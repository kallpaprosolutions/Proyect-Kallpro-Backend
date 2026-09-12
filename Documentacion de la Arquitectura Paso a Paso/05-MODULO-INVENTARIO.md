# Módulo Inventario — KallpaPro
> Productos, bodegas, categorías, kardex, y motor de costo promedio ponderado.

---

## Endpoints

### Categorías
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/inventory/categories | Listar categorías |
| POST | /api/inventory/categories | Crear categoría |

### Bodegas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/inventory/warehouses | Listar bodegas |
| POST | /api/inventory/warehouses | Crear bodega |

### Productos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/inventory/products | Listar productos (con stocks por bodega) |
| POST | /api/inventory/products | Crear producto |
| GET | /api/inventory/products/:id | Detalle + últimos 50 movimientos |
| PATCH | /api/inventory/products/:id | Actualizar producto |

### Movimientos (Kardex)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/inventory/movements | Registrar movimiento (IN/OUT/ADJUSTMENT) |
| GET | /api/inventory/products/:id/kardex | Historial de movimientos de un producto |

### KPIs
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/inventory/kpis | Total productos, valor inventario, bajo stock |

---

## Motor de Costo Promedio Ponderado

Implementado en: `src/services/inventory.service.ts` → `registerMovement()`

### Fórmula (entradas IN / ADJUSTMENT_IN):
```
Nuevo Promedio = (stock_actual × costo_actual + cantidad_nueva × costo_nuevo)
                 ────────────────────────────────────────────────────────────
                          (stock_actual + cantidad_nueva)
```

### Fórmula (salidas OUT / ADJUSTMENT_OUT):
```
El costo promedio NO CAMBIA en salidas.
Solo disminuye el stock.
Si stock < cantidad → lanza INSUFFICIENT_STOCK
```

### Código exacto:
```typescript
if (data.type === 'IN' || data.type === 'ADJUSTMENT_IN') {
  const totalValue = currentQty * currentAvgCost + qty * unitCost;
  newQty = currentQty + qty;
  newAvgCost = newQty > 0 ? totalValue / newQty : unitCost;
} else {
  if (currentQty < qty) throw new Error('INSUFFICIENT_STOCK');
  newQty = currentQty - qty;
  newAvgCost = currentAvgCost; // no cambia
}
```

### Transacción atómica:
`registerMovement()` usa `prisma.$transaction()` para:
1. Leer stock actual
2. Calcular nuevo promedio
3. Crear `InventoryMovement`
4. Actualizar `ProductStock` (upsert)
5. Actualizar `Product.avgCost`

---

## Flujo completo de setup de inventario

```
1. Crear bodega:
   POST /api/inventory/warehouses
   { "name": "Bodega Principal", "code": "BP" }
   → Primera bodega: isDefault = true automáticamente

2. Crear categoría:
   POST /api/inventory/categories
   { "name": "Productos Terminados" }

3. Crear producto:
   POST /api/inventory/products
   { "sku": "PROD-001", "name": "Cable UTP", "categoryId": "...",
     "unit": "ROLLO", "salePrice": 25.00, "minStock": 5 }

4. Registrar entrada:
   POST /api/inventory/movements
   { "productId": "...", "warehouseId": "...",
     "type": "IN", "quantity": 100, "unitCost": 18.50,
     "reference": "OC-0001", "notes": "Entrada inicial" }
   → Actualiza avgCost, crea kardex, actualiza ProductStock
```

---

## Tipos de movimiento

| Tipo | Efecto en stock | Efecto en costo |
|------|-----------------|-----------------|
| IN | +cantidad | Recalcula promedio |
| OUT | -cantidad | Sin cambio |
| ADJUSTMENT_IN | +cantidad | Recalcula promedio |
| ADJUSTMENT_OUT | -cantidad | Sin cambio |

---

## KPIs devueltos

```typescript
{
  totalProducts: number,    // productos activos
  totalValue: number,       // suma(qty_total × avgCost) de todos los productos
  lowStockCount: number,    // productos con qty ≤ minStock (y qty > 0)
  zeroStockCount: number    // productos con qty = 0
}
```

---

## Ejemplo payload — POST /api/inventory/movements

```json
{
  "productId": "abc-123",
  "warehouseId": "def-456",
  "type": "IN",
  "quantity": 50,
  "unitCost": 12.75,
  "reference": "FAC-SRI-001",
  "notes": "Recepción factura SRI EMPROMOTOR"
}
```

---

## Bodegas: lógica isDefault

```typescript
// Al crear la primera bodega de una empresa:
const count = await prisma.warehouse.count({ where: { companyId } });
isDefault: count === 0  // → true si es la primera
```

`confirmSriDocument()` y `receivePurchaseOrder()` buscan la bodega por defecto:
```typescript
const warehouse = await prisma.warehouse.findFirst({
  where: { companyId, isActive: true },
  orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
});
```

---

## Archivos del módulo

```
Backend:
  src/routes/inventory.routes.ts
  src/controllers/inventory.controller.ts
  src/services/inventory.service.ts

Frontend:
  src/api/inventory.ts
  src/pages/inventory/InventoryPage.tsx      → lista productos + KPIs
  src/pages/inventory/NewProductPage.tsx     → formulario crear producto
  src/pages/inventory/ProductDetailPage.tsx  → detalle + kardex
  src/pages/inventory/WarehousesPage.tsx     → lista y crear bodegas
  src/pages/inventory/CategoriesPage.tsx     → lista y crear categorías
```
