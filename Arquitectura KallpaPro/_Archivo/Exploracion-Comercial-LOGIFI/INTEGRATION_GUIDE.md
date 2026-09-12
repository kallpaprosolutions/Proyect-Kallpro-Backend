# INTEGRATION_GUIDE.md
## Guía de integración para Claude Code · Módulo Financiero LOGIFI™

> Este documento está escrito específicamente para que **Claude Code** lo lea y guíe la integración nativa del módulo financiero con tu ERP existente (Node.js + Express + PostgreSQL).
>
> Si eres un desarrollador humano, también puedes seguir esta guía paso a paso.

---

## 📋 Contexto que Claude Code debe absorber primero

Antes de escribir código, lee en este orden:

1. **`README.md`** — Overview del módulo y su propósito
2. **`integration_schema.json`** — Esquema técnico completo (DB + endpoints)
3. **`KPI_FORMULAS.md`** — Diccionario de las 60+ fórmulas con justificación NIIF
4. **`LOGIFI_ERP_Financiero.html`** — Las 8 vistas con comentarios `[ROUTE:]` y `[API:]`
5. **Este archivo** — La guía paso a paso

---

## 🎯 Prompt maestro para Claude Code

Cuando inicies el trabajo, comienza con este prompt:

```
Necesito integrar el módulo financiero LOGIFI™ a mi ERP existente. El stack
es Node.js + Express + PostgreSQL con API REST tradicional. Ya tengo módulos
de Compras, Inventario, Ventas y Logística funcionando con sus respectivas
tablas y endpoints.

Lee en este orden:
1. /logifi_financiero/README.md
2. /logifi_financiero/integration_schema.json
3. /logifi_financiero/KPI_FORMULAS.md
4. /logifi_financiero/LOGIFI_ERP_Financiero.html (busca comentarios [ROUTE:] y [API:])

Después implementa siguiendo la fase 1 de INTEGRATION_GUIDE.md. No avances
a la fase 2 hasta que yo confirme que los tests de fase 1 pasaron.
```

---

## 🚀 Plan de implementación · 6 fases

### FASE 1 · Esquema de base de datos (2-4 días)

**Objetivo:** Crear el esquema `finance` con todas las tablas, vistas materializadas y triggers.

#### Paso 1.1 · Crear esquema y tablas base

Prompt sugerido para Claude Code:

```
Lee integration_schema.json sección "database_schema". Genera un archivo
de migración SQL en /migrations/finance/001_create_schema.sql que contenga:

1. CREATE SCHEMA finance
2. Las 10 tablas listadas (chart_of_accounts, journal_entries, journal_lines,
   cost_centers, budgets, savings_log, dcf_models, scenarios, sri_filings,
   three_way_match)
3. Todos los indexes especificados
4. Todas las constraints (CHECK, FOREIGN KEY, UNIQUE)

Asegúrate de que las foreign keys apunten correctamente a las tablas
existentes core.tenants, purchasing.orders, etc. Si alguna tabla origen
no existe en mi proyecto actual, déjala como referencia comentada
y avísame al final.
```

#### Paso 1.2 · Plan de cuentas NIIF Ecuador

Prompt sugerido:

```
Genera /migrations/finance/002_seed_chart_of_accounts.sql con un plan
de cuentas estándar para PyMES en Ecuador siguiendo la estructura de la
Superintendencia de Compañías. Incluye:

- 1 = ACTIVO (1.1 corriente, 1.2 no corriente)
- 2 = PASIVO (2.1 corriente, 2.2 no corriente)
- 3 = PATRIMONIO
- 4 = INGRESOS
- 5 = COSTOS
- 6 = GASTOS

Usa códigos jerárquicos de 4-6 niveles (ej: 1.1.01.001 = Caja general).
Marca con niif_reference las cuentas que mapean a NIC/NIIF específicas
(NIC 2 inventarios, NIC 16 PPE, NIC 38 intangibles, NIIF 9 instrumentos
financieros, NIIF 15 ingresos, NIC 19 beneficios empleados).

El seed debe ser parametrizado por tenant_id (los cliente nuevos tendrán
una copia automática).
```

#### Paso 1.3 · Vistas materializadas

```
Para cada vista listada en integration_schema.json sección
"materialized_views", genera el SQL CREATE MATERIALIZED VIEW.

Importante:
- Usar CONCURRENTLY en los REFRESH para no bloquear lecturas
- Crear índices únicos sobre cada vista (requisito PostgreSQL para CONCURRENTLY)
- Las vistas deben joinear con tablas de purchasing, inventory, sales y tms

Ejemplo de fórmula para mv_balance_sheet:
SELECT
  account_id,
  SUM(CASE WHEN account_type IN ('ACTIVO','GASTO','COSTO')
      THEN debit - credit ELSE credit - debit END) as balance
FROM finance.journal_lines jl
JOIN finance.journal_entries je ON jl.entry_id = je.id
JOIN finance.chart_of_accounts coa ON jl.account_id = coa.id
WHERE je.status = 'POSTED'
  AND je.entry_date <= [period_end]
GROUP BY account_id;

Genera el archivo /migrations/finance/003_materialized_views.sql
```

#### Paso 1.4 · Triggers de actualización automática

```
Crea triggers para que cada INSERT/UPDATE en estas tablas dispare un
NOTIFY hacia los canales WebSocket finance:*:

- finance.journal_entries → finance:executive (refresh KPIs)
- purchasing.savings_log → finance:savings (mega-card)
- finance.sri_filings → finance:sri:warnings

Genera /migrations/finance/004_triggers.sql usando pg_notify().
```

#### Tests de fase 1

```
✓ El esquema finance existe y tiene 10 tablas
✓ El plan de cuentas seed crea ~280 cuentas para un nuevo tenant
✓ INSERT en journal_entries con líneas balanceadas funciona
✓ INSERT con líneas desbalanceadas falla (CHECK constraint)
✓ REFRESH MATERIALIZED VIEW CONCURRENTLY funciona en las 5 vistas
```

---

### FASE 2 · Servicios de cálculo (5-8 días)

**Objetivo:** Implementar la lógica de negocio en `/services/finance/`.

#### Estructura sugerida

```
src/
├── services/finance/
│   ├── index.js                    ← entry point
│   ├── statementsService.js        ← Balance, ER, EFE
│   ├── ratiosService.js            ← 30+ ratios
│   ├── dcfService.js               ← cálculo DCF
│   ├── scenariosService.js         ← what-if + escenarios
│   ├── savingsService.js           ← agregación de ahorros
│   ├── optimizationService.js      ← KPIs 4D
│   ├── sriService.js               ← formularios SRI
│   ├── threeWayMatchingService.js  ← validación cruzada
│   └── aiInsightsService.js        ← Claude API integration
└── controllers/finance/
    └── ...                         ← uno por cada servicio
```

#### Paso 2.1 · Servicio de estados financieros

Prompt:

```
Implementa /services/finance/statementsService.js con tres métodos:

async function getBalanceSheet(tenantId, period, framework='niif_full')
async function getIncomeStatement(tenantId, periodFrom, periodTo, framework)
async function getCashFlow(tenantId, periodFrom, periodTo, method='indirect')

Cada método debe:
1. Consultar la mat_view correspondiente
2. Estructurar la respuesta según el response_schema en integration_schema.json
3. Aplicar reglas de presentación NIIF Plenas vs Pymes (toggle)
4. Para Ecuador, calcular automáticamente 15% PT y 25% IR antes de utilidad neta

Usar pg-promise o el ORM ya activo en el proyecto. Si no hay ORM, usar
pool.query directo de pg.

Ejemplo de uso:
const balance = await statementsService.getBalanceSheet(1, '2026-04', 'niif_full');
// Retorna: { sections: {...}, totals: {...}, currency: 'USD' }
```

#### Paso 2.2 · Servicio de ratios

```
Implementa /services/finance/ratiosService.js. Lee KPI_FORMULAS.md para
todas las fórmulas exactas.

async function getRatios(tenantId, period, category='all')

Debe calcular las 4 categorías:
- liquidez: razón corriente, prueba ácida, razón de efectivo
- solvencia: endeudamiento, D/E, cobertura de intereses
- rentabilidad: márgenes (bruto, EBITDA, neto), ROA, ROE, ROIC
- eficiencia: rotaciones, EVA, WACC, FCF

Cada ratio debe retornar:
{
  code: 'RC',
  name: 'Razón corriente',
  value: 1.74,
  formula: 'AC / PC',
  numerator: 979094,
  denominator: 563600,
  benchmark_sector: 1.5,
  status: 'green' | 'yellow' | 'red',
  variation_yoy: 0.045
}

Para WACC y EVA usa las constantes de Ecuador definidas en
integration_schema.json (tasa BCE 8.5% + prima riesgo país 3.4%).
```

#### Paso 2.3 · Servicio DCF

```
Implementa /services/finance/dcfService.js.

async function calculateDCF(tenantId, assumptions)

Algoritmo:
1. Pull base_revenue del último período si no fue dado
2. Para cada año 1..N:
   - Revenue_y = Revenue_(y-1) × (1 + growth_rate)
   - EBITDA_y = Revenue_y × ebitda_margin
   - NOPAT_y = EBITDA_y × (1 - tax_rate)
   - CapEx_y = Revenue_y × capex_pct
   - ΔWC_y = Revenue_y × wc_change_pct
   - FCF_y = NOPAT_y - CapEx_y - ΔWC_y
   - PV_FCF_y = FCF_y / (1 + WACC)^y
3. Terminal Value:
   - TV = FCF_N × (1 + g) / (WACC - g)
   - PV_TV = TV / (1 + WACC)^N
4. Enterprise Value = Σ(PV_FCF) + PV_TV
5. Equity Value = EV - Deuda Neta + Caja

Adicionalmente, calcular sensibilidad ±2pp WACC y ±3pp growth.

Si recibe el flag 'save_model: true', persistir en finance.dcf_models.
```

#### Paso 2.4 · Servicio de ahorros (savings)

```
Implementa /services/finance/savingsService.js.

async function getSavingsSummary(tenantId, period)
async function logSaving(tenantId, savingData)

Este servicio agrega los 4 tipos de ahorro:
- HARD_SAVINGS: viene de purchasing.orders (precio_negociado vs precio_referencia)
- COST_AVOIDANCE: viene de decisiones registradas en purchasing.decisions
- CONSOLIDATION: contratos marco activos vs spending sin contrato
- DOWNTIME_AVOIDED: viene de inventory.stockout_predictions × valor_hora_parada

Para downtime avoided, la fórmula es:
USD_evitado = stockouts_prevenidos × hours_avoided × revenue_per_hour

Donde revenue_per_hour viene de la línea de negocio del cliente
(configurable en core.tenants.business_settings).
```

#### Paso 2.5 · Servicio SRI

```
Implementa /services/finance/sriService.js. Este es el más complejo.

async function getSRIForms(tenantId, fiscalYear, status)
async function generateForm(tenantId, formCode, fiscalPeriod, outputFormat)
async function validateBeforeSubmit(tenantId, formCode, fiscalPeriod)

Para cada formulario, implementa la lógica de generación:

FORM 101 (IR sociedades anual):
- Reconciliación tributaria desde Estado de Resultados
- Casillero por casillero según resolución SRI vigente
- Output: XML cumpliendo XSD del SRI + PDF resumen

FORM 103 (Retenciones fuente):
- Pull retenciones desde purchasing.orders y otros movimientos con retención
- Agrupar por porcentaje y código (1%, 2%, 8%, etc.)
- Validar que sumas concilien con cuentas contables

FORM 104 (IVA mensual):
- IVA repercutido (ventas) - IVA soportado (compras)
- Diferenciar 0%, 12% (histórico), 15% (vigente desde abril 2024)
- Crédito tributario si IVA pagado > IVA cobrado

FORM 115 (ATS):
- Lista detallada de TODOS los comprobantes electrónicos del mes
- Datos del comprador/vendedor, RUC, montos, retenciones

Para todos: validar formato XML contra XSD oficial antes de retornar.

Si el cliente tiene certificado digital configurado en
core.tenants.sri_credentials, ofrecer firma + envío automático.
```

#### Tests de fase 2

```
✓ getBalanceSheet retorna activo = pasivo + patrimonio
✓ getIncomeStatement: utilidad neta = utilidad antes imp - 15% PT - 25% IR
✓ getCashFlow: flujo neto = operativo + inversión + financiación
✓ Todos los ratios retornan número finito y dentro de rangos sensatos
✓ DCF: si WACC=growth → infinito (división por cero protegida)
✓ DCF: si todos inputs = 0 → EV = 0
✓ SRI Form 104: IVA neto = IVA ventas - IVA compras
✓ Three-way matching detecta correctamente discrepancias
```

---

### FASE 3 · Endpoints REST (3-5 días)

**Objetivo:** Exponer los servicios como API REST.

#### Paso 3.1 · Estructura de rutas

```
Crea /routes/finance.js con todas las rutas listadas en
integration_schema.json sección "rest_endpoints".

Patrón de cada controlador:

// /controllers/finance/executiveSummaryController.js
async function getExecutiveSummary(req, res, next) {
  try {
    const { period = 'current_month', compare_with } = req.query;
    const tenantId = req.user.tenantId;

    const summary = await Promise.all([
      savingsService.getSavingsSummary(tenantId, period),
      optimizationService.get4DKPIs(tenantId, period),
      statementsService.getPLPulse(tenantId, period),
      aiInsightsService.getExecutiveAlerts(tenantId)
    ]);

    res.json({
      savings_total: summary[0].total,
      savings_breakdown: summary[0].breakdown,
      kpis_4d: summary[1],
      pl_pulse: summary[2],
      alerts: summary[3]
    });
  } catch (e) { next(e); }
}

Aplica en TODOS los endpoints:
- middleware de autenticación (verificar req.user existe)
- middleware de RBAC (req.user.permissions incluye 'finance:read')
- middleware de tenant isolation (todas queries con tenant_id = req.user.tenantId)
- error handler global
```

#### Paso 3.2 · WebSocket para tiempo real

```
El sistema actual usa REST tradicional, pero el frontend necesita updates
en tiempo real. Implementa un thin layer de Server-Sent Events (SSE)
o WebSocket sobre socket.io.

Crea /websocket/financeChannel.js:

const channels = {
  'finance:executive': [],     // suscriptores a este canal
  'finance:alerts': [],
  'finance:savings': [],
  'finance:sri:warnings': []
};

// Listener de PostgreSQL NOTIFY (creado en triggers de fase 1)
pgClient.on('notification', (msg) => {
  if (msg.channel.startsWith('finance:')) {
    broadcastToChannel(msg.channel, JSON.parse(msg.payload));
  }
});

// Cada socket subscribe se agrega a channels[channelName]
// Al recibir NOTIFY, hace io.to(channelName).emit('update', data)

Esto permite que el frontend reaccione instantáneamente al cierre de
una OC o al alta de un ahorro, sin polling.
```

#### Tests de fase 3

```
✓ GET /api/finance/executive-summary retorna 200 con shape correcto
✓ GET sin token retorna 401
✓ GET con token sin permiso 'finance:read' retorna 403
✓ POST /api/finance/dcf/calculate con assumptions inválidas retorna 400
✓ Cliente WebSocket recibe push tras INSERT en savings_log
```

---

### FASE 4 · Frontend (10-15 días)

**Objetivo:** Portar el HTML del prototipo a tu framework (Vue 3 / React 18 / Angular).

#### Paso 4.1 · Componentización

```
Toma /logifi_financiero/LOGIFI_ERP_Financiero.html y divide cada
<section class="view"> en un componente independiente:

Vue 3 (sugerido por afinidad con tu stack actual):
- ExecutiveDashboard.vue       (vista 1)
- Optimization4D.vue           (vista 2)
- FinancialStatements.vue      (vista 3)
- FinancialRatios.vue          (vista 4)
- DCFValuation.vue             (vista 5)
- ScenariosWhatIf.vue          (vista 6)
- SRICompliance.vue            (vista 7)
- DataSourcesHealth.vue        (vista 8)

Componentes compartidos:
- KPITile.vue
- TrafficLight.vue
- AIInsightCard.vue
- MegaSavingsCard.vue
- FormulaBadge.vue (con tooltip que muestra fórmula)

El CSS está en variables CSS dentro del HTML. Extrae a:
/styles/finance/_tokens.css   (variables)
/styles/finance/_components.css

NO modifiques los nombres de variables (--ink, --gold, --rust, etc.)
porque comparten paleta con módulos Compras y Proveedores.
```

#### Paso 4.2 · Stores / state management

```
Crea un store Pinia (Vue) o Redux Toolkit (React) para finance:

stores/finance.js:
- state: { executiveSummary, ratios, dcfModel, scenarios, sriForms }
- actions:
  - fetchExecutiveSummary(period)
  - fetchRatios(category)
  - calculateDCF(assumptions)  // POST al backend, persistir resultado
  - simulateWhatIf(params)
- websocket subscription:
  - on 'finance:executive' update → mutate state.executiveSummary
  - on 'finance:savings' update → recalc savings_total

Importante: el slider del DCF debe debounce 300ms antes de llamar al
backend para no saturar.
```

#### Paso 4.3 · Sliders interactivos

```
Los sliders del DCF y What-If en el HTML usan input[type=range] con
oninput nativo. Para Vue/React, usa una librería ligera como vue3-slider
o react-slider para mejor UX (touch, accesibilidad).

Cada cambio del slider debe:
1. Update local state (instant feedback)
2. Debounce 300ms
3. POST al backend
4. Update store con resultado
5. Re-render solo los componentes afectados (KPI cards, chart)
```

#### Tests de fase 4

```
✓ Cada vista renderiza sin error
✓ Sliders DCF actualizan EV en menos de 500ms
✓ Cambio de período en el dashboard re-fetch correctamente
✓ WebSocket disconnect/reconnect graceful
✓ Mobile responsive funciona (breakpoint 1100px)
```

---

### FASE 5 · IA Insights con Claude API (3-5 días)

**Objetivo:** Que el módulo genere insights automáticos en lenguaje natural.

#### Paso 5.1 · Configuración del agente IA financiero

```
Crea /services/finance/aiInsightsService.js usando @anthropic-ai/sdk.

Define las herramientas (function calling) que Claude puede usar:

const financeTools = [
  {
    name: 'get_financial_state',
    description: 'Obtiene los estados financieros de un período',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', description: 'YYYY-MM' },
        framework: { type: 'string', enum: ['niif_pymes', 'niif_full'] }
      },
      required: ['period']
    }
  },
  {
    name: 'calculate_dcf',
    description: 'Calcula valor empresarial con DCF',
    input_schema: {
      type: 'object',
      properties: {
        assumptions: { type: 'object' }
      }
    }
  },
  {
    name: 'compare_scenarios',
    description: 'Compara dos escenarios financieros',
    input_schema: { ... }
  },
  {
    name: 'detect_anomalies',
    description: 'Detecta movimientos anómalos en una cuenta',
    input_schema: { ... }
  },
  {
    name: 'suggest_optimizations',
    description: 'Sugiere acciones para mejorar un KPI específico',
    input_schema: {
      type: 'object',
      properties: {
        kpi_code: { type: 'string', description: 'Ej: DSO, EBITDA, ROIC' },
        current_value: { type: 'number' },
        target_value: { type: 'number' }
      }
    }
  }
];

System prompt para el agente:

"""
Eres el asistente financiero de LOGIFI™ ERP. Estás analizando los datos
de la empresa [TENANT_NAME] en Ecuador. Sigues NIIF [FRAMEWORK] y la
normativa SRI ecuatoriana.

Tu trabajo es generar insights ejecutivos accionables, no descripciones
genéricas. Cada insight debe:
1. Identificar un hecho específico (con números reales)
2. Explicar la causa probable
3. Cuantificar el impacto en USD
4. Proponer una acción concreta con plazo

Tono: profesional pero accesible. Evita jerga financiera sin explicar.
Idioma: español neutro de Latinoamérica.
"""

Cuando el usuario hace clic en "Insights" en el dashboard, se ejecuta:

const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  system: systemPrompt,
  tools: financeTools,
  messages: [{
    role: 'user',
    content: `Analiza el cierre de mes ${period} y genera 3 insights
              priorizados por impacto en USD.`
  }]
});

// Claude llamará a las herramientas que necesite (get_financial_state,
// detect_anomalies, etc.) y retornará los insights finales.
```

#### Paso 5.2 · Cuándo invocar a Claude

```
NO llames a Claude API en cada request — es caro y lento. Estrategia:

1. Cierre de mes (cron job día 1 de cada mes a las 6am):
   - Genera insights ejecutivos del mes anterior
   - Persistir en finance.ai_insights con TTL 30 días

2. On-demand desde el dashboard:
   - Botón "Refresh insights" → invoca a Claude
   - Cooldown 5 minutos por tenant

3. Eventos críticos:
   - DSO supera 60 días → invoca insight automáticamente
   - Form SRI vence en 7 días → invoca insight con plan acción
   - Margen EBITDA cae >3pp m/m → invoca insight

Cachear insights generados durante 24h para evitar re-cómputo.
```

#### Tests de fase 5

```
✓ Claude llama correctamente a get_financial_state con período válido
✓ Insights generados contienen números específicos (no genéricos)
✓ Cooldown funciona: 2 calls seguidas en <5min usa caché
✓ Si Claude API falla, retorna insights pre-calculados de fallback
```

---

### FASE 6 · Compliance y go-live (5-7 días)

**Objetivo:** Auditoría, logs, y despliegue.

#### Paso 6.1 · Audit log

```
Toda operación financiera debe loggear en finance.audit_log:
- Quién (user_id)
- Qué (action: 'create_journal' | 'close_period' | 'modify_dcf' | etc.)
- Cuándo (timestamp)
- Antes/Después (JSON con cambios)

Implementa middleware /middleware/financeAuditLogger.js que se aplique
a todas las rutas /api/finance/* con method != GET.
```

#### Paso 6.2 · Inmutabilidad de cierres

```
Una vez cerrado un período (mes), los asientos NO deben poder modificarse.

Implementa:
- Estado finance.fiscal_periods.status = 'CLOSED' bloquea INSERT/UPDATE
  sobre journal_entries con entry_date dentro del período
- Si necesita corregirse, requiere asiento de reversión en período actual
- Solo rol 'finance:admin' puede reabrir un período cerrado (con audit)
```

#### Paso 6.3 · Performance y escalabilidad

```
Para clientes con >100k asientos:

1. Particionar finance.journal_lines por fiscal_year
2. Crear índices BRIN en entry_date (más eficientes para series temporales)
3. Configurar autovacuum agresivo en mat_views
4. Cachear ratios calculados en Redis con TTL 60s
5. Worker queue (Bull/BullMQ) para generación de Form 115 ATS (puede
   tomar minutos para clientes con muchos comprobantes)
```

#### Paso 6.4 · Backups y disaster recovery

```
Para datos financieros, backup más estricto:
- Logical backup (pg_dump) diario completo + incremental cada 6 horas
- WAL archiving continuo
- Retención: 7 años (requisito legal Ecuador para info contable)
- Tests de restore mensuales documentados
```

#### Tests de fase 6

```
✓ Cada acción finance:* aparece en audit_log
✓ INSERT en período cerrado falla con error explícito
✓ Reapertura de período registra evento crítico
✓ Performance: getBalanceSheet en <500ms para tenant con 50k asientos
✓ Restore de backup funciona end-to-end
```

---

## 🔧 Comandos útiles para Claude Code

```bash
# Ejecutar migraciones
npm run migrate:up -- --schema=finance

# Tests del módulo
npm test -- --testPathPattern=finance

# Refresh manual de mat_views
psql -c "REFRESH MATERIALIZED VIEW CONCURRENTLY finance.mv_balance_sheet;"

# Regenerar plan de cuentas para un tenant nuevo
node scripts/finance/seed-coa.js --tenant=42

# Generar Form 104 manualmente
node scripts/finance/sri-generate.js --form=104 --period=2026-04 --tenant=1
```

---

## ⚠️ Pitfalls comunes (que Claude Code debe evitar)

1. **No olvidar tenant_id en queries** — Cada query debe filtrar por
   `tenant_id = $1`. Crear helper `withTenant(query, tenantId)` para no
   olvidar.

2. **Usar DECIMAL no FLOAT** — En PostgreSQL, todos los montos son
   `DECIMAL(15,2)`. Nunca `FLOAT` o `DOUBLE PRECISION` para dinero.

3. **Timezone Ecuador** — Configurar PostgreSQL en `America/Guayaquil`
   (UTC-5). Los timestamps de cierre de mes son críticos.

4. **IVA cambió en 2024** — De 12% a 15%. Si procesas histórico, verifica
   la fecha del comprobante para aplicar la tasa correcta.

5. **Refresh CONCURRENTLY requiere índice único** — Si falla el REFRESH,
   verifica que cada mat_view tenga al menos un UNIQUE INDEX.

6. **Claude API rate limits** — 1000 req/min en tier 2. Si tienes muchos
   tenants, distribuye los cron jobs.

7. **Validación XML SRI** — Usar `xmllint` con el XSD oficial antes de
   enviar. Errores de schema rechazados por SRI cuestan días de retraso.

8. **El módulo Compras debe estar implementado primero** — Sin él, no hay
   savings_log y la mega-card del dashboard estará vacía.

---

## 📚 Recursos adicionales

- **NIIF para PyMES (vigente Ecuador):** https://www.supercias.gob.ec
- **Resoluciones SRI:** https://www.sri.gob.ec/web/guest/normativa
- **Tasas BCE referenciales:** https://contenido.bce.fin.ec/
- **Plan de cuentas Superintendencia de Cías:** https://www.supercias.gob.ec
- **XSD oficiales SRI:** https://www.sri.gob.ec/facturacion-electronica

---

## ✅ Checklist final pre-go-live

- [ ] Esquema finance creado en producción
- [ ] Plan de cuentas inicial cargado para cliente piloto
- [ ] Mat_views refrescándose vía cron
- [ ] Endpoints REST con tests automatizados
- [ ] WebSocket conectado y emitiendo updates
- [ ] Frontend portado y desplegado
- [ ] IA insights generando con cron mensual
- [ ] Audit log activo en todas las rutas write
- [ ] Backup automatizado configurado
- [ ] Stripe (o pasarela elegida) integrada para upsell de tiers
- [ ] Documentación de cliente final lista (manual usuario)
- [ ] Capacitación a contador del cliente piloto

---

**Para soporte durante la integración:**
Consulta este documento + los otros 4 archivos del paquete. Si surgen
preguntas sobre fórmulas → `KPI_FORMULAS.md`. Sobre estructura de datos
→ `integration_schema.json`. Sobre UX y vistas → el HTML.

**KallpaPro Soluciones Integrales · Guayaquil · Mayo 2026**
