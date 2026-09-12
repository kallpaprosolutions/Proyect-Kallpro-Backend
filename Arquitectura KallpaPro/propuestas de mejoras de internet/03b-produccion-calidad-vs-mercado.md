# 3b. Producción y Calidad — comparación con mejores prácticas de mercado

> 📍 Ubicación: Módulo 3b — Producción y Calidad. Backend: `apps/api/src/modules/manufacturing/*`, `apps/api/src/modules/quality/*`, `journal.service` para el asiento de transformación. Frontend: `apps/web/src/modules/manufacturing/*`, `apps/web/src/modules/quality/*`.

## 1. Investigación: qué hacen los mejores ERP/MES/QMS en 2026

| Práctica | Odoo 18 Manufacturing/Quality | SAP Business One (Production/QM) | NetSuite Manufacturing | ISO 9001:2015 / ISO 22000 (HACCP) |
|---|---|---|---|---|
| Rutas con operaciones múltiples | Work Centers + Routing con múltiples operaciones secuenciales, tiempos por operación, tablet view por work center | Rutas de producción (Bill of Operations) con centros de trabajo | Routing con operation sequences y work centers | No aplica (norma de gestión, no de proceso productivo) |
| Capacity planning / cuellos de botella | Work Center capacity, "Planning" Gantt con carga por centro, alertas de sobrecarga | Capacity planning con MRP run y reportes de carga | Finite/infinite capacity planning en Manufacturing Work Center | No aplica |
| Recepción con inspección de calidad | Quality Control Points configurables por punto (recepción, producción, entrega) con "Quality Checks" que bloquean el flujo si no pasan | QM inspection en recepción de mercancía (goods receipt inspection) | Quality inspection plans vinculados a recepción de OC | ISO 9001 §8.4 (control de proveedores externos) exige verificar productos comprados |
| Auditorías internas y control de documentos | Módulo "Quality" con checklists de auditoría; control documental vía Knowledge/Documents app | QM con planes de inspección documentados; control de documentos vía DMS integrado | Documentos de calidad versionados en File Cabinet | ISO 9001 §9.2 (auditoría interna obligatoria) y §7.5 (información documentada: control de versión, aprobación, distribución) |
| Maestro de equipos con calibración | App "Maintenance" con equipos, calibración programada, alertas de vencimiento | Equipment master con planes de mantenimiento preventivo | Asset management con calendarios de mantenimiento | ISO 9001 §7.1.5 exige que el equipo de medición esté calibrado, trazable a patrones, con registro de calibración vigente |
| Reproceso automático | "Scrap"/"Rework" genera nueva orden de fabricación vinculada automáticamente en configuraciones avanzadas | Reproceso vía nueva orden de producción manual referenciando la no conformidad | Rework order vinculado al work order original | ISO 9001 §8.7 exige que la disposición de no conformes (incluido reproceso) quede documentada y verificada |
| Trazabilidad hacia adelante (forward) | "Traceability Report" en un clic: de lote de materia prima → todas las órdenes → todos los clientes que recibieron producto derivado | Where-used / batch traceability report | Lot traceability con forward/backward trace en un reporte | ISO 22000/HACCP y trazabilidad general de alimentos exige poder recuperar hacia adelante en minutos (requisito de retiro de producto/recall) |
| Inspección visual con IA / computer vision | Integraciones de terceros (cámaras + modelos de visión) para defectos superficiales en líneas de alto volumen | SAP + IoT/AI add-ons para inspección visual en industrias específicas | Integraciones vía partners para visión artificial | No lo exige la norma, pero es tendencia de la industria 2025-2026 en manufactura discreta |
| Mantenimiento/falla predictiva | Maintenance app con "Preventive Maintenance" calendarizado; predictivo vía IoT en ediciones/partners | PM (mantenimiento preventivo) nativo; predictivo vía SAP Predictive Maintenance and Service (add-on) | Asset performance management con partners de IoT | No aplica (fuera de alcance de la norma) |
| Digital twin de línea | No nativo; requiere partners de manufactura avanzada (Siemens, etc.) | SAP Digital Manufacturing Cloud (producto separado, no B1) | No nativo | No aplica |

**Prácticas confirmadas por la investigación**

*Planeación y capacidad*
- **Rutas con múltiples operaciones secuenciales por centro de trabajo** (routing) es estándar en manufactura discreta desde nivel pyme hacia arriba — permite calcular tiempos reales, no solo "una orden = un paso".
- **Capacity planning con visibilidad de cuellos de botella** (Theory of Constraints: identificar el recurso más restrictivo y planificar alrededor de él, no optimizar cada estación por separado) es la práctica confirmada en Odoo, SAP y NetSuite mediante vistas de carga por centro de trabajo/Gantt.
- El principio de **Theory of Constraints (TOC)** de Goldratt sigue siendo la base conceptual recomendada en 2025-2026 para priorizar dónde invertir en capacidad: mejorar cualquier estación que no sea el cuello de botella no aumenta el throughput total.

*Calidad conectada al flujo físico*
- **Inspección de recepción de materia prima** ligada a la orden de compra es práctica estándar (Odoo Quality Control Points, SAP QM en Goods Receipt) — evita que material defectuoso entre a producción.
- **Reproceso que genera automáticamente una nueva orden de producción** vinculada a la no conformidad de origen es el patrón maduro frente a solo "registrar" el reproceso.
- **Trazabilidad hacia adelante en un clic** (de lote de materia prima → todas las órdenes de producción → todos los despachos/clientes) es un requisito explícito en industrias reguladas (alimentos, farmacéutica) para poder ejecutar un retiro de producto (recall) en minutos, no días.

*Cumplimiento documental ISO 9001*
- **§7.1.5 (recursos de seguimiento y medición)**: exige un maestro de equipos de medición con calibración trazable a patrones nacionales/internacionales, con periodicidad y registro — confirmado como brecha típica en organizaciones que solo controlan el producto pero no los instrumentos que lo miden.
- **§9.2 (auditoría interna)** y **§7.5 (información documentada)**: exigen un programa de auditorías internas planificado y un control de versiones/aprobación de documentos (procedimientos, instructivos) — es requisito de certificación, no opcional para quien busca o mantiene ISO 9001.

*Tendencias emergentes de IA en manufactura 2025-2026*
- **Inspección visual por computer vision** para defectos superficiales está madurando rápido en manufactura discreta (empaque, textil, metalmecánica) como complemento (no reemplazo) de la inspección humana — se integra vía cámara + modelo, con el resultado presentado como sugerencia para que un operario confirme.
- **Mantenimiento predictivo** (predecir falla de equipo antes de que ocurra, vía sensores/IoT + modelos) es tendencia fuerte en 2026, pero depende de instrumentación física (sensores) que la mayoría de pymes no tiene instalada.
- **Digital twin de línea completa** es una capacidad de manufactura avanzada (automotriz, electrónica de alto volumen) ofrecida como producto separado incluso por SAP (Digital Manufacturing Cloud), no parte de un ERP núcleo ni siquiera en SAP Business One.
- El patrón de **"IA con humano en el loop"** (sugerencia con aceptar/rechazar, nunca autoejecución) es la forma responsable en que la industria está introduciendo IA en planeación y calidad — mismo patrón que forecasting de demanda en supply chain.

**Fuentes**
- [Manufacturing | Features | Odoo](https://www.odoo.com/app/manufacturing-features)
- [Odoo Manufacturing (MRP) Setup: BOM, Routing & Work Orders 2026](https://www.odooskillz.com/blog/odoo-skillz-insights-1/odoo-manufacturing-mrp-bom-work-orders-routing-guide-2026-344)
- [Odoo Manufacturing Module: Smart MRP, Production Planning & Automation](https://synconics.ca/odoo-mrp/)
- [Odoo for Manufacturing | MRP, BOM, Quality, Shop Floor](https://www.techultrasolutions.com/industries/manufacturing)
- [What Is an MRP System? Material Requirements Planning](https://www.ecisolutions.com/en-au/blog/manufacturing/what-is-mrp/)
- [What is MRP? The Key to Efficient Manufacturing | SAP](https://www.sap.com/resources/what-is-material-resource-planning-mrp)
- [Bottleneck & Constraint Analysis in Manufacturing](https://www.planettogether.com/aps/best-practices/bottleneck-and-constraint-analysis-in-manufacturing)
- [Capacity Planning in Manufacturing ERP: Avoiding Bottlenecks Before They Happen | Bizowie](https://bizowie.com/capacity-planning-in-manufacturing-erp-avoiding-bottlenecks-before-they-happen)
- [Production Planning 2026 — MRP, MRP-II, APS, Top Vendors](https://erp-software.org/en/production-planning/)
- [Best Non-Conformance Management Software 2026](https://goaudits.com/blog/non-conformance-management-software/)
- [CAPA Requirements in ISO 9001:2015 | isoTracker](https://www.isotracker.com/blog/capa-requirements-in-iso-90012015/)
- [Nonconformity Management in QMS: Best Practices and Effective Strategies](https://www.qualityze.com/blogs/nonconformity-management)
- [What Is ISO 22000 Food Safety Management System? (2026 Guide Update)](https://www.fooddocs.com/post/iso-22000)
- [A Practical Guide to ISO 22000 for Food Manufacturers](https://foodready.ai/blog/iso-22000-for-food-manufacturers/)
- [Best HACCP Software in 2026 | IONI AI](https://ioni.ai/post/best-haccp-software)
- [ISO 9001 - Clause 7.1.5: Calibrated Equipment Procedure](https://www.scribd.com/document/744168218/ISO-9001-Clause-7-1-5-Calibrated-Equipment-Procedure)
- [Clause 7.1.5 ISO 9001 Explained | Core Business Solutions](https://www.thecoresolution.com/clause-7-1-5-iso-9001-explained)
- [7.1.5 Monitoring and Measuring Resources for ISO 9001](https://www.iso-9001-checklist.co.uk/7.1.5-monitoring-and-measuring-resources-for-iso-9001.htm)
- [AI in manufacturing: Benefits and use cases [2026 Guide] | Standard Bots](https://standardbots.com/blog/ai-manufacturing)
- [What is a Manufacturing Execution System (MES)? | QAD Blog](https://www.qad.com/blog/2026/02/what-is-mes-manufacturing-execution-systems)
- [Computer Vision Applications in Manufacturing for 2026 | AI-innovate](https://ai-innovate.com/computer-vision-applications-manufacturing-2026/)
- [Top Digital Twin Companies for Manufacturing (2026) | Treeview](https://treeview.studio/blog/digital-twin-companies-manufacturing)
- [Digital Manufacturing with SAP: Powering the Future of Intelligent, Connected Factories](https://koerber-stellium.com/digital-manufacturing-with-sap-powering-the-future-of-intelligent-connected-factories/)
- [Human-in-the-Loop Supply Chain: Turning AI Into Decisions You Can Actually Execute](https://intuendi.com/resource-center/human-the-loop-supply-chain/)

## 2. Nuestro estado actual (KallpaPro)

- BOM (lista de materiales) y órdenes de producción que consumen materia prima por capas FIFO reales.
- Trazabilidad hacia atrás: qué lote de materia prima entró a cada orden de producción.
- El producto terminado nace con lote y fecha de vencimiento (`shelfLifeDays` del producto).
- Control de calidad: especificaciones por producto (numérico con rango, sí/no, texto), marca de Punto Crítico de Control (PCC/HACCP), método de ensayo.
- Lote nace en CUARENTENA si el producto exige control de calidad; solo se libera con inspección aprobada, firmada (quién y cuándo).
- No conformidades con disposición (reproceso/desecho/concesión/devolución) y ciclo CAPA completo: causa raíz → acción correctiva → verificación de eficacia obligatoria antes de cerrar.
- Registro sanitario ARCSA (Ecuador) por producto con alerta de vencimiento.
- Certificado de análisis imprimible (especificación vs resultado).
- El despacho de ventas bloquea lotes no liberados o rechazados.
- Costeo real del producto terminado (no estimado) + asiento contable automático de la transformación (materia prima → producto terminado).
- Cumple: ISO 9001 §8.5.2 (trazabilidad), §8.6 (liberación), §8.7 (no conformes), §10.2 (CAPA), §9.1 (KPIs de calidad), ISO 22000/HACCP (PCC).

## 3. Diagnóstico: brechas frente al mercado

| Práctica confirmada en el mercado | ¿La tenemos? |
|---|---|
| Rutas con múltiples operaciones/etapas por centro de trabajo | No — producción es de un solo paso |
| Capacity planning / visibilidad de cuellos de botella (TOC) | No |
| Inspección de calidad activada en recepción de materia prima (OC) | No — el modelo lo soporta pero no está activada |
| Reproceso que genera automáticamente nueva orden de producción | No — REWORK se registra pero requiere crear la orden manualmente |
| Trazabilidad hacia adelante en un clic (lote → todos los clientes) | No — hoy requiere buscar por referencia de envío/factura |
| Maestro de equipos con calibración (§7.1.5) | No |
| Auditorías internas planificadas (§9.2) | No |
| Control de documentos con versión/aprobación (§7.5) | No |
| Inspección visual por IA/computer vision | No (no aplica aún, ver sección 5) |
| Mantenimiento predictivo | No (no aplica aún, ver sección 5) |

## 4. Propuestas de mejora

### Flujo de trabajo
1. **Inspección de recepción activada**: al confirmar la recepción de una orden de compra para un producto marcado como "requiere control de calidad de entrada", generar automáticamente un registro de inspección en estado PENDIENTE que bloquea el ingreso del lote a inventario disponible hasta su liberación — reutilizando el mismo motor de cuarentena/liberación que ya existe para producto terminado.
2. **Reproceso automático**: cuando la disposición de una no conformidad sea "REPROCESO", generar automáticamente una nueva orden de producción en estado borrador, pre-cargada con el lote/cantidad afectada como material de entrada y vinculada a la no conformidad de origen (para trazabilidad del ciclo completo).
3. **Rutas de producción con etapas**: extender `ProductionOrder` para soportar una lista ordenada de operaciones (ej. Mezclado → Envasado → Etiquetado), cada una con su propio centro de trabajo, tiempo estimado/real y responsable; el producto en proceso pasa de etapa a etapa (ya existe la cuenta contable de producto en proceso, solo falta el flujo operativo que la use).
4. **Trazabilidad hacia adelante en un clic**: nueva pantalla "Trazabilidad de lote" donde, dado un lote de materia prima o de producto terminado, se muestre en árbol expandible todas las órdenes de producción que lo consumieron y todos los documentos de venta/despacho donde terminó — consulta ya resoluble con los datos actuales (`InventoryBatch`, `ProductionOrder`, líneas de venta), falta solo la vista agregada.

### Sistema de organización / configuración
5. **Maestro de equipos con calibración**: nueva entidad `Equipment` (nombre, tipo, ubicación, número de serie) con `CalibrationRecord` (fecha, patrón usado, resultado, próxima calibración, certificado adjunto); alerta de vencimiento igual al patrón ya usado para registro sanitario ARCSA. Vincular opcionalmente un equipo a un método de ensayo en la especificación de calidad.
6. **Programa de auditorías internas**: módulo simple de `QualityAudit` (área auditada, fecha planificada, auditor, checklist de hallazgos, cada hallazgo puede derivar en una No Conformidad ya existente) — reutiliza el motor CAPA actual como destino de los hallazgos.
7. **Control de documentos**: agregar a la ficha de "Especificación de calidad" y a nuevos "Procedimientos"/"Instructivos" un campo de versión, estado (borrador/vigente/obsoleto), aprobador y fecha de aprobación — no requiere un DMS completo, solo metadatos de control de versión sobre los documentos que ya se generan (certificados, especificaciones).
8. **Centros de trabajo y capacidad**: nueva entidad `WorkCenter` (nombre, capacidad en horas/día, costo por hora) referenciada desde las etapas de producción del punto 3; permite calcular carga planificada vs capacidad disponible por centro.

### Experiencia de usuario (frontend operativo)
9. **Vista Kanban de órdenes de producción** por etapa (Planificada → En Proceso → Control de Calidad → Liberada → Cerrada), con tarjetas que muestren producto, lote, cantidad y responsable — mismo patrón visual que Odoo Manufacturing y que el pipeline del CRM de KallpaPro.
10. **Panel de carga por centro de trabajo**: vista tipo Gantt/barra simple que muestre, por centro de trabajo y por día, las horas planificadas vs disponibles, resaltando en rojo el centro que actúa como cuello de botella (mayor porcentaje de utilización) — implementación ligera del principio de Theory of Constraints sin necesitar un motor de programación finita complejo.
11. **Pantalla de trazabilidad visual**: la vista de árbol del punto 4, con un botón "Generar reporte de retiro" que exporte la lista de clientes/despachos afectados por un lote específico — crítico para cumplimiento de recall en industria alimentaria.
12. **Checklist móvil de inspección**: para inspección de recepción y de producto terminado, una vista tipo formulario paso a paso (una especificación a la vez, con teclado numérico o sí/no grande) optimizada para tablet en planta, en vez del formulario de escritorio denso actual.

### Actualizaciones futuras (mercado emergente / IA)
13. **Inspección visual asistida por IA (humano en el loop)**: para especificaciones de tipo "visual" (ej. color, presencia de defectos superficiales), permitir adjuntar una foto tomada con la cámara del dispositivo y mostrar una sugerencia automática de aprobado/rechazado con nivel de confianza — el inspector siempre confirma o corrige antes de guardar, igual que el patrón de sugerencias del CRM.
14. **Predicción de riesgo de no conformidad**: modelo simple basado en histórico (ej. "este proveedor/lote de materia prima ha tenido 30% de no conformidades en los últimos 6 meses") mostrado como alerta al momento de crear la inspección de recepción, para priorizar atención humana sin bloquear el flujo.
15. **Sugerencia de causa raíz en CAPA**: al abrir una no conformidad, sugerir automáticamente causas raíz probables basadas en no conformidades históricas similares (mismo producto, mismo proveedor, mismo tipo de defecto) como punto de partida editable, no como respuesta automática.

## 5. Qué NO tocar

- **Digital twin de línea de producción completa**: incluso SAP lo ofrece como producto separado (Digital Manufacturing Cloud), no parte de SAP Business One; requiere instrumentación IoT y modelado 3D que ninguna pyme ecuatoriana objetivo de KallpaPro tiene ni necesita en este horizonte.
- **Mantenimiento predictivo basado en sensores IoT**: depende de instrumentación física (vibración, temperatura, corriente) que la mayoría de líneas de producción pyme no tiene instalada; el maestro de equipos con calibración y mantenimiento preventivo calendarizado (punto 5) cubre el requisito normativo real sin esa inversión.
- **Programación finita de capacidad (finite capacity scheduling) con algoritmos de optimización avanzada**: motores APS (Advanced Planning and Scheduling) completos son para manufactura de alto mix/alto volumen con cientos de órdenes simultáneas; el panel de carga simple del punto 10 (planificado vs disponible, resaltando el cuello de botella) resuelve el 90% del valor de TOC sin la complejidad de un solver.
- **Inspección visual por computer vision en línea de alta velocidad**: cámaras industriales sincronizadas a velocidad de línea son inversión de manufactura de gran escala (empaque de alto volumen, automotriz); la propuesta del punto 13 (foto puntual + sugerencia, humano confirma) es la versión pyme-apropiada y ya cubre el caso de uso de control de calidad por lote.
- **Multi-nivel de rutas con sub-ensambles y BOM de múltiples niveles anidados de fabricación propia de terceros (make-to-order complejo)**: la mayoría de pymes ecuatorianas manufactureras (alimentos, químicos de consumo, textiles) tienen procesos de 1-4 etapas lineales, no árboles de sub-ensambles como electrónica o automotriz; el modelo de etapas secuenciales del punto 3 es suficiente y evita la complejidad de gestión de BOM multinivel con sub-órdenes de producción anidadas.
