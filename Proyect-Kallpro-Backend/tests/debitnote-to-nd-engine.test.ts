import { buildNotaDebitoInput } from '../src/services/finance/engines/debitnote-to-nd.engine';
import { buildNotaDebitoXml } from '../src/services/finance/engines/nota-debito-xml.engine';

const CLAVE = '6'.repeat(49);
const emisor = { ruc: '1790012345001', razonSocial: 'Comercial Prueba S.A.', dirMatriz: 'Quito', obligadoContabilidad: true };

describe('debitnote-to-nd.engine — buildNotaDebitoInput', () => {
  const args = {
    debitNote: { taxRate: 15, concepts: [{ description: 'Interés por mora', amount: 20 }] },
    customer: { name: 'ACME S.A.', ruc: '1791234567001', documentType: 'RUC' as const },
    invoiceSustento: { estab: '001', ptoEmi: '001', sriSecuencial: '000000042', issueDate: new Date('2026-09-01T00:00:00Z') },
    emisor, ambiente: 'PRUEBAS' as const, claveAcceso: CLAVE, estab: '001', ptoEmi: '001', secuencial: '000000002',
  };

  it('arma el docModificado a partir de la factura sustento', () => {
    const input = buildNotaDebitoInput(args);
    expect(input.docModificado).toEqual({ tipo: 'FACTURA', estab: '001', ptoEmi: '001', secuencial: '000000042', fechaEmision: args.invoiceSustento.issueDate });
    expect(input.motivos).toEqual([{ razon: 'Interés por mora', valor: 20 }]);
    expect(input.comprador.identificacion).toBe('1791234567001');
    expect(input.ivaCodigo).toBe('15');
  });

  it('el resultado produce un XML válido con el total correcto ($20 al 15% = $23.00)', () => {
    const xml = buildNotaDebitoXml(buildNotaDebitoInput(args));
    expect(xml).toContain('<valorTotal>23.00</valorTotal>');
    expect(xml).toContain('<numDocModificado>001-001-000000042</numDocModificado>');
  });

  it('sin conceptos bloquea con mensaje claro', () => {
    expect(() => buildNotaDebitoInput({ ...args, debitNote: { taxRate: 15, concepts: [] } })).toThrow(/no tiene conceptos/);
  });

  it('una tarifa de IVA desconocida bloquea la emisión', () => {
    expect(() => buildNotaDebitoInput({ ...args, debitNote: { taxRate: 21, concepts: [{ description: 'x', amount: 1 }] } })).toThrow(/no está en el catálogo/);
  });
});
