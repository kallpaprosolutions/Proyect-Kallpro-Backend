import { parseXml } from '../src/services/sri-parser.service';

/**
 * Documento sustento (modificado) en notas de crédito/débito de proveedores (2026-07-04).
 * El SRI incluye codDocModificado/numDocModificado/fechaEmisionDocSustento dentro de
 * infoNotaCredito/infoNotaDebito — el parser debe extraerlos sin inventar nada cuando faltan.
 */

const NC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<notaCredito id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>2</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>PROVEEDOR DE PRUEBA S.A.</razonSocial>
    <ruc>1790012345001</ruc>
    <claveAcceso>0407202404179001234500120010020000001231234567811</claveAcceso>
    <codDoc>04</codDoc>
    <estab>001</estab>
    <ptoEmi>002</ptoEmi>
    <secuencial>000000123</secuencial>
    <dirMatriz>Av. Principal 123</dirMatriz>
  </infoTributaria>
  <infoNotaCredito>
    <fechaEmision>04/07/2024</fechaEmision>
    <dirEstablecimiento>Av. Principal 123</dirEstablecimiento>
    <tipoIdentificacionComprador>04</tipoIdentificacionComprador>
    <razonSocialComprador>MI EMPRESA S.A.</razonSocialComprador>
    <identificacionComprador>0999999999001</identificacionComprador>
    <obligadoContabilidad>SI</obligadoContabilidad>
    <codDocModificado>01</codDocModificado>
    <numDocModificado>001-002-000001437</numDocModificado>
    <fechaEmisionDocSustento>13/11/2024</fechaEmisionDocSustento>
    <totalSinImpuestos>100.00</totalSinImpuestos>
    <valorModificacion>115.00</valorModificacion>
    <totalConImpuestos>
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>4</codigoPorcentaje>
        <baseImponible>100.00</baseImponible>
        <valor>15.00</valor>
      </totalImpuesto>
    </totalConImpuestos>
    <motivo>No recibieron la mercadería</motivo>
  </infoNotaCredito>
  <detalles>
    <detalle>
      <codigoPrincipal>PROD-1</codigoPrincipal>
      <descripcion>Mercadería devuelta</descripcion>
      <cantidad>1</cantidad>
      <precioUnitario>100.00</precioUnitario>
      <descuento>0.00</descuento>
      <precioTotalSinImpuesto>100.00</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>4</codigoPorcentaje>
          <tarifa>15</tarifa>
          <baseImponible>100.00</baseImponible>
          <valor>15.00</valor>
        </impuesto>
      </impuestos>
    </detalle>
  </detalles>
</notaCredito>`;

describe('sri-parser.parseXml — documento sustento de NC de proveedor', () => {
  it('extrae codDocModificado/numDocModificado/fechaEmisionDocSustento del XML', async () => {
    const parsed = await parseXml(Buffer.from(NC_XML, 'utf-8'));
    expect(parsed.tipoDocumento).toBe('NOTA_CREDITO');
    expect(parsed.docModificadoTipo).toBe('FACTURA');
    expect(parsed.docModificadoNumero).toBe('001-002-000001437');
    expect(parsed.docModificadoFecha).toBeInstanceOf(Date);
    expect(parsed.docModificadoFecha?.getFullYear()).toBe(2024);
    expect(parsed.docModificadoFecha?.getMonth()).toBe(10); // noviembre, 0-indexado
    expect(parsed.docModificadoFecha?.getDate()).toBe(13);
  });

  it('no inventa el documento sustento si el XML no lo trae (factura normal)', async () => {
    const facturaXml = NC_XML
      .replace('<notaCredito', '<factura')
      .replace('</notaCredito>', '</factura>')
      .replace('<infoNotaCredito>', '<infoFactura>')
      .replace('</infoNotaCredito>', '</infoFactura>')
      .replace('<codDocModificado>01</codDocModificado>', '')
      .replace('<numDocModificado>001-002-000001437</numDocModificado>', '')
      .replace('<fechaEmisionDocSustento>13/11/2024</fechaEmisionDocSustento>', '')
      .replace('<codDoc>04</codDoc>', '<codDoc>01</codDoc>');
    const parsed = await parseXml(Buffer.from(facturaXml, 'utf-8'));
    expect(parsed.docModificadoTipo).toBeUndefined();
    expect(parsed.docModificadoNumero).toBeUndefined();
    expect(parsed.docModificadoFecha).toBeUndefined();
  });
});
