# 23 — Auditoría de Inventario: backlog pendiente de doc 21 + errores encontrados

> **Fecha:** 2026-07-04 · **Actualizado:** 2026-07-05
> **Objetivo:** revisar el estado real del backlog dejado en `21-REVISION-ODOO-INVENTARIO.md` y
> hacer una auditoría de código (no solo repetir lo ya documentado) para encontrar errores reales
> en el motor de inventario.
>
> **✅ ACTUALIZACIÓN 2026-07-05: el bug de costeo FIFO/LIFO (§2) fue CORREGIDO y verificado
> end-to-end** (ver §5), junto con la segunda ronda del bug de numeración multi-tenant. El fix es
> hacia adelante: los asientos históricos generados con costo incorrecto NO se ajustaron
> retroactivamente (no había productos FIFO/LIFO reales en la BD al momento del fix).

---

## 1. Estado del backlog de doc 21 (verificado contra el código actual)

| Ítem del backlog (doc 21 §4) | Estado actual | Nota |
|---|---|---|
| `allowNegativeStock` por producto | **Sigue sin implementar** | Las 4 validaciones `INSUFFICIENT_STOCK` (`registerMovement` salidas, `registerFifoOut`, `transferStock`, `reserveStock`) siguen bloqueando siempre. Confirmado por lectura directa del código. |
| Unidad de medida de compra ≠ venta | **Sigue sin implementar** | `Product.unit` sigue siendo un solo campo en el schema. |
| Cuenta contable por producto/categoría | **Sigue sin implementar** | `AccountMapping` sigue siendo únicamente por empresa (`@@unique([companyId, key])`), sin override por producto. |
| Botón "Reabastecer" rápido desde producto | **Sigue sin implementar** | No hay ninguna acción de este tipo en `ProductDetailPage.tsx`. |
| Ubicaciones como centros de costo/proyecto | **Sin cambios (correcto no implementarlo)** | Sigue siendo un patrón específico de constructoras; no se recomienda sin caso de uso explícito. |

Ningún ítem del backlog anterior se implementó todavía — es exactamente el estado en que quedó doc 21.

## 2. Hallazgo nuevo (auditoría de código): costeo FIFO/LIFO de salidas está roto

Este NO estaba en el backlog de doc 21 — apareció al auditar el motor de inventario completo
buscando errores reales, no solo repasar lo ya documentado.

### 2.1 Qué está mal, con evidencia exacta

**`ProductDetailPage.tsx:667`** permite elegir `AVG | FIFO | LIFO | STANDARD_COST` como método de
valoración de cualquier producto, con descripciones que prometen el comportamiento real:
> "FIFO: Consume el lote más antiguo primero." / "LIFO: Consume el lote más reciente primero."

Pero el motor real (`inventory.service.ts`, función `registerMovement`, única vía por la que pasan
ventas, ajustes y consumos normales) **no cumple esa promesa**:

1. **FIFO nunca consume lotes en salidas.** El único bloque de consumo de lotes en `registerMovement`
   (líneas 298-319) es exclusivamente para `product.valuationMethod === 'LIFO'`. No existe una rama
   equivalente para FIFO. Resultado: `InventoryBatch.remainingQty` de un producto FIFO solo crece
   (cada `IN` crea un lote nuevo, línea 280-296) y **nunca decrece** con las salidas.
   - Existe una función separada, `registerFifoOut()` (líneas 521-597), que sí implementa el
     consumo FIFO correctamente (recorre lotes `orderBy: receivedAt: 'asc'`, calcula el costo
     ponderado real de lo consumido). **Pero no la llama ningún controlador ni otro servicio**
     (confirmado por búsqueda: cero referencias a `registerFifoOut` fuera de su propia definición).
     Es código muerto — la función correcta existe pero nunca se ejecuta.

2. **LIFO consume lotes pero no usa su costo.** El bloque de LIFO sí decrementa `remainingQty` de
   los lotes correctos (más recientes primero), pero el **costo registrado en el movimiento**
   (`unitCost`/`totalCost`/`avgCostAfter`, línea 232 y 242) se calcula ANTES de ese bloque, y
   siempre usa `currentAvgCost` (el campo `product.avgCost`) — nunca el costo real de los lotes LIFO
   que se acaban de consumir. El consumo de lotes queda desconectado del costo que se reporta.

3. **`avgCost` queda congelado para productos FIFO/LIFO.** Línea 264: `product.avgCost` solo se
   actualiza `if (valuationMethod === 'AVG' || valuationMethod === 'STANDARD_COST')`. Para FIFO/LIFO
   se salta esa actualización a propósito (comentario: "no recalcular avgCost") — correcto en
   teoría (AVG no aplica a FIFO/LIFO), pero como *nada más* recalcula el costo real por esos
   métodos, `avgCost` se queda congelado en el valor que tenía al momento de cambiar el método
   (frecuentemente `0` si el producto es nuevo).

4. **Esto llega a la contabilidad real.** `journal.service.ts` (`createCOGSEntry`, línea 259-264)
   calcula el Costo de Ventas de **todos** los productos con `Number(it.product?.avgCost ?? 0) * quantity`,
   sin mirar `valuationMethod`. Para un producto FIFO/LIFO cuyo `avgCost` está congelado (posiblemente
   en `0`), el asiento de Costo de Ventas generado al facturar una venta **registra un costo
   incorrecto** (frecuentemente `$0`), inflando la utilidad bruta reportada.

5. **Las transferencias entre bodegas agravan el problema.** `transferStock` (línea 674-767) mueve
   cantidades entre `ProductStock` de dos bodegas, pero **no mueve ni divide los lotes
   (`InventoryBatch.warehouseId`)** — un lote FIFO/LIFO creado en la bodega A sigue "viviendo" ahí
   aunque el stock se haya transferido a la bodega B. Si luego se vende desde B, no habrá lotes que
   consumir en esa bodega (o se consumirán lotes de A que ya no corresponden a stock físico ahí).

### 2.2 Alcance del impacto

- Afecta **solo** a productos con `valuationMethod` configurado explícitamente como `FIFO` o `LIFO`
  (el default de un producto nuevo es `AVG`, que sí funciona correctamente). El riesgo es
  proporcional a cuántos productos reales tengan ese método activado.
- No afecta compras/recepciones (`IN`) — la creación de lotes ahí funciona bien.
- No afecta el modelo `AVG`/`STANDARD_COST` en absoluto.

### 2.3 Qué se necesitaría para corregirlo (no implementado, solo diagnóstico)

1. Añadir en `registerMovement` (o extraer a un helper compartido) el mismo patrón de consumo que
   ya existe correctamente en `registerFifoOut`, pero para **ambos** métodos (hoy solo existe para
   LIFO), y hacer que el costo del movimiento (`unitCost`/`totalCost`/`avgCostAfter`) se calcule a
   partir de los lotes realmente consumidos, no de `avgCost`.
2. Decidir qué reemplaza a `avgCost` como "costo actual" de un producto FIFO/LIFO para que
   `createCOGSEntry` (y cualquier otro consumidor de `product.avgCost`) obtenga el costo correcto —
   opciones: mantener un campo separado tipo `lastMovementCost` actualizado en cada salida, o hacer
   que `createCOGSEntry` calcule el costo por línea desde el propio `InventoryMovement`/lote en vez
   de leer `product.avgCost`.
3. Decidir si las transferencias entre bodegas deben mover/dividir lotes FIFO/LIFO, o si (más
   simple) se documenta como limitación: FIFO/LIFO no está soportado combinado con multi-bodega.
4. Eliminar (o finalmente conectar) `registerFifoOut`, que hoy es código muerto y una fuente de
   confusión — alguien podría asumir que ya está en uso porque existe y está bien escrito.
5. Este es un cambio con implicaciones contables reales (afecta Costo de Ventas ya contabilizado
   para clientes que hayan usado FIFO/LIFO) — conviene decidir con el usuario si also se requiere
   un ajuste retroactivo de los asientos ya generados con costo incorrecto, o si el fix solo aplica
   hacia adelante.

## 3. Recomendación (histórica — superada por §5)

No se tocó código en la sesión del 2026-07-04 (decisión del usuario: solo documentar). El fix se
ejecutó al día siguiente a pedido del usuario ("continúa con los errores") — ver §5.

## 5. ✅ CORRECCIONES EJECUTADAS (2026-07-05)

### 5.1 Costeo FIFO/LIFO — corregido en el motor y en la contabilidad

**`inventory.service.ts`:**
- Nueva función pura exportada `planBatchConsumption(batches, qty, fallbackUnitCost)`: planifica
  el consumo de capas (los lotes llegan YA ordenados según el método) y devuelve qué tomar de cada
  una + costo total real. El remanente sin capas (datos legados) se costea con el fallback.
- Nuevo helper `remainingBatchesAvgCost(tx, companyId, productId)`: ponderado de las capas
  restantes (todas las bodegas).
- **`registerMovement` reestructurado:** en salidas FIFO consume capas `receivedAt asc`, en LIFO
  `desc`; el movimiento registra `unitCost`/`totalCost` con el **costo real de las capas
  consumidas** (antes: FIFO no consumía nada; LIFO consumía pero costeaba con avgCost congelado).
  Tras cada movimiento FIFO/LIFO, `product.avgCost` se actualiza al ponderado de las capas
  RESTANTES (costo de acarreo) — esto corrige de rebote a TODOS los consumidores de `avgCost`
  (`createCOGSEntry`, notas de crédito, valorización) que antes leían un valor congelado.
- **`transferStock`:** para FIFO/LIFO las capas ahora VIAJAN con el stock — se consumen en origen
  según el método y se recrean en destino preservando `unitCost` y `receivedAt` (la antigüedad se
  conserva para el orden FIFO). El movimiento usa el costo real de las capas movidas.
- `registerFifoOut` (código muerto) **eliminada**; su lógica vive integrada en `registerMovement`.

**`sales.service.ts` + schema (COGS exacto por envío):**
- `ShipmentItem.unitCost` (nuevo campo, migración `20260705110000_shipment_item_unit_cost`):
  al despachar, `dispatchOrder` captura el `unitCost` real del movimiento OUT devuelto por
  `fulfillReservation` y lo guarda en la línea del envío.
- `invoiceSalesOrder` calcula el COGS del envío con ese costo capturado (fallback a `avgCost`
  para envíos legados con `unitCost = 0`).

**Verificación:**
- 7 tests nuevos en `tests/fifo-lifo-costing.test.ts`: 4 puros (`planBatchConsumption`) + 3 e2e
  contra BD real (FIFO consume capas antiguas → $90 exactos; LIFO consume recientes → $105;
  transferencia mueve capas y la salida en destino funciona). Suite completa: **78/78 verdes**.
- E2E del camino contable completo con script efímero: venta de 15 uds de un producto FIFO con
  capas 10@$5 + 10@$8 → `ShipmentItem.unitCost = $6`, factura emitida, y **asiento de COGS por
  $90.00 exactos** (`5101` Costo de Ventas D / `1010306` Inventario H). Antes del fix: $0.
- `tsc --noEmit` verde backend; `npm run build` verde frontend (sin cambios de frontend en este fix).

### 5.2 Numeración multi-tenant — segunda ronda corregida

El fix de junio solo cubrió `Invoice`/`SalesOrder`. La auditoría encontró **5 modelos más** con
secuencia por empresa pero unicidad GLOBAL, todos corregidos a `@@unique([companyId, …])` en la
migración `20260705100000_unique_numbers_per_company_v2` (aplicada):
`PurchaseOrder.poNumber`, `Requisition.reqNumber`, `SalesQuotation.quoteNumber`,
`Shipment.trackingNumber`, `Payment.paymentNumber`. Verificado en BD (transacción revertida):
mismo número en 2 empresas = OK; duplicado en la misma empresa = rechazado.

### 5.3 Hallazgo menor adicional

Los scripts `lint` existen en ambos `package.json` pero **no hay archivo de configuración de
ESLint en ninguno de los dos proyectos** (`eslint` falla con "no configuration found"). Decidir si
se adopta un config (p. ej. `@typescript-eslint` recomendado) queda como tarea de tooling aparte.
