# LOGIFI™ ERP · Módulo CRM + Agentes IA

> CRM B2B con sistema multi-agente IA, inbox unificado WhatsApp + Telegram + Gmail, pipeline visual, forecasting predictivo y conversation intelligence.
> Diseñado por **KallpaPro Soluciones Integrales** para PyMES y empresas medianas en Ecuador y Latinoamérica.

---

## 🎯 Propuesta de valor

LOGIFI™ CRM no es "otro CRM con IA" — es un sistema multi-agente diseñado para que la IA sea el **músculo principal de ventas**, con humanos en el loop solo donde añaden valor real (cierre de deals grandes, casos delicados, decisiones estratégicas).

### Compite directamente contra:
- **Kommo** ($15-49/usuario/mes) · #1 messenger CRM global
- **HubSpot Sales Hub + Breeze AI** ($45-1500/mes) · estándar enterprise
- **Harmonix AI** · omnichannel embebido en CRM existente
- **Zoho CRM Plus + Zia** ($40-50/usuario/mes)
- **Pipedrive + AI** ($14-99/usuario/mes)

### Diferenciadores LOGIFI™ CRM
- ✅ **Sistema multi-agente real** (no un chatbot disfrazado): Router IA + 5 agentes especializados (SDR, Researcher, Copywriter, Closer, Success)
- ✅ **Autonomía configurable por etapa**: Autopilot total cuando aplica, Setter-Closer cuando hay riesgo, Manual cuando lo decides
- ✅ **Inbox unificado real** vía Unipile API: WhatsApp + Telegram + Gmail + LinkedIn (próximo)
- ✅ **Forecasting predictivo** con Claude entrenado en tu histórico
- ✅ **Conversation intelligence** con sentiment + objeciones + action items
- ✅ **Integración nativa** con resto de módulos LOGIFI (Compras, Inventario, Financiero, TMS)
- ✅ **Cumplimiento Ecuador**: SRI Form 101/103/104, RUC validation, factura electrónica
- ✅ **Apps móviles** iOS + Android nativas (Q3 2026)

---

## 🧩 Lo que entrega

### 1. Inbox unificado multi-canal
- **WhatsApp Business Cloud API** vía Unipile (mensajes, plantillas, voice notes)
- **Telegram Bot API** (gratis, ilimitado)
- **Gmail API** (con OAuth2, hilos, etiquetas)
- **LinkedIn DMs** (próximo, vía Unipile)
- Cada conversación enriquecida con contexto del CRM en tiempo real

### 2. Pipeline visual con drag·n·drop
- 6 etapas configurables (Lead → Cualificado → Reunión → Propuesta → Negociación → Ganado)
- Score IA por deal (0-100)
- Indicadores visuales de canal, urgencia y agente asignado
- Vista lista + Kanban + Timeline

### 3. Sistema multi-agente IA
| Agente | Rol | Tools |
|--------|-----|-------|
| **Router** | Orquestador maestro | classify_intent, fetch_context, delegate |
| **Sofía · SDR** | Cualifica + agenda | qualify_bant, check_calendar, send_template |
| **Iván · Researcher** | Inteligencia comercial | web_search, enrich_company, detect_signals |
| **Camila · Copywriter** | Propuestas + outbound | generate_proposal, personalize, create_template |
| **Andrés · Closer** | Negocia + cierra | handle_objection, generate_counter, request_approval |
| **Lucía · Success** | Post-venta + retención | monitor_health, trigger_qbr, detect_churn |

### 4. Automatizaciones visuales (workflows)
- Welcome lead caliente · respuesta &lt;60s
- Recordatorio demo (24h + 1h)
- Rescate deal estancado (7+ días)
- Onboarding nuevo cliente (30 días)
- Detección signals compra (pricing visit ≥3)

### 5. Forecasting IA
- Proyección 90 días por categoría (Comprometido / Probable / Posible / Long shot)
- Confianza global del modelo (0-100%)
- Top deals que mueven el forecast
- Alertas de riesgo y concentración

### 6. Conversation intelligence
- Transcripción automática de Zoom/Meet/calls WhatsApp
- Sentiment timeline (visual)
- Detección de temas, objeciones, commitments
- Action items extraídos automáticamente

### 7. Apps móviles iOS + Android (Q3 2026)
- React Native + TypeScript
- Notificaciones push inteligentes (filtradas por IA)
- Dictado por voz + IA refina
- Modo offline con SQLite
- Mismo inbox unificado que web

---

## 🏗 Arquitectura técnica

### Stack
- **Backend:** Node.js >= 18 + Express >= 4.18
- **Base de datos:** PostgreSQL >= 14 (esquema `crm`)
- **Mensajería:** Unipile API (https://www.unipile.com)
- **IA:** Claude Sonnet 4 (`@anthropic-ai/sdk`) con function calling
- **Tiempo real:** WebSocket / Server-Sent Events
- **Cola de mensajes:** BullMQ + Redis (para rate limiting de Unipile)
- **Frontend móvil:** React Native + Expo (fase 2)

### Diagrama de integración

```
                    ┌─────────────────────────────────┐
                    │  CANALES EXTERNOS               │
                    │  WhatsApp · Telegram · Gmail    │
                    │  LinkedIn (próximo)             │
                    └───────────┬─────────────────────┘
                                ↓ webhooks
                    ┌─────────────────────────────────┐
                    │  UNIPILE API (unificación)      │
                    │  https://api.unipile.com        │
                    └───────────┬─────────────────────┘
                                ↓ webhook único
                    ┌─────────────────────────────────┐
                    │  LOGIFI™ CRM Backend            │
                    │  Express + Node.js              │
                    │                                  │
                    │  /api/crm/webhooks/unipile      │
                    │  ↓                              │
                    │  Router Agent (Claude)          │
                    │  ↓                              │
                    │  ┌─────────────────────────┐    │
                    │  │ SDR · Researcher ·      │    │
                    │  │ Copywriter · Closer ·   │    │
                    │  │ Success                 │    │
                    │  └─────────────────────────┘    │
                    │  ↓                              │
                    │  PostgreSQL (esquema crm)       │
                    │  + WebSocket → Frontend         │
                    └─────────────────────────────────┘
                                ↓
              ┌─────────────────────────────────┐
              │  Frontend (HTML/Vue/React)      │
              │  Mobile (React Native, Q3)      │
              └─────────────────────────────────┘
                                ↓
              ┌─────────────────────────────────┐
              │  ERP LOGIFI · módulos hermanos  │
              │  Compras · Inventario · TMS ·   │
              │  Financiero (savings sync)      │
              └─────────────────────────────────┘
```

---

## 📁 Estructura del paquete

```
logifi_crm/
├── CRM_README.md                ← Este archivo
├── LOGIFI_ERP_CRM.html          ← UI completa con 8 vistas
├── crm_integration_schema.json  ← Esquemas DB + endpoints REST
├── CRM_INTEGRATION_GUIDE.md     ← Guía paso a paso para Claude Code
└── AI_AGENTS_GUIDE.md           ← Configuración detallada agentes + prompts
```

---

## 💼 Pricing modular sugerido

Este módulo se factura como **add-on premium** sobre el plan base de LOGIFI™. Toma como referencia el spread real del mercado:

| Tier | Funciones incluidas | Precio (USD/mes) |
|------|---------------------|------------------|
| **Starter** | CRM + 1 canal + 1 agente IA básico | +$120 |
| **Growth** | + Pipeline visual + 3 canales + 3 agentes | +$280 |
| **Pro** | + Forecasting + Workflows + 6 agentes + sentiment | +$480 |
| **Enterprise** | Todo + apps móviles + custom prompts + SLA | +$880 |

**Comparativo del mercado 2026:**
- Kommo Enterprise: ~$45/usuario/mes × 10 = $450/mes
- HubSpot Sales Hub Enterprise: $1500/mes desde
- Salesforce Sales Cloud Enterprise: $165/usuario/mes
- Harmonix AI: $79/usuario/mes (mínimo $790/mes)

LOGIFI™ Pro a $480/mes con TODAS las features = **2-3x más barato** que la competencia comparable, con la ventaja de estar nativamente integrado al resto del ERP.

---

## ⚙️ Costos operativos a considerar

### Unipile API (mensajería unificada)
- Plan startup: **$99/mes** (5 cuentas conectadas, 50K eventos/mes)
- Plan business: **$299/mes** (20 cuentas, 200K eventos/mes)
- Plan scale: **$799/mes** (100 cuentas, 1M eventos/mes)
- **Estos costos los absorbe KallpaPro y se reflejan en el precio del plan al cliente final.**

### WhatsApp Business (a través de Unipile)
- Mensajes service (24h ventana): **GRATIS**
- Templates marketing (Latam): ~$0.016-0.020 por mensaje delivered
- Templates utility (Latam): ~$0.008-0.012
- Templates auth (OTP): ~$0.005

### Claude API (agentes IA)
- Claude Sonnet 4: $3 input + $15 output por 1M tokens
- Estimado por conversación cualificada: ~5K tokens = **$0.05-0.10 USD**
- Por mes con 1000 conversaciones: ~**$50-100 USD**

### Telegram Bot API
- 100% **GRATIS** (sin límites prácticos)

### Gmail API
- 100% **GRATIS** (1B quotas/día, suficiente para SMB)

**Costo total estimado por cliente Pro/mes:** $130-180 (Unipile + WA messages + Claude + infra). Margen del módulo: **65-72%**.

---

## 📋 Vistas disponibles (8)

| # | Vista | Ruta sugerida | Endpoint principal |
|---|-------|---------------|--------------------|
| 1 | Dashboard de ventas | `/crm/dashboard` | `GET /api/crm/dashboard` |
| 2 | Inbox unificado | `/crm/inbox` | `GET /api/crm/conversations` |
| 3 | Pipeline visual | `/crm/pipeline` | `GET /api/crm/deals` |
| 4 | Agentes IA | `/crm/agents` | `GET /api/crm/agents` |
| 5 | Automatizaciones | `/crm/automations` | `GET /api/crm/workflows` |
| 6 | Forecasting IA | `/crm/forecast` | `GET /api/crm/forecast` |
| 7 | Conversation intel. | `/crm/intelligence` | `GET /api/crm/intelligence/:conv` |
| 8 | Apps móviles config | `/crm/mobile` | `GET /api/crm/mobile/config` |

---

## 🚀 Cómo integrarlo en tu ERP

Ver **`CRM_INTEGRATION_GUIDE.md`** para el plan completo en 7 fases.

Resumen ejecutivo:

1. **Setup Unipile** — crear cuenta, conectar WA Business + Telegram bot + Gmail (1-2 días)
2. **Crear esquema DB** — ejecutar SQL del `crm_integration_schema.json` (1 día)
3. **Implementar webhook unificado** — recibir mensajes de Unipile → procesarlos (3 días)
4. **Sistema multi-agente** — implementar Router + 6 agentes según `AI_AGENTS_GUIDE.md` (5-7 días)
5. **Endpoints REST** — exponer todas las rutas del schema (4-5 días)
6. **Frontend** — portar HTML a Vue/React (10-14 días)
7. **Apps móviles** — React Native (fase 2, Q3 2026)

**Tiempo total estimado:** 100-140 horas backend + 80-120 horas frontend + 200-280 horas mobile (fase 2).

---

## 🤖 Capacidades IA destacadas

- **Lead scoring automático**: BANT score + signals comportamiento + sector + tamaño empresa
- **Routing inteligente**: cada mensaje al agente IA correcto en menos de 0.5s
- **Conversation orchestration**: múltiples agentes pueden colaborar en un mismo deal
- **Forecasting predictivo**: modelo entrenado con histórico del cliente
- **Sentiment analysis**: en cada mensaje, in-line, con escalación automática
- **Action items extraction**: post-call automatic
- **Personalization at scale**: cada email/WA personalizado con datos enriquecidos del lead

---

## 📞 Contacto técnico

**KallpaPro Soluciones Integrales**
Guayaquil · Ecuador
- **Ing. Cristhan Matamoros** — Tecnología & Operaciones
- **CPA. Steven Sánchez C.** — Finanzas & Estrategia

---

## 📜 Versión

**Versión:** 1.0.0
**Fecha:** Mayo 2026
**Compatibilidad:** Node.js ≥ 18 · PostgreSQL ≥ 14 · Express ≥ 4.18 · Anthropic SDK ≥ 0.27 · Unipile API v1
