import { buildGuiaRemisionXml, GuiaRemisionXmlInput } from '../src/services/finance/engines/guia-remision-xml.engine';

const CLAVE = '7'.repeat(49);

function baseInput(overrides: Partial<GuiaRemisionXmlInput> = {}): GuiaRemisionXmlInput {
  return {
    ambiente: 'PRUEBAS',
    claveAcceso: CLAVE,
    emisor: { ruc: '1790012345001', razonSocial: 'Comercial Prueba S.A.', dirMatriz: 'Quito', obligadoContabilidad: true },
    estab: '001', ptoEmi: '001', secuencial: '000000001',
    dirPartida: 'Av. Amazonas y Naciones Unidas, Quito',
    transportista: { razonSocial: 'Transportes Rápidos S.A.', tipoIdentificacion: 'RUC', identificacion: '1790099999001', placa: 'PBX-1234' },
    fechaIniTransporte: new Date('2026-09-15T00:00:00Z'),
    fechaFinTransporte: new Date('2026-09-15T00:00:00Z'),
    destinatario: { tipoIdentificacion: 'CEDULA', identificacion: '1712345678', razonSocial: 'Juan Pérez', motivoTraslado: 'Venta' },
    items: [{ codigoInterno: 'PROD-001', descripcion: 'Tornillo M6', cantidad: 10 }],
    ...overrides,
  };
}

describe('guia-remision-xml.engine — buildGuiaRemisionXml', () => {
  it('genera un XML bien formado con codDoc 06, sin valores monetarios', () => {
    const xml = buildGuiaRemisionXml(baseInput());
    expect(xml).toContain('<guiaRemision id="comprobante" version="1.0.0">');
    expect(xml).toContain('<codDoc>06</codDoc>');
    expect(xml).toContain('<placa>PBX-1234</placa>');
    expect(xml).toContain('<motivoTraslado>Venta</motivoTraslado>');
    expect(xml).toContain('<cantidad>10.000000</cantidad>');
    expect(xml).not.toMatch(/<valor>|<precioUnitario>|<totalSinImpuestos>/);
  });

  it('incluye el documento sustento (factura) cuando existe', () => {
    const xml = buildGuiaRemisionXml(baseInput({
      destinatario: {
        tipoIdentificacion: 'CEDULA', identificacion: '1712345678', razonSocial: 'Juan Pérez', motivoTraslado: 'Venta',
        docSustento: { estab: '001', ptoEmi: '001', secuencial: '000000042', numeroAutorizacion: '123456789', fechaEmision: new Date('2026-09-01T00:00:00Z') },
      },
    }));
    expect(xml).toContain('<codDocSustento>01</codDocSustento>');
    expect(xml).toContain('<numDocSustento>001-001-000000042</numDocSustento>');
    expect(xml).toContain('<numAutDocSustento>123456789</numAutDocSustento>');
  });

  it('omite el documento sustento cuando no existe (traslado sin factura)', () => {
    const xml = buildGuiaRemisionXml(baseInput());
    expect(xml).not.toContain('<codDocSustento>');
  });

  it('rechaza sin ítems, sin motivo, sin placa o con fechas invertidas', () => {
    expect(() => buildGuiaRemisionXml(baseInput({ items: [] }))).toThrow(/al menos un ítem/);
    expect(() => buildGuiaRemisionXml(baseInput({ destinatario: { tipoIdentificacion: 'CEDULA', identificacion: '1712345678', razonSocial: 'Juan', motivoTraslado: '  ' } }))).toThrow(/motivo de traslado/);
    expect(() => buildGuiaRemisionXml(baseInput({ transportista: { razonSocial: 'X', tipoIdentificacion: 'RUC', identificacion: '1790099999001', placa: '' } }))).toThrow(/placa/);
    expect(() => buildGuiaRemisionXml(baseInput({ fechaIniTransporte: new Date('2026-09-16T00:00:00Z'), fechaFinTransporte: new Date('2026-09-15T00:00:00Z') }))).toThrow(/no puede ser anterior/);
  });

  it('rechaza una claveAcceso inválida', () => {
    expect(() => buildGuiaRemisionXml(baseInput({ claveAcceso: '123' }))).toThrow(/claveAcceso/);
  });

  it('escapa la razón social del transportista (previene XML inválido/inyección)', () => {
    const xml = buildGuiaRemisionXml(baseInput({ transportista: { razonSocial: 'Transportes & <Rápidos> "S.A."', tipoIdentificacion: 'RUC', identificacion: '1790099999001', placa: 'PBX-1234' } }));
    expect(xml).toContain('Transportes &amp; &lt;Rápidos&gt; &quot;S.A.&quot;');
  });
});
