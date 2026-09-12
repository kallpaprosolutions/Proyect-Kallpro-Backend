# Módulo Financiero — KallpaPro
> Facturas internas del ERP (no son facturas SRI). Cuentas por cobrar y pagar. KPIs.

---

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/financial/invoices | Listar facturas (filtro por type) |
| POST | /api/financial/invoices | Crear factura |
| GET | /api/financial/invoices/:id | Detalle + ítems |
| PATCH | /api/financial/invoices/:id/status | Cambiar estado + monto pagado |
| GET | /api/financial/kpis | KPIs financieros |

---

## Tipos de Factura

| Tipo | Prefijo | Descripción |
|------|---------|-------------|
| SALES | FAC-0001 | Factura de venta (cuenta por cobrar) |
| PURCHASE | OCP-0001 | Factura de compra interna (cuenta por pagar) |

---

## Estados de Factura

```
DRAFT → SENT → PAID
              ↓
           OVERDUE
              ↓
          CANCELLED
```

| Estado | Descripción |
|--------|-------------|
| DRAFT | Borrador |
| SENT | Enviada al cliente/proveedor |
| PAID | Pagada completamente |
| OVERDUE | Vencida sin pagar |
| CANCELLED | Cancelada |

---

## Auto-generación de número

```typescript
const count = await prisma.invoice.count({ where: { companyId } });
const prefix = data.type === 'SALES' ? 'FAC' : 'OCP';
const number = `${prefix}-${String(count + 1).padStart(4, '0')}`;
// FAC-0001, FAC-0002 ... / OCP-0001, OCP-0002 ...
```

---

## Ejemplo de payloads

### Crear factura de venta
```json
POST /api/financial/invoices
{
  "type": "SALES",
  "dueDate": "2025-04-30",
  "notes": "Consultoría enero 2025",
  "items": [
    { "description": "Consultoría técnica", "quantity": 8, "unitPrice": 150.00 },
    { "description": "Capacitación", "quantity": 4, "unitPrice": 80.00 }
  ]
}
```

### Marcar como pagada
```json
PATCH /api/financial/invoices/:id/status
{
  "status": "PAID",
  "paidAmount": 1520.00
}
```

---

## KPIs financieros

```typescript
GET /api/financial/kpis

Respuesta:
{
  totalSales: number,          // suma de todas las facturas de venta
  totalCollected: number,      // suma de paidAmount en facturas de venta
  accountsReceivable: number,  // totalSales - totalCollected
  totalPurchases: number,      // suma de todas las facturas de compra
  totalPaid: number,           // suma de paidAmount en facturas de compra
  accountsPayable: number,     // totalPurchases - totalPaid
  overdueReceivable: number,   // por cobrar vencido (dueDate < hoy y no PAID)
  overduePayable: number,      // por pagar vencido
  netCashFlow: number          // totalCollected - totalPaid
}
```

---

## Diferencia: Invoice vs SriDocument

| Característica | Invoice (ERP) | SriDocument |
|----------------|---------------|-------------|
| Origen | Creada manualmente en el ERP | Importada desde PDF/XML del SRI |
| Valida tributariamente | No | Sí |
| Actualiza inventario | No automático | Sí (al confirmar) |
| Tiene clave de acceso | No | Sí (49 dígitos) |
| Uso | Control interno, CxC/CxP | Procesamiento facturas reales Ecuador |

---

## Página principal del módulo financiero

`FinancialPage.tsx` muestra:
- KPI cards: CxC, CxP, flujo neto
- Tabla de facturas (paginada)
- Filtro por tipo: SALES / PURCHASE
- Botón "Nueva Factura" → /financial/invoices/new
- Botón "Facturas SRI" → /sri

---

## Archivos del módulo

```
Backend:
  src/routes/financial.routes.ts
  src/controllers/financial.controller.ts
  src/services/financial.service.ts

Frontend:
  src/api/financial.ts
  src/pages/financial/FinancialPage.tsx       → dashboard financiero
  src/pages/financial/NewInvoicePage.tsx      → crear factura
  src/pages/financial/InvoiceDetailPage.tsx   → detalle + cambiar estado
  src/pages/financial/SriDocumentsPage.tsx    → subir y listar facturas SRI
  src/pages/financial/SriDocumentReviewPage.tsx → revisar y confirmar SRI
```
