# Frontend — Módulos (Páginas) — KallpaPro
> Descripción de cada página: qué hace, qué API llama, qué estado maneja.

---

## Dashboard.tsx

**Ruta:** `/dashboard`

Muestra tarjetas de módulos del sistema con indicador de estado activo/pendiente.

```
Módulos activos (navegan al módulo):
  - Inventario → /inventory
  - Compras    → /purchases
  - Financiero → /financial

Módulos pendientes (no navegan):
  - Ventas (próximamente)
  - Logística (próximamente)
```

Estado en Dashboard.tsx:
```typescript
const modules = [
  { name: 'Inventario', active: true, path: '/inventory', icon: '📦' },
  { name: 'Compras', active: true, path: '/purchases', icon: '🛒' },
  { name: 'Financiero', active: true, path: '/financial', icon: '💰' },
  { name: 'Ventas', active: false, path: '/sales', icon: '💼' },
  { name: 'Logística', active: false, path: '/logistics', icon: '🚚' },
];
```

---

## Módulo Inventario

### InventoryPage.tsx — `/inventory`
- KPI cards: total productos, valor inventario, bajo stock, sin stock
- Lista de productos con columnas: SKU, nombre, categoría, stock total, avgCost, precio venta
- Botones: Nuevo Producto, Ver Bodegas, Ver Categorías
- API: `inventoryApi.getProducts()`, `inventoryApi.getKPIs()`

### NewProductPage.tsx — `/inventory/products/new`
- Formulario: SKU, nombre, descripción, categoría, unidad, precio venta, stock mínimo
- Carga categorías del backend
- API: `inventoryApi.createProduct()`, `inventoryApi.getCategories()`

### ProductDetailPage.tsx — `/inventory/products/:id`
- Muestra datos del producto + stock por bodega
- Formulario para registrar movimiento: tipo, bodega, cantidad, costo unitario
- Tabla kardex: historial de movimientos con columnas fecha/tipo/qty/costo/promedio/stock
- API: `inventoryApi.getProduct(id)`, `inventoryApi.registerMovement()`, `inventoryApi.getKardex(id)`

### WarehousesPage.tsx — `/inventory/warehouses`
- Lista bodegas con badge "Principal" para isDefault
- Modal crear bodega: nombre, código, dirección
- API: `inventoryApi.getWarehouses()`, `inventoryApi.createWarehouse()`

### CategoriesPage.tsx — `/inventory/categories`
- Lista categorías con descripción
- Modal crear categoría: nombre, descripción
- API: `inventoryApi.getCategories()`, `inventoryApi.createCategory()`

---

## Módulo Compras

### PurchasesPage.tsx — `/purchases`
- Lista OC con columnas: número, proveedor, estado, total, fecha
- Badge de color por estado (DRAFT=gris, APPROVED=azul, RECEIVED=verde, etc.)
- Botones: Nueva OC, Ver Proveedores
- API: `purchasesApi.getPurchaseOrders()`

### SuppliersPage.tsx — `/purchases/suppliers`
- Lista proveedores con nombre, RUC, email, ciudad
- Modal crear proveedor: nombre, RUC, email, teléfono, dirección, ciudad, condiciones pago
- API: `purchasesApi.getSuppliers()`, `purchasesApi.createSupplier()`

### NewOrderPage.tsx — `/purchases/new`
- Select proveedor
- Tabla de ítems con add/remove: select producto, cantidad, precio unitario
- Calcula total en tiempo real
- API: `purchasesApi.createPurchaseOrder()`, carga productos para seleccionar

### OrderDetailPage.tsx — `/purchases/:id`
- Detalle completo OC con ítems
- Botones por estado:
  - DRAFT → "Enviar a aprobación"
  - APPROVED → "Enviar al proveedor"
  - SENT → "Recibir mercancía" (abre modal select bodega)
- Recepción: `purchasesApi.receivePurchaseOrder(id, warehouseId)`
- API: `purchasesApi.getPurchaseOrder(id)`, `purchasesApi.updateStatus()`, `purchasesApi.receive()`

---

## Módulo Financiero

### FinancialPage.tsx — `/financial`
- KPI cards: CxC, CxP, flujo neto, vencido
- Tabs: TODAS / VENTAS / COMPRAS
- Lista facturas con: número, tipo, estado, total, pagado, vencimiento
- Botones: Nueva Factura, Facturas SRI (→ /sri)
- API: `financialApi.getInvoices()`, `financialApi.getKPIs()`

### NewInvoicePage.tsx — `/financial/invoices/new`
- Select tipo (SALES/PURCHASE)
- Tabla de ítems: descripción, cantidad, precio unitario
- Calcula total en tiempo real
- API: `financialApi.createInvoice()`

### InvoiceDetailPage.tsx — `/financial/invoices/:id`
- Detalle factura con ítems
- Botones de cambio de estado según estado actual
- Input para monto pagado al marcar PAID
- API: `financialApi.getInvoice(id)`, `financialApi.updateStatus()`

---

## Módulo SRI

### SriDocumentsPage.tsx — `/sri`
- **Zona de upload**: drag & drop + input file, acepta PDF/XML
- KPI cards: pendientes, confirmados, rechazados, total compras, IVA crédito fiscal
- Tabs de filtro: TODOS / PENDIENTE REVISIÓN / CONFIRMADO / RECHAZADO
- Tabla: fecha emisión, número doc, emisor, RUC, total, IVA, estado
- Por cada fila no-CONFIRMED: botón 🗑 Eliminar con confirmación
- Click en fila → navega a `/sri/:id`
- API: `sriApi.upload()`, `sriApi.list()`, `sriApi.kpis()`, `sriApi.delete()`

### SriDocumentReviewPage.tsx — `/sri/:id`
- **Panel Emisor**: razón social, RUC, establecimiento, dirección
- **Panel Comprobante**: número, fecha emisión, clave de acceso, ambiente
- **Panel Totales**: subtotal 0%, subtotal 15%, IVA 15%, total
- **Panel Match OC**: si hay OC asignada, muestra número y badge confianza
- **Advertencias de parseo**: si confidence < 70, lista de warnings
- **Tabla ítems**: código, descripción, cantidad, precio unit, precio total, tarifa IVA, valorIVA
  - Columna `tipoItem`: dropdown editable (PRODUCTO/SERVICIO) cuando status=PENDING_REVIEW
  - Columna `Producto ERP`: dropdown para asignar productId (carga lista de productos)
- **Botones principales** (cuando PENDING_REVIEW):
  - ✓ Confirmar y cargar inventario → POST /api/sri/:id/confirm
  - ✗ Rechazar → input motivo + POST /api/sri/:id/reject
  - 🗑 Eliminar → DELETE /api/sri/:id
- API: `sriApi.get(id)`, `sriApi.update()`, `sriApi.confirm()`, `sriApi.reject()`, `sriApi.delete()`

---

## Patrones UI reutilizados

### Input numérico
```typescript
// Previene caracteres no numéricos
<input
  type="number"
  step="0.01"
  min="0"
  onWheel={(e) => e.currentTarget.blur()} // evita cambio accidental con scroll
/>
```

### Badge de estado
```typescript
const statusColors = {
  DRAFT: 'bg-gray-700 text-gray-300',
  APPROVED: 'bg-blue-900 text-blue-300',
  RECEIVED: 'bg-green-900 text-green-300',
  CONFIRMED: 'bg-green-900 text-green-300',
  PENDING_REVIEW: 'bg-yellow-900 text-yellow-300',
  REJECTED: 'bg-red-900 text-red-300',
  CANCELLED: 'bg-red-900 text-red-300',
};
```

### Tabla estándar
```
header: bg-gray-800 text-gray-400 text-xs uppercase
rows:   bg-gray-900 hover:bg-gray-800 text-white
border: border-gray-700
```

### Formulario estándar
```
label: text-gray-400 text-sm
input: bg-gray-800 border border-gray-700 rounded text-white
       focus:outline-none focus:border-cyan-500
```
