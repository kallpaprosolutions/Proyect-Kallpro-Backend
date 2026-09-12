# 3. Inventario

> 📍 Módulo **3** del ciclo operativo · [[flujo-trabajo-erp|← Router de módulos]]

## Flujo de trabajo
Recepción de compra → Kardex por producto/bodega con costeo AVG/FIFO/LIFO por capas →
traslados entre bodegas (las capas viajan) → ajustes con doble autorización → reserva y
despacho en Ventas.

## Ejecutado ✅
| Paso | Dónde |
|---|---|
| Multibodega jerárquica + traslados (capas viajan) | Sprint 3 / doc23 |
| Costeo AVG · FIFO · LIFO · estándar (capas reales) | doc23 corregido |
| Kardex por producto/bodega + valorización conciliada con 1010306 | Valorización |
| Ajustes con doble autorización + asiento | Sprint AJU |
| Conteo físico por sesión con ajustes automáticos | `PhysicalCount` |
| Entrada rápida con scanner/cámara | `QuickEntry` |
| Lotes y vencimientos | `InventoryBatch` (near-expiry) |
| **C1 · Reglas de reabastecimiento entre bodegas** (push/pull simplificado): mín/máx override por `ProductStock` (bodega), motor puro `replenishment.engine.ts` decide traslado (si otra bodega sola cubre el faltante sobre SU máximo) o requisición de compra; acciones reales "Trasladar"/"Requisición"/"Posponer" en `/inventory/replenishment` | `replenishment.engine.ts` + `getReplenishmentSuggestions` (2026-09-05) |
| **C2 · Panel de operaciones de inventario**: tarjeta por bodega con recepciones de compra pendientes (`PurchaseOrder` APROBADA/PARCIAL), expediciones de venta por estado (en espera/por entregar/con demora/parciales) y traslados de hoy (entrantes/salientes); solo muestra bodegas con operación activa | `getInventoryOperationsPanel` + sección "Operaciones de hoy" en `InventoryAnalyticsPage` (2026-09-05) |
| **Pronóstico de demanda + tendencia de rotación por producto**: motor puro de suavizado exponencial sobre unidades vendidas mensuales (`SalesOrderItem.shippedQty`) → top vendidos con pronóstico del siguiente mes y tendencia creciente/estable/decreciente; para productos con stock (no servicios) agrega el índice de rotación anualizado (COGS/inventario promedio) clasificado ALTA/MEDIA/BAJA | `demand-forecast.engine.ts` + `getDemandForecast`/`getRotationTrend` (2026-09-10) |
| **UI del pronóstico/rotación**: pestaña "🔮 Demanda y Rotación" en `InventoryAnalyticsPage` — selector de historial (3/6/12 meses), tabla de más vendidos con sparkline + pronóstico + badge de tendencia, tabla de rotación con badge ALTA/MEDIA/BAJA | `InventoryAnalyticsPage.tsx` (2026-09-11) |
| **C3 · Stock negativo configurable por producto**: `Product.allowNegativeStock` (default `false`, comportamiento intacto) — cuando está activo, `registerMovement` (salida), `transferStock` y `reserveStock` dejan de bloquear con `INSUFFICIENT_STOCK`; el costo de la porción en negativo se valora al costo promedio vigente (`planBatchConsumption.uncovered`, ya existía para el caso FIFO/LIFO con datos legados). Toggle en la ficha de producto (pestaña Editar) + badge "Stock negativo permitido" en el header + badge "⚠ Stock negativo" por bodega cuando la cantidad es < 0 | `Product.allowNegativeStock` + `ProductDetailPage.tsx` (2026-09-11) |
| **C3 · Unidad de compra ≠ unidad de venta/stock**: `Product.purchaseUnit`/`purchaseConversionFactor` (default `null`/`1`, sin distinción = comportamiento previo intacto) — al crear una OC (`quantityUnit: 'PURCHASE'`), el motor puro `purchase-unit.engine.ts` convierte cantidad (×factor, redondeada a entero por `POItem.quantity: Int`) y precio unitario (÷factor, redondeado a 2 decimales) a la unidad de stock antes de guardar; el resto del flujo (recepción, kardex, costeo) no cambia porque ya recibe todo en unidad de stock. Se guarda un snapshot informativo (`purchaseQuantity`/`purchaseUnitLabel`) para trazabilidad. Configuración en la ficha de producto (pestaña Editar) + badge "Compra: 1 CAJA = N UNIDAD" en el header; selector de unidad de carga (compra/stock) por línea en `NewOrderPage` (solo visible si el producto tiene unidad de compra configurada) + texto "Se compró: N CAJA (M UNIDAD)" en `OrderDetailPage`. Alcance: solo Órdenes de Compra (no Requisiciones) | `purchase-unit.engine.ts` + `POItem.purchaseQuantity/purchaseUnitLabel` (2026-09-11) |

## Mejoras propuestas
- Cuenta contable por producto (doc21) — no implementado; fuera de alcance de C3 (unidad de compra≠venta y stock negativo, las otras dos partes de C3, ya están hechas).

## Ver también
- [[02-compras|Módulo 2 · Compras]] (origen de la recepción)
- [[03b-produccion-calidad|Módulo 3.b · Producción y Calidad]] (consumo/transformación de capas)
- [[04-ventas|Módulo 4 · Ventas]] (reserva y despacho)
