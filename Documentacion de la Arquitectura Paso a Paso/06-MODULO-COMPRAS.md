# Módulo Compras — KallpaPro
> Proveedores, órdenes de compra y recepción automática en inventario.

---

## Endpoints

### Proveedores
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/purchases/suppliers | Listar proveedores activos |
| POST | /api/purchases/suppliers | Crear proveedor |
| PATCH | /api/purchases/suppliers/:id | Actualizar proveedor |

### Órdenes de Compra
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/purchases | Listar OC (con proveedor e ítems) |
| POST | /api/purchases | Crear OC |
| GET | /api/purchases/:id | Detalle OC |
| PATCH | /api/purchases/:id/status | Cambiar estado |
| POST | /api/purchases/:id/receive | Recibir OC → genera movimientos IN |

---

## Estados de Orden de Compra

```
DRAFT → SUBMITTED → APPROVED → SENT → PARTIAL → RECEIVED
                                            ↓
                                        CANCELLED
```

| Estado | Descripción |
|--------|-------------|
| DRAFT | Borrador, editable |
| SUBMITTED | Enviada a aprobación interna |
| APPROVED | Aprobada internamente |
| SENT | Enviada al proveedor |
| PARTIAL | Recibida parcialmente |
| RECEIVED | Totalmente recibida |
| CANCELLED | Cancelada |

---

## Auto-generación de número OC

```typescript
const count = await prisma.purchaseOrder.count({ where: { companyId } });
const poNumber = `OC-${String(count + 1).padStart(4, '0')}`;
// Resultado: OC-0001, OC-0002, OC-0003 ...
```

---

## Recepción de OC → Inventario automático

Función: `receivePurchaseOrder()` en `purchases.service.ts`

```typescript
// Para cada ítem de la OC:
await registerMovement(companyId, {
  productId: item.productId,
  warehouseId,           // enviado en el request
  type: 'IN',
  quantity: item.quantity,
  unitCost: Number(item.unitPrice),
  reference: po.poNumber,
  notes: `Recepción OC ${po.poNumber}`,
  createdBy: userId,
});

// Actualiza receivedQuantity en el ítem
// Cambia estado OC a RECEIVED
```

---

## Ejemplo de payloads

### Crear proveedor
```json
POST /api/purchases/suppliers
{
  "name": "EMPROMOTOR CIA. LTDA.",
  "ruc": "1791860829001",
  "email": "ventas@empromotor.com",
  "phone": "022345678",
  "address": "Quito, Ecuador",
  "paymentTerms": "30 días"
}
```

### Crear OC
```json
POST /api/purchases
{
  "supplierId": "uuid-del-proveedor",
  "deliveryDate": "2025-03-15",
  "notes": "Entrega urgente",
  "items": [
    { "productId": "uuid-producto", "quantity": 100, "unitPrice": 18.50 },
    { "productId": "uuid-producto-2", "quantity": 50, "unitPrice": 45.00 }
  ]
}
```

### Recibir OC
```json
POST /api/purchases/:id/receive
{
  "warehouseId": "uuid-bodega"
}
```

---

## Campo RUC en Supplier

El campo `ruc` es clave para el módulo SRI:

```typescript
// sri-document.service.ts — al importar una factura PDF/XML:
const supplier = await prisma.supplier.findFirst({
  where: { companyId, ruc: parsed.rucEmisor, isActive: true },
});
// Si encuentra proveedor → lo asigna al SriDocument automáticamente
// Si no encuentra → supplierId = null (el usuario asigna en revisión)
```

**Por eso es importante registrar el RUC del proveedor al crearlo.**

---

## Relación OC ↔ Facturas SRI

Las OC en estado SENT/PARTIAL/DRAFT son candidatas al matching automático con facturas SRI:

```
Factura SRI importada (RUC emisor = proveedor.ruc)
  ↓
findMatchingPO() busca OC del mismo proveedor
  ↓
Compara totalFactura vs OC.totalAmount
  ↓
Asigna confidence:
  ±1%  → 95% confianza (Coincidencia alta)
  ±5%  → 80% confianza (Coincidencia media)
  ±10% → 65% confianza
  ±20% → 50% confianza (Coincidencia baja)
  solo mismo proveedor → 40% (Solo mismo proveedor)
```

---

## Archivos del módulo

```
Backend:
  src/routes/purchases.routes.ts
  src/controllers/purchases.controller.ts
  src/services/purchases.service.ts

Frontend:
  src/api/purchases.ts
  src/pages/purchases/PurchasesPage.tsx     → lista OC + KPIs
  src/pages/purchases/SuppliersPage.tsx     → lista y crear proveedores
  src/pages/purchases/NewOrderPage.tsx      → crear OC con ítems
  src/pages/purchases/OrderDetailPage.tsx   → detalle + acciones (recibir, cambiar estado)
```
