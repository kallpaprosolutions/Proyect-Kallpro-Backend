import { buildNotaCreditoXml, NotaCreditoXmlInput } from '../src/services/finance/engines/nota-credito-xml.engine';

const CLAVE = '2'.repeat(49);

function baseInput(overrides: Partial<NotaCreditoXmlInput> = {}): NotaCreditoXmlInput {
  return {
    ambiente: 'PRUEBAS',
    claveAcceso: CLAVE,
    emisor: { ruc: '1790012345001', razonSocial: 'Comercial Prueba S.A.', dirMatriz: 'Quito', obligadoContabilidad: true },
    estab: '001', ptoEmi: '001', secuencial: '000000001',
    fechaEmision: new Date('2026-09-15T00:00:00Z'),
    comprador: { tipoIdentificacion: 'CEDULA', identificacion: '1712345678', razonSocial: 'Juan Pérez' },
    docModificado: { tipo: 'FACTURA', estab: '001', ptoEmi: '001', secuencial: '000000042', fechaEmision: new Date('2026-09-01T00:00:00Z') },
    motivo: 'Devolución de mercadería',
    items: [{ codigoPrincipal: 'PROD-001', descripcion: 'Tornillo M6', cantidad: 10, precioUnitario: 1, ivaCodigo: '15' }],
    ...overrides,
  };
}

describe('nota-credito-xml.engine — buildNotaCreditoXml', () => {
  it('genera un XML bien formado con codDoc 04 y el docModificado', () => {
    const xml = buildNotaCreditoXml(baseInput());
    expect(xml).toContain('<notaCredito id="comprobante" version="1.1.0">');
    expect(xml).toContain('<codDoc>04</codDoc>');
    expect(xml).toContain('<codDocModificado>01</codDocModificado>');
    expect(xml).toContain('<numDocModificado>001-001-000000042</numDocModificado>');
    expect(xml).toContain('<fechaEmisionDocSustento>01/09/2026</fechaEmisionDocSustento>');
    expect(xml).toContain('<motivo>Devolución de mercadería</motivo>');
  });

  it('calcula el valor de modificación con IVA (10 × $1 al 15% = $11.50)', () => {
    const xml = buildNotaCreditoXml(baseInput());
    expect(xml).toContain('<totalSinImpuestos>10.00</totalSinImpuestos>');
    expect(xml).toContain('<valorModificacion>11.50</valorModificacion>');
    expect(xml).toContain('<valor>1.50</valor>');
  });

  it('escapa el motivo (previene XML inválido/inyección)', () => {
    const xml = buildNotaCreditoXml(baseInput({ motivo: 'Cliente & <devolución> "urgente"' }));
    expect(xml).toContain('Cliente &amp; &lt;devolución&gt; &quot;urgente&quot;');
  });

  it('rechaza sin ítems o sin motivo', () => {
    expect(() => buildNotaCreditoXml(baseInput({ items: [] }))).toThrow(/ítem/);
    expect(() => buildNotaCreditoXml(baseInput({ motivo: '  ' }))).toThrow(/motivo/);
  });

  it('rechaza una claveAcceso inválida', () => {
    expect(() => buildNotaCreditoXml(baseInput({ claveAcceso: '123' }))).toThrow(/claveAcceso/);
  });

  it('agrupa varios ítems de la misma tarifa en un solo totalImpuesto', () => {
    const xml = buildNotaCreditoXml(baseInput({
      items: [
        { codigoPrincipal: 'A', descripcion: 'A', cantidad: 1, precioUnitario: 10, ivaCodigo: '15' },
        { codigoPrincipal: 'B', descripcion: 'B', cantidad: 1, precioUnitario: 20, ivaCodigo: '15' },
      ],
    }));
    expect((xml.match(/<totalImpuesto>/g) ?? [])).toHaveLength(1);
  });
});
