# 2. Compras (Procure-to-Pay) — comparación con mejores prácticas de mercado

> 📍 Ubicación en KallpaPro: módulo Compras (Requisiciones, RFQ, Órdenes de Compra, Recepciones, Facturas de Compra), con portal de proveedores en `/portal`.

## 1. Investigación: qué hacen los mejores en procurement (S2P/P2P) en 2026

| Práctica | Odoo 18 | SAP Business One | NetSuite | Microsoft Dynamics 365 Business Central |
|---|---|---|---|---|
| Requisición → RFQ → OC | Flujo nativo "Purchase" con estados Draft RFQ → RFQ enviada → OC confirmada; RFQ editable desde portal por el proveedor en 18.0 | Documento "Purchase Request" → "Purchase Quotation" → "Purchase Order", con comparación de cotizaciones manual en reportes | Flujo completo con "Vendor RFQ", comparación de cotizaciones y conversión directa a OC | "Purchase Requisition" → "Request for Quote" → "Purchase Order", con workflow de aprobación nativo |
| Portal de proveedores self-service | Sí, portal de clientes/proveedores con acceso a RFQ, permite edición de precio de RFQ desde el portal (app `bi_portal_rfq_price_update` y nativo desde 18.0), notificación por email/portal de nuevas RFQ | Portal limitado, mayormente vía integraciones de terceros (B1 no tiene portal nativo robusto) | Vendor Center: portal robusto para que el proveedor vea OCs, suba facturas y confirme entregas | Portal básico vía Power Pages/Teams, no nativo en el core |
| Comparación ponderada de cotizaciones | Comparación manual en vista lista/kanban, no hay matriz ponderada nativa (precio + calidad + plazo) | No nativo | Comparación de cotizaciones en pantalla de RFQ, pero ponderación multi-criterio requiere SuiteAnalytics/reportes personalizados | No nativo, requiere Power BI |
| Aprobación multinivel por monto | Vía "Approval" de Odoo Studio/Approvals app, configurable por monto | "Approval Procedure" nativo, con reglas por monto, por documento y por usuario/rol | "Approval Routing" configurable con múltiples niveles por monto, departamento, tipo de gasto | "Approval Workflows" nativo, con reglas por monto y por dimensión, incluye aprobación delegada y notificación automática |
| Aprobación basada en política (no solo monto) | Limitada, requiere reglas personalizadas | Sí, se puede combinar monto + tipo de documento + centro de costo | Sí, "policy-based approval" combinando monto, categoría de gasto, proveedor y presupuesto disponible | Sí, reglas combinables (monto + tipo + dimensión); documentado como mejor práctica 2025 para reducir cuellos de botella |
| 3-way match (OC-Recepción-Factura) | Sí, nativo en facturación de proveedores, con control de discrepancias | Sí, nativo ("Landed Costs" + validación de documentos base) | Sí, nativo, con tolerancias configurables (%, monto) | Sí, nativo, con bloqueo de pago si no coincide |
| Catálogos de proveedores homologados | Vía "Vendor Pricelist" por producto; no hay homologación formal (aprobación de proveedor como paso de negocio) | Vía "Business Partner Master Data" con categorías, sin flujo de homologación nativo | "Approved Vendor List" con proceso de onboarding y aprobación de proveedor antes de poder comprarle | No nativo, requiere personalización |
| Scorecard de desempeño de proveedor | No nativo (apps de terceros) | No nativo | "Vendor Scorecard" con métricas de OTIF (on-time-in-full), calidad y variación de precio, algunos usan IA para scoring automático | No nativo |
| Gasto indirecto / tail spend | No hay categorización nativa de "tail spend" | No nativo | Reportes de spend analysis por categoría, permite identificar cola de gasto disperso en proveedores pequeños | Limitado |
| Sourcing estratégico | Vía apps de terceros | No nativo | "Strategic Sourcing" en NetSuite avanzado, con eventos de sourcing y negociación | No nativo |
| IA humano-en-el-loop en compras | Poco desarrollado en el core | No | Sugerencias de reorden y de proveedor preferido en algunos add-ons; no hay OCR nativo de facturas con validación humana en el core | Copilot sugiere líneas de compra y previsión de demanda, siempre editable antes de confirmar |

### Prácticas confirmadas por la investigación

**Procurement colaborativo y portal self-service**
- El estándar 2025-2026 para RFQ ya no es "enviar PDF por correo y esperar respuesta": Odoo 18 formalizó la edición de precios de RFQ directamente desde el portal del proveedor, con notificación automática y trazabilidad de quién cambió qué precio y cuándo ([CBMS – RFQ from Email/Portal](https://home.mycbms.com/how-to-manage-rfq-from-email-portal-in-odoo-18-odoo-18-purchase-odoo-18-new-features-odoo-18-cbms-odoo-erp/), [Odoo docs RFQ](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/purchase/manage_deals/rfq.html)). NetSuite va más allá con un "Vendor Center" donde el proveedor también sube su factura y confirma la entrega, cerrando el ciclo sin intervención manual del comprador.

**Scorecards de desempeño de proveedor**
- La práctica confirmada como diferenciador competitivo en 2025-2026 es el "vendor scorecard" con métricas objetivas — típicamente OTIF (on-time-in-full), tasa de rechazo de calidad, variación de precio vs. cotizado, y tiempo de respuesta a RFQ — actualizado automáticamente con cada recepción y cada factura, no solo con evaluaciones manuales anuales ([SpecLens – Vendor Scorecard Guide](https://www.speclens.ai/blog/vendor-scorecard-guide), [Gurus Solutions – AI Vendor Performance for NetSuite](https://gurussolutions.com/blog/netsuite-ai-vendor-performance-analysis)).
- Un patrón emergente es el uso de IA para calcular el score de forma continua a partir de datos ya existentes en el ERP (fechas de entrega vs. prometidas, notas de crédito por defectos, cumplimiento de precio cotizado), en vez de depender de que alguien llene un formulario de evaluación ([lowcode.agency – AI Vendor Performance Scoring](https://www.lowcode.agency/blog/how-to-use-ai-to-score-vendor-performance-and-make-better-procurement-decisions)).

**Aprobación basada en política, no solo en monto**
- Ivalua y Zycus (líderes de procurement enterprise) documentan que el modelo de aprobación de "un solo umbral de monto" ya es insuficiente: las mejores prácticas 2025-2026 combinan monto **+ categoría de gasto + disponibilidad presupuestaria + tipo de proveedor (homologado o nuevo)** en la misma regla, de forma que una compra pequeña a un proveedor nuevo no homologado puede requerir aprobación aunque el monto sea bajo ([Ivalua – Procurement Software Best Practices 2026](https://www.ivalua.com/blog/procurement-software-best-practices/), [Zycus – Procurement Approval Workflow](https://www.zycus.com/blog/workflow-management/building-a-best-in-class-procurement-approval-workflow)). Dynamics 365 Business Central formaliza esto con reglas combinables por dimensión, no solo por monto ([Microsoft Learn – Workflows](https://learn.microsoft.com/en-us/dynamics365/business-central/across-workflow)).

**Tail spend management (gasto de cola)**
- El "tail spend" — la larga cola de compras pequeñas y dispersas a proveedores no estratégicos, que suele representar 20% del gasto pero 80% de las transacciones — se identifica como una de las áreas de mayor oportunidad de ahorro no explotada en pymes y medianas empresas en 2026. La recomendación de mercado es categorizar automáticamente el gasto por volumen/frecuencia y aplicar reglas de aprobación más ligeras (o catálogos pre-negociados) para esa cola, liberando tiempo del comprador para el gasto estratégico ([ProcureDesk – Tail Spend Management Guide 2026](https://www.procuredesk.com/tail-spend-management-guide/), [Keelvar – What is Tail Spend](https://www.keelvar.com/knowledge-hub/tail-spend), [Beyond Intranet – Tail Spend Management 2026](https://www.beyondintranet.com/blog/tail-spend-management/)).

**Catálogos de proveedores homologados**
- NetSuite formaliza el concepto de "Approved Vendor List": un proveedor debe pasar por un proceso de onboarding/homologación antes de poder recibir una OC, evitando compras a proveedores no verificados (RUC inválido, sin referencias, sin documentos tributarios en regla) — relevante para el contexto ecuatoriano donde la validez del RUC ante el SRI es crítica.

**IA humano-en-el-loop en procurement**
- El patrón "sugerir, no decidir" se confirma como el estándar de adopción de IA en compras para 2025-2026: los agentes de IA en compras (matching de facturas, sugerencia de proveedor, detección de duplicados) se despliegan con un punto de aprobación humano explícito antes de cualquier acción con impacto financiero — "human-in-the-loop at the consequence boundary" ([AccessAllGPT — Put Approval at the Consequence Boundary](https://www.accessallgpt.com/research/automation-workflows-human-approval-boundaries), [Perfectory AI — Human-in-the-Loop Procurement Automation](https://perfectory.ai/news/human-in-the-loop-procurement-automation), [Tungsten Automation — HITL Enterprise Governance](https://www.tungstenautomation.com/blog/human-in-the-loop-ai-enterprise-governance-best-practices)). Esto valida directamente el patrón que KallpaPro ya usa en su "centro de trabajo" de facturas SRI (checklist + asiento sugerido antes de confirmar).

**Facturación recurrente / recurring bills**
- La automatización de facturas recurrentes (arriendos, seguros, software, servicios básicos) con generación programada y conciliación automática es una práctica estándar en las suites de AP modernas (Stampli, Zone & Co, NetSuite) — se genera el borrador de la factura en la fecha programada y un humano solo confirma/ajusta el monto si cambió, en vez de digitar la factura completa cada mes ([Stampli – Recurring Invoices in AP](https://www.stampli.com/resources/recurring-invoices-in-accounts-payable/), [Zone & Co – ERP billing capabilities](https://www.zoneandco.com/articles/erp-billing-capabilities-what-every-recurring-revenue-business-needs-to-know)).

### Fuentes
- [8 Procurement Software Best Practices For 2026 — Ivalua](https://www.ivalua.com/blog/procurement-software-best-practices/)
- [10 Procure-to-Pay Best Practices for Efficiency & Control — Ivalua](https://www.ivalua.com/blog/procure-to-pay-best-practice/)
- [Tail Spend Management: The CFO's Guide for 2026 — ProcureDesk](https://www.procuredesk.com/tail-spend-management-guide/)
- [What is Tail Spend? A Complete Guide for 2026 — Keelvar](https://www.keelvar.com/knowledge-hub/tail-spend)
- [Tail Spend Management: Strategy, Framework & Benchmarks — Beyond Intranet](https://www.beyondintranet.com/blog/tail-spend-management/)
- [Portal Purchase RFQ Edit — Odoo Apps Store](https://apps.odoo.com/apps/modules/18.0/avp_portal_purchase_rfq_edit)
- [How to Manage RFQ From Email/Portal in Odoo 18 — CBMS](https://home.mycbms.com/how-to-manage-rfq-from-email-portal-in-odoo-18-odoo-18-purchase-odoo-18-new-features-odoo-18-cbms-odoo-erp/)
- [Requests for quotation — Odoo 19.0 documentation](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/purchase/manage_deals/rfq.html)
- [Vendor Portal Management — Odoo Apps Store](https://apps.odoo.com/apps/modules/18.0/bi_supplier_portal)
- [SAP Business One Procurement | Capabilities & Review — ERP Research](https://www.erpresearch.com/erp/sap-business-one/procurement)
- [What is SAP Business One Purchasing Module? — Hyperbots](https://www.hyperbots.com/glossary/sap-business-one-purchasing-module)
- [Mastering Procurement Process with SAP Business One — Accelontech](https://accelontech.com/blog/sap-business-one/mastering-procurement-process-with-sap-business-one/)
- [Ultimate Guide to NetSuite Vendor Management — Tipalti](https://tipalti.com/blog/netsuite-vendor-management/)
- [NetSuite Procurement Software — NetSuite oficial](https://www.netsuite.com/portal/products/erp/procurement.shtml)
- [NetSuite Vendor Management System — NetSuite oficial](https://www.netsuite.com/portal/products/erp/procurement/vendor.shtml)
- [NetSuite Sourcing Management Software — NetSuite oficial](https://www.netsuite.com/portal/products/erp/procurement/source.shtml)
- [AI Vendor Performance Scoring for Smarter Procurement — lowcode.agency](https://www.lowcode.agency/blog/how-to-use-ai-to-score-vendor-performance-and-make-better-procurement-decisions)
- [AI-Powered Vendor Performance Analysis for NetSuite — Gurus Solutions](https://gurussolutions.com/blog/netsuite-ai-vendor-performance-analysis)
- [Vendor Scorecard Guide: KPIs & Templates — SpecLens](https://www.speclens.ai/blog/vendor-scorecard-guide)
- [Purchase Order Approval Workflow with AI (2025) — ApproveIt](https://approveit.today/blog/purchase-order-approval-workflow-with-ai-rules-thresholds-templates-(2025))
- [Building a Best-in-Class Procurement Approval Workflow — Zycus](https://www.zycus.com/blog/workflow-management/building-a-best-in-class-procurement-approval-workflow)
- [Approval workflow: Definition, functionality, and KPIs in procurement — Tacto](https://www.tacto.ai/en/procurement-glossary/approval-workflow)
- [Setting Up Purchase Approval Workflows in Dynamics 365 Business Central — IES](https://www.iesgp.com/blog/setting-up-purchase-approval-workflows-in-dynamics-365-business-central)
- [Workflows in Dynamics 365 Business Central — Microsoft Learn](https://learn.microsoft.com/en-us/dynamics365/business-central/across-workflow)
- [Human-in-the-Loop AI: Put Approval at the Consequence Boundary — AccessAllGPT Research](https://www.accessallgpt.com/research/automation-workflows-human-approval-boundaries)
- [Human-in-the-Loop Procurement Automation — Perfectory AI](https://perfectory.ai/news/human-in-the-loop-procurement-automation)
- [Human-in-the-Loop AI: Enterprise Governance Best Practices — Tungsten Automation](https://www.tungstenautomation.com/blog/human-in-the-loop-ai-enterprise-governance-best-practices)
- [The Art of Managing Recurring Expenses — Stampli](https://www.stampli.com/blog/payments/managing-recurring-expenses/)
- [Recurring Invoices in Accounts Payable — Stampli](https://www.stampli.com/resources/recurring-invoices-in-accounts-payable/)
- [ERP billing system capabilities — Zone & Co](https://www.zoneandco.com/articles/erp-billing-capabilities-what-every-recurring-revenue-business-needs-to-know)

## 2. Nuestro estado actual (KallpaPro)

- Requisición con prioridad y fecha `neededBy`.
- RFQ a proveedores con portal del proveedor (`/portal`).
- Comparativo ponderado de cotizaciones (`QuotationCompare`, matriz ponderada, no solo precio) — esto ya es más avanzado que la comparación básica de Odoo/SAP B1 estándar.
- Aprobación multinivel L1-L5 por matriz de monto (`ApprovalMatrix`).
- Ciclo OC → anticipo → recepción (con ubicación física en bodega) → pago de saldo, con asientos contables automáticos.
- Factura de compra (documento SRI de Ecuador) con OCR/IA + validación 3-way match (OC vs recepción vs factura).
- Ingreso manual o semi-automático de factura/nota de crédito/nota de débito sin PDF/XML, opcionalmente pre-llenado por IA.
- Retenciones de compra (Formulario 103 de Ecuador).
- Detección de facturas de compra duplicadas: bloquea si proveedor+número exacto coinciden; advierte si monto ±1% y fecha ±5 días.
- "Centro de trabajo" de factura SRI: checklist de validación de 9 puntos + panel de "asiento contable sugerido" antes de confirmar — este es exactamente el patrón de IA humano-en-el-loop que el mercado confirma como mejor práctica 2025-2026.
- Deuda técnica identificada: número de requisición único global (debería ser único por empresa).
- Pendiente identificado: plantilla de facturas de compra recurrentes (arriendos, servicios) con generación mensual automática.

## 3. Diagnóstico: brechas frente al mercado

| Práctica confirmada en el mercado | ¿La tenemos? | Comentario |
|---|---|---|
| RFQ + portal de proveedor self-service | Sí | Ya tenemos portal en `/portal`, en línea con Odoo 18 |
| Comparativo ponderado de cotizaciones | Sí | `QuotationCompare` ya cubre esto, más avanzado que el estándar Odoo/SAP B1 |
| Aprobación multinivel por monto | Sí | `ApprovalMatrix` L1-L5 lo cubre |
| Aprobación basada en política (monto + categoría + proveedor homologado + presupuesto) | Parcial | Solo tenemos monto (vía `ApprovalMatrix`) y presupuesto (vía `checkBudget`); falta la dimensión "categoría de gasto" y "proveedor homologado o nuevo" como criterio adicional de la regla |
| 3-way match | Sí | Ya implementado en el centro de trabajo de factura SRI |
| Catálogo de proveedores homologados (aprobación formal antes de poder comprarles) | No confirmado | Existe el maestro de proveedores, pero no hay evidencia de un estado "homologado/en evaluación/bloqueado" que condicione si se le puede emitir OC |
| Scorecard de desempeño de proveedor (OTIF, calidad, cumplimiento de precio) | No | No existe ninguna métrica automática de desempeño de proveedor basada en datos de recepción/factura ya existentes en el sistema |
| Tail spend management (categorización de gasto disperso, reglas más ligeras) | No | No hay categorización de compras por volumen/frecuencia que identifique la "cola" de gasto disperso |
| Facturas de compra recurrentes con generación automática | No | Ya identificado internamente como pendiente; el mercado lo confirma como práctica estándar (Stampli, Zone & Co, NetSuite) |
| Número de requisición único por empresa (no global) | No | Deuda técnica ya conocida; no es una brecha de mercado per se, pero afecta la percepción de calidad multi-tenant |
| IA humano-en-el-loop en compras (sugerir, no decidir) | Sí (parcial) | Ya aplicado en OCR de factura SRI y detección de duplicados; el mercado confirma que este patrón debería extenderse a más puntos del flujo (ver propuestas) |

## 4. Propuestas de mejora

### Flujo de trabajo
1. **Estado de homologación de proveedor**: agregar al maestro de proveedores un campo de estado (`Nuevo` → `En evaluación` → `Homologado` → `Bloqueado`), y una regla en `ApprovalMatrix` que exija un nivel de aprobación adicional (o bloquee la emisión de OC) cuando el proveedor no esté en estado `Homologado`, replicando el "Approved Vendor List" de NetSuite. Encaja naturalmente con la validación de RUC ante el SRI que KallpaPro ya necesita hacer.
2. **Cálculo automático de scorecard de proveedor**: usando datos que el sistema ya captura (fecha prometida de OC vs. fecha real de recepción, monto cotizado en `QuotationCompare` vs. monto facturado, notas de crédito por devolución/defecto), calcular automáticamente 3 métricas por proveedor: % de entregas a tiempo (OTIF), % de cumplimiento de precio cotizado, y tasa de incidencias (devoluciones/notas de crédito). Mostrar como score visible en la ficha del proveedor y en el comparativo de cotizaciones (`QuotationCompare`), para que el peso del historial real influya en la próxima decisión de compra.
3. **Regla de aprobación por política, no solo por monto**: extender `ApprovalMatrix` para que una regla pueda combinar monto + categoría de gasto (o centro de costo) + estado de homologación del proveedor, de forma que, por ejemplo, una compra de bajo monto a un proveedor nuevo no homologado siga requiriendo aprobación de nivel 2, aunque el monto por sí solo solo requeriría nivel 1.
4. **Plantilla de factura de compra recurrente**: crear una pantalla "Facturas recurrentes" en Compras donde se configure proveedor, concepto, monto estimado, cuenta contable y periodicidad (mensual/bimestral). El sistema genera automáticamente el borrador de la factura en la fecha programada, ya con el "asiento contable sugerido" (reutilizando el centro de trabajo de factura SRI existente), y el usuario solo confirma o ajusta el monto si cambió — no vuelve a digitar todo desde cero cada mes.
5. **Corregir numeración de requisición a nivel de empresa**: cambiar el correlativo de `Requisicion` de único global a único por `companyId`, para alinear con el patrón multi-tenant del resto del sistema y evitar confusión cuando distintos tenants ven números salteados.

### Sistema de organización / configuración
6. **Categorización de gasto (spend category)**: agregar un catálogo de categorías de gasto (ej. materia prima, servicios generales, activos fijos, gastos indirectos/tail spend) asignable a cada línea de Requisición/OC, para habilitar tanto la aprobación por política (punto 3) como reportes de "dónde se concentra el gasto disperso" — insumo directo para identificar tail spend sin necesitar un módulo nuevo.
7. **Reglas más ligeras para compras de baja cuantía y proveedor recurrente homologado**: configurar en `ApprovalMatrix` un camino rápido (menos niveles de aprobación) cuando la compra es de bajo monto, a un proveedor ya homologado, y dentro de una categoría de gasto recurrente — esto libera tiempo del aprobador para las compras estratégicas, aplicando el principio de tail spend management sin construir un módulo de sourcing completo.
8. **Umbral configurable para el detector de facturas duplicadas y para el 3-way match**: permitir que cada empresa ajuste sus propios porcentajes de tolerancia (hoy fijos en ±1% monto / ±5 días fecha para duplicados) desde una pantalla de configuración de Compras, ya que la tolerancia adecuada varía según el rubro del negocio.

### Experiencia de usuario (frontend operativo)
9. **Ficha de proveedor con scorecard visual**: en la ficha de cada proveedor, agregar un panel con las 3 métricas del punto 2 mostradas como indicadores simples (semáforo o barra), más un historial de las últimas 5 órdenes con su cumplimiento, para que el comprador decida con datos objetivos al momento de elegir proveedor en una nueva RFQ.
10. **Indicador de "proveedor no homologado" en el flujo de creación de OC**: cuando se seleccione un proveedor en estado `Nuevo` o `En evaluación` al crear una OC, mostrar una advertencia visual clara (badge amarillo) antes de confirmar, en vez de descubrirlo solo cuando la aprobación se demora.
11. **Panel de "próximas facturas recurrentes"** en el dashboard de Compras, listando las facturas recurrentes que se generarán en los próximos 7 días, con acceso directo a revisarlas antes de que se disparen automáticamente.
12. **Vista de "cola de gasto" (tail spend)** en reportes de Compras: un gráfico simple que muestre qué % de las transacciones (no del monto) corresponde a compras pequeñas y dispersas, ayudando al gerente de compras a identificar dónde consolidar proveedores.

### Actualizaciones futuras (mercado emergente / IA)
13. **Sugerencia de proveedor por IA en nueva RFQ**: al crear una Requisición, sugerir automáticamente 1-2 proveedores basados en el scorecard histórico (punto 2) y en compras anteriores del mismo producto/categoría, con opción de aceptar la sugerencia o elegir manualmente — mismo patrón de sugerencia editable ya usado en el centro de trabajo de factura SRI.
14. **Detección de anomalías de precio en factura vs. histórico del proveedor**: extender la IA que ya hace OCR/pre-llenado de facturas para que, además del 3-way match contra la OC, compare el precio unitario facturado contra el precio histórico pagado a ese mismo proveedor por el mismo producto, marcando como advertencia (no bloqueo) cuando la variación supere un umbral — capa adicional de control más allá del match contra la OC puntual.
15. **Generación asistida por IA del borrador de factura recurrente**: cuando el monto de una factura recurrente varíe respecto al mes anterior (ej. planilla de servicios básicos), usar IA para sugerir si la variación es razonable (rango histórico) o requiere revisión manual antes de aprobar, en vez de generar el borrador siempre con el mismo monto fijo.

## 5. Qué NO tocar

- **Sourcing estratégico con eventos de negociación multi-ronda (tipo NetSuite avanzado o Ariba/Coupa)**: implica subastas inversas, negociación estructurada multi-vuelta y gestión de contratos marco complejos — funcionalidad de procurement enterprise que una pyme ecuatoriana B2B no necesita; el comparativo ponderado de cotizaciones (`QuotationCompare`) que ya existe es suficiente para el segmento.
- **Motor de tail spend management con marketplace de catálogos punch-out (integración directa con catálogos electrónicos de proveedores tipo Amazon Business)**: es una capa de integración de datos de catálogo externo típica de grandes corporativos; para pymes basta con la categorización interna de gasto (punto 6) y reglas de aprobación más livianas (punto 7), sin necesitar integraciones de punch-out.
- **Portal de proveedor con edición de precios de RFQ en tiempo real bidireccional compleja (como el add-on de Odoo 18)**: KallpaPro ya tiene portal de proveedores; agregar edición de precio en vivo con control de versiones de negociación añadiría complejidad de UI y de auditoría desproporcionada frente al beneficio para el volumen de RFQ típico de una pyme (generalmente pocas cotizaciones por proveedor, no negociación de alta frecuencia).
- **Consolidación de compras multi-entidad/multi-moneda con conversión automática de tipo de cambio en tiempo real**: relevante para corporativos con subsidiarias en varios países; KallpaPro es multi-tenant por `companyId` con una empresa por tenant operando principalmente en USD (moneda oficial de Ecuador), por lo que un motor de consolidación multi-moneda no aporta valor al segmento objetivo actual.
