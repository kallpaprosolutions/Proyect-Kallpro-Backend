# 8. Análisis financiero: Cuentas por Pagar / Cuentas por Cobrar — comparación con mejores prácticas de mercado

> 📍 Módulo 8 — Análisis financiero (CxP/CxC). Desarrollo reciente (ago-sep 2026): mesa de trabajo (workbench), radar de cartera vencida, scoring 4D, gestión de cobranza, priorización de pagos.

## 1. Investigación: qué hacen los mejores en AP/AR automation en 2026

| Práctica | Odoo 18 | SAP Business One | NetSuite | Tipalti / Bill.com | HighRadius (especialista AR) |
|---|---|---|---|---|---|
| Cobranza con secuencias automáticas (dunning) | Recordatorios automáticos por antigüedad, plantillas por segmento de cliente | Cartas de dunning configurables por nivel de mora | Collections Management module con secuencias multi-nivel | Recordatorios automáticos multi-canal | Motor de dunning con secuencias por score de riesgo del cliente |
| Predicción de pago tardío con IA/ML | IA básica en Enterprise (predicción de fecha de pago) | Limitado, requiere add-on | Predictive analytics de SuiteAnalytics | Modelos de predicción de atraso | Caso de uso insignia: "Payment Behavior Prediction" con ML sobre histórico de pagos |
| Invoice-to-cash touchless | Parcial (conciliación automática de pagos) | Parcial | Alto grado con AutoCash | Alto (Bill.com AR automatiza aplicación de pagos) | Referencia de mercado: cash application automática >90% touchless |
| Portal de autoservicio de pago para el cliente | Portal de clientes con pago en línea | Portal B1 limitado, requiere add-on | Customer Center con pago en línea | Portales dedicados (EIPP) | EIPP (Electronic Invoice Presentment & Payment) como categoría propia |
| Descuentos por pronto pago automatizados (dynamic discounting) | Términos de pago con descuento configurable, aplicación manual | Términos de pago con descuento, cálculo manual | Motor de términos con descuento automático | Dynamic discounting como producto (Taulia, C2FO, Tipalti) | Programas de descuento dinámico ligados a scoring de proveedor |
| App móvil para aprobar pagos | Odoo mobile con aprobaciones | SAP B1 mobile app con flujo de aprobación de documentos | NetSuite mobile con aprobaciones de PO/pago | Apps móviles nativas de aprobación | — |
| Score de riesgo de cliente/proveedor | Básico (antigüedad + monto) | Básico | SuiteAnalytics con score compuesto | Score de riesgo de proveedor (fraude/cumplimiento) | Score de cobrabilidad multi-factor (el más sofisticado del mercado) |
| Límite de crédito simétrico (cliente Y proveedor) | Límite de crédito de cliente; proveedor sin límite nativo | Límite de crédito de cliente con bloqueo de pedido | Credit Limits and Holds — solo lado cliente, nativo y con bloqueo automático de órdenes | No aplica (son plataformas de pago, no ERP) | No aplica |
| Aprobaciones de pago por monto (workflow) | Reglas de aprobación multi-nivel por monto | Flujo de aprobación de documentos (DAF) | Approval routing configurable por umbral | Aprobaciones multi-nivel nativas | — |
| Conciliación con score de match visible | Reglas + IA con % de confianza | Matching por referencia | AutoCash con reglas ponderadas | Cash application con score de confianza mostrado al usuario | Sí, con % de confianza visible por transacción |

### Prácticas confirmadas por la investigación

**Cobranza automatizada (dunning) como estándar, no como lujo**
Las guías de mercado 2026 (OneAdvanced, Monk, HighRadius) documentan que la cobranza manual (llamadas/emails caso por caso) es la principal causa de DSO alto en pymes. El patrón ganador es una **secuencia de recordatorios automatizados** (dunning sequence): email N días antes del vencimiento, recordatorio al vencer, escalamiento a los 15/30/60 días, con tono y canal ajustados por segmento de cliente o por score de riesgo. KallpaPro ya calcula el score de prioridad en el radar de cartera vencida — el mercado confirma que el siguiente paso natural es **disparar la secuencia automáticamente a partir de ese score**, no dejarlo en manos del usuario para iniciar contacto manual.

**Predicción de pago tardío con IA/ML**
HighRadius y Quadient documentan como caso de uso consolidado (no experimental) el modelo que predice, para cada factura abierta, la probabilidad y fecha esperada de pago basándose en el historial del cliente (patrón de pago, estacionalidad, monto). Esto permite priorizar la cobranza sobre las facturas con mayor riesgo real de impago, en vez de solo por antigüedad o monto — un salto de sofisticación sobre el scoring 4D actual, que puede evolucionar a un modelo de predicción de fecha de pago real.

**Invoice-to-cash touchless y cash application automática**
La categoría "touchless AP/AR" describe el objetivo de que facturas y pagos se concilien sin intervención humana en el caso estándar (factura correcta, pago recibido, match exacto), dejando la intervención humana solo para excepciones. HighRadius reporta implementaciones con >90% de aplicación de pagos automática. El patrón aplicable a KallpaPro es extender la detección de duplicados (ya construida) hacia una conciliación de pagos entrantes con sugerencia automática de la factura que salda, con aceptar/rechazar humano en los casos ambiguos.

**Portales de autoservicio de pago (EIPP)**
La categoría "Electronic Invoice Presentment & Payment" (EIPP) es un segmento de mercado propio (HighRadius, Gaviti, EBizCharge la documentan activamente en 2026): el cliente B2B ve sus facturas pendientes, descarga el estado de cuenta y paga directamente desde un portal, sin llamar o escribir a cobranzas. Esto reduce fricción de cobro y es especialmente valioso para pymes con equipos de cobranza pequeños.

**Descuentos por pronto pago automatizados (dynamic discounting)**
MineralTree, Corpay y HighRadius coinciden en que el descuento por pronto pago dejó de ser una condición fija en el término de pago (ej. "2/10 net 30") para convertirse en un **programa dinámico**: el sistema calcula, para cada factura, el descuento óptimo a ofrecer según cuán rápido se quiera cobrar/pagar y el costo de capital, y lo aplica automáticamente si el pago llega dentro de la ventana. Es una asimetría notable: KallpaPro ya identificó esta brecha internamente y el mercado la confirma como práctica de valor alto y relativamente bajo costo de implementación.

**Límite de crédito simétrico (también para proveedores)**
NetSuite documenta "Credit Limits and Holds" como una función **nativa solo del lado cliente** (bloqueo de nuevas órdenes cuando se supera el límite) — de hecho, la asimetría que tiene KallpaPro (cliente con límite, proveedor sin límite) es coherente con lo que ofrecen los ERP de referencia. Sin embargo, para el caso de uso de una pyme que además de vender también compra a crédito, un "límite de exposición" por proveedor (para controlar concentración de riesgo de pago, no de cobro) es una práctica emergente de gestión de tesorería que aún no está estandarizada en el mercado — se puede tratar como mejora diferenciadora, no como corrección de brecha.

**UX de aprobación: apps móviles y flujos visuales**
SAP Business One (mobile app con flujo de aprobación de documentos) y las plataformas de AP automation (Tipalti, Bill.com) construyen la aprobación de pagos como una experiencia de **tarjetas swipeable / lista priorizada con aprobar-rechazar en un toque**, pensada para que un gerente apruebe pagos desde el celular entre reuniones. El "Modo Experto" y la mesa de trabajo de KallpaPro ya tienen la lógica de priorización (score 0-100); el patrón de mercado sugiere que el siguiente salto de UX es hacer ese flujo utilizable desde un dispositivo móvil con gestos simples.

**Conciliación con score de confianza visible**
Tanto Odoo como HighRadius muestran al usuario el **porcentaje de confianza del match sugerido** (ej. "95% de coincidencia por monto + referencia + fecha"), no solo un sí/no binario. Esto genera confianza en el operador para aceptar sugerencias masivamente en vez de revisar cada una manualmente.

#### Fuentes
- [AP and AR Automation: What It Is, How It Works & Key Benefits in 2026 — OneAdvanced](https://www.oneadvanced.com/resources/how-automation-can-enhance-accounts-payable-and-accounts-receivable-efficiency/)
- [7 Real-World Use Cases Of AI In Accounts Receivable 2026 — HighRadius](https://www.highradius.com/resources/Blog/ai-in-accounts-receivable/)
- [Accounts payable automation trends for 2026: AI, touchless AP, and fraud prevention — Quadient](https://www.quadient.com/en/blog/which-accounts-payable-automation-trends-will-matter-most-2026)
- [AR Collections Guide 2026: Process, Metrics, Tools — Monk](https://monk.com/blog/ar-collections-complete-guide)
- [What are the top ways to implement AI in accounts receivable in 2026? — Quadient](https://www.quadient.com/en-ca/blog/what-are-the-top-ways-to-implement-ai-in-accounts-receivable-in-2026)
- [The Ultimate Guide to Early Payment Discounts — MineralTree](https://www.mineraltree.com/blog/early-payment-discounts/)
- [Early Payment Discounts & Dynamic Discounting Explained — Corpay](https://www.corpay.com/resources/blog/early-payment-discounts-dynamic-discounting)
- [How to Automate Early Payment Discounts in Accounts Payable — Rossum](https://rossum.ai/blog/early-payment-discounts-in-accounts-payable/)
- [What Is Dynamic Discounting? — HighRadius](https://www.highradius.com/resources/Blog/dynamic-discounting-benefits/)
- [Dynamic Discounting Automation: AI-Powered Early Payment — ProcIndex](https://procindex.com/blog/dynamic-discounting-early-payment-ai-automation)
- [Accelerating SAP Business One: Why Mid-Market CFOs are Automating AP in 2026 — AccountingWEB](https://www.accountingweb.co.uk/community/industry-insights/accelerating-sap-business-one-why-mid-market-cfos-are-automating-ap-in)
- [SAP Business One Mobile App User Guide — SAP](https://help.sap.com/doc/1da4d937104747a9b22c61eb1285b0eb/1.2.x/en-US/How_to_Work_with_B1_mobile_app_for_Android.pdf)
- [NetSuite Collections Module Explained: Improve Cash Flow & Reduce DSO — Folio3](https://netsuite.folio3.com/blog/netsuite-collections-module-cash-flow/)
- [Accounts Receivable (AR) Dashboard: Benefits, Examples & Tips — NetSuite](https://www.netsuite.com/portal/resource/articles/accounting/accounts-receivable-ar-dashboard.shtml)
- [Credit Limits for Customers in NetSuite — Anchor Group](https://www.anchorgroup.tech/credit-limits-for-customers-in-netsuite)
- [NetSuite Applications Suite - Managing Customer Credit Limits and Holds — Oracle](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1080144.html)
- [The 5 Best B2B Customer Payment Portals of 2026 — Gaviti](https://gaviti.com/best-b2b-customer-payment-portals/)
- [9 Best EIPP Tools in 2026 to Simplify Invoicing & Payments — HighRadius](https://www.highradius.com/resources/Blog/top-eipp-tools/)
- [Customer Payment Portal for B2B — EBizCharge](https://ebizcharge.com/blog/customer-payment-portal-for-b2b/)

## 2. Nuestro estado actual (KallpaPro)

- Ingresos & Egresos mensual con margen (cuentas 4x/5x).
- Cartera CxC / Pagos CxP con aging (antigüedad de saldos).
- Estado de cuenta de proveedor/cliente: cronología de cargo/pago/nota de crédito con saldo corrido, imprimible.
- Detección de facturas de compra duplicadas.
- Ratios financieros, DCF, escenarios, scoring 4D, cálculo de ahorros ("Modo Experto").
- Insights de IA (con respaldo local si no hay conexión).
- Gestión de cobranza (CxC): historial de contactos + radar de cartera vencida priorizado por score.
- Bandeja de acciones sugeridas: tarjetas de vencidos / vencen esta semana.
- Priorización y programación de pagos (CxP): score 0-100, botón "Programar pago", "Procesar todo".
- "Mesa de trabajo" (workbench) de CxP y CxC: cola priorizada + panel de detalle con acciones en línea (pago parcial, ajuste de saldo/write-off, aplicar nota de crédito manualmente, reclasificar cuenta contable).

## 3. Diagnóstico: brechas frente al mercado

| Brecha | Severidad | Confirmada por investigación |
|---|---|---|
| Recordatorios de cobranza 100% manuales, sin secuencia automática (dunning) | Alta | Sí — es la práctica central de todo especialista de AR automation (HighRadius, Monk, OneAdvanced) y el paso natural sobre el score ya calculado |
| Sin descuentos por pronto pago automatizados (dynamic discounting) | Media-Alta | Sí — categoría de producto propia en 2026, de implementación relativamente accesible |
| Proveedor sin límite de crédito (asimetría con cliente) | Media | Parcial — el mercado tampoco lo estandariza del lado proveedor; es más una oportunidad de diferenciación de tesorería que una corrección de brecha |
| Sin comparativo presupuesto-vs-real en Resultados | Media | Coherente con lo esperado en un módulo de control de gestión, aunque no es foco específico de AP/AR |
| Sin KPIs por departamento ni consolidación multiempresa | Baja (para el segmento pyme) | El mercado lo ofrece en ERP tier-1, pero es sobre-alcance para el segmento objetivo actual |
| Sin motor de reglas configurable de clasificación contable con score de confianza | Media | Sí — patrón "sugerir + aceptar/rechazar" ya validado en Odoo/HighRadius, y coherente con el patrón de IA que KallpaPro ya usa en CRM |
| Sin aprobaciones configurables de pagos por monto | Media-Alta | Sí — es funcionalidad estándar (workflow de aprobación por umbral) en los 3 ERP de referencia y en las plataformas de AP dedicadas |
| Sin matching de conciliación con score visible | Media | Sí — patrón consolidado en Odoo y HighRadius (mostrar % de confianza, no solo sí/no) |
| Sin portal de autoservicio de pago para clientes (EIPP) | Media-Alta | Sí — categoría de producto activa en 2026; reduce carga del equipo de cobranza |
| Sin predicción de pago tardío basada en histórico (ML) | Media (mejora de siguiente nivel sobre el scoring 4D actual) | Sí — caso de uso consolidado en HighRadius |

## 4. Propuestas de mejora

### Flujo de trabajo
1. **Automatizar la secuencia de cobranza (dunning) a partir del score ya calculado**: cuando una factura entra en el radar de cartera vencida con score alto, disparar automáticamente un recordatorio por email (plantilla configurable) en los hitos N días antes del vencimiento, al vencer, y a los 15/30/60 días de mora — dejando el contacto manual para casos que la secuencia automática no resuelve.
2. Añadir un flujo de **aprobación de pagos por monto**: definir umbrales (ej. hasta $500 auto-aprobado por el rol de tesorería, más de $500 requiere aprobación de un segundo rol) integrado a la mesa de trabajo de CxP, de modo que "Procesar todo" respete la matriz de aprobación en vez de ejecutar todo sin control.
3. Incorporar el **descuento por pronto pago** como un campo del término de pago y aplicarlo automáticamente en la mesa de trabajo cuando el pago se registre dentro de la ventana (ej. 2/10 neto 30), con visibilidad del ahorro/costo en el detalle de la factura.
4. Extender la detección de duplicados hacia una **conciliación de pagos entrantes**: al registrar un pago o al importar un extracto, sugerir la(s) factura(s) que probablemente salda, con score de confianza y acción de aceptar/rechazar (mismo patrón human-in-the-loop del CRM).

### Sistema de organización / configuración
5. Configuración de **plantillas de dunning** por segmento de cliente (ej. cliente estratégico vs. cliente ocasional) con tono y canal ajustables, reutilizando el motor de scoring existente para decidir a quién aplicar qué secuencia.
6. Definir un **límite de exposición por proveedor** (monto máximo de CxP pendiente antes de alertar a tesorería), simétrico en experiencia de configuración al límite de crédito del cliente, aunque con semántica distinta (riesgo de concentración de pago, no de cobro).
7. Motor de reglas configurable de clasificación contable con score de confianza: permitir que el sistema sugiera la cuenta contable de una transacción no mapeada, mostrando el nivel de confianza y dejando la confirmación al usuario — extensión natural del `AccountMapping` existente.

### Experiencia de usuario (frontend operativo)
8. Vista móvil simplificada de la mesa de trabajo de CxP para aprobación de pagos: tarjetas con aprobar/rechazar en un toque, pensada para uso desde celular, siguiendo el patrón de las apps de aprobación de SAP B1 y plataformas de AP dedicadas.
9. Mostrar el **score de confianza del match** en cualquier sugerencia automática (conciliación de pagos, clasificación contable, aplicación de nota de crédito), no solo aceptar/rechazar binario — consistente con el patrón de transparencia que ya usa KallpaPro en sus insights de IA.
10. Portal de autoservicio básico para clientes: vista de solo lectura de facturas pendientes y estado de cuenta, con opción de registrar/confirmar un pago, reduciendo la carga operativa del equipo de cobranza en clientes de bajo riesgo.

### Actualizaciones futuras (mercado emergente / IA)
11. Modelo de predicción de pago tardío basado en histórico del cliente (fecha probable de pago, no solo score de prioridad), como evolución natural del scoring 4D existente.
12. Programa de descuento dinámico (dynamic discounting) más sofisticado: en vez de un descuento fijo por término de pago, calcular el descuento óptimo según el costo de capital y la urgencia de cobro/pago del período.
13. Explorar integración de pasarela de pago para que el portal de autoservicio de clientes permita pago directo en línea (tarjeta/transferencia), cerrando el ciclo invoice-to-cash sin intervención manual para el caso estándar.

## 5. Qué NO tocar

- **Consolidación multiempresa y KPIs por departamento tipo NetSuite/SAP B1 corporativo**: son capacidades de ERP tier-1 para grupos con múltiples entidades legales o centros de costo complejos; el segmento objetivo (pyme/mediana empresa individual) no las necesita y añadirlas ahora complicaría el modelo de datos de CxP/CxC sin beneficio inmediato.
- **Plataforma de pagos globales tipo Tipalti (pagos masivos multi-moneda, cumplimiento fiscal internacional de proveedores, gestión de retenciones internacionales)**: Tipalti resuelve el caso de uso de empresas con miles de proveedores/beneficiarios en decenas de países; KallpaPro opera en un mercado local ecuatoriano B2B con proveedores nacionales — construir esa capa de complejidad regulatoria internacional no tiene demanda real en el segmento actual.
- **EIPP de nivel enterprise con motor de disputa de facturas y negociación de descuentos en línea (como HighRadius)**: el portal de autoservicio propuesto (punto 10) cubre el 80% del valor (ver factura, pagar) sin construir un módulo completo de gestión de disputas, que agrega complejidad de workflow desproporcionada para el tamaño de cliente objetivo.
- **Score de cobrabilidad multi-factor de nivel HighRadius (decenas de variables, aprendizaje continuo sobre miles de clientes)**: KallpaPro ya tiene un scoring 4D funcional; replicar la sofisticación de un especialista de mercado medio-alto que entrena modelos sobre carteras masivas no es viable ni necesario para carteras de pyme de decenas o cientos de clientes — el salto propuesto (predicción de fecha de pago, punto 11) es el techo razonable para este segmento.
