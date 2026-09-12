/**
 * Mapa centralizado de rutas → labels para Breadcrumbs.
 * Soporta rutas estáticas y dinámicas (ej. ':id' se reemplaza por su valor real
 * cuando el segmento no aparece en este mapa, se usa el valor literal).
 */

export const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard',

  // CRM
  '/crm': 'CRM',
  '/crm/inbox': 'Bandeja',
  '/crm/pipeline': 'Pipeline',
  '/crm/agents': 'Agentes IA',
  '/crm/forecast': 'Pronóstico',
  '/crm/contacts': 'Contactos',
  '/crm/deals': 'Oportunidades',
  '/crm/leads': 'Leads',
  '/crm/config': 'Configuración del CRM',

  // Finanzas
  '/financial': 'Finanzas',
  '/financial/executive': 'Panel Ejecutivo',
  '/financial/analytics': 'Analytics',
  '/financial/journal-entries': 'Asientos',
  '/financial/invoices': 'Facturas',
  '/financial/invoices/new': 'Nueva Factura',
  '/sri': 'Documentos SRI',
  '/sri/recurrentes': 'Facturación Recurrente',
  '/contabilidad': 'Contabilidad',
  '/contabilidad/activos-fijos': 'Activos Fijos',

  // Compras
  '/purchases': 'Compras',
  '/purchases/new': 'Nueva OC',
  '/purchases/analytics': 'Analytics',
  '/purchases/requisitions': 'Requisiciones',
  '/purchases/requisitions/new': 'Nueva Requisición',
  '/purchases/suppliers': 'Proveedores',
  '/purchases/suppliers/new': 'Nuevo Proveedor',
  '/purchases/suppliers/ranking': 'Ranking',
  '/approvals': 'Aprobaciones',

  // Inventario
  '/inventory': 'Inventario',
  '/inventory/products': 'Productos',
  '/inventory/products/new': 'Nuevo Producto',
  '/inventory/warehouses': 'Almacenes',
  '/inventory/categories': 'Categorías',
  '/inventory/transfers': 'Transferencias',
  '/inventory/analytics': 'Analytics',
  '/inventory/physical-count': 'Conteo Físico',
  '/inventory/quick-entry': 'Entrada Rápida',
  '/inventory/adjustments': 'Ajustes',
  '/inventory/replenishment': 'Reposición',
  '/inventario': 'Inventario',
  '/inventario/valorizacion': 'Valorización',

  // Producción
  '/production': 'Producción',
  '/production/orders/new': 'Nueva Orden',

  // Ventas
  '/sales': 'Ventas',
  '/sales/customers': 'Clientes',
  '/sales/customers/new': 'Nuevo Cliente',
  '/sales/quotations': 'Cotizaciones',
  '/sales/quotations/new': 'Nueva Cotización',
  '/sales/orders': 'Pedidos',
  '/sales/price-lists': 'Listas de Precios',
  '/ventas': 'Ventas',
  '/ventas/rapida': 'Venta Rápida',
  '/budget': 'Presupuesto',
  '/gerencial': 'Gerencial',

  // Compras (alias en español) y Logística
  '/compras': 'Compras',
  '/compras/ordenes': 'Órdenes',
  '/logistica': 'Logística',
  '/finanzas': 'Finanzas',

  // Nómina
  '/nomina': 'Nómina',
  '/nomina/empleados': 'Empleados',
  '/nomina/organigrama': 'Organigrama',
  '/nomina/asistencia': 'Asistencia',
  '/nomina/calendario': 'Calendario',

  // Tesorería
  '/tesoreria': 'Tesorería',

  // Sistema
  '/reports': 'Reportes',
  '/research': 'Investigación',
  '/admin': 'Admin',
  '/admin/users': 'Usuarios',
  '/settings': 'Configuración',
  '/settings/empresa': 'Empresa',
  '/settings/security': 'Seguridad',
};

/**
 * Construye breadcrumbs jerárquicos a partir del pathname.
 * Ej: '/purchases/suppliers/abc-123' →
 *  [{ to:'/purchases', label:'Compras' }, { to:'/purchases/suppliers', label:'Proveedores' },
 *   { to:'/purchases/suppliers/abc-123', label:'abc-123' }]
 */
export function buildBreadcrumbs(pathname: string): { to: string; label: string }[] {
  if (pathname === '/' || pathname === '') return [];
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { to: string; label: string }[] = [];
  let accumulated = '';
  for (const seg of segments) {
    accumulated += '/' + seg;
    const label = ROUTE_LABELS[accumulated] ?? prettifySegment(seg);
    crumbs.push({ to: accumulated, label });
  }
  return crumbs;
}

function prettifySegment(seg: string): string {
  // IDs/UUIDs → truncar
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(seg)) return seg.slice(0, 8) + '…';
  if (/^c[a-z0-9]{20,}$/i.test(seg)) return seg.slice(0, 8) + '…';      // cuid
  if (/^\d+$/.test(seg)) return `#${seg}`;
  // kebab-case → Title Case
  return seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
