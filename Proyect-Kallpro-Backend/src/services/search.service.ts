import { prisma } from '../lib/prisma';

// ============================================================
// BÚSQUEDA GLOBAL FEDERADA (mejora A1 — patrón Odoo Ctrl+K)
// ============================================================
// Una sola consulta busca en paralelo sobre clientes, proveedores, productos,
// órdenes de compra, facturas, pedidos de venta y requisiciones de la empresa.
// Los menús/rutas del sistema se resuelven en el frontend (son estáticos).

export interface SearchResult {
  type: 'CUSTOMER' | 'SUPPLIER' | 'PRODUCT' | 'PURCHASE_ORDER' | 'INVOICE' | 'SALES_ORDER' | 'REQUISITION';
  id: string;
  title: string;
  subtitle: string;
  route: string; // ruta del frontend a la que navega el resultado
}

export interface SearchResponse {
  query: string;
  groups: { type: SearchResult['type']; label: string; results: SearchResult[] }[];
  total: number;
}

// Etiquetas en español por tipo (regla 7: sin enums crudos en UI)
export const SEARCH_GROUP_LABELS: Record<SearchResult['type'], string> = {
  CUSTOMER: 'Clientes',
  SUPPLIER: 'Proveedores',
  PRODUCT: 'Productos',
  PURCHASE_ORDER: 'Órdenes de compra',
  INVOICE: 'Facturas',
  SALES_ORDER: 'Pedidos de venta',
  REQUISITION: 'Requisiciones',
};

// Filas crudas mínimas que el motor puro necesita de cada entidad
export interface RawSearchRows {
  customers: { id: string; name: string; ruc: string | null; email: string | null }[];
  suppliers: { id: string; name: string; ruc: string | null; email: string | null }[];
  products: { id: string; name: string; sku: string | null; barcode: string | null }[];
  purchaseOrders: { id: string; poNumber: string; status: string; totalAmount: unknown; supplierName: string }[];
  invoices: { id: string; number: string; type: string; status: string; totalAmount: unknown }[];
  salesOrders: { id: string; orderNumber: string; status: string; total: unknown; customerName: string }[];
  requisitions: { id: string; reqNumber: string; title: string; status: string }[];
}

// Estados traducidos para subtítulos (subset de los catálogos existentes)
const STATUS_ES: Record<string, string> = {
  DRAFT: 'Borrador', SUBMITTED: 'Enviada', APPROVED: 'Aprobada', REJECTED: 'Rechazada',
  RECEIVED: 'Recibida', CANCELLED: 'Anulada', ISSUED: 'Emitida', PAID: 'Pagada',
  PARTIALLY_PAID: 'Pago parcial', CONFIRMED: 'Confirmado', PICKING: 'En preparación',
  PARTIALLY_SHIPPED: 'Despacho parcial', DISPATCHED: 'Despachado', DELIVERED: 'Entregado',
  PARTIALLY_INVOICED: 'Facturación parcial', INVOICED: 'Facturado', COMPLETED: 'Completado',
  PENDING_L1: 'Pendiente aprobación N1', PENDING_L2: 'Pendiente aprobación N2',
  PENDING_L3: 'Pendiente aprobación N3', QUOTED: 'Cotizada', PO_CREATED: 'OC creada',
  PENDING: 'Pendiente', POSTED: 'Contabilizada',
};

const statusEs = (s: string) => STATUS_ES[s] ?? s;
const money = (v: unknown) => `$${Number(v ?? 0).toFixed(2)}`;

/**
 * Motor PURO (regla 6): transforma filas crudas en la respuesta agrupada.
 * Sin BD → testeable unitariamente.
 */
export function buildSearchResponse(query: string, rows: RawSearchRows): SearchResponse {
  const groups: SearchResponse['groups'] = [];

  const push = (type: SearchResult['type'], results: SearchResult[]) => {
    if (results.length > 0) groups.push({ type, label: SEARCH_GROUP_LABELS[type], results });
  };

  push('CUSTOMER', rows.customers.map(c => ({
    type: 'CUSTOMER' as const, id: c.id, title: c.name,
    subtitle: [c.ruc, c.email].filter(Boolean).join(' · ') || 'Cliente',
    route: `/sales/customers/${c.id}`,
  })));

  push('SUPPLIER', rows.suppliers.map(s => ({
    type: 'SUPPLIER' as const, id: s.id, title: s.name,
    subtitle: [s.ruc, s.email].filter(Boolean).join(' · ') || 'Proveedor',
    route: `/purchases/suppliers/${s.id}`,
  })));

  push('PRODUCT', rows.products.map(p => ({
    type: 'PRODUCT' as const, id: p.id, title: p.name,
    subtitle: [p.sku && `SKU ${p.sku}`, p.barcode].filter(Boolean).join(' · ') || 'Producto',
    route: `/inventory/products/${p.id}`,
  })));

  push('PURCHASE_ORDER', rows.purchaseOrders.map(po => ({
    type: 'PURCHASE_ORDER' as const, id: po.id, title: po.poNumber,
    subtitle: `${po.supplierName} · ${statusEs(po.status)} · ${money(po.totalAmount)}`,
    route: `/purchases/${po.id}`,
  })));

  push('INVOICE', rows.invoices.map(inv => ({
    type: 'INVOICE' as const, id: inv.id, title: inv.number,
    subtitle: `${inv.type === 'SALES' ? 'Venta' : 'Compra'} · ${statusEs(inv.status)} · ${money(inv.totalAmount)}`,
    route: `/financial/invoices/${inv.id}`,
  })));

  push('SALES_ORDER', rows.salesOrders.map(so => ({
    type: 'SALES_ORDER' as const, id: so.id, title: so.orderNumber,
    subtitle: `${so.customerName} · ${statusEs(so.status)} · ${money(so.total)}`,
    route: `/sales/orders/${so.id}`,
  })));

  push('REQUISITION', rows.requisitions.map(r => ({
    type: 'REQUISITION' as const, id: r.id, title: `${r.reqNumber} — ${r.title}`,
    subtitle: statusEs(r.status),
    route: `/purchases/requisitions/${r.id}`,
  })));

  return { query, groups, total: groups.reduce((n, g) => n + g.results.length, 0) };
}

const PER_TYPE_LIMIT = 5;

/** Búsqueda federada multi-tenant: todas las consultas filtran por companyId. */
export async function globalSearch(companyId: string, query: string): Promise<SearchResponse> {
  const q = query.trim();
  if (q.length < 2) return { query: q, groups: [], total: 0 };

  const contains = { contains: q, mode: 'insensitive' as const };

  const [customers, suppliers, products, purchaseOrders, invoices, salesOrders, requisitions] =
    await Promise.all([
      prisma.customer.findMany({
        where: { companyId, isActive: true, OR: [{ name: contains }, { ruc: contains }, { email: contains }] },
        select: { id: true, name: true, ruc: true, email: true },
        take: PER_TYPE_LIMIT,
      }),
      prisma.supplier.findMany({
        where: { companyId, isActive: true, OR: [{ name: contains }, { ruc: contains }, { email: contains }] },
        select: { id: true, name: true, ruc: true, email: true },
        take: PER_TYPE_LIMIT,
      }),
      prisma.product.findMany({
        where: { companyId, isActive: true, OR: [{ name: contains }, { sku: contains }, { barcode: contains }] },
        select: { id: true, name: true, sku: true, barcode: true },
        take: PER_TYPE_LIMIT,
      }),
      prisma.purchaseOrder.findMany({
        where: { companyId, OR: [{ poNumber: contains }, { supplier: { name: contains } }] },
        select: { id: true, poNumber: true, status: true, totalAmount: true, supplier: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: PER_TYPE_LIMIT,
      }),
      prisma.invoice.findMany({
        where: { companyId, number: contains },
        select: { id: true, number: true, type: true, status: true, totalAmount: true },
        orderBy: { createdAt: 'desc' },
        take: PER_TYPE_LIMIT,
      }),
      prisma.salesOrder.findMany({
        where: { companyId, OR: [{ orderNumber: contains }, { customer: { name: contains } }] },
        select: { id: true, orderNumber: true, status: true, total: true, customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: PER_TYPE_LIMIT,
      }),
      prisma.requisition.findMany({
        where: { companyId, OR: [{ reqNumber: contains }, { title: contains }] },
        select: { id: true, reqNumber: true, title: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: PER_TYPE_LIMIT,
      }),
    ]);

  return buildSearchResponse(q, {
    customers,
    suppliers,
    products,
    purchaseOrders: purchaseOrders.map(po => ({
      id: po.id, poNumber: po.poNumber, status: po.status,
      totalAmount: po.totalAmount, supplierName: po.supplier.name,
    })),
    invoices,
    salesOrders: salesOrders.map(so => ({
      id: so.id, orderNumber: so.orderNumber, status: so.status,
      total: so.total, customerName: so.customer.name,
    })),
    requisitions,
  });
}
