import {
  buildFacturaInput, resolveComprador, taxRateToIvaCodigo, CONSUMIDOR_FINAL_ID, InvoiceForSri,
} from '../src/services/finance/engines/invoice-to-factura.engine';
import { buildFacturaXml } from '../src/services/finance/engines/factura-xml.engine';

const CLAVE = '1'.repeat(49);
const emisor = { ruc: '1790012345001', razonSocial: 'Comercial Prueba S.A.', dirMatriz: 'Quito', obligadoContabilidad: true };

function invoice(overrides: Partial<InvoiceForSri> = {}): InvoiceForSri {
  return {
    number: 'FAC-V-0007',
    issueDate: new Date('2026-09-11T00:00:00Z'),
    totalAmount: 115,
    customer: { name: 'ACME S.A.', ruc: '1791234567001', documentType: 'RUC', address: 'Av. 10 de Agosto', email: 'pagos@acme.ec' },
    lines: [{ sku: 'TOR-M6', description: 'Tornillo M6', quantity: 100, unitPrice: 1, discountPct: 0, taxRate: 15 }],
    ...overrides,
  };
}

describe('invoice-to-factura.engine — taxRateToIvaCodigo', () => {
  it('traduce las tarifas del catálogo', () => {
    expect(taxRateToIvaCodigo(15)).toBe('15');
    expect(taxRateToIvaCodigo(12)).toBe('12');
    expect(taxRateToIvaCodigo(8)).toBe('8');
    expect(taxRateToIvaCodigo(0)).toBe('0');
  });
  it('bloquea una tarifa fuera del catálogo del SRI', () => {
    expect(() => taxRateToIvaCodigo(14)).toThrow(/14%/);
  });
});

describe('invoice-to-factura.engine — resolveComprador', () => {
  it('RUC declarado', () => {
    expect(resolveComprador({ name: 'ACME', ruc: '1791234567001', documentType: 'RUC' }, 100))
      .toMatchObject({ tipoIdentificacion: 'RUC', identificacion: '1791234567001' });
  });
  it('infiere cédula por longitud si el tipo no está declarado', () => {
    expect(resolveComprador({ name: 'Juan', ruc: '1712345678' }, 100).tipoIdentificacion).toBe('CEDULA');
  });
  it('usa razonSocial sobre name cuando existe', () => {
    expect(resolveComprador({ name: 'ACME', razonSocial: 'ACME SOCIEDAD ANONIMA', ruc: '1791234567001' }, 100).razonSocial).toBe('ACME SOCIEDAD ANONIMA');
  });
  it('sin identificación → CONSUMIDOR FINAL hasta $50', () => {
    expect(resolveComprador({ name: 'Mostrador' }, 50)).toEqual({
      tipoIdentificacion: 'CONSUMIDOR_FINAL', identificacion: CONSUMIDOR_FINAL_ID, razonSocial: 'CONSUMIDOR FINAL',
    });
  });
  it('sin identificación y sobre $50 → bloquea con mensaje claro', () => {
    expect(() => resolveComprador({ name: 'Mostrador' }, 50.01)).toThrow(/tope de \$50/);
  });
  it('RUC con longitud incorrecta → bloquea', () => {
    expect(() => resolveComprador({ name: 'X', ruc: '123', documentType: 'RUC' }, 10)).toThrow(/13 dígitos/);
  });
});

describe('invoice-to-factura.engine — buildFacturaInput', () => {
  const args = { emisor, ambiente: 'PRUEBAS' as const, claveAcceso: CLAVE, estab: '001', ptoEmi: '001', secuencial: '000000007' };

  it('mapea líneas (SKU como código principal, descuento en valor) y campos adicionales', () => {
    const input = buildFacturaInput({ ...args, invoice: invoice({ lines: [{ sku: 'TOR-M6', description: 'Tornillo', quantity: 10, unitPrice: 10, discountPct: 10, taxRate: 15 }] }) });
    expect(input.items[0]).toMatchObject({ codigoPrincipal: 'TOR-M6', cantidad: 10, precioUnitario: 10, descuento: 10, ivaCodigo: '15' });
    expect(input.infoAdicional).toMatchObject({ 'Factura interna': 'FAC-V-0007', Email: 'pagos@acme.ec' });
    expect(input.comprador.identificacion).toBe('1791234567001');
  });

  it('sin SKU genera un código de línea estable', () => {
    const input = buildFacturaInput({ ...args, invoice: invoice({ lines: [{ description: 'Servicio', quantity: 1, unitPrice: 100, discountPct: 0, taxRate: 15 }] }) });
    expect(input.items[0].codigoPrincipal).toBe('ITEM-001');
  });

  it('el input resultante produce un XML válido con el total correcto (100 × $1 + 15% = $115)', () => {
    const xml = buildFacturaXml(buildFacturaInput({ ...args, invoice: invoice() }));
    expect(xml).toContain('<importeTotal>115.00</importeTotal>');
    expect(xml).toContain('<secuencial>000000007</secuencial>');
    expect(xml).toContain('<campoAdicional nombre="Factura interna">FAC-V-0007</campoAdicional>');
  });

  it('factura sin líneas → bloquea', () => {
    expect(() => buildFacturaInput({ ...args, invoice: invoice({ lines: [] }) })).toThrow(/no tiene líneas/);
  });
});
