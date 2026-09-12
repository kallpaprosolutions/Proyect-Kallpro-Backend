# 21 — Revisión de Odoo: Inventario (guía de referencia)

> **Fecha:** 2026-07-04
> **Objetivo:** revisar el módulo de Inventario en el Odoo real del usuario (solo lectura, ningún
> comprobante creado/modificado) para usarlo como guía y mejorar KallpaPro donde aplique.
>
> **✅ ESTADO: Ejecutada 1 mejora priorizada por el usuario** (trazabilidad asiento/movimiento en
> Ajustes de Inventario). El resto de hallazgos queda como backlog documentado.

---

## 1. Qué se revisó en Odoo (sin tocar nada)

- **Resumen de inventario** (kanban de tipos de operación por almacén): Recepciones,
  Transferencias internas, Despacho de Órdenes, Fabricación — cada uno con contador "A procesar"
  y alertas de retraso/espera.
- **Ajustes de inventario** (`stock.inventory`): define un ámbito (ubicación + productos), pasa por
  Borrador → En proceso → Validado, y **una vez validado expone botones clickeables "Movimientos
  productos" y "Asientos contables"** que navegan directo a los registros generados.
- **Movimientos de producto**: cada línea es una transferencia entre dos ubicaciones (origen →
  destino), incluso los ajustes usan una ubicación virtual `Virtual Locations/Inventory adjustment`
  como contraparte — Odoo modela *todo* movimiento de stock como doble entrada entre ubicaciones.
- **Ubicaciones jerárquicas anidadas**: en esta empresa (constructora), las sub-ubicaciones de un
  almacén representan proyectos/lotes de obra (ej. `SAV/Existencias/Constructora XYZ`) — patrón de
  centros de costo vía jerarquía de ubicación, específico del sector.
- **Informes**: Kardex Valorizado (wizard con ubicación + rango de fechas + selección de productos,
  exporta PDF/Excel — coincide con nuestro Kardex), Inventario pronosticado, Valoración del
  inventario, Análisis de Almacén.
- **Ficha de producto**: toggles independientes "Puede ser vendido"/"Puede ser comprado", flag
  **"Permitir Stock Negativo"** por producto, unidad de medida de compra distinta a la de venta,
  botones rápidos "Actualizar la cantidad" y "Reabastecer", pestaña Contabilidad con cuentas de
  ingreso/gasto que **sobreescriben el mapeo global por producto individual**, pestaña Inventario
  con rutas (Comprar/Fabricar) y diagrama de reabastecimiento.

## 2. Hallazgos frente a KallpaPro (comparación)

| Área | Odoo | KallpaPro (antes) | Decisión |
|---|---|---|---|
| Trazabilidad ajuste → asiento/movimiento | Links clickeables desde el propio documento | El asiento se genera (`createInventoryAdjustmentEntry`) pero no había forma de navegar a él desde la UI de Ajustes | ✅ **Implementado** (ver §3) |
| Stock negativo | Configurable por producto (opt-in) | Bloqueado siempre, en 4 puntos de `inventory.service.ts` | Backlog — cambia validación central, mayor riesgo, el usuario no lo priorizó esta sesión |
| Unidad de medida compra ≠ venta | Sí, dos campos distintos | `Product.unit` es un solo campo | Backlog |
| Cuenta contable por producto/categoría | Override a nivel de producto individual | Solo por empresa vía `AccountMapping` | Backlog (alcance mayor, toca todo `journal.service.ts`) |
| Botón "Reabastecer" rápido desde producto | Sí, en la ficha | No existe | Backlog |
| Ubicaciones como centros de costo/proyecto | Jerarquía ilimitada usada así en esta empresa | `StorageLocation` es plana (zona/percha/piso), sin jerarquía propia | No aplicable de forma genérica — es un patrón específico de construcción, no se implementa sin pedido explícito |
| Kardex valorizado con export | Wizard con filtros + PDF/Excel | Ya existe (Kardex + valorización) | Ya cubierto, sin cambios |

## 3. Implementado: trazabilidad asiento contable / movimiento en Ajustes de Inventario

**Backend:**
- Schema (`prisma/schema.prisma`, migración `20260704190000_inventory_adjustment_journal_link`):
  `InventoryAdjustment.journalEntryId` (nuevo, junto al ya existente `movementId`).
- `inventory.service.ts` — `registerMovement` ahora captura el `id` del `JournalEntry` creado por
  `createInventoryAdjustmentEntry` y lo adjunta al resultado (`{ ...movement, journalEntryId }`).
- `inventory-adjustment.service.ts` — tanto `createAdjustmentRequest` (rama sin doble autorización)
  como `approveAdjustment` persisten `journalEntryId` al aplicar el ajuste.
- Nuevo endpoint `GET /inventory/movements/:id` (`inv.getMovementById`) — no existía forma de leer
  un movimiento individual por ID, solo listados (Kardex). Se agregó siguiendo el mismo patrón que
  `GET /financial/journal-entries/:id` (ya existente, reutilizado sin cambios).

**Frontend:**
- `InventoryAdjustmentsPage.tsx` — en cada ajuste `APPROVED_APPLIED` con `movementId`/`journalEntryId`,
  aparecen los links "Ver movimiento" / "Ver asiento" que abren un modal con el detalle (cantidad,
  costo, saldo después para el movimiento; número, fecha, líneas debe/haber para el asiento).

**Verificación:**
- `tsc --noEmit` verde en backend y frontend.
- `npm test`: **71/71 verdes** (sin regresiones).
- E2E contra BD real: se creó una bodega + producto de prueba en la empresa QA dedicada, se generó
  un ajuste de entrada (con doble autorización desactivada para simplificar), y se confirmó que
  `movementId` y `journalEntryId` quedaron poblados; `GET /inventory/movements/:id` y
  `GET /financial/journal-entries/:id` devolvieron 200 con los datos correctos, y el asiento
  generado cuadra (Debe $250 = Haber $250, cuentas `1010306` Inventario / `4305` Otras Rentas).
  Datos de prueba eliminados al terminar.

## 4. Backlog (no implementado esta sesión, solo documentado)

- Flag `allowNegativeStock` por producto (opt-in) — requiere tocar las 4 validaciones de
  `INSUFFICIENT_STOCK` en `inventory.service.ts` (salidas normales, consumo FIFO, transferencias,
  reservas). Mayor riesgo: si se libera sin cuidado, `avgCost`/valorización pueden quedar
  inconsistentes con cantidades negativas.
- Unidad de medida de compra distinta a la de venta por producto.
- Cuenta contable (ingreso/gasto) configurable a nivel de producto o categoría, no solo por empresa.
- Botón "Reabastecer" rápido desde `ProductDetailPage` (crear requisición pre-llenada si el stock
  cae bajo el punto de reorden).
- Ubicaciones jerárquicas como centros de costo/proyecto — patrón específico del sector
  construcción visto en la empresa de referencia; no se traslada sin un caso de uso explícito.
