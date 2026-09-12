// Tests del motor puro de búsqueda global (A1 — plan Odoo 18).
// buildSearchResponse no toca la BD: transforma filas crudas en grupos con rutas.
import { buildSearchResponse, RawSearchRows, SEARCH_GROUP_LABELS } from '../src/services/search.service';

const emptyRows: RawSearchRows = {
  customers: [], suppliers: [], products: [],
  purchaseOrders: [], invoices: [], salesOrders: [], requisitions: [],
};

describe('buildSearchResponse (búsqueda global federada)', () => {
  it('devuelve vacío cuando no hay coincidencias', () => {
    const res = buildSearchResponse('nada', emptyRows);
    expect(res.total).toBe(0);
    expect(res.groups).toHaveLength(0);
    expect(res.query).toBe('nada');
  });

  it('omite grupos sin resultados y cuenta el total', () => {
    const res = buildSearchResponse('acme', {
      ...emptyRows,
      customers: [{ id: 'c1', name: 'ACME Cía.', ruc: '0999999999001', email: null }],
      products: [
        { id: 'p1', name: 'Tornillo ACME', sku: 'TOR-01', barcode: null },
        { id: 'p2', name: 'Tuerca ACME', sku: null, barcode: '778001' },
      ],
    });
    expect(res.total).toBe(3);
    expect(res.groups.map(g => g.type)).toEqual(['CUSTOMER', 'PRODUCT']);
  });

  it('usa etiquetas en español por grupo (regla 7)', () => {
    const res = buildSearchResponse('x', {
      ...emptyRows,
      purchaseOrders: [{ id: 'po1', poNumber: 'OC-0001', status: 'APPROVED', totalAmount: 150, supplierName: 'Prov X' }],
      requisitions: [{ id: 'r1', reqNumber: 'REQ-0002', title: 'Papelería', status: 'PENDING_L1' }],
    });
    const labels = res.groups.map(g => g.label);
    expect(labels).toEqual(['Órdenes de compra', 'Requisiciones']);
    expect(SEARCH_GROUP_LABELS.INVOICE).toBe('Facturas');
  });

  it('traduce estados y formatea montos en los subtítulos (sin enums crudos)', () => {
    const res = buildSearchResponse('oc', {
      ...emptyRows,
      purchaseOrders: [{ id: 'po1', poNumber: 'OC-0007', status: 'APPROVED', totalAmount: 1234.5, supplierName: 'Ferretería Sur' }],
      invoices: [{ id: 'i1', number: 'FAC-V-0003', type: 'SALES', status: 'PAID', totalAmount: 99 }],
      salesOrders: [{ id: 's1', orderNumber: 'PV-0009', status: 'CONFIRMED', total: 10, customerName: 'Cliente Z' }],
    });
    const [po, inv, so] = res.groups;
    expect(po.results[0].subtitle).toBe('Ferretería Sur · Aprobada · $1234.50');
    expect(inv.results[0].subtitle).toBe('Venta · Pagada · $99.00');
    expect(so.results[0].subtitle).toBe('Cliente Z · Confirmado · $10.00');
  });

  it('genera las rutas de navegación del frontend por tipo', () => {
    const res = buildSearchResponse('q', {
      customers: [{ id: 'c1', name: 'A', ruc: null, email: null }],
      suppliers: [{ id: 's1', name: 'B', ruc: null, email: null }],
      products: [{ id: 'p1', name: 'C', sku: null, barcode: null }],
      purchaseOrders: [{ id: 'po1', poNumber: 'OC-1', status: 'DRAFT', totalAmount: 0, supplierName: 'B' }],
      invoices: [{ id: 'i1', number: 'F-1', type: 'PURCHASE', status: 'DRAFT', totalAmount: 0 }],
      salesOrders: [{ id: 'so1', orderNumber: 'PV-1', status: 'DRAFT', total: 0, customerName: 'A' }],
      requisitions: [{ id: 'r1', reqNumber: 'REQ-1', title: 'T', status: 'DRAFT' }],
    });
    const routes = res.groups.flatMap(g => g.results.map(r => r.route));
    expect(routes).toEqual([
      '/sales/customers/c1',
      '/purchases/suppliers/s1',
      '/inventory/products/p1',
      '/purchases/po1',
      '/financial/invoices/i1',
      '/sales/orders/so1',
      '/purchases/requisitions/r1',
    ]);
  });

  it('la factura de compra se etiqueta como Compra', () => {
    const res = buildSearchResponse('f', {
      ...emptyRows,
      invoices: [{ id: 'i1', number: 'FC-1', type: 'PURCHASE', status: 'PENDING', totalAmount: 55 }],
    });
    expect(res.groups[0].results[0].subtitle).toContain('Compra');
  });
});
