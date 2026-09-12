import { buildFacturaXml, IVA_SRI_CODE, FacturaXmlInput } from '../src/services/finance/engines/factura-xml.engine';

const CLAVE_VALIDA = '1'.repeat(49);

function baseInput(overrides: Partial<FacturaXmlInput> = {}): FacturaXmlInput {
  return {
    ambiente: 'PRUEBAS',
    claveAcceso: CLAVE_VALIDA,
    emisor: {
      ruc: '1790012345001',
      razonSocial: 'Comercial Prueba S.A.',
      dirMatriz: 'Av. Amazonas N34-451, Quito',
      obligadoContabilidad: true,
    },
    estab: '001',
    ptoEmi: '001',
    secuencial: '000000001',
    fechaEmision: new Date('2026-09-15T00:00:00Z'),
    comprador: {
      tipoIdentificacion: 'CEDULA',
      identificacion: '1712345678',
      razonSocial: 'Juan Pérez',
    },
    items: [
      { codigoPrincipal: 'PROD-001', descripcion: 'Tornillo M6', cantidad: 10, precioUnitario: 1, ivaCodigo: '15' },
    ],
    ...overrides,
  };
}

describe('factura-xml.engine — buildFacturaXml', () => {
  it('genera un XML bien formado con la clave de acceso y los datos del emisor', () => {
    const xml = buildFacturaXml(baseInput());
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<factura id="comprobante" version="1.1.0">');
    expect(xml).toContain(`<claveAcceso>${CLAVE_VALIDA}</claveAcceso>`);
    expect(xml).toContain('<ruc>1790012345001</ruc>');
    expect(xml).toContain('<ambiente>1</ambiente>'); // PRUEBAS
  });

  it('calcula el IVA correctamente (10 × $1 al 15% = $1.50)', () => {
    const xml = buildFacturaXml(baseInput());
    expect(xml).toContain('<totalSinImpuestos>10.00</totalSinImpuestos>');
    expect(xml).toContain('<valor>1.50</valor>');
    expect(xml).toContain('<importeTotal>11.50</importeTotal>');
    expect(xml).toContain(`<codigoPorcentaje>${IVA_SRI_CODE['15'].codigoPorcentaje}</codigoPorcentaje>`);
  });

  it('resta el descuento antes de calcular la base imponible del IVA', () => {
    const xml = buildFacturaXml(baseInput({
      items: [{ codigoPrincipal: 'X', descripcion: 'Item', cantidad: 10, precioUnitario: 10, descuento: 20, ivaCodigo: '12' }],
    }));
    // 10*10=100, -20 descuento = 80 base; 80*12% = 9.60
    expect(xml).toContain('<totalSinImpuestos>80.00</totalSinImpuestos>');
    expect(xml).toContain('<totalDescuento>20.00</totalDescuento>');
    expect(xml).toContain('<valor>9.60</valor>');
  });

  it('agrupa varios ítems con la misma tarifa en un solo totalImpuesto (no uno por línea)', () => {
    const xml = buildFacturaXml(baseInput({
      items: [
        { codigoPrincipal: 'A', descripcion: 'A', cantidad: 1, precioUnitario: 10, ivaCodigo: '15' },
        { codigoPrincipal: 'B', descripcion: 'B', cantidad: 1, precioUnitario: 20, ivaCodigo: '15' },
      ],
    }));
    const matches = xml.match(/<totalImpuesto>/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(xml).toContain('<baseImponible>30.00</baseImponible>');
  });

  it('separa ítems con tarifas distintas en totalImpuesto distintos', () => {
    const xml = buildFacturaXml(baseInput({
      items: [
        { codigoPrincipal: 'A', descripcion: 'A', cantidad: 1, precioUnitario: 10, ivaCodigo: '15' },
        { codigoPrincipal: 'B', descripcion: 'B', cantidad: 1, precioUnitario: 20, ivaCodigo: '0' },
      ],
    }));
    const matches = xml.match(/<totalImpuesto>/g) ?? [];
    expect(matches).toHaveLength(2);
  });

  it('escapa caracteres especiales en la descripción y razón social (previene XML inválido/inyección)', () => {
    const xml = buildFacturaXml(baseInput({
      comprador: { tipoIdentificacion: 'CEDULA', identificacion: '1712345678', razonSocial: 'O\'Brien & <Cía>' },
      items: [{ codigoPrincipal: 'X', descripcion: 'Tuerca "6mm" & arandela', cantidad: 1, precioUnitario: 1, ivaCodigo: '0' }],
    }));
    expect(xml).toContain('O&apos;Brien &amp; &lt;Cía&gt;');
    expect(xml).toContain('Tuerca &quot;6mm&quot; &amp; arandela');
    expect(xml).not.toContain('<Cía>');
  });

  it('incluye campos opcionales solo si vienen en el input (nombreComercial, contribuyenteEspecial)', () => {
    const withOptional = buildFacturaXml(baseInput({
      emisor: { ...baseInput().emisor, nombreComercial: 'Mi Tienda', contribuyenteEspecial: '5368' },
    }));
    expect(withOptional).toContain('<nombreComercial>Mi Tienda</nombreComercial>');
    expect(withOptional).toContain('<contribuyenteEspecial>5368</contribuyenteEspecial>');

    const withoutOptional = buildFacturaXml(baseInput());
    expect(withoutOptional).not.toContain('nombreComercial');
    expect(withoutOptional).not.toContain('contribuyenteEspecial');
  });

  it('rechaza una claveAcceso que no tenga 49 dígitos', () => {
    expect(() => buildFacturaXml(baseInput({ claveAcceso: '123' }))).toThrow(/claveAcceso/);
  });

  it('rechaza una factura sin ítems', () => {
    expect(() => buildFacturaXml(baseInput({ items: [] }))).toThrow(/ítem/);
  });

  it('usa forma de pago 20 (otros con sistema financiero) por defecto', () => {
    const xml = buildFacturaXml(baseInput());
    expect(xml).toContain('<formaPago>20</formaPago>');
  });

  it('respeta la forma de pago explícita', () => {
    const xml = buildFacturaXml(baseInput({ formaPago: '01' }));
    expect(xml).toContain('<formaPago>01</formaPago>');
  });
});
