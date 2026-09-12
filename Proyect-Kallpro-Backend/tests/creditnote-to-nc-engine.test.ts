import { buildNotaCreditoInput } from '../src/services/finance/engines/creditnote-to-nc.engine';
import { buildNotaCreditoXml } from '../src/services/finance/engines/nota-credito-xml.engine';

const CLAVE = '3'.repeat(49);
const emisor = { ruc: '1790012345001', razonSocial: 'Comercial Prueba S.A.', dirMatriz: 'Quito', obligadoContabilidad: true };

describe('creditnote-to-nc.engine — buildNotaCreditoInput', () => {
  const args = {
    creditNote: { reason: 'Devolución por daño', lines: [{ sku: 'TOR-M6', description: 'Tornillo', quantity: 5, unitPrice: 2, discountPct: 0, taxRate: 15 }] },
    customer: { name: 'ACME S.A.', ruc: '1791234567001', documentType: 'RUC' as const },
    invoiceSustento: { estab: '001', ptoEmi: '001', sriSecuencial: '000000042', issueDate: new Date('2026-09-01T00:00:00Z') },
    emisor, ambiente: 'PRUEBAS' as const, claveAcceso: CLAVE, estab: '001', ptoEmi: '001', secuencial: '000000002',
  };

  it('arma el docModificado a partir de la factura sustento', () => {
    const input = buildNotaCreditoInput(args);
    expect(input.docModificado).toEqual({ tipo: 'FACTURA', estab: '001', ptoEmi: '001', secuencial: '000000042', fechaEmision: args.invoiceSustento.issueDate });
    expect(input.motivo).toBe('Devolución por daño');
    expect(input.comprador.identificacion).toBe('1791234567001');
  });

  it('el resultado produce un XML válido con el total correcto (5 × $2 al 15% = $11.50)', () => {
    const xml = buildNotaCreditoXml(buildNotaCreditoInput(args));
    expect(xml).toContain('<valorModificacion>11.50</valorModificacion>');
    expect(xml).toContain('<numDocModificado>001-001-000000042</numDocModificado>');
  });

  it('sin líneas bloquea con mensaje claro', () => {
    expect(() => buildNotaCreditoInput({ ...args, creditNote: { reason: 'x', lines: [] } })).toThrow(/no tiene líneas/);
  });
});
