# LOGIFI™ CRM · Guía de integración con Claude Code

> Esta guía te lleva paso a paso para integrar el módulo CRM + Agentes IA en tu ERP LOGIFI existente. Está pensada para ejecutarse con [Claude Code](https://docs.claude.com/claude-code) usando los prompts indicados.

---

## 🎯 Pre-requisitos

Antes de empezar, asegúrate de tener:

- ✅ ERP base LOGIFI corriendo (módulos Compras, Inventario, Financiero ya integrados)
- ✅ Stack: Node.js ≥ 18, Express ≥ 4.18, PostgreSQL ≥ 14
- ✅ Cuenta Anthropic API con créditos (https://console.anthropic.com)
- ✅ Cuenta Unipile (https://www.unipile.com — plan startup mínimo)
- ✅ Cuenta Meta Business + WhatsApp Business verificada
- ✅ Bot de Telegram creado (vía @BotFather)
- ✅ Cuenta Gmail empresarial con OAuth2 configurado
- ✅ Redis ≥ 6 corriendo (para BullMQ)
- ✅ Claude Code instalado (`npm install -g @anthropic-ai/claude-code`)

### Variables de entorno necesarias (`.env`)

```bash
# Existentes (ya configuradas en ERP base)
DATABASE_URL=postgresql://user:pass@host:5432/logifi
JWT_SECRET=...
ANTHROPIC_API_KEY=sk-ant-...

# Nuevas para CRM
UNIPILE_API_KEY=your_unipile_workspace_key
UNIPILE_DSN=apiN.unipile.com:13NNN
UNIPILE_WEBHOOK_SECRET=hmac_secret_for_signature_validation

REDIS_URL=redis://localhost:6379

# Agentes IA - configuración
CRM_AI_DEFAULT_MODEL=claude-sonnet-4-20250514
CRM_AI_ROUTER_MODEL=claude-haiku-4-5-20251001
CRM_AI_ESCALATION_THRESHOLD_USD=30000

# Apps móviles (fase 2)
ONESIGNAL_APP_ID=...
ONESIGNAL_API_KEY=...
```

---

## 🛣 Plan de implementación · 7 fases

| Fase | Duración | Foco |
|------|----------|------|
| 1 | 1-2 días | Setup Unipile + canales |
| 2 | 1 día | Esquema DB + migraciones |
| 3 | 3 días | Webhook unificado + ingestión |
| 4 | 5-7 días | Sistema multi-agente IA |
| 5 | 4-5 días | Endpoints REST completos |
| 6 | 10-14 días | Frontend Vue/React |
| 7 (fase 2) | 200-280h | Apps móviles React Native |

**Total fase 1-6:** ~100-140h backend + 80-120h frontend.

---

## FASE 1 · Setup Unipile + canales (1-2 días)

### 1.1 Crear cuenta Unipile y obtener API key

1. Sign up en https://www.unipile.com (plan **startup $99/mes** suficiente para comenzar)
2. Crear un workspace
3. Generar API key en `Settings → API Keys`
4. Anotar el `DSN` (formato `apiN.unipile.com:13NNN`)
5. Añadir a `.env`

### 1.2 Conectar canales

#### WhatsApp Business
```bash
# El cliente final hará esto desde el frontend, pero para testing:
curl -X POST "https://${UNIPILE_DSN}/api/v1/accounts" \
  -H "X-API-KEY: ${UNIPILE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"provider":"WHATSAPP"}'

# Devuelve un QR code base64. Escanéalo desde tu WhatsApp Business.
```

#### Telegram Bot
1. Crear bot en Telegram con `@BotFather` → guardar `BOT_TOKEN`
2. Conectar a Unipile:
```bash
curl -X POST "https://${UNIPILE_DSN}/api/v1/accounts" \
  -H "X-API-KEY: ${UNIPILE_API_KEY}" \
  -d '{"provider":"TELEGRAM","credentials":{"bot_token":"YOUR_BOT_TOKEN"}}'
```

#### Gmail
1. Configurar OAuth2 en Google Cloud Console (scopes: `gmail.readonly`, `gmail.send`, `gmail.modify`)
2. Conectar a Unipile vía OAuth flow

### 1.3 Registrar webhook URL

```bash
curl -X POST "https://${UNIPILE_DSN}/api/v1/webhooks" \
  -H "X-API-KEY: ${UNIPILE_API_KEY}" \
  -d '{
    "url":"https://your-erp.com/api/crm/webhooks/unipile",
    "events":["message.received","message.delivered","message.read","account.error"]
  }'
```

---

## FASE 2 · Esquema DB + migraciones (1 día)

### 2.1 Prompt para Claude Code

```
Tengo un proyecto Node.js + Express + PostgreSQL en este directorio. Voy a integrar
un módulo CRM nuevo. Adjunto el archivo `crm_integration_schema.json` con el esquema
completo.

Por favor:

1. Crea las migraciones SQL en /migrations/crm/ siguiendo la convención del proyecto.
   Una migración por tabla (16 tablas en total bajo schema `crm`).
2. Genera el script de creación del schema `crm` y todas las tablas con sus
   constraints, indexes, FK y check constraints.
3. Crea los seeds iniciales para la tabla `crm.agents` con los 6 agentes definidos
   (router, sdr, researcher, copywriter, closer, success).
4. Genera las materialized views: mv_pipeline_summary, mv_agent_performance,
   mv_conversion_funnel.
5. Crea un cron job en /jobs/refresh-crm-mvs.js que refresque las MVs según el
   intervalo definido en cada una.
6. Asegúrate de que las FK a core.users y core.companies estén correctas según mi
   ERP existente.

Antes de generar nada, revisa la estructura actual de mi proyecto y dime qué
convenciones detectaste para que las apliques.
```

### 2.2 Validación

```bash
# Ejecutar migraciones
npm run migrate

# Verificar tablas creadas
psql $DATABASE_URL -c "\dt crm.*"

# Debe mostrar las 16 tablas: contacts, companies, deals, deal_stage_history,
# conversations, messages, agents, agent_runs, workflows, workflow_runs,
# calls_transcripts, lead_scores, forecasts, templates
```

---

## FASE 3 · Webhook unificado + ingestión (3 días)

Este es el **punto de entrada crítico**. Todos los mensajes del mundo entran aquí.

### 3.1 Prompt para Claude Code

```
Voy a implementar el webhook unificado de Unipile. Necesito:

1. Endpoint POST /api/crm/webhooks/unipile en routes/crm/webhooks.js
2. Middleware de validación de firma HMAC-SHA256:
   - Header: X-Unipile-Signature
   - Secret: process.env.UNIPILE_WEBHOOK_SECRET
   - Si firma inválida → 401
3. Manejo idempotente: cada evento tiene un `id`, guarda IDs procesados en
   Redis con TTL 24h. Si llega duplicado → return 200 sin procesar.
4. Switch por tipo de evento:
   - message.received → handleInboundMessage(payload)
   - message.delivered → updateMessageStatus(payload, 'delivered')
   - message.read → updateMessageStatus(payload, 'read')
   - account.error → notifyAdmin + log

5. handleInboundMessage debe:
   a. Resolver o crear el contact (por whatsapp_id, telegram_id o email)
   b. Resolver o crear la company (si tiene RUC en mensaje, validar contra SRI)
   c. Encontrar o crear la conversation (key = unipile_chat_id)
   d. Insertar el message con direction='inbound'
   e. Emitir evento WS crm:inbox:user:{ownerId} → message:new
   f. Si conversation.ai_handling=true:
      - Encolar job en BullMQ: queue 'crm-router'
      - El job invoca al Router IA (siguiente fase)
   g. Retornar 200 inmediatamente (idempotencia + speed)

6. updateMessageStatus debe actualizar el status del mensaje y emitir WS
   crm:inbox:user:{ownerId} → message:status_update.

Stack actual: Express, BullMQ, ioredis, pg con knex. Usa exactamente esas
librerías. Maneja errores con try/catch que loguean a Sentry pero siempre
retornan 200 para no provocar retries de Unipile.
```

### 3.2 Tests críticos

```javascript
// tests/crm/webhook.test.js — pídele a Claude Code que cree estos tests:
describe('POST /api/crm/webhooks/unipile', () => {
  it('rechaza request sin firma válida (401)')
  it('procesa message.received y crea contact + conversation + message')
  it('es idempotente con el mismo event id')
  it('encola job en crm-router cuando ai_handling=true')
  it('emite evento WebSocket message:new al owner')
  it('retorna 200 en menos de 500ms (latencia crítica)')
  it('actualiza status en message.delivered y message.read')
})
```

---

## FASE 4 · Sistema multi-agente IA (5-7 días)

Esta es la fase más compleja. Construye el cerebro del CRM.

### 4.1 Estructura de archivos

```
src/crm/
├── agents/
│   ├── base.js              ← BaseAgent: invoke(), with tools, with retries
│   ├── router.js            ← Router · clasifica intent + delega
│   ├── sdr.js               ← Sofía · cualifica + agenda
│   ├── researcher.js        ← Iván · investiga lead
│   ├── copywriter.js        ← Camila · genera propuestas
│   ├── closer.js            ← Andrés · negocia + cierra
│   └── success.js           ← Lucía · post-venta
├── tools/
│   ├── classify_intent.js
│   ├── fetch_lead_context.js
│   ├── delegate_to_agent.js
│   ├── qualify_bant.js
│   ├── check_calendar.js
│   ├── send_template.js
│   ├── create_meeting.js
│   ├── enrich_company.js
│   ├── detect_signals.js
│   ├── validate_ruc.js
│   ├── generate_proposal.js
│   ├── handle_objection.js
│   ├── close_deal.js
│   └── ...
├── workers/
│   ├── crm-router.worker.js  ← BullMQ worker que recibe inbound msgs
│   └── crm-workflows.worker.js
└── prompts/
    └── (cargados desde DB crm.agents.system_prompt)
```

### 4.2 Prompt para Claude Code · BaseAgent

```
Implementa src/crm/agents/base.js con la clase BaseAgent.

Requerimientos:
1. Constructor recibe { code } y carga la config desde crm.agents WHERE code = ?
   (system_prompt, model, max_tokens, temperature, tools, autonomy_default)
2. Método invoke(context) que:
   a. Construye el array de messages para Claude API:
      [
        { role: 'user', content: buildContextString(context) }
      ]
      donde buildContextString incluye: lead profile, company, recent messages,
      active deals, buying signals.
   b. Llama a Anthropic API con anthropic.messages.create({
        model, max_tokens, temperature, system: system_prompt, messages, tools
      })
   c. Si la respuesta tiene tool_use blocks → ejecuta cada tool en src/crm/tools/{name}.js
   d. Pasa los tool_result al modelo y sigue el loop hasta stop_reason='end_turn'
   e. Registra TODO en crm.agent_runs (input_context, output, tools_called,
      tokens_input, tokens_output, cost_usd, latency_ms, status)
   f. Retorna { reply, actions, escalate, requires_approval }
3. Método respondTo(conversationId) que:
   - Carga el contexto completo
   - Verifica autonomy_mode del deal o conversación
   - Si autonomy_mode='autopilot' → invoca y envía respuesta directamente
   - Si 'setter_closer' y deal.amount > escalation_threshold → escala a humano
   - Si 'semi_assisted' → guarda como sugerencia, espera approval del usuario
   - Si 'manual' → solo registra sugerencia visible, no envía nada

Calcula cost_usd con las constantes en crm_integration_schema.json:
  cost = tokens_input * 3/1000000 + tokens_output * 15/1000000  (Sonnet 4)
  cost = tokens_input * 0.8/1000000 + tokens_output * 4/1000000  (Haiku 4.5)

Incluye reintentos exponenciales (3 intentos) si Claude API falla. Si falla
definitivamente, registra agent_run con status='failed' y escala a humano.
```

### 4.3 Prompt para Claude Code · Router

```
Implementa src/crm/agents/router.js extendiendo BaseAgent.

El Router es el orquestador. Su system_prompt está en crm.agents WHERE code='router'
(ver AI_AGENTS_GUIDE.md para el contenido).

Comportamiento esperado:
1. Recibe un mensaje inbound + contexto
2. Llama classify_intent(message) → { intent, confidence, urgency }
3. Llama fetch_lead_context(contact_id) → datos enriquecidos
4. Decide qué agente especialista activar usando esta lógica:
   - intent=question + lead_score<50 → sdr (cualificar primero)
   - intent=question + lead_score>=50 → sdr o copywriter según deal stage
   - intent=interest + no deal → sdr (crea deal y agenda)
   - intent=interest + deal exists → closer
   - intent=objection → closer
   - intent=commitment → closer (registra commitment) + agendar siguiente paso
   - intent=complaint + customer → success (recovery mode)
   - intent=other → sdr por default
5. Invoca al agente con delegate_to_agent(agent_code, context)
6. Si confidence<0.7 → puede invocar 2 agentes en paralelo y elegir el mejor
7. Si urgency=high → ignora autonomy_mode, escala inmediatamente a humano

Modelo: usa claude-haiku-4-5-20251001 para el Router (latencia crítica). Los
agentes especialistas usan Sonnet 4.

Tiempo de respuesta objetivo: <500ms para la decisión de routing.
```

### 4.4 Prompts para los 5 agentes especialistas

Ver `AI_AGENTS_GUIDE.md` para los **system prompts completos en español** de cada uno de los 6 agentes (Router, Sofía SDR, Iván Researcher, Camila Copywriter, Andrés Closer, Lucía Success), junto con sus tool definitions en formato Anthropic function calling.

### 4.5 Worker de BullMQ

```
Implementa src/crm/workers/crm-router.worker.js

Es un worker de BullMQ que consume la queue 'crm-router'. Cada job contiene:
{ message_id, conversation_id }.

Lógica:
1. Cargar el message + conversation + contact + company + recent messages
2. Construir contexto completo
3. Instanciar Router agent y llamar router.respondTo(conversationId)
4. El Router internamente delega al especialista correcto
5. Si el especialista retorna actions, ejecutarlas (enviar mensaje, agendar, etc.)
6. Si requires_approval=true, NO envíes — emite WS para que humano apruebe

Concurrency: 5 workers simultáneos.
Rate limit: respeta los límites de Unipile (80 msgs/seg WhatsApp inicial, ajustable).
Timeout: 60s por job. Si timeout → escalate a humano.

Retry policy: 3 intentos con backoff exponencial (1s, 5s, 25s). Después de 3 fallos
→ dead letter queue + alerta admin.
```

---

## FASE 5 · Endpoints REST (4-5 días)

### 5.1 Prompt para Claude Code

```
Implementa todos los endpoints REST listados en crm_integration_schema.json
sección "rest_api.endpoints".

Convenciones:
- Routes en routes/crm/{resource}.js (deals.js, contacts.js, conversations.js, etc.)
- Controllers en controllers/crm/{resource}.controller.js
- Services en services/crm/{resource}.service.js
- DTOs/Validators con zod en validators/crm/
- Middleware de permisos: authorize('crm.deals.view') etc.

Para cada endpoint:
1. Validar body/query con zod schema
2. Verificar permisos vía middleware authorize()
3. Llamar al service correspondiente
4. Retornar respuesta tipada con HTTP status correcto
5. Manejar errores con next(err) → handler global → 4xx/5xx + log Sentry

Endpoints críticos a priorizar:
- GET /api/crm/dashboard
- GET /api/crm/conversations
- POST /api/crm/conversations/:id/messages
- GET /api/crm/deals
- PATCH /api/crm/deals/:id/stage
- GET /api/crm/forecast
- POST /api/crm/companies/validate-ruc

Para validate-ruc, usa el servicio existente del módulo Financiero
(POST /api/financiero/sri/validate-ruc) — no dupliques la lógica.

Genera tests de integración para cada endpoint con supertest.
```

### 5.2 WebSocket setup

```
Configura el WebSocket server en src/crm/ws/server.js usando ws (ya instalado
en el ERP base).

Channels a implementar (ver schema):
- crm:inbox:user:{userId}
- crm:pipeline:tenant:{tenantId}
- crm:agents:tenant:{tenantId}
- crm:forecast:tenant:{tenantId}

Autenticación: JWT en query param ?token=... validado al conectar.
Si JWT inválido → cerrar con código 4001.

Implementa un EventEmitter central en src/crm/ws/events.js que cualquier
servicio puede usar:
  emit('crm:inbox:user:abc-123', { type: 'message:new', payload: {...} })

Y el WS server lo retransmite al cliente conectado correspondiente.
```

---

## FASE 6 · Frontend (10-14 días)

### 6.1 Convertir HTML a componentes

El archivo `LOGIFI_ERP_CRM.html` tiene **8 vistas completas con CSS y diseño final**. Úsalo como referencia visual y portea a tu framework (Vue / React).

```
Toma el archivo LOGIFI_ERP_CRM.html que tiene las 8 vistas del módulo CRM
diseñadas con HTML + CSS puro. Necesito portarlas a [Vue 3 / React 18] con:

1. TailwindCSS (extender el theme con los design tokens del CSS:
   --ink, --paper, --gold, --rust, --moss, --sky, --plum, --wa, --tg, --gm)
2. Pinia / Zustand para estado global
3. TanStack Query para fetching/caching de la API
4. Socket.io-client o native WebSocket para tiempo real
5. dnd-kit / vue-draggable-next para el pipeline kanban

Estructura sugerida:
src/views/crm/
├── DashboardView.vue / .tsx        ← view 1
├── InboxView.vue / .tsx            ← view 2 (más compleja)
├── PipelineView.vue / .tsx         ← view 3 (drag·n·drop)
├── AgentsView.vue / .tsx           ← view 4
├── AutomationsView.vue / .tsx      ← view 5
├── ForecastView.vue / .tsx         ← view 6 (chart con Recharts/D3)
├── IntelligenceView.vue / .tsx     ← view 7
└── MobileConfigView.vue / .tsx     ← view 8

components/crm/
├── ConversationList.vue
├── ConversationThread.vue
├── AISuggestionPanel.vue
├── LeadContextSidebar.vue
├── DealCard.vue
├── KanbanColumn.vue
├── AgentCard.vue
├── WorkflowCard.vue
├── ForecastChart.vue
└── TranscriptViewer.vue

Cada componente con responsive completo, accessibility (ARIA), y animaciones
sutiles (fade, slide, scale).

Empieza por DashboardView + InboxView (las dos más críticas). Luego me muestras
para revisar antes de seguir con las 6 restantes.
```

### 6.2 Tiempo real

```
En el inbox y pipeline, conecta el WebSocket al montar:

useWebSocket() {
  const socket = new WebSocket(`${WS_URL}?token=${getJWT()}`)
  socket.onmessage = (event) => {
    const { type, payload } = JSON.parse(event.data)
    switch (type) {
      case 'message:new':
        queryClient.invalidateQueries(['conversations'])
        queryClient.setQueryData(['conversation', payload.conversation_id], ...)
        playNotificationSound() // si no es del usuario actual
        break
      case 'deal:stage_changed':
        queryClient.invalidateQueries(['deals'])
        break
      // ...
    }
  }
}
```

---

## FASE 7 · Apps móviles iOS + Android (Q3 2026 · fase 2)

```
Cuando comencemos la fase 2 del proyecto:

1. Inicializar React Native + Expo:
   npx create-expo-app logifi-mobile --template

2. Instalar:
   - @tanstack/react-query
   - zustand
   - socket.io-client
   - react-native-webview
   - expo-notifications
   - expo-sqlite (para offline)
   - onesignal-react-native

3. Reutilizar 100% de los endpoints REST y WebSocket del backend.

4. Estructura inspirada en la web:
   app/
   ├── (auth)/
   ├── (tabs)/
   │   ├── inbox.tsx     ← simplified de InboxView
   │   ├── pipeline.tsx  ← cards verticales en lugar de kanban horizontal
   │   ├── deals.tsx
   │   └── more.tsx
   ├── conversation/[id].tsx
   └── deal/[id].tsx

5. Notificaciones push con OneSignal:
   - Configurar tags por usuario: ai_alert_level, channel_priority
   - El backend dispara notificación cuando:
     a. Lead caliente nuevo asignado al user
     b. Deal estancado >7 días
     c. Sentiment negativo detectado
     d. Demo en 1h (recordatorio)

6. Offline mode:
   - Cachear las últimas 100 conversaciones + deals activos en SQLite
   - Acciones offline (cambiar stage, enviar mensaje) van a queue local
   - Al reconectar → sync con backend, resolución de conflictos last-write-wins

Estimado fase 2: 200-280 horas (iOS + Android compartiendo 90% código).
```

---

## ✅ Checklist de validación post-integración

Antes de mover a producción:

- [ ] Las 16 tablas de DB están creadas con índices y FK
- [ ] Los 6 agentes están en `crm.agents` con prompts cargados
- [ ] Webhook de Unipile recibe y procesa mensajes (probar manualmente)
- [ ] Router IA clasifica intents correctamente (>95% accuracy en muestra)
- [ ] WhatsApp service window de 24h se respeta (no enviar templates innecesarios)
- [ ] Validación de RUC contra SRI funciona
- [ ] Pipeline drag·n·drop emite WS y actualiza DB
- [ ] Forecasting recalcula cada noche (cron job)
- [ ] Conversation intelligence extrae action items de transcripts
- [ ] Tests de integración pasan al 100%
- [ ] Logs de agent_runs registran cost_usd correctamente
- [ ] Permisos RBAC bloquean accesos no autorizados
- [ ] Performance: dashboard carga &lt;2s, inbox carga &lt;1.5s
- [ ] Sentry captura errores backend y frontend
- [ ] Backup automático de DB cada 6h

---

## 🚨 Errores comunes y cómo evitarlos

| Error | Causa | Solución |
|-------|-------|----------|
| Webhook duplica mensajes | No se valida idempotencia | Usar Redis con TTL 24h por event id |
| WhatsApp template rechazado | Template marketing sin opt-in | Usar utility templates dentro de service window |
| Cost IA explotó | Router con Sonnet en lugar de Haiku | Cambiar Router a `claude-haiku-4-5-20251001` |
| Agente IA responde fuera de contexto | Context insuficiente | Incluir últimos 50 msgs + lead profile + deals |
| Drag·n·drop no persiste | No se llama PATCH /deals/:id/stage | Optimistic update + rollback en error |
| Sentiment incorrecto en español | Modelo en inglés | Usar Sonnet 4 con prompt en español |
| Forecast inflado | Ponderación sin probability real | Usar `probability` del deal × `amount_usd` |

---

## 📞 Soporte

Si Claude Code se atasca o necesitas guía adicional:

1. Revisa primero `crm_integration_schema.json` (fuente de verdad de la estructura)
2. Revisa `AI_AGENTS_GUIDE.md` para los prompts y tools de cada agente
3. Documentación oficial:
   - Anthropic API: https://docs.claude.com/api
   - Unipile: https://developer.unipile.com/docs
   - WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
   - BullMQ: https://docs.bullmq.io

---

**Última actualización:** Mayo 2026
**Versión:** 1.0.0
