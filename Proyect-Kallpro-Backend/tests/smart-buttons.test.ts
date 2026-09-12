// Tests del motor puro de smart buttons (A4 — plan Odoo 18).
// buildSmartButtons agrega documentos vinculados sin tocar la BD.
import { buildSmartButtons } from '../src/services/smart-buttons.service';

describe('buildSmartButtons (contadores de documentos vinculados)', () => {
  it('OC: arma asientos, docs SRI y envíos con etiquetas en español', () => {
    const buttons = buildSmartButtons('PURCHASE_ORDER', 'po1', {
      journalEntries: [
        { id: 'j1', entryNumber: 'AST-0001', description: 'Anticipo OC-0001', totalDebit: 100, status: 'POSTED' },
        { id: 'j2', entryNumber: 'AST-0002', description: 'Recepción OC-0001', totalDebit: 400, status: 'POSTED' },
      ],
      sriDocuments: [{ id: 'd1', numeroDoc: '001-001-000000123', razonSocialEmisor: 'Ferretería Sur', total: 500 }],
      shipments: [],
    });
    expect(buttons.map(b => [b.key, b.label, b.count])).toEqual([
      ['JOURNAL', 'Asientos', 2],
      ['SHIPMENTS', 'Envíos', 0],
      ['SRI_DOCS', 'Docs. SRI', 1],
    ]);
    expect(buttons[0].items[0].subtitle).toBe('Anticipo OC-0001 · $100.00 · Contabilizado');
    expect(buttons.find(b => b.key === 'SRI_DOCS')!.items[0].route).toBe('/sri/d1');
  });

  it('OC: el botón de asientos navega al diario filtrado por entityType+entityId', () => {
    const buttons = buildSmartButtons('PURCHASE_ORDER', 'po9', { journalEntries: [] });
    expect(buttons[0].route).toBe('/financial/journal-entries?entityType=PURCHASE_ORDER&entityId=po9');
  });

  it('pedido de venta: facturas y envíos con rutas de detalle', () => {
    const buttons = buildSmartButtons('SALES_ORDER', 'so1', {
      journalEntries: [],
      invoices: [{ id: 'i1', number: 'FAC-V-0001', status: 'PAID', totalAmount: 250 }],
      shipments: [{ id: 'sh1', trackingNumber: 'KP-ABC123', status: 'DELIVERED', carrier: 'SERVIENTREGA' }],
    });
    const inv = buttons.find(b => b.key === 'INVOICES')!;
    const shp = buttons.find(b => b.key === 'SHIPMENTS')!;
    expect(inv.items[0]).toMatchObject({ route: '/financial/invoices/i1', subtitle: 'Pagada · $250.00' });
    expect(shp.items[0]).toMatchObject({ route: '/logistica/sh1', subtitle: 'Entregado · SERVIENTREGA' });
  });

  it('factura: pagos y retenciones son informativos (route null) y NC muestra motivo', () => {
    const buttons = buildSmartButtons('INVOICE', 'inv1', {
      journalEntries: [{ id: 'j1', entryNumber: 'AST-0010', description: 'Factura venta', totalDebit: 115, status: 'POSTED' }],
      payments: [{ id: 'pa1', paymentNumber: 'PAG-0001', amountApplied: 115, appliedAt: '2026-07-01T12:00:00Z' }],
      withholdings: [{ id: 'w1', tipo: 'RENTA', codigo: '312', porcentaje: 1.75, valor: 1.75 }],
      creditNotes: [{ id: 'cn1', number: 'NC-0001', reason: 'Devolución', total: 20 }],
    });
    const pagos = buttons.find(b => b.key === 'PAYMENTS')!;
    const ret = buttons.find(b => b.key === 'WITHHOLDINGS')!;
    const nc = buttons.find(b => b.key === 'CREDIT_NOTES')!;
    expect(pagos.items[0].route).toBeNull();
    expect(pagos.items[0].subtitle).toContain('$115.00 aplicado');
    expect(ret.items[0].title).toBe('Renta 312');
    expect(nc.items[0].subtitle).toBe('Devolución · -$20.00');
  });

  it('factura: el botón de asientos filtra solo por entityId (INVOICE y SALES_INVOICE comparten id)', () => {
    const buttons = buildSmartButtons('INVOICE', 'inv7', { journalEntries: [] });
    expect(buttons[0].route).toBe('/financial/journal-entries?entityId=inv7');
  });

  it('solo incluye botones cuyas filas fueron consultadas', () => {
    const buttons = buildSmartButtons('SALES_ORDER', 'so1', { invoices: [] });
    expect(buttons.map(b => b.key)).toEqual(['INVOICES']);
  });
});
