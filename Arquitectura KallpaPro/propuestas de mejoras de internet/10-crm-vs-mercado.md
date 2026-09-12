# 10. CRM — comparación con mejores prácticas de mercado

> 📍 Este documento complementa la investigación de mercado 2026 ya realizada para el Sprint 13 del módulo CRM (con 6 agentes de IA operando sobre la API de Anthropic). No repite esa investigación: la reorganiza en el formato estándar de este lote de 12 documentos y la actualiza con lo que apareció en el mercado entre finales de 2025 y septiembre de 2026.

## 1. Investigación: qué hacen los mejores CRM en 2026

Los CRM líderes (Salesforce, HubSpot) y la nueva ola de "AI sales agents" (Clay, Warmly, Qualified, etc.) convergen en cinco prácticas:

1. **Agentes de IA especializados y orquestados, no un solo "asistente".** Salesforce reposicionó toda su oferta como **Agentforce 360**: una capa de orquestación multiagente donde agentes distintos (prospección, calificación, servicio, cierre) se coordinan y se traspasan trabajo entre sí, con métricas públicas de tasa de resolución autónoma. HubSpot sigue la misma lógica con **Breeze**, que expone agentes separados (prospecting agent, customer agent, content agent) en vez de un copiloto único.
2. **Scoring predictivo/ML, no solo reglas fijas.** El estándar 2026 es el "compound scoring": combinar señales de comportamiento (engagement), firmográficas (fit) e intención (terceros: visitas, contrataciones, tecnología usada) en un modelo entrenado sobre conversión histórica, reemplazando tablas de puntos fijos. Odoo 18 ya lo ofrece de fábrica (predictive lead scoring).
3. **Enriquecimiento automático en el momento de captura.** Los agentes de "research" ya no son un paso manual posterior: se disparan automáticamente al crear el lead (validación de identidad fiscal/empresarial, tamaño, señales de compra) antes de que un humano lo vea.
4. **Autonomía graduada y auditable.** El patrón de mercado no es "todo o nada": los agentes operan bajo niveles de autonomía configurables (sugerir → redactar con aprobación → actuar solo dentro de límites), con registro de costo/latencia por llamada y explicabilidad de cada decisión (por qué se asignó un score, por qué se recomendó un descuento).
5. **Atribución multitoque y orquestación omnicanal.** El mercado ya no acepta atribuir la conversión solo al primer contacto; se exige registrar la cadena completa de touches (canal, agente, mensaje) y unificar WhatsApp/correo/chat en una sola bandeja por lead.

| Práctica de mercado 2026 | Salesforce (Agentforce 360) | HubSpot (Breeze) | KallpaPro (Sprint 13) |
|---|---|---|---|
| Agentes de IA especializados por rol | Sí, multiagente orquestado | Sí (prospecting/customer/content agents) | Sí — 6 agentes (router, SDR, researcher, copywriter, closer, success) |
| Autonomía graduada configurable | Parcial (niveles de permiso por agente) | Parcial | Sí — 4 modos por oportunidad (autopilot/setter_closer/semi_assisted/manual) |
| Scoring predictivo con ML | Sí (Einstein/Data Cloud) | Sí (Breeze Intelligence) | No — reglas fijas por categoría (FIT/ENGAGEMENT/NEGATIVE) con decaimiento |
| Enriquecimiento automático al alta del lead | Sí | Sí | No — el agente investigador (Iván) existe pero no se encadena automáticamente al alta |
| Atribución multitoque | Sí | Sí | No — solo se guarda el primer toque |
| Fusión asistida de duplicados | Sí (pantalla de merge) | Sí | Parcial — se detecta y marca (95% de coincidencia), pero no hay pantalla de fusión campo a campo |
| Bandeja omnicanal unificada | Sí | Sí | No construido (visión "LOGIFI" pendiente de decisión de producto) |
| Costo/latencia de IA auditado por interacción | No siempre expuesto al cliente | No siempre expuesto al cliente | Sí — registrado por llamada, ventaja diferencial |

**Fuentes:**
- [HubSpot vs Salesforce 2026: AI Features and Pricing](https://www.digitalapplied.com/blog/hubspot-vs-salesforce-2026-pricing-ai-features-comparison)
- [The 2026 Enterprise ROI Report: Scaling Growth with HubSpot Breeze and Salesforce Agentforce](https://stormy.ai/blog/2026-enterprise-roi-report-hubspot-breeze-salesforce-agentforce)
- [HubSpot vs Salesforce: Which CRM Is More AI-Agent Ready in 2026?](https://vantagepoint.io/blog/sf/hubspot-vs-salesforce-ai-agent-ready-2026-comparison)
- [HubSpot Breeze AI 2026: Complete Guide to Agents and Assistant](https://syncbricks.com/hubspot-breeze-ai-complete-guide-2026/)
- [AI Features Every CRM Should Have in 2026](https://gigacatalyst.com/blog/crm-ai-features-2026)
- [AI Lead Scoring: The Compound Score Method for B2B Sales [2026 Framework]](https://www.warmly.ai/p/blog/ai-lead-scoring)
- [Best Predictive Lead Scoring Tools [2026]](https://sales-mind.ai/en/blog/post/predictive-lead-scoring-tools)
- [Build an AI Lead-Scoring Agent for Your CRM](https://www.digitalapplied.com/blog/build-ai-lead-scoring-agent-crm-2026)
- [Salesforce Agentforce: Architecture, Pricing & MCP [2026]](https://atlan.com/know/ai-agent/ai-agent-applications/what-is-salesforce-agentforce/)
- [Salesforce Agentforce Guide 2026: Products, AI Agents & Use Cases](https://vantagepoint.io/blog/sf/the-complete-guide-to-salesforces-agentforce-ecosystem-understanding-the-full-product-portfolio-in-2026)
- (Investigación original Sprint 13 con 6 agentes IA sobre API de Anthropic — bitácora interna del proyecto)

## 2. Nuestro estado actual (KallpaPro)

Sprint 13 implementó un módulo CRM con seis agentes de IA reales (`crm_agents`) ejecutando un bucle agéntico contra la API de Anthropic (hasta 5 iteraciones de tool_use, respaldo local en Ollama, registro de costo/latencia):

- **`router`** (Haiku): clasifica la intención entrante y delega al agente correspondiente.
- **`sdr` "Sofía"** (Haiku/Sonnet): califica BANT citando evidencia textual, agenda reuniones, registra compromisos.
- **`researcher` "Iván"** (Sonnet): valida RUC en el SRI de Ecuador, enriquece industria/tamaño, detecta señales de compra (contrataciones, expansión, licitaciones).
- **`copywriter`** (Sonnet): redacta mensaje personalizado por canal (WhatsApp/Telegram/correo).
- **`closer`** (Sonnet): maneja objeciones, pide aprobación de descuentos por matriz de monto, cierra ganado/perdido.
- **`success`** (Haiku): post-venta, detecta riesgo de fuga y señales de venta cruzada.

**Autonomía graduada por oportunidad:** `autopilot` (actúa solo), `setter_closer` (califica y agenda, humano cierra — predeterminado), `semi_assisted` (redacta, humano aprueba cada mensaje), `manual` (solo sugiere).

**Captura de leads:** modelo `CrmLead` separado de `CrmContact`, estados NEW→WORKING→QUALIFIED→CONVERTED|DISQUALIFIED, formularios web editables con endpoint público (honeypot + límite de tasa), deduplicación en la puerta (motor puro que puntúa coincidencia por RUC/correo/teléfono/dominio/nombre), enrutamiento por reglas (`CrmAssignmentRule`, condiciones → propietario o round-robin).

**Scoring:** motor configurable con reglas por categoría FIT/ENGAGEMENT/NEGATIVE, eventos de lead con decaimiento por media vida configurable, umbrales MQL/SQL y grados A/B/C/D editables desde la interfaz. Se corrigió un bug real donde el eje de interacción normalizaba contra la suma de TODOS los topes en vez de las 3 reglas de mayor peso (ningún lead alcanzaba nunca el umbral MQL).

**Pronóstico:** etapas de pipeline editables por empresa (`CrmPipelineStage`, con probabilidad y categoría de pronóstico), categorías de forecast con anulación manual, motor puro de pronóstico (ponderado, por categoría, cobertura vs. cuota, velocidad por etapa, oportunidades estancadas), precisión histórica comparando el forecast guardado contra lo realmente ganado.

**Interfaz:** `/crm/leads` (bandeja con score explicado punto por punto, duplicados, conversión), `/crm/config` (pestañas: Etapas, Puntaje, Formularios, Asignación, Agentes IA — editor de prompt/modelo/temperatura/autonomía desde el frontend), `/crm/forecast` v2 (categorías, cobertura, precisión, velocidad, desglose por vendedor).

**Validado end-to-end:** 229/229 tests de backend, 90/90 de frontend; casos reales probados (bot descartado por honeypot, duplicado detectado al 95%, teléfono normalizado a E.164, conversión transaccional, cobertura de cuota calculada).

## 3. Diagnóstico: brechas frente al mercado

Comparando el estado actual contra la investigación de mercado, las brechas ya identificadas internamente (backlog "Qué sigue") coinciden con lo que el mercado 2026 ya trata como estándar, no como diferenciador:

1. **Fusión asistida de duplicados** — hoy se detectan y marcan (95% de coincidencia), pero un humano decide sin pantalla de fusión campo a campo. Salesforce y HubSpot ya ofrecen esta pantalla de forma nativa; sin ella, la deduplicación pierde la mitad de su valor operativo.
2. **Scoring predictivo con ML sobre conversión histórica** — hoy son reglas fijas por categoría. Es exactamente lo que el mercado llama "compound scoring" / lo que Odoo 18 ya trae de fábrica con predictive lead scoring. Es la brecha más citada en la investigación de mercado 2026 y la que más rápido erosiona la ventaja competitiva si no se cierra.
3. **Enriquecimiento automático al capturar** — el agente investigador (Iván) existe pero no está encadenado al alta del lead; el mercado ya da esto por defecto (Breeze Intelligence, Einstein) en el momento de creación, no como paso posterior.
4. **Atribución multitoque** — hoy solo se guarda el primer toque. El estándar de mercado exige la cadena completa de interacciones para justificar inversión en canales.
5. **Criterios de "Commit" obligatorios** — el campo existe pero no bloquea el paso de etapa todavía, dejando el pronóstico expuesto a optimismo no verificado, algo que las mejores prácticas de forecasting corrigen con gates duros por etapa.

No se identificó ninguna brecha estructural nueva en la investigación de mercado de 2026 que no estuviera ya contemplada en el backlog original del Sprint 13: la arquitectura de agentes especializados con autonomía graduada de KallpaPro ya está alineada con el patrón "Agentforce 360 / Breeze" (agentes por rol orquestados, no un asistente único), lo cual es un hallazgo favorable — no es una brecha, es una confirmación de que el diseño base es correcto.

## 4. Propuestas de mejora

### Flujo de trabajo
- Encadenar automáticamente al agente `researcher` (Iván) en el momento de alta del lead (web, importación o manual), en vez de dejarlo como acción posterior — cerrando la brecha de "enriquecimiento automático" frente al mercado.
- Introducir una pantalla de fusión de duplicados campo a campo (elegir qué valor de cada campo prevalece) para los leads marcados en el 95%+ de coincidencia, en lugar de solo marcarlos.
- Convertir el campo "Commit" en un gate real: no permitir avanzar una oportunidad de etapa "Commit" sin que los criterios definidos estén marcados como cumplidos.
- Registrar cada interacción (no solo la primera) contra el lead/oportunidad con canal y agente de origen, como base mínima de atribución multitoque, aun antes de construir reportes de atribución completos.

### Sistema de organización / configuración
- Priorizar, dentro de la pestaña "Puntaje" ya existente en `/crm/config`, un modo de scoring "sugerido por datos" (mostrar al usuario qué reglas explican mejor la conversión histórica) como paso intermedio hacia ML predictivo completo, sin requerir aún un modelo entrenado.
- Añadir a `CrmAssignmentRule` una opción de enrutamiento por reglas de enriquecimiento (ej. industria detectada por Iván), aprovechando que el enriquecimiento ahora ocurriría al alta.

### Experiencia de usuario (frontend operativo)
- En `/crm/leads`, agregar el flujo de fusión de duplicados como una acción directa sobre el resultado de deduplicación ya visible (hoy solo se marca; falta la acción).
- En `/crm/forecast`, mostrar de forma visible cuándo una oportunidad en etapa "Commit" tiene criterios pendientes, para que el vendedor y el gerente lo vean antes de que distorsione el número de forecast.
- Mantener la transparencia ya lograda (score explicado punto por punto, costo/latencia por agente) como eje de diferenciación frente a Salesforce/HubSpot, que no siempre exponen esto al usuario final — y extenderla a la futura pantalla de atribución multitoque.

### Actualizaciones futuras (mercado emergente / IA)
- **Scoring predictivo con ML entrenado sobre conversión histórica** es la actualización de mayor prioridad según práctica de mercado: es la única brecha que aparece simultáneamente en el backlog interno y en la investigación de mercado 2026 como estándar ya adoptado por competidores directos (Odoo, HubSpot Breeze Intelligence, Salesforce Einstein), y es la que más valor de venta agrega para diferenciarse como "CRM con IA real" frente a competidores de reglas fijas.
- Explorar, sin comprometerse todavía, un patrón de "agent-to-agent" (traspaso de contexto entre agentes vía protocolo estandarizado tipo MCP) como el que usa Agentforce 360 para orquestar sus agentes — evaluar si aporta algo sobre el router actual antes de invertir en ello.
- La visión "LOGIFI" / "avance v2" (inbox omnicanal unificado WhatsApp + Telegram + Gmail vía Unipile, apps móviles, módulo financiero con DCF/valuación) sigue siendo una **actualización futura condicionada a decisión de producto**: el mercado sí exige bandeja omnicanal unificada como estándar 2026, pero decidir si se retoma esa visión ampliada o si el Sprint 13 ya es el alcance definitivo del CRM-IA es una decisión de negocio pendiente, no una recomendación técnica de este documento.

## 5. Qué NO tocar

- La arquitectura de seis agentes especializados con router de intención: está alineada con el patrón de mercado 2026 (Agentforce 360, Breeze) de agentes por rol orquestados en vez de un asistente único. No consolidar en un solo agente genérico.
- Los cuatro modos de autonomía por oportunidad (`autopilot`, `setter_closer`, `semi_assisted`, `manual`): son el mecanismo de control y confianza que el mercado recién está formalizando; no eliminarlos ni reducir sus niveles.
- El registro de costo/latencia por llamada a la API de Anthropic: es una ventaja de transparencia que ni Salesforce ni HubSpot exponen consistentemente al cliente final. Mantenerlo y, si acaso, exponerlo más, no ocultarlo.
- El motor de deduplicación en la puerta (puntuación por RUC/correo/teléfono/dominio/nombre) y el motor de pronóstico puro (ponderado, cobertura, velocidad, precisión histórica): están validados end-to-end (229/229 backend, 90/90 frontend) y ya corrigieron un bug real de scoring; no reescribirlos, solo extenderlos (fusión asistida, gates de Commit) sin tocar su lógica base.
- El default `setter_closer` (IA califica y agenda, humano cierra): es el punto de equilibrio correcto entre autonomía y control para pymes B2B; no cambiarlo a `autopilot` por defecto solo porque el mercado avance hacia más autonomía.
