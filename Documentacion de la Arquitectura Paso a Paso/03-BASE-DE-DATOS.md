# Base de Datos — KallpaPro
> PostgreSQL 15 vía Docker. ORM: Prisma 5.x. 25 modelos / tablas.

---

## Modelos (tablas)

### Grupo 1 — Tenants y Usuarios

| Modelo | Tabla | Descripción |
|--------|-------|-------------|
| Company | companies | Empresa (tenant). Todo lo demás depende de companyId |
| User | users | Usuario de la empresa. Email único global. Roles: ADMIN, USER |

```
Company
  id, name, email?, phone?, industry?, createdAt, updatedAt
  → users[], categories[], warehouses[], products[], movements[]
  → purchaseOrders[], invoices[], subscriptions[], sriDocuments[]

User
  id, companyId (FK→Company), email (UNIQUE), passwordHash
  firstName?, lastName?, role (default "USER"), isActive, lastLoginAt
  @@index([companyId]), @@index([email])
```

---

### Grupo 2 — Inventario

| Modelo | Tabla | Descripción |
|--------|-------|-------------|
| Category | categories | Categorías de productos con jerarquía (parentId) |
| Warehouse | warehouses | Bodegas. La primera que se crea es isDefault=true |
| Product | products | Productos/servicios. avgCost = promedio ponderado |
| ProductStock | product_stock | Stock por producto+bodega (tabla pivot) |
| InventoryMovement | inventory_movements | Kardex: historial de cada movimiento |

```
Product
  id, companyId, sku?, barcode?, name, description?, categoryId?
  unit (default "UNIDAD"), salePrice Decimal(12,2), avgCost Decimal(12,4)
  minStock Decimal(12,4), maxStock?, isActive, type (default "PRODUCT")
  lastMovementAt?, createdAt, updatedAt

ProductStock
  id, productId (FK), warehouseId (FK), quantity Decimal(12,4), reserved
  @@unique([productId, warehouseId])   ← pivot único

InventoryMovement
  id, companyId, productId, warehouseId
  type: IN | OUT | ADJUSTMENT_IN | ADJUSTMENT_OUT
  quantity, unitCost, totalCost, avgCostAfter, stockAfter
  reference?, notes?, createdBy?, createdAt
```

---

### Grupo 3 — Compras

| Modelo | Tabla | Descripción |
|--------|-------|-------------|
| Supplier | suppliers | Proveedor. Campo ruc para matching SRI |
| PurchaseOrder | purchase_orders | Orden de compra. poNumber auto: OC-0001 |
| POItem | po_items | Líneas de la OC |

```
Supplier
  id, companyId, name, ruc?, email?, phone?, address?, city?, country?
  paymentTerms?, isActive
  @@index([ruc])   ← búsqueda por RUC al importar facturas SRI

PurchaseOrder
  id, companyId, supplierId (FK), poNumber (UNIQUE), status, totalAmount
  deliveryDate?, notes?, createdAt, updatedAt
  Estados: DRAFT → SUBMITTED → APPROVED → SENT → PARTIAL → RECEIVED | CANCELLED

POItem
  id, poId (FK), productId? (FK), quantity (Int), unitPrice, lineTotal
  receivedQuantity (default 0)
```

---

### Grupo 4 — Financiero

| Modelo | Tabla | Descripción |
|--------|-------|-------------|
| Invoice | invoices | Factura interna ERP (no es factura SRI) |
| InvoiceItem | invoice_items | Líneas de la factura |
| SubscriptionPlan | subscription_plans | Planes del SaaS KallpaPro |
| Subscription | subscriptions | Suscripción de cada empresa |
| BillingHistory | billing_history | Historial de pagos |

```
Invoice
  id, companyId, number (UNIQUE), type: SALES|PURCHASE
  status: DRAFT|SENT|PAID|OVERDUE|CANCELLED
  totalAmount, paidAmount (default 0), issueDate, dueDate?, notes?
  Numeración: FAC-0001 (SALES), OCP-0001 (PURCHASE)
```

---

### Grupo 5 — SRI Ecuador

| Modelo | Tabla | Descripción |
|--------|-------|-------------|
| SriDocument | sri_documents | Documento importado via PDF/XML |
| SriDocumentItem | sri_document_items | Líneas del documento SRI |
| SriRetention | sri_retentions | Retenciones del documento |
| IvaTariff | iva_tariffs | Catálogo de tarifas IVA vigentes |
| RetentionCatalog | retention_catalog | Catálogo de retenciones IR+IVA |

```
SriDocument
  id, companyId, status: PENDING_REVIEW|CONFIRMED|REJECTED
  tipoDocumento: FACTURA|NOTA_CREDITO|NOTA_DEBITO|LIQUIDACION_COMPRA|RETENCION
  claveAcceso (49 dígitos), numeroAutorizacion?
  rucEmisor, razonSocialEmisor, nombreComercial?, dirEmisor?
  contribuyenteEspecial?, obligadoContabilidad
  tipoIdComprador?, idComprador?, razonSocialComprador?
  estab, ptoEmi, secuencial, numeroDoc (ej: 013-001-000001305)
  fechaEmision, fechaAutorizacion?, ambiente
  subtotal0, subtotal8, subtotal12, subtotal15, subtotalNoObj, subtotalExento
  totalDescuento, ice, iva, irbpnr, propina, total
  formaPago?, valorFormaPago?
  retencionRenta?, retencionIva?
  parseConfidence (0-100), parseWarnings (JSON), fileType (PDF|XML), rawJson
  supplierId? (FK→Supplier), purchaseOrderId? (FK→PurchaseOrder)
  @@unique([companyId, claveAcceso])   ← evita duplicados por empresa

SriDocumentItem
  id, documentId (FK), linea, codPrincipal, codAuxiliar?, descripcion
  detAdicional?, cantidad, precioUnitario, descuento, precioTotal
  codigoTarifa (0/8/12/15/NO_OBJETO/EXENTO), tarifaIva, valorIva
  tipoItem: PRODUCTO|SERVICIO   ← el usuario clasifica en revisión
  productId? (FK→Product)       ← el usuario mapea en revisión
```

### Grupo 6 — Auditoría

| Modelo | Tabla | Descripción |
|--------|-------|-------------|
| AuditLog | audit_logs | Log de acciones del sistema |

---

## Relaciones clave

```
Company ──< User
Company ──< Category ──< Product ──< ProductStock >── Warehouse
Company ──< Warehouse ──< InventoryMovement >── Product
Company ──< Supplier ──< PurchaseOrder ──< POItem >── Product
Company ──< Invoice ──< InvoiceItem
Company ──< SriDocument ──< SriDocumentItem >── Product
Supplier ──< SriDocument
PurchaseOrder ──< SriDocument
```

---

## Comandos Prisma

```powershell
# Primera migración (crea todas las tablas)
npx prisma migrate dev --name init

# Aplicar migraciones sin interacción (CI/CD o nuevo PC)
npx prisma migrate deploy

# Regenerar cliente Prisma (después de cambiar schema)
npx prisma generate

# Ver base de datos en navegador
npx prisma studio

# Resetear BD (¡borra todo!)
npx prisma migrate reset

# Nueva migración al cambiar schema
npx prisma migrate dev --name nombre_descriptivo
```

---

## Seed de catálogos tributarios

Archivo: `prisma/seed-tax.ts`

```powershell
# Ejecutar seed
npx ts-node --project tsconfig.json prisma/seed-tax.ts
```

Siembra:
- **6 tarifas IVA**: 0%, 8% (construcción), 12% (hasta mayo 2024), 15% (vigente), NO_OBJETO, EXENTO
- **30 retenciones IR**: códigos 303 al 3491 (honorarios, servicios, bienes, etc.)
- **12 retenciones IVA**: códigos 721 al 734 (30%, 70%, 100% del IVA)
- Total: 48 registros en catálogos

---

## Migraciones históricas

| Migración | Cambio |
|-----------|--------|
| `init` | Crea todas las tablas base del sistema |
| `add_ruc_to_supplier` | Agrega campo `ruc` a Supplier para matching SRI |
| `add_sri_models` | Agrega SriDocument, SriDocumentItem, SriRetention |
| `add_tax_catalogs` | Agrega IvaTariff, RetentionCatalog |
| `add_sri_relations` | Agrega FK sriDocuments en Company, Supplier, PurchaseOrder |

Ruta en disco: `Proyect-Kallpro-Backend/prisma/migrations/`

---

## Tipos Decimal en Prisma

Prisma usa `Prisma.Decimal` para campos `@db.Decimal`. Al usarlos en código:

```typescript
// Crear
salePrice: new Prisma.Decimal(data.salePrice)

// Leer (convertir a número)
const qty = Number(product.avgCost)
const total = Number(po.totalAmount)
```

> **Importante:** Nunca comparar `Decimal === number` directamente. Siempre usar `Number()`.
