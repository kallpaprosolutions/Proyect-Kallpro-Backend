# 17 — Sprint 1.5: Cierre de calidad del P0 + Backlog técnico

> **Fecha:** 2026-06-20
> **Origen:** Fusión de las recomendaciones propias (cierre del Sprint 1) + la revisión externa de DeepSeek,
> **reconciliada contra el código real** (no contra suposiciones).
> **Regla:** igual que el resto del proyecto — toda regla de negocio nueva va en `ErpConfig`, y antes de
> modelar algo se verifica que no exista ya en `schema.prisma`.

---

## 1. Verificación de las observaciones de DeepSeek

DeepSeek revisó sin acceso al esquema. Varias observaciones son correctas y valiosas; tres parten de
supuestos que **no se cumplen** en este código. Tabla honesta:

| # | DeepSeek propone | Realidad verificada en el código | Veredicto |
|---|------------------|----------------------------------|-----------|
| 1.1 | Numeración atómica pendiente en REQ/OC/AJU | Cierto: `requisition.service`, `purchases.service`, `inventory-adjustment.service` aún usan `findFirst orderBy createdAt` / `count()` | ✅ **Hacer en 1.5** |
| 1.2 | Facturar parcial "usando `Shipment.items`" | ⚠️ `Shipment` **no tiene items** (solo `orderType`/`orderId` + `ShipmentEvent[]`). `SalesOrderItem` no tiene `shippedQty`/`invoicedQty`. Hoy hay **1 envío = pedido completo** | 🟠 **Necesidad válida, mal dimensionada**: requiere modelar `ShipmentItem` + cantidades + estado `PARTIALLY_SHIPPED`. Es una feature, no un ajuste fino → §3 |
| 1.3 | Crédito: filtrar PENDING/PARTIAL, restar notas de crédito, incluir confirmados | Mi código ya excluye `PAID/CANCELLED/DRAFT` e **ya incluye** pedidos confirmados sin facturar. Notas de crédito: **no existe modelo de NC de venta** todavía | 🟡 **Refinar** (filtro explícito); NC depende de feature futura |
| 2.1 | Centralizar PrismaClient (singleton) | Cierto: 54 servicios hacen `new PrismaClient()` → fuga de pools de conexión | ✅ **Hacer en 1.5** (alto valor, mecánico) |
| 2.2 | AsyncLocalStorage para `userId`/`ip` | Válido; hoy el `actorId` se pasa a mano (frágil si un servicio llama a otro) | 🔵 **P2** (tras el singleton, que es prerequisito) |
| 3.1 | Retenciones en `PaymentApplication` (ya) | Necesidad real en Ecuador. Infra parcial existe: `SriRetention`, `RetentionCatalog`, `AccountMapping`, `journal.service` | 🟡 **Sprint 2 (Finanzas)** — es grande, no "fino" |
| 3.2 | Proteger precios/versionado ("Claude implementó PriceList") | ❌ **PriceList NO está implementado** (es Sprint 2; solo está en el plan) | 🟡 Va **junto con PriceList** en Sprint 2 |
| 4.1 | Test de concurrencia de numeración | Válido. Ojo extra: el `upsert` puede competir en el **primer INSERT** (no solo en el `increment`) | ✅ **Hacer en 1.5** (script) |
| 4.2 | Agregar índices a las tablas nuevas | ✅ **Ya están**: `DocumentSequence` → `@@unique([companyId,docType])` + `@@index([companyId])`; `PaymentApplication` → `@@index([paymentId])` + `@@index([invoiceId])`; `Payment` → `@@index([companyId])` + `@@index([entityType,entityId])` | ✅ **Ya hecho** — nada que agregar |

**Conclusión:** de las 9 observaciones, **3 entran tal cual al Sprint 1.5** (1.1, 2.1, 4.1), **1 ya está hecha** (4.2),
**2 son refinamientos menores** (1.3, 2.2→P2), y **3 son features mayores mal etiquetadas como "ajuste fino"**
(1.2 despacho parcial, 3.1 retenciones, 3.2 protección de precios) que van a sus sprints correspondientes.

---

## 2. SPRINT 1.5 — Cerrar el P0 con calidad corporativa

> Objetivo: dejar el Sprint 1 sin deudas de integridad, sin features nuevas riesgosas.
> Todo de bajo riesgo de regresión. Cierre: `npx tsc --noEmit` + prueba en navegador.

### 🔴 1.5-A · Numeración atómica en REQ / OC / AJU `[P0]`
- Reemplazar en `requisition.service.ts` (`REQ-`), `purchases.service.ts` (`OC-`) e
  `inventory-adjustment.service.ts` (`AJU-`) la lógica vieja por `getNextDocumentNumber(tx, ...)`
  dentro de `$transaction`, con docTypes `REQUISITION`, `PURCHASE_ORDER`, `INVENTORY_ADJUSTMENT`.
- Los prefijos salen de `ErpConfig.documents` (`reqPrefix`, `poPrefix`, `adjPrefix`).
- Extender `prisma/seeds/init-sequences.ts` para backfillear esos 3 correlativos al máximo actual.
- **Esfuerzo:** S · **Riesgo:** bajo.

### 🔴 1.5-B · Singleton de Prisma `[P1, prerequisito de 2.2 y de auditoría global]`
- Crear `src/lib/prisma.ts`:
  ```ts
  import { PrismaClient } from '@prisma/client';
  const g = globalThis as unknown as { prisma?: PrismaClient };
  export const prisma = g.prisma ?? new PrismaClient();
  if (process.env.NODE_ENV !== 'production') g.prisma = prisma; // evita fugas con nodemon/ts-node
  ```
- Refactor mecánico: en los 54 archivos, sustituir `const prisma = new PrismaClient()` por
  `import { prisma } from '../lib/prisma'` (ajustar profundidad relativa).
- Verificar que ningún servicio dependa de tener su propio cliente (no los hay; todos usan el default).
- **Esfuerzo:** M (mecánico) · **Riesgo:** bajo-medio (un import mal puesto rompe un servicio → lo atrapa `tsc`).
- **Beneficio:** elimina la fuga de pools de conexión y **habilita** el `$extends` global de auditoría a futuro.

### 🟡 1.5-C · Refinar el cálculo de crédito `[P1]`
- Hacer explícito el filtro a `status IN ('PENDING','PARTIAL','SENT')` (hoy es por exclusión, equivalente
  pero menos legible) y dejar comentado el gancho para **restar notas de crédito** cuando exista el modelo de NC.
- Confirmar (ya implementado) la inclusión de pedidos `CONFIRMED` sin factura en la exposición.
- **Esfuerzo:** S · **Riesgo:** bajo.

### 🔴 1.5-D · Prueba de concurrencia de numeración `[P0 — calidad]`
- Script `prisma/tests/sequence-concurrency.ts` + script npm `test:sequence`: lanza N (ej. 100) creaciones
  de cotización en paralelo (`Promise.all`) y verifica que los N `quoteNumber` sean **únicos**.
- Cubrir el caso del **primer INSERT concurrente** del `upsert` (dos transacciones creando la fila a la vez):
  si Postgres lanza conflicto de unicidad, reintentar una vez.
- **Esfuerzo:** S · **Riesgo:** nulo (solo prueba).

> **Resultado del 1.5:** numeración 100% atómica en todo el ERP, una sola conexión Prisma, crédito legible
> y la atomicidad probada bajo concurrencia.

---

## 3. Feature: Despachos parciales (corrige el punto 1.2, bien dimensionado) `[P1 — diseño primero]`

DeepSeek tiene razón en el **riesgo**, no en el **cómo**. Hoy NO es un bug (un pedido = un solo `Shipment`
que cubre todo, y `invoiceSalesOrder` factura el total al entregar, lo cual es consistente). El problema
aparece **el día que se quiera despachar un pedido en varios envíos**. Eso requiere modelar, no parchear:

**Cambios de esquema necesarios:**
1. Nuevo modelo `ShipmentItem` (`shipmentId`, `salesOrderItemId`, `productId`, `quantity`).
2. En `SalesOrderItem`: agregar `shippedQty` e `invoicedQty` (Decimal).
3. Estado de pedido `PARTIALLY_SHIPPED` / `PARTIALLY_INVOICED`.

**Cambios de lógica:**
4. `dispatchOrder(orderId, { items: [{itemId, qty}] })` → crea `Shipment` con sus `ShipmentItem`, suma a
   `shippedQty`. Si `Σ shippedQty < Σ quantity` → pedido `PARTIALLY_SHIPPED`, si no `DISPATCHED`.
5. `invoiceSalesOrder(companyId, shipmentId, ...)` → factura **solo los ítems de ese `Shipment`**
   (no el pedido completo). Acumula `invoicedQty`. La factura queda `PARTIAL` mientras falten unidades.
6. La validación de crédito ya tolera esto (suma facturas no pagadas + confirmados).

**Esfuerzo:** L · **Riesgo:** medio (toca despacho, factura e inventario). **No hacer a ciegas** — requiere
confirmar contigo si el negocio realmente despacha parcial (si siempre es envío único, esto es innecesario).

---

## 4. Lo que se suma a SPRINTS POSTERIORES (no al 1.5)

| Item | Sprint | Notas |
|------|--------|-------|
| **2.2** AsyncLocalStorage para `userId`/`ip` | 2 (tras singleton) | Reemplaza el `actorId` manual; permite `$extends` global de auditoría |
| **3.1** Retenciones de venta en `PaymentApplication` + asiento "Retención por pagar" | 2 (Finanzas) | Reusar `RetentionCatalog`/`AccountMapping`/`journal.service`; config por cliente (`defaultRetentionCode*` ya existe en `Customer`) |
| **3.2** PriceList + protección/versionado de precios con cotizaciones activas | 2 | Al cambiar `Product`/`PriceListItem` con cotizaciones `PENDING` → versionar, no sobrescribir |
| Notas de crédito de venta (para crédito y SRI) | 2-3 | Prerequisito real para "restar NC" del punto 1.3 |
| Auditoría global vía `$extends` | 3 | Solo posible **después** del singleton (1.5-B) |

---

## 5. Checklist Sprint 1.5

- [x] **1.5-A** Numeración atómica REQ / OC / AJU (+ las 2 rutas de OC comparten `docType` PURCHASE_ORDER) + backfill en seed
- [x] **1.5-B** `src/lib/prisma.ts` singleton (con `beforeExit`) + refactor de 57 imports (limpios)
- [x] **1.5-C** Crédito: `pendingOrdersTotal` explícito null-safe + comentario de saldo vía `paidAmount`
- [x] **1.5-D** Script `npm run test:sequence` (100 concurrentes, `unique: true/false`) + retry P2002 en el helper
- [ ] (Usuario) `npx prisma migrate dev` → regenerar cliente → `npm run db:init-sequences` → `npx tsc --noEmit` → `npm run test:sequence`
- [ ] Prueba en navegador: crear REQ/OC/AJU y verificar correlativos

### Refinamientos extra aplicados (pedido del usuario)
- [x] Singleton con cierre graceful `process.on('beforeExit')`
- [x] `getNextDocumentNumber` con try/catch + reintento P2002 (×3)
- [x] Seed lee prefijos de `ErpConfig.documents` (REQ/OC/AJU) y calcula el máx real de los 6 tipos
- [x] Crédito null-safe con `pendingOrdersTotal`
- [x] `test:sequence` con `Promise.all` e impresión de números + `unique`

### Cierre final 1.5 (5 puntos extra)
- [x] **Auto-seed**: `initDocumentSequences()` en el arranque de `index.ts` (solo si la tabla está vacía); lógica en `src/lib/init-sequences.ts`
- [x] **Numeración total**: migradas `financial.service` (`FAC-`/`OCP-` → docTypes `FINANCIAL_INVOICE_*`), `production.service` (`PROD-`), `journal.service` (`AST-`) al helper atómico (transacción propia)
- [x] **Test multi-tipo**: `test:sequence` ahora prueba COT/REQ/OC/AJU × 25 concurrentes + 100 COT por flujo real, con footprint cero (restaura contadores)
- [x] **Pool de tests**: `prisma.ts` usa `connection_limit=30` cuando `NODE_ENV==='test'`
- [x] **Despacho parcial** (decisión: SÍ): modelo `ShipmentItem`, `SalesOrderItem.shippedQty/invoicedQty`, relación 1:N `SalesOrder.invoices`, estado `PARTIALLY_SHIPPED`, `dispatchOrder(items?)` parcial y `invoiceSalesOrder(shipmentId)` que factura solo el envío. Frontend `SalesOrderDetailPage` adaptado a `order.invoices[]`.

> El seed `init-sequences` y el auto-seed cubren los 12 docTypes y separan `FAC-V-` / `FAC-` / `OCP-` por prefijo para no mezclar contadores.

## 6. Despacho parcial — RESUELTO (decisión: SÍ) ✅

Decisión tomada: **SÍ** se implementa. Modelado e integrado (ver §3) y cerrado con 4 cabos sueltos:

- [x] **Frontend `DispatchModal`** (`components/sales/DispatchModal.tsx`): elegir cantidades por producto;
      botones "Despachar todo" (sin items) y "Despachar seleccionado" (parcial). Página adaptada
      (`order.invoices[]`, estado `PARTIALLY_SHIPPED`).
- [x] **Migración de datos** sin pérdida: `db:capture-invoice-links` (antes de migrar) +
      `db:restore-invoice-links` (después) rellenan `Invoice.salesOrderId` desde el viejo `SalesOrder.invoiceId`.
- [x] **Contabilidad por envío**: `invoiceSalesOrder` postea Ingreso + COGS **proporcionales a cada Shipment**
      (no solo al final) vía `createSalesEntryAmounts` / `createCOGSEntryAmount`.
- [x] **Config `sales.allowPartialDispatch`** (default `false`): si está off, el backend rechaza el parcial
      (`PARTIAL_DISPATCH_DISABLED`) y se mantiene el flujo clásico 1 envío = 1 pedido.

> El esquema y la lógica del despacho parcial están descritos en §3. Con esto, el Sprint 1.5 queda
> completo a falta de la verificación (`tsc` + migración + test) por parte del usuario.

### Micro-ajustes de cierre del despacho parcial
- [x] **Estado maestro centralizado**: `recalculateOrderStatus(orderId, companyId)` calcula el estado del
      pedido (`PARTIALLY_SHIPPED` / `DISPATCHED` / `PARTIALLY_INVOICED` / `COMPLETED`, preservando `DELIVERED`)
      desde shippedQty/invoicedQty. Se invoca tras cada despacho, facturación y entrega.
- [x] **Índices**: `@@index([orderId, shippedQty])` y `@@index([orderId, invoicedQty])` en `SalesOrderItem`.
- [x] **Stock en el modal**: `GET /sales/orders/:id` devuelve `availableStock` **neto** por ítem
      (`quantity − reserved + reservedQty_propia` = físico menos reservas de **otros** pedidos); el
      `DispatchModal` limita el input a `min(pendiente, stock)` y avisa cuando el stock restringe.
      *(Se corrigió la fórmula `quantity − reserved` propuesta, que bloqueaba el despacho del propio pedido reservado.)*
- [x] **Estado "facturado sin despachar"**: `recalculateOrderStatus` ya no se queda en `CONFIRMED` si
      hay facturación sin envío (flujo de anticipo) → `PARTIALLY_SHIPPED`.
- [x] **Guardarraíl de devoluciones**: TODO de Notas de Crédito en `Invoice`; el frontend deshabilita
      "Anular" en facturas con `salesOrderId` (muestra "Anular (requiere NC)") hasta el módulo de NC (Sprint 3).
- [x] **Restore idempotente**: `restore-invoice-links` usa `WHERE "salesOrderId" IS NULL` (re-ejecutable).

---

> **Orden recomendado:** 1.5-A → 1.5-B → 1.5-C → 1.5-D (los cuatro son de bajo riesgo y cierran el P0 con
> calidad). El despacho parcial (§3) se decide aparte porque su necesidad depende de tu operación real, y
> retenciones/PriceList se mantienen en el Sprint 2 donde tienen su contexto.
