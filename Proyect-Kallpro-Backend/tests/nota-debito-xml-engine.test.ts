import { buildNotaDebitoXml, NotaDebitoXmlInput } from '../src/services/finance/engines/nota-debito-xml.engine';

const CLAVE = '5'.repeat(49);

function baseInput(overrides: Partial<NotaDebitoXmlInput> = {}): NotaDebitoXmlInput {
  return {
    ambiente: 'PRUEBAS',
    claveAcceso: CLAVE,
    emisor: { ruc: '1790012345001', razonSocial: 'Comercial Prueba S.A.', dirMatriz: 'Quito', obligadoContabilidad: true },
    estab: '001', ptoEmi: '001', secuencial: '000000001',
    fechaEmision: new Date('2026-09-15T00:00:00Z'),
    comprador: { tipoIdentificacion: 'CEDULA', identificacion: '1712345678', razonSocial: 'Juan Pérez' },
    docModificado: { tipo: 'FACTURA', estab: '001', ptoEmi: '001', secuencial: '000000042', fechaEmision: new Date('2026-09-01T00:00:00Z') },
    ivaCodigo: '15',
    motivos: [{ razon: 'Interés por mora', valor: 10 }],
    ...overrides,
  };
}

describe('nota-debito-xml.engine — buildNotaDebitoXml', () => {
  it('genera un XML bien formado con codDoc 05 y el docModificado', () => {
    const xml = buildNotaDebitoXml(baseInput());
    expect(xml).toContain('<notaDebito id="comprobante" version="1.0.0">');
    expect(xml).toContain('<codDoc>05</codDoc>');
    expect(xml).toContain('<codDocModificado>01</codDocModificado>');
    expect(xml).toContain('<numDocModificado>001-001-000000042</numDocModificado>');
    expect(xml).toContain('<fechaEmisionDocSustento>01/09/2026</fechaEmisionDocSustento>');
    expect(xml).toContain('<razon>Interés por mora</razon>');
  });

  it('calcula el valor total con IVA sobre la suma de motivos ($10 al 15% = $11.50)', () => {
    const xml = buildNotaDebitoXml(baseInput());
    expect(xml).toContain('<totalSinImpuestos>10.00</totalSinImpuestos>');
    expect(xml).toContain('<valorTotal>11.50</valorTotal>');
    expect(xml).toContain('<valor>1.50</valor>');
  });

  it('suma varios motivos en un solo totalSinImpuestos', () => {
    const xml = buildNotaDebitoXml(baseInput({ motivos: [{ razon: 'Gasto A', valor: 5 }, { razon: 'Gasto B', valor: 5 }] }));
    expect(xml).toContain('<totalSinImpuestos>10.00</totalSinImpuestos>');
    expect((xml.match(/<motivo>/g) ?? [])).toHaveLength(2);
  });

  it('escapa la razón (previene XML inválido/inyección)', () => {
    const xml = buildNotaDebitoXml(baseInput({ motivos: [{ razon: 'Cliente & <mora> "urgente"', valor: 5 }] }));
    expect(xml).toContain('Cliente &amp; &lt;mora&gt; &quot;urgente&quot;');
  });

  it('rechaza sin motivos, con razón vacía o valor no positivo', () => {
    expect(() => buildNotaDebitoXml(baseInput({ motivos: [] }))).toThrow(/al menos un motivo/);
    expect(() => buildNotaDebitoXml(baseInput({ motivos: [{ razon: '  ', valor: 5 }] }))).toThrow(/razón/);
    expect(() => buildNotaDebitoXml(baseInput({ motivos: [{ razon: 'x', valor: 0 }] }))).toThrow(/mayor a cero/);
  });

  it('rechaza una claveAcceso inválida', () => {
    expect(() => buildNotaDebitoXml(baseInput({ claveAcceso: '123' }))).toThrow(/claveAcceso/);
  });

  it('no tiene bloque de detalles (a diferencia de factura/NC)', () => {
    const xml = buildNotaDebitoXml(baseInput());
    expect(xml).not.toContain('<detalles>');
  });
});
