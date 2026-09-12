# 3. Inventario — comparación con mejores prácticas de mercado

> 📍 Ubicación: Módulo 3 — Inventario. Backend: `apps/api/src/modules/inventory/*`, `journal.service` para asientos. Frontend: `apps/web/src/modules/inventory/*`.

## 1. Investigación: qué hacen los mejores WMS/ERP en 2026

| Práctica | Odoo 18 Inventory | SAP Business One | NetSuite WMS | Fishbowl / Zoho Inventory |
|---|---|---|---|---|
| Reglas de reabastecimiento | Reordering rules (min/max) por producto-bodega, rutas push/pull configurables, "Replenishment" view con sugerencias en un clic | MRP wizard + niveles mín/máx por almacén | Reorder points por ubicación + "Demand Planning" con IA | Reorder points simples por producto |
| Unidades de medida múltiples | UoM de compra vs venta vs almacenamiento (packaging: caja, pallet) nativas en la ficha de producto | UoM alternativas por documento (compra en caja, inventario en unidad) | Units of measure conversion tables por ítem | UoM básico, conversión manual |
| Cycle counting vs conteo anual | "Inventory Adjustments" con frecuencia configurable por ubicación + ABC, conteo cíclico recomendado en vez de conteo físico anual | Cycle count recomendado con clasificación ABC (LX26/LICC en S/4, conceptualmente igual en B1) | Cycle count schedules por clase ABC | Conteos manuales periódicos |
| Slotting / ubicación óptima | Multi-step routes, "Storage Categories" con reglas de capacidad y afinidad de producto | Bin location management con reglas de put-away | Advanced bin/lot management con opciones de slotting dinámico | Ubicaciones básicas |
| Picking por olas (wave picking) | "Batch Transfers" y "Wave" picking activables en Inventory Settings | Pick lists agrupables, no wave nativo (requiere add-on) | Wave management, pick/pack/ship por oleada | No nativo |
| Cross-docking | Ruta de 2 pasos "Cross-Dock" nativa (recepción → salida sin pasar por stock) | Requiere configuración de almacén de tránsito | Soportado vía flujos de transferencia | No |
| Dashboard de operaciones | "Inventory Overview" con Kanban de operaciones pendientes por tipo (recepciones, entregas, ajustes, traslados), colores por estado de urgencia | Panel de "Inventory Status" e informes de stock | "Warehouse Management Dashboard" con KPIs de throughput | Reportes básicos |
| App móvil de bodega | Odoo Barcode app (Android/iOS/PWA) con escaneo para recepción, picking, conteo, traslados, en tiempo real | SAP B1 mobile app con recepción/despacho por escaneo | NetSuite WMS Mobile / Mobile Lite con RF-gun style workflows | Apps móviles de terceros |
| Cuenta contable por producto/categoría | Categorías de producto con cuentas de valoración, ingreso y costo configurables, override a nivel de producto | Cuentas de inventario por grupo de artículos (Item Groups) | Cuentas por "Item" o "Item Category" con reglas de posting | Limitado |
| Stock negativo configurable | Permitir stock negativo activable por ubicación/producto (con warning) | Bloqueo configurable por almacén | Configurable por ítem | Bloqueo simple |

**Prácticas confirmadas por la investigación**

*Reabastecimiento y unidades*
- Reglas mín/máx por producto-bodega con reabastecimiento automático (push/pull) es estándar en Odoo, SAP y NetSuite — no es un lujo, es tabla base de cualquier WMS moderno.
- Unidad de compra distinta a unidad de venta (comprar por caja/pallet, vender por unidad) con conversión automática es funcionalidad núcleo, presente en las 4 plataformas comparadas.
- Cuenta contable configurable por categoría de producto, con posibilidad de override por producto individual, es el patrón universal para evitar que todo el inventario caiga en una cuenta contable genérica.

*Conteo y precisión*
- El estándar de la industria 2025-2026 es **cycle counting continuo priorizado por clasificación ABC** (los artículos A se cuentan semanal/mensualmente, B trimestralmente, C anualmente), no el conteo físico total una vez al año — reduce interrupción operativa y mejora precisión sostenida.
- ABC analysis (Pareto 80/20 por valor de consumo o rotación) es la base para decidir dónde poner esfuerzo de conteo, ubicación y control.

*Distribución física (slotting, oleadas, cross-dock)*
- **Slotting**: asignar ubicaciones según velocidad de rotación (los productos de alta rotación cerca de la zona de despacho) reduce tiempos de picking; se implementa con "categorías de almacenamiento" o zonas con reglas de afinidad.
- **Wave picking / batch picking**: agrupar múltiples pedidos en una sola ronda de picking optimiza el recorrido del operario; es estándar en operaciones con volumen medio-alto.
- **Cross-docking**: mercadería que llega y sale sin pasar por almacenamiento (ruta directa recepción→despacho), reduce manipulación y tiempo de ciclo; se modela como una ruta de "0 o 1 paso" con ubicación de tránsito.

*UX operativa de bodega*
- Todas las plataformas líderes ofrecen una app o modo móvil con escáner de código de barras para las operaciones diarias (recepción, picking, conteo, traslado) — no dependen del teclado en un formulario de escritorio.
- Dashboards tipo Kanban que agrupan operaciones pendientes por tipo y urgencia (vencidas en rojo, hoy en amarillo, futuras en gris) son el patrón de "centro de operaciones" que reemplaza listas planas.

**Fuentes**
- [Odoo Warehouse Management | Capabilities & Review (2026) | ERP Research](https://www.erpresearch.com/erp/odoo/warehouse-management)
- [Odoo 18. Inventory Management Enhancements](https://solvve.odoo.com/blog/articles-4/odoo-18-inventory-management-enhancements-31)
- [Odoo Inventory Management: 8 Best Practices for Warehouse Efficiency | ECOSIRE](https://ecosire.com/blog/odoo-inventory-management-best-practices)
- [How to Pick Goods in Your Warehouse Efficiently | VentorTech](https://ventor.tech/warehouse-management/how-to-pick-goods-in-your-warehouse-efficiently/)
- [Odoo Warehouse Management: Setup, Features & Best Practices in 2026](https://www.cudio.com/blog/warehouse-management-odoo)
- [SAP Business One Inventory Management | Capabilities & Review (2026) | ERP Research](https://www.erpresearch.com/erp/sap-business-one/inventory-management)
- [Understanding SAP Cycle Counting Process: ABC Analysis, LX26, and LICC](https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-members/understanding-sap-cycle-counting-process-abc-analysis-lx26-and-licc/ba-p/14446102)
- [SAP Cycle Counting: Methods, Configuration, and Best Practices](https://www.cleverence.com/articles/business-blogs/sap-cycle-count-4927/)
- [Mastering Inventory Cycle Count with SAP Business One | CPCON Group](https://cpcongroup.com/mastering-inventory-cycle-count-with-sap-business-one/)
- [ABC Analysis in Inventory Management: Complete Guide for 2026](https://quicksync.pro/blog/abc-analysis-in-inventory-management/)
- [Warehouse Management: 10 Best Practices for 2025](https://www.jittransportation.com/posts/warehouse-management-10-best-practices-for-2025)
- [Warehouse Management System Guide 2026 (Whitepaper)](https://www.jascicloud.com/whitepapers/the-complete-guide-to-warehouse-management-systems-wms-2026)
- [Warehousing & Inventory Management Best Practices for 2026 | Falcon Global Logistics](https://falcongl.com/blog/warehousing-inventory-management-best-practices-for-2026.html)
- [Top 11 Warehouse Inventory Management Tips for 2026 | Productiv](https://getproductiv.com/blog/top-11-warehouse-inventory-management-tips-for-2026)
- [NetSuite Warehouse Management Review (2026) | ERP Research](https://www.erpresearch.com/erp-add-ons/wms/netsuite-wms)
- [NetSuite Mobile Warehouse Management | NetSuite](https://www.netsuite.com/portal/products/erp/warehouse-fulfillment/mobile-warehouse-management.shtml)
- [NetSuite WMS App: Best Practices for Faster Warehouse Execution](https://suiteworkstech.com/netsuite-wms-app-best-practices-faster-warehouse-execution/)
- [Human-in-the-Loop Supply Chain: Turning AI Into Decisions You Can Actually Execute](https://intuendi.com/resource-center/human-the-loop-supply-chain/)
- [AI in Demand Planning: What It Changes for Distributors](https://erpsoftwareblog.com/2026/09/ai-in-demand-planning-what-it-changes-for-distributors/)

## 2. Nuestro estado actual (KallpaPro)

- Multibodega jerárquica con traslados entre bodegas; las capas de costo viajan con el traslado (no se pierde trazabilidad de costo al mover stock).
- Costeo AVG, FIFO, LIFO y estándar, por capas reales (no promedio simplificado) — corregido y verificado con 7 tests tras un bug histórico.
- Kardex por producto/bodega, valorización conciliada contablemente.
- Ajustes de inventario con doble autorización + asiento contable automático.
- Conteo físico por sesión con ajustes automáticos.
- Entrada rápida con escáner/cámara de código de barras (`@zxing`) — cubre parte del requisito de "app móvil de bodega" sin necesitar hardware dedicado.
- Lotes y fechas de vencimiento (`InventoryBatch`), con alerta de próximos a vencer.

## 3. Diagnóstico: brechas frente al mercado

| Práctica confirmada en el mercado | ¿La tenemos? |
|---|---|
| Reglas de reabastecimiento automático mín/máx por producto-bodega (push/pull) | No |
| Unidad de compra distinta a unidad de venta con conversión automática | No |
| Cuenta contable configurable por producto/categoría | No (genérica) |
| Stock negativo configurable por producto | No |
| Cycle counting continuo priorizado por ABC (vs. solo conteo por sesión manual) | No — solo tenemos conteo por sesión, sin política de frecuencia ni clasificación ABC |
| Slotting / ubicación óptima por rotación | No — bodegas son jerárquicas pero sin lógica de asignación de ubicación por velocidad de rotación |
| Picking por olas (wave/batch picking) | No |
| Cross-docking (ruta directa recepción→despacho) | No |
| Dashboard de operaciones de inventario (Kanban de pendientes del día) | No |
| App móvil dedicada con flujos guiados de recepción/picking/traslado | Parcial — hay escáner de código de barras pero no un flujo móvil guiado tipo "wave" |

## 4. Propuestas de mejora

### Flujo de trabajo
1. **Reabastecimiento automático**: agregar tabla `ReplenishmentRule` (productId, warehouseId, min, max, method: PUSH/PULL/MANUAL). Un job diario (o trigger al bajar de mínimo tras un movimiento de salida) genera una "sugerencia de traslado" o "sugerencia de orden de compra" en estado borrador — nunca la confirma sola.
2. **Ciclo de conteo por ABC**: agregar campo `abcClass` (A/B/C) calculado mensualmente por consumo/valor (job batch), y una pantalla "Plan de conteo cíclico" que sugiere qué productos-bodega tocan contar esta semana según su clase (A: cada 30 días, B: cada 90, C: cada 180) — separado del flujo actual de "conteo físico por sesión" que se mantiene para conteos totales anuales/de auditoría.
3. **Recepción con unidad de compra**: al crear una orden de compra, permitir elegir unidad de compra (ej. "Caja x12") distinta a la unidad de stock/venta ("Unidad"), con factor de conversión en la ficha de producto; el kardex y el costeo siempre operan en unidad base tras la conversión automática.
4. **Cross-docking simple**: nuevo tipo de traslado "directo" que vincula una línea de OC entrante con una línea de pedido de venta saliente sin pasar por el kardex de la bodega intermedia — útil para pymes distribuidoras que reciben y despachan el mismo día.

### Sistema de organización / configuración
5. **Cuenta contable configurable**: agregar `inventoryAccountId`, `revenueAccountId`, `cogsAccountId` a nivel de `ProductCategory`, con override opcional a nivel de `Product`. El `journal.service` debe resolver: producto → si no tiene, categoría → si no tiene, cuenta genérica actual (fallback, no ruptura).
6. **Stock negativo configurable**: flag `allowNegativeStock` en `Product` (default false); si está activo, los movimientos de salida no bloquean aunque el saldo quede negativo, pero se marca la operación con una advertencia visual persistente hasta que se regularice con el próximo ingreso.
7. **Configuración de ubicaciones (slotting básico)**: agregar campo `zone` (ej. "Rápido", "Normal", "Lento") a la bodega/ubicación y sugerir automáticamente la zona de picking según la clase ABC del producto — sin necesidad de un motor de slotting complejo, solo una recomendación visible en la ficha del producto.

### Experiencia de usuario (frontend operativo)
8. **Panel de operaciones de inventario** (nueva pantalla, home del módulo): tablero tipo Kanban con columnas "Recepciones pendientes", "Traslados en tránsito", "Conteos programados hoy", "Ajustes por aprobar", cada tarjeta con badge de urgencia (rojo = vencido, amarillo = hoy, gris = próximos 7 días) — mismo patrón visual que ya usa el pipeline del CRM.
9. **Flujo guiado de picking móvil**: extender la pantalla de escáner actual para que, al seleccionar un traslado/pedido, muestre una lista secuencial de "producto → ubicación → cantidad" con confirmación por escaneo en cada paso (equivalente simplificado del wave picking de Odoo Barcode), en vez de un escaneo libre sin guía.
10. **Widget de sugerencias de reabastecimiento** en el dashboard del módulo: lista de productos bajo el mínimo con botón "Generar OC" / "Generar traslado" / "Ignorar" — implementa el patrón aceptar/rechazar ya usado en el CRM.

### Actualizaciones futuras (mercado emergente / IA)
11. **Forecasting de demanda con IA humano-en-el-loop**: motor de sugerencia de cantidad de reposición basado en histórico de consumo (media móvil o modelo simple), presentado como sugerencia editable en el widget del punto 10 — nunca autoejecutado, siempre con aceptar/ajustar/rechazar, siguiendo el mismo patrón ya validado en el CRM de KallpaPro.
12. **Clasificación ABC automática por IA/heurística** recalculada mensualmente y usada para alimentar tanto el plan de conteo cíclico como las sugerencias de slotting — primer paso antes de cualquier optimización de rutas de picking más compleja.
13. **Predicción de quiebre de stock** (stockout risk score) combinando velocidad de consumo reciente + lead time de proveedor, mostrado como alerta temprana en el panel de operaciones.

## 5. Qué NO tocar

- **WMS de múltiples niveles con RF-guns dedicados y voice picking**: es infraestructura de centros de distribución de gran volumen (miles de líneas/día); una pyme ecuatoriana con 1-3 bodegas no lo necesita — el escáner de cámara/celular ya cubre el caso de uso real.
- **Slotting dinámico automatizado con reoptimización continua de layout físico**: motores de slotting avanzado (como los de WMS de nivel enterprise) reoptimizan miles de ubicaciones en tiempo real; para el volumen de SKUs de una pyme, una recomendación de zona por clase ABC es suficiente y evita complejidad de mantenimiento.
- **Digital twin de bodega/línea completa**: simulación 3D en tiempo real del flujo físico es una inversión de manufactura de gran escala (automotriz, electrónica); no aporta ROI a una pyme y añadiría una capa de infraestructura (IoT, sensores) fuera del alcance del producto.
- **Wave picking multi-oleada con optimización de rutas por algoritmos de vehículos (VRP)**: útil en operaciones de +50 pedidos/día por bodega; el flujo guiado simple del punto 9 cubre el caso de uso de una pyme sin la complejidad de un motor de optimización de rutas.
- **Cross-docking multi-nodo con red de distribución nacional**: nuestra propuesta de cross-docking simple (punto 4) es suficiente; un motor de red logística con múltiples centros de distribución es un producto distinto (TMS/red de distribución), no parte de un ERP de inventario para pyme.
