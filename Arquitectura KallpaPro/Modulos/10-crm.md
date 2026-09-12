# CRM Pro — Captura de leads, scoring, pronóstico y agentes editables

> 📍 Módulo **10** del ciclo operativo · [[flujo-trabajo-erp|← Router de módulos]] · [[plan-mejoras-odoo18|Plan de mejoras]]
> Sprint 13. Documento vivo. Creado: 2026-07-22. Último sprint cerrado del proyecto.

---

## 1. Investigación: qué hacen los mejores CRM en 2026

El cambio de fondo de 2025→2026 es el paso de **IA que sugiere** a **IA que actúa**:
agentes autónomos con herramientas, guardarraíles y aprobación humana en los puntos
irreversibles. Resumen por plataforma:

| Plataforma | Agentes / IA | Qué hace en captura, scoring y pronóstico |
|---|---|---|
| **Salesforce** (Agentforce + Einstein) | Sales Qualification Agent, Prospecting Agent, Lead Nurture Agent, Sales Coaching Agent, Pipeline Management Agent, Service Agent. Motor de razonamiento *Atlas* para decisiones multipaso. Se define por **temas**, **acciones** y **guardarraíles**. | Web-to-Lead con reglas de duplicados y de asignación; Einstein Lead Scoring **predictivo** entrenado con conversiones históricas + reglas configurables en Account Engagement; Einstein Forecasting con categorías Pipeline/Best Case/Commit/Closed/Omitted. |
| **HubSpot** (Breeze) | Prospecting Agent (cola diaria priorizada + "por qué ahora" + redacción personalizada), Customer Agent (soporte anclado a base de conocimiento), Content Agent, Social Agent, Deal intelligence. | Formularios con campos ocultos UTM; **doble score**: *fit* (demográfico/firmográfico) e *intent* (conductual), con **decaimiento** y **puntos negativos**; umbrales MQL/SQL configurables. |
| **Zoho** (Zia) | Detección de anomalías del pipeline, mejor hora de contacto, recuperación conversacional de datos. | Scoring por reglas + predicción de cierre. |
| **Odoo 18** | Sin agentes conversacionales reales. | **Predictive lead scoring** por ML sobre datos históricos (variables configurables en Ajustes); **asignación basada en reglas** por equipo con dominio editable, ejecutable manual o repetidamente; probabilidad editable a mano en la oportunidad. |

### Prácticas confirmadas por la investigación

**Captura de leads**
- Formulario web con **3–5 campos visibles** para tráfico frío; quitar teléfono sube la
  conversión 15–20 %, quitar facturación 20–25 %.
- **8–12 campos ocultos** de atribución: `utm_source`, `utm_medium`, `utm_campaign`,
  `utm_term`, `utm_content`, `referrer`, `landingPage`, `gclid`, timestamp; cookie de
  30–90 días para atribución multitoque.
- **Deduplicar en la puerta**, no después: un comprador = un registro, sin importar por
  cuántos canales entró.
- **Enrutamiento** por reglas (equipo/territorio/industria/monto) al momento de entrar.

**Scoring**
- Separar **fit** (tamaño, industria, ingresos, cargo) de **engagement** (visitas a
  precios, demo, respuestas), porque cuentan historias distintas.
- **Decaimiento**: a los 7–14 días sin actividad el engagement debe bajar; media vida
  típica de 30 días (a los 6 meses un formulario vale la mitad).
- **Puntos negativos** para descalificar: correo personal, competidor, estudiante,
  baja de suscripción, país fuera de mercado.
- Umbrales explícitos MQL/SQL y grado A/B/C/D, no un número suelto.

**Pronóstico**
- Cinco categorías: **Pipeline, Best Case, Commit, Closed, Omitted**.
- *Benchmarks 2026*: precisión de Commit ~85 % (mediana), Best Case ~38 %,
  pipeline ponderado ~22 %. Un Best Case por encima de 55 % es bandera roja
  (el vendedor está sub-pronosticando). Varianza > ±25 % es señal de alarma.
- La palanca de precisión más grande son los **criterios documentados de Commit**:
  el vendedor no puede promover a Commit sin cumplir compuertas de verificación.
- **Cobertura de pipeline** (pipeline abierto ÷ cuota) y **velocidad** (días en etapa
  vs. promedio) para detectar estancamiento.

**Fuentes:** [Zapier — autonomous AI CRM](https://zapier.com/blog/ai-crm/) ·
[Forecastio — forecast categories](https://forecastio.ai/blog/forecast-categories) ·
[Growthspree — benchmarks 2026](https://www.growthspreeofficial.com/blogs/b2b-saas-sales-forecast-accuracy-benchmarks-2026-commit-best-case-pipeline-by-stage) ·
[SaaScend — UTM en campos ocultos](https://www.saascend.com/best-practices-for-lead-source-tracking-capturing-utm-parameters-with-hidden-fields/) ·
[Prospeo — negative lead scoring](https://prospeo.io/s/negative-lead-scoring) ·
[iO — modelo de scoring de HubSpot](https://www.iodigital.com/en/insights/blogs/everything-you-need-to-know-about-hubspot-new-lead-scoring-model) ·
[Odoo 18 — predictive lead scoring](https://www.odoo.com/documentation/18.0/applications/sales/crm/track_leads/lead_scoring.html) ·
[Vantage Point — Breeze vs Agentforce](https://vantagepoint.io/blog/sf/hubspot-vs-salesforce-ai-agent-ready-2026-comparison)

---

## 2. Los agentes de IA de KallpaPro — qué hace cada uno

KallpaPro ya tiene seis agentes (`crm_agents`) con bucle agéntico real
(`base.agent.ts`: hasta 5 iteraciones de *tool_use* contra la API de Anthropic, con
respaldo local en Ollama y registro de coste/latencia por corrida en `crm_agent_runs`).

| Código | Nombre | Modelo típico | Qué hace | Herramientas |
|---|---|---|---|---|
| `router` | **Ruteador** | Haiku (barato, rápido) | Primera parada de todo mensaje entrante. Clasifica la intención y delega al agente correcto. No responde al cliente. | `classify_intent`, `delegate_to_agent` |
| `sdr` | **Sofía · SDR** | Haiku/Sonnet | Califica el lead por **BANT** citando evidencia textual de la conversación, actualiza el score, agenda reuniones y registra compromisos. Es el que convierte un contacto frío en oportunidad. | `qualify_bant`, `fetch_lead_context`, `check_calendar`, `create_meeting`, `register_commitment`, `send_message` |
| `researcher` | **Iván · Investigador** | Sonnet | Enriquece la empresa: valida el RUC en el SRI, busca en la web, deduce industria/CIIU/tamaño y detecta **señales de compra** (contrataciones, expansión, licitaciones). Escribe en `crm_companies.enrichedData`. | `validate_ruc`, `enrich_company`, `web_search`, `detect_signals` |
| `copywriter` | **Redactor** | Sonnet | Redacta el mensaje personalizado por canal (WhatsApp/Telegram/correo) usando plantillas aprobadas y el contexto del lead. Nunca envía sin pasar por el modo de autonomía. | `send_template`, `fetch_lead_context` |
| `closer` | **Cierre** | Sonnet | Maneja objeciones, pide aprobación de descuentos por matriz de monto y mueve la oportunidad a ganada/perdida con motivo. | `handle_objection`, `request_approval`, `close_deal` |
| `success` | **Éxito del cliente** | Haiku | Post-venta: vigila la salud de la cuenta, detecta **riesgo de fuga** y **señales de venta cruzada**. | `monitor_health`, `detect_churn_risk`, `upsell_signal` |

### Modos de autonomía (por oportunidad, campo `autonomyMode`)

| Modo | Significado |
|---|---|
| `autopilot` | El agente responde y actúa solo. Se usa en leads fríos de bajo valor. |
| `setter_closer` | El agente califica y agenda; el humano cierra. **Predeterminado.** |
| `semi_assisted` | El agente redacta, el humano aprueba cada mensaje antes de salir (`requiresApproval`). |
| `manual` | El agente solo sugiere en el panel; no toca la conversación. |

### Lo que este sprint añade a los agentes

1. **Editables desde el frontend**: prompt del sistema, modelo, temperatura, `maxTokens`,
   modo de autonomía y activación, sin tocar la base de datos a mano.
2. **Nuevo trabajo del SDR**: el score BANT deja de ser el único; ahora convive con el
   motor de reglas (fit + engagement) y ambos se combinan en el score final del lead.
3. **Herramienta nueva `score_lead`**: el agente puede recalcular el score de un lead con
   las reglas de la empresa y explicar por qué subió o bajó.

---

## 3. Diagnóstico: qué le falta hoy a nuestro CRM

| Área | Estado antes del Sprint 13 |
|---|---|
| Captura | ❌ Inexistente. Los contactos entran a mano o por el webhook de Unipile. Sin formularios web, sin UTM, sin deduplicación, sin enrutamiento. |
| Scoring | 🟡 Solo BANT, calculado por el agente SDR, con 0–25 fijos por dimensión. Sin reglas configurables, sin decaimiento, sin puntos negativos, sin umbrales MQL/SQL. |
| Pronóstico | 🟡 Solo ponderado por etapa con `STAGE_PROBABILITY` **quemado en el código**. Sin categorías, sin cobertura, sin velocidad, sin precisión histórica, sin cuota. |
| Editabilidad | ❌ Etapas del pipeline, probabilidades y prompts de agentes son constantes de código o filas de BD sin interfaz. |

---

## 4. Plan de implementación

### A · Captura de leads (A1–A4)
- **A1 · Modelo `CrmLead`**: bandeja de entrada cruda, separada de `CrmContact`. Estados
  `NEW → WORKING → QUALIFIED → CONVERTED | DISQUALIFIED`. Guarda atribución completa.
- **A2 · Formularios web editables** (`CrmCaptureForm`): campos, etiquetas, obligatoriedad,
  mapeo a campos del lead, texto de consentimiento, `publicKey`. Endpoint público
  `GET/POST /api/public/crm/forms/:publicKey` con honeypot y límite de tasa.
- **A3 · Deduplicación en la puerta**: motor puro que puntúa coincidencia por RUC, correo,
  teléfono E.164, dominio del correo y nombre normalizado (sin acentos).
- **A4 · Enrutamiento por reglas** (`CrmAssignmentRule`): condiciones sobre campos del lead
  → propietario o round-robin sobre una lista de usuarios; prioridad y activación editables.

### B · Motor de scoring configurable (B1–B3)
- **B1 · `CrmScoringRule`**: `category` (`FIT` | `ENGAGEMENT` | `NEGATIVE`), campo, operador
  (`EQUALS`, `CONTAINS`, `IN`, `GT`, `LT`, `BETWEEN`, `EXISTS`, `EVENT_COUNT`), valor, puntos.
- **B2 · Decaimiento y eventos**: `CrmLeadEvent` registra cada señal (envío de formulario,
  apertura, visita a precios, respuesta). El motor aplica **media vida configurable**.
- **B3 · `CrmScoringConfig`**: pesos fit/engagement, media vida, umbrales MQL/SQL y cortes
  de grado A/B/C/D. Todo editable desde la interfaz.

### C · Pronóstico profesional (C1–C4)
- **C1 · `CrmPipelineStage`**: etapas por empresa, editables — orden, probabilidad,
  categoría de pronóstico, banderas ganada/perdida. Sustituye `STAGE_PROBABILITY`.
- **C2 · Categorías** en `CrmDeal.forecastCategory` con anulación manual sobre la
  categoría heredada de la etapa.
- **C3 · Motor de pronóstico puro**: ponderado, por categoría, cobertura vs. cuota,
  velocidad por etapa, oportunidades estancadas y en riesgo.
- **C4 · Precisión histórica**: comparar el `CrmForecast` guardado del período con lo
  realmente ganado → % de precisión de Commit y de Best Case, contra los benchmarks.

### D · Interfaz totalmente editable
- `/crm/leads` — bandeja con score, grado, origen, duplicados y botón **Convertir**.
- `/crm/config` — pestañas: **Etapas**, **Scoring**, **Formularios**, **Asignación**, **Agentes**.
- `/crm/forecast` — v2 con categorías, cobertura, velocidad y precisión.

### E · Verificación
Motores puros con tests unitarios (regla transversal 6), `tsc --noEmit` limpio en ambos
proyectos, y prueba e2e en el navegador.

---

## 5. Lo que quedó implementado

### Backend
- **Migración** `20260723034700_sprint13_crm_pro_leads_scoring_forecast`, APLICADA.
  Seis modelos nuevos (`CrmLead`, `CrmLeadEvent`, `CrmCaptureForm`, `CrmScoringRule`,
  `CrmScoringConfig`, `CrmPipelineStage`, `CrmAssignmentRule`) y campos nuevos en
  `CrmDeal` (`forecastCategory`, `categoryOverride`, `lastActivityAt`, `leadId`) y
  `CrmForecast` (`commitUsd`, `bestCaseUsd`, `quotaUsd`, `coverageRatio`, precisión).
- **Cinco motores puros** en `src/services/crm/engines/` con **56 tests unitarios**:
  `condition`, `lead-scoring`, `lead-dedup`, `lead-routing`, `forecast`.
- **Servicios**: `lead.service`, `capture-form.service`, `crm-config.service`,
  `forecast.service` reescrito sobre el motor.
- **Endpoint público** `POST /api/public/crm/forms/:publicKey` con CORS abierto solo en
  esa rama, honeypot, tiempo mínimo de llenado y límite de 20 envíos/hora por IP.
- **Herramienta `score_lead`** para que el agente SDR recalcule el puntaje con las reglas
  de la empresa y pueda explicar por qué subió o bajó.

### Frontend
- `/crm/leads` — bandeja ordenada por puntaje, con panel de detalle que **explica cada
  punto sumado o restado**, aviso de duplicado, conversión y descarte.
- `/crm/config` — cinco pestañas: Etapas, Puntaje de leads, Formularios, Asignación y
  Agentes IA (editor de la instrucción del sistema, modelo, temperatura y autonomía).
- `/crm/forecast` v2 — categorías, cobertura contra cuota, precisión contra las
  referencias del mercado, velocidad por etapa, estancadas y desglose por vendedor.

### Dos hallazgos corregidos durante la prueba e2e

1. **El techo del eje de interacción era inalcanzable.** Se normalizaba contra la suma de
   TODOS los topes (157 con las reglas por defecto), lo que exigía que un lead pidiera
   demo, viera precios, respondiera tres veces, agendara y descargara material para llegar
   a 100. El eje quedaba comprimido y **ningún lead alcanzaba nunca el umbral MQL**: todos
   salían grado D. Ahora se normaliza contra las **tres reglas de mayor peso**
   (`ENGAGEMENT_CEILING_RULES`), que es lo que un lead interesado sí produce.
2. **Un formulario corto no daba señal de perfil.** Se añadieron dos reglas por defecto —
   *Correo corporativo (dominio propio)* en perfil y *Mensaje con intención de compra* en
   interacción — y el formulario de arranque pasó a pedir también el cargo.

> **Nota operativa:** las reglas se siembran una sola vez por empresa. Una empresa que ya
> entró al CRM antes de este cambio conserva las 16 reglas originales; para incorporar las
> dos nuevas hay que pulsar **Restaurar el juego de reglas recomendado** en
> Configuración → Puntaje de leads.

## 6. Validación e2e (2026-07-22)

Probado como usuario real contra la base de datos, con el endpoint público llamado desde
fuera de la sesión:

| Caso | Resultado |
|---|---|
| Lead legítimo con consentimiento | Capturado, puntuado y en la bandeja |
| Bot (honeypot lleno) | Descartado en silencio, con éxito falso; no crea lead |
| Sin consentimiento | Rechazado con `CONSENT_REQUIRED` |
| Segundo envío con el mismo correo | Marcado **posible duplicado, 95 %**, sin fusionar |
| Teléfono `0998887766` | Normalizado a `+593998887766` |
| Campos no declarados en el formulario | Descartados (solo entra lo declarado) |
| Mismo lead, formulario de 4 → 8 campos | **12 → 52 puntos (MQL, grado C)** |
| Conversión a oportunidad | Contacto + empresa + oportunidad en una transacción |
| Segunda conversión del mismo lead | Rechazada con `LEAD_ALREADY_CONVERTED` |
| Pronóstico tras convertir | Comprometido $48.000 · ponderado $36.000 (75 %) |
| Cuota de $100.000 | Cobertura 0,48× → marcada **insuficiente** (sana: 3×) |

**Tests: backend 229/229 · frontend 90/90 · `tsc --noEmit` limpio en ambos.**

## 7. Registro de avance

| Fecha | Avance |
|---|---|
| 2026-07-22 | Investigación cerrada, plan A→E redactado, implementación completa A→E, migración aplicada, e2e validado. Sprint 13 CERRADO. |
| 2026-09-11 | **Puente CRM → Ventas**: cerrar un deal como ganado (o el botón manual "Generar cotización" en cualquier etapa) ya no solo cambia el `stage` — genera la cotización de venta real con los productos conversados (`CrmDealItem`, nuevo). Antes `updateDealStage`/`close_deal.ts` (herramienta del agente Andrés/Closer) solo tocaba el estado del deal; ahora dispara `tryAutoConvertOnWon` (no bloqueante: un deal sin productos queda WON igual, listo para completarse a mano). Emparejamiento de `Customer` por RUC de `CrmCompany` → email del contacto → razón social exacta; sin coincidencia crea el cliente. Reusa `sales.service.createQuotation` — ver [[04-ventas]] para el detalle técnico completo. Verificado e2e real: oportunidad demo → cotización COT-0003 generada con el cliente correcto emparejado por RUC. |

## 8. Qué sigue en este módulo

- **Fusión asistida de duplicados**: hoy se marcan y un humano decide, pero no hay una
  pantalla que fusione los dos registros campo a campo.
- **Scoring predictivo**: cuando haya suficientes leads convertidos, entrenar los pesos
  con la conversión histórica en vez de fijarlos a mano (es lo que hace Odoo 18).
- **Enriquecimiento automático al capturar**: encadenar el agente Iván (investigador)
  al alta del lead para que valide el RUC y complete industria y tamaño solo.
- **Atribución multitoque**: hoy se guarda el primer toque; falta el modelo por posición.
- **Criterios de Commit obligatorios**: el campo `entryCriteria` ya existe y se muestra,
  pero todavía no bloquea el paso de etapa.
