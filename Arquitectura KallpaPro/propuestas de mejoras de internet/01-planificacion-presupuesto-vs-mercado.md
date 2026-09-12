# 1. Planificación y Presupuesto — comparación con mejores prácticas de mercado

> 📍 Ubicación en KallpaPro: Financiero → Presupuestos (`BudgetControl`), con enganche automático desde Compras (`budget.service.checkBudget`) y desde Inventario (reorder-suggestions).

## 1. Investigación: qué hacen los mejores en planificación y presupuesto en 2026

| Práctica | Odoo 18 | SAP Business One | NetSuite (NSPB) | Microsoft Dynamics 365 Business Central |
|---|---|---|---|---|
| Modelo de presupuesto | Presupuestos por analítica (proyecto/departamento/cuenta), con líneas por período fiscal, "Budgetary Position" para agrupar cuentas | Reportes de presupuesto por centro de costo/proyecto sobre el motor financiero de HANA, comparación real vs. presupuestado en informes financieros nativos | Planificación multi-escenario (mejor/peor/base) con NetSuite Planning and Budgeting (NSPB), integrado a OneStream/Oracle EPM | Presupuestos por cuenta G/L, dimensión y período, integrados a "General Ledger Setup"; comparación en "Trial Balance/Budget" |
| Forecasting rolling vs. anual fijo | Soporta re-presupuestación manual por período; no tiene rolling forecast nativo (se logra con analítica + revisiones periódicas) | Igual: presupuesto anual fijo, revisión manual; rolling forecast requiere add-ons de terceros | NSPB soporta forecast continuo (rolling 12-18 meses), revisión mensual/trimestral con "reforecast" automático que jala el actual | Presupuestos anuales; "rolling budget" posible mediante Power BI + Jobs, no nativo en el core |
| Alertas de sobregiro | Barra de progreso visual (% consumido) en la vista de presupuesto, colores por umbral | Alertas configurables por "Approval Procedure" cuando una orden excede el presupuesto de un proyecto | Alertas automáticas por email/dashboard cuando el gasto real supera X% del forecast; soporta "budget vs actual" en tiempo real vía saved searches | Notificaciones de workflow cuando una compra excede el presupuesto disponible de la dimensión |
| Escenarios (best/worst/base case) | No nativo; se simula duplicando presupuestos | No nativo | Sí, núcleo de NSPB: múltiples escenarios paralelos comparables en un mismo dashboard | Limitado; se resuelve con Power BI o Jet Reports |
| Presupuesto vs. real en tiempo real | Sí, ligado a asientos contables en tiempo real (no batch) | Sí, vía HANA in-memory, consulta instantánea | Sí, "real-time" porque se alimenta del GL vía integración continua | Sí, vía Business Central cube/Power BI embebido |
| Vinculación presupuesto-compras (bloqueo preventivo) | Vía validaciones en analítica; no bloquea automáticamente por defecto | "Budget Approval Procedure": puede bloquear o advertir documentos de compra que exceden presupuesto, antes de contabilizar | Vía "Commitment-based budgeting": el compromiso (PO abierta) descuenta el presupuesto disponible aunque no se haya facturado | Presupuesto por dimensión ligado a compras vía flujo de aprobación, opcionalmente bloqueante |
| Forecasting con IA | Módulo de previsión de demanda en Inventario (no en Presupuesto per se) | No nativo | NSPB incluye "Predictive Planning" con ML para proyectar tendencias de ingreso/gasto | Copilot en Business Central sugiere previsiones de flujo de caja basado en históricos |

### Prácticas confirmadas por la investigación

**Rolling forecast y periodicidad**
- El estándar de mercado en 2025-2026 está migrando del presupuesto anual fijo (`static annual budget`) hacia el "rolling forecast" — revisiones trimestrales o mensuales que extienden el horizonte hacia adelante, en vez de fijar el año completo en enero y no tocarlo. Fuentes de la industria (Farseer, Aleph, Consolidate.io) documentan que empresas con ciclos de negocio volátiles adoptan rolling forecast de 12-18 meses con reforecast mensual ([Farseer](https://www.farseer.com/blog/rolling-forecast/), [Aleph](https://www.getaleph.com/answers/rolling-reforecast-budgeting-tools)).
- Para pymes, la recomendación de mercado no es abandonar el presupuesto anual sino usar un **modelo híbrido**: presupuesto anual como ancla de gobierno + reforecast trimestral ligero que ajusta el resto del año sin rehacer todo el ejercicio ([Onetribe Advisory](https://www.onetribeadvisory.com/knowledge-hub/rolling-forecast-vs-annual-budget/), [Beancount.io](https://beancount.io/blog/2026/07/17/rolling-forecast-vs-annual-budget-small-business-guide)).

**Compromisos (commitment accounting) — no solo real vs. presupuesto**
- La práctica más citada como diferenciadora en 2025-2026 es el "commitment-based budgeting": el presupuesto disponible se descuenta en el momento en que se emite la orden de compra (compromiso), no cuando llega la factura. Esto evita el efecto "presupuesto verde en pantalla, pero ya comprometido en el papel" ([Softengine – Budgeting and Forecasting with ERP](https://softengine.com/budgeting-and-forecasting-with-erp/)).
- NetSuite formaliza esto como triple capa: **Presupuestado → Comprometido (OC abiertas) → Ejecutado (facturado/pagado)**, mostrando las tres cifras simultáneamente en el dashboard de presupuesto.

**Alertas y gobierno de sobregiro**
- Los líderes de mercado no solo muestran una barra de progreso; envían alertas proactivas (email/notificación in-app) cuando el consumo cruza umbrales configurables (ej. 80%, 100%, 110%), y algunos bloquean documentos que excedan el presupuesto salvo aprobación explícita de un nivel superior — no es un bloqueo ciego, es una excepción con flujo de aprobación (SAP Business One "Budget Approval Procedure").

**Escenarios y planificación multidimensional**
- NSPB y las suites de EPM (Oracle, OneStream, Anaplan) popularizaron la planificación por escenarios (base/optimista/pesimista) como estándar para empresas medianas con más de una unidad de negocio o alta exposición a variables externas (tipo de cambio, precios de insumos) ([Cirrus ERP](https://www.cirrus-erp.com/resources-library/why-finance-leaders-are-embracing-scenario-planning-in-2025)).

**IA en planificación financiera**
- Microsoft Copilot en Business Central y "Predictive Planning" en NSPB usan modelos de series de tiempo para sugerir el próximo forecast a partir del histórico, siempre presentado como sugerencia editable, no como cifra final impuesta — patrón de "humano en el loop" también aplicado a presupuestos, igual que en compras/CRM.

### Fuentes
- [Best practices for budgeting and financial planning in 2026 — Pex](https://www.pexcard.com/blog/best-practices-budgeting-financial-planning/)
- [Rolling forecast software: 2026 buyer's guide — Aleph](https://www.getaleph.com/answers/rolling-reforecast-budgeting-tools)
- [Rolling Forecast vs. Annual Budget: Which Should a Small Business Use? — Beancount.io](https://beancount.io/blog/2026/07/17/rolling-forecast-vs-annual-budget-small-business-guide)
- [5 Best ERP Budgeting Software for 2026 — Consolidate.io](https://www.consolidate.io/blog/5-best-erp-budgeting-software)
- [Budgeting and Forecasting: 10 Best Practices with Your ERP — Softengine](https://softengine.com/budgeting-and-forecasting-with-erp/)
- [Rolling Forecasts: The Complete FP&A Guide — Farseer](https://www.farseer.com/blog/rolling-forecast/)
- [Rolling Forecast vs Annual Budget — Onetribe Advisory](https://www.onetribeadvisory.com/knowledge-hub/rolling-forecast-vs-annual-budget/)
- [Optimized Budget Management with Odoo 18.0 — Cleverence](https://www.cleverence.com/articles/odoo-documentation/budgets-odoo-documentation-6842/)
- [Odoo 18 Budget Management — Odoo Apps Store](https://apps.odoo.com/apps/modules/18.0/base_account_budget)
- [Budgets in Odoo 18 — TenthPlanet Technologies](https://tenthplanet.in/odoo/product/budget/budgets-in-odoo-18/)
- [Odoo 18 Project Budget Management: Track Revenue, Expenses, Real-Time Alerts — Braincuber](https://www.braincuber.com/tutorial/odoo-18-project-budget-management-analytic-accounting)
- [Budgets in SAP Business One — SAP B1 Blog](https://sap-b1-blog.com/en/budgets-in-sap-business-one/)
- [SAP B1 9.0 Financial Forecast & Budget Applications — Clients First](https://clientsfirst-us.com/blog/sap-business-one-9-0-financial-forecast-budget-applications)
- [Budget Management in SAP Business One — Vinasystem](https://vinasystem.com/en/blogs/sap-hana/budget-management-in-sap-business-one)
- [A Guide to NetSuite Planning and Budgeting — Folio3](https://netsuite.folio3.com/blog/elevating-your-businesss-financial-health-a-guide-to-netsuite-planning-and-budgeting/)
- [NetSuite Planning and Budgeting — NetSuite oficial](https://www.netsuite.com/portal/products/erp/financial-management/financial-planning.shtml)
- [NetSuite Planning and Budgeting (NSPB): Comprehensive Guide — Houseblend](https://www.houseblend.io/articles/netsuite-planning-budgeting-nspb-overview)
- [Why Scenario Planning Wins in 2025 — Cirrus ERP](https://www.cirrus-erp.com/resources-library/why-finance-leaders-are-embracing-scenario-planning-in-2025)
- [NetSuite Budgeting and Planning: Top 5 Powerful Benefits — Nuage](https://nuagecg.com/blog/netsuite-budgeting-and-planning/)
- [Setting Up Purchase Approval Workflows in Dynamics 365 Business Central — IES](https://www.iesgp.com/blog/setting-up-purchase-approval-workflows-in-dynamics-365-business-central)
- [Workflows in Dynamics 365 Business Central — Microsoft Learn](https://learn.microsoft.com/en-us/dynamics365/business-central/across-workflow)

## 2. Nuestro estado actual (KallpaPro)

- Presupuesto anual por departamento vs. real, con entidad `BudgetControl`, visible en Financiero → Presupuestos.
- Control presupuestario automático al aprobar cada Requisición u Orden de Compra en el módulo de Compras, vía `budget.service.checkBudget` — esto ya implementa parcialmente el concepto de "commitment accounting" del mercado, porque el chequeo ocurre en el momento de la aprobación, no solo al facturar.
- Punto de reorden con sugerencias automáticas en Inventario (reorder-suggestions), que alimenta indirectamente la planificación de compra.
- Identificado internamente como pendiente: predicción de demanda con IA, hoy parcial porque depende de Ollama como componente opcional (no siempre disponible en todas las instalaciones/tenants).

## 3. Diagnóstico: brechas frente al mercado

| Práctica confirmada en el mercado | ¿La tenemos? | Comentario |
|---|---|---|
| Presupuesto anual fijo | Sí | Cubierto |
| Chequeo de presupuesto al aprobar OC/Requisición (compromiso) | Sí | Cubierto, es más avanzado que Odoo estándar |
| Rolling forecast / reforecast periódico | No | Solo existe el presupuesto anual estático; no hay mecanismo de revisión trimestral que ajuste el resto del año |
| Triple vista Presupuestado / Comprometido / Ejecutado en un mismo panel | Parcial | El chequeo de compromiso existe en backend (`checkBudget`), pero no hay evidencia de que el dashboard de `BudgetControl` muestre las tres cifras separadas — probablemente solo presupuestado vs. real ejecutado |
| Alertas proactivas de sobregiro (email/notificación) al cruzar umbral, no solo color en pantalla | No confirmado | No hay mención de alertas push/email por umbral de presupuesto, solo el bloqueo/chequeo puntual en Compras |
| Aprobación de excepción cuando se excede presupuesto (en vez de bloqueo ciego) | Parcial | Existe la matriz de aprobación L1-L5 para OC por monto, pero no está claro si hay un flujo específico de "excepción de presupuesto" separado del flujo normal de aprobación |
| Escenarios (base/optimista/pesimista) | No | No existe planificación multi-escenario |
| Forecasting con IA aplicado directamente al presupuesto financiero (no solo a demanda de inventario) | No | El pendiente de IA identificado es solo para demanda de inventario, no para proyección de gasto/ingreso departamental |

## 4. Propuestas de mejora

### Flujo de trabajo
1. **Reforecast trimestral asistido**: agregar un botón "Revisar proyección" en Financiero → Presupuestos que, al cierre de cada trimestre, permita ajustar los 3 trimestres restantes del año sin reabrir todo el presupuesto anual. El sistema pre-llena el ajuste sugerido usando el promedio de ejecución real de los meses transcurridos, y el usuario aprueba o edita línea por línea antes de confirmar (patrón sugerencia-aceptar-editar-rechazar).
2. **Vista de triple capa Presupuestado / Comprometido / Ejecutado**: en la pantalla de detalle de `BudgetControl` por departamento, agregar una tercera columna "Comprometido" que sume el monto de Requisiciones y OC aprobadas pero aún no facturadas contra ese departamento/centro de costo, calculada en tiempo real desde `budget.service`. Hoy probablemente solo se ve Presupuestado vs. Ejecutado.
3. **Flujo de excepción de sobregiro**: cuando `checkBudget` detecte que una Requisición/OC excede el presupuesto disponible del departamento, en vez de solo bloquear o solo advertir, disparar automáticamente una notificación al aprobador de nivel superior de la matriz L1-L5 con el detalle del exceso, y registrar la decisión (aprobado/rechazado con motivo) como parte del historial de auditoría de esa OC.

### Sistema de organización / configuración
4. **Umbrales de alerta configurables por departamento**: en la configuración de `BudgetControl`, permitir definir 2-3 umbrales (ej. 80%, 95%, 100%) por departamento, cada uno con una acción distinta (notificar al responsable, notificar al gerente financiero, requerir aprobación adicional). Hoy el control parece ser binario (dentro/fuera de presupuesto).
5. **Periodicidad configurable del presupuesto**: permitir elegir, al crear un `BudgetControl`, si el ciclo es "anual fijo" (como hoy) o "anual con reforecast trimestral", sin necesitar dos módulos distintos — es la misma tabla, con una bandera de periodicidad y una fecha de "última revisión".
6. **Escenarios ligeros (opcional, por plan/suscripción)**: para el plan más alto del módulo Financiero, permitir clonar un `BudgetControl` como "escenario" (ej. "Presupuesto 2027 – conservador" vs. "– optimista") y compararlos lado a lado en una sola pantalla, sin duplicar la complejidad de un motor EPM completo.

### Experiencia de usuario (frontend operativo)
7. **Dashboard de presupuesto con semáforo y barra de tres segmentos**: en la pantalla principal de Presupuestos, cada departamento debe mostrar una sola barra visual dividida en tres colores (ejecutado, comprometido, disponible) en vez de solo un porcentaje, siguiendo el patrón visual que usan Odoo y NetSuite para que el usuario entienda de un vistazo cuánto le queda realmente disponible, no solo cuánto ha gastado.
8. **Notificación in-app + badge** en el ícono de Presupuestos cuando cualquier departamento cruce el umbral de alerta configurado, con un listado accionable ("Ver requisiciones pendientes que afectan este presupuesto").
9. **Exportación rápida a Excel/PDF del comparativo presupuesto vs. real vs. comprometido** por departamento y por rango de fechas, para los gerentes que necesitan llevarlo a una reunión sin acceso al sistema.

### Actualizaciones futuras (mercado emergente / IA)
10. **Reforecast asistido por IA**: usar el mismo motor que se plantea para predicción de demanda (hoy dependiente de Ollama opcional) para sugerir automáticamente el ajuste de presupuesto restante del año en el flujo de reforecast trimestral (punto 1), mostrando la sugerencia con opción de aceptar/editar/rechazar — replicando el patrón "humano en el loop" que KallpaPro ya usa en CRM y en el centro de trabajo de facturas SRI.
11. **Detección de anomalías de gasto**: alertar cuando el gasto real de un departamento en un mes se desvía más de X% de su patrón histórico, incluso si no ha superado el presupuesto total del año — señal temprana antes de que el sobregiro sea evidente.
12. **Explicación en lenguaje natural del estado del presupuesto**: un resumen generado (ej. "Marketing lleva 72% ejecutado con 3 meses restantes; a este ritmo cerrará en 96%") en la parte superior del dashboard, en vez de que el gerente tenga que interpretar tablas.

## 5. Qué NO tocar

- **Motor de planificación multi-escenario tipo EPM (Anaplan/OneStream/NSPB completo)**: implica modelado dimensional pesado, versionamiento de escenarios ilimitado y consolidación multi-entidad — sobre-ingeniería para una pyme ecuatoriana con una sola razón social por tenant. La versión "ligera" de escenarios (punto 6) es suficiente.
- **Forecast continuo mensual obligatorio para todos los clientes**: forzar rolling forecast mensual a una pyme pequeña que apenas está adoptando presupuestación formal generaría fricción y abandono. El reforecast trimestral opcional (punto 1) es el nivel de madurez correcto; el mensual puede ofrecerse como opción avanzada, no como default.
- **Integración con suites de Corporate Performance Management externas (Oracle EPM, OneStream)**: el mercado enterprise las usa para consolidar múltiples subsidiarias y monedas; KallpaPro es multi-tenant por `companyId` con una empresa por tenant, no multi-entidad consolidada, así que esa capa de integración no aporta valor al segmento objetivo.
- **Presupuestación en cascada con múltiples ciclos de revisión y aprobación por comité (típico de grandes corporativos)**: para pymes de 5-200 empleados, un solo nivel de aprobación de presupuesto (el gerente financiero o el dueño) es suficiente; replicar comités de presupuesto de multinacional añadiría pasos burocráticos sin beneficio real para el segmento.
