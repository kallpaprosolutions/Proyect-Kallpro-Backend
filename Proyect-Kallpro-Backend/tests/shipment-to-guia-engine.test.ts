import { buildGuiaRemisionInput } from '../src/services/finance/engines/shipment-to-guia.engine';
import { buildGuiaRemisionXml } from '../src/services/finance/engines/guia-remision-xml.engine';

const CLAVE = '8'.repeat(49);
const emisor = { ruc: '1790012345001', razonSocial: 'Comercial Prueba S.A.', dirMatriz: 'Quito', obligadoContabilidad: true };

describe('shipment-to-guia.engine — buildGuiaRemisionInput', () => {
  const args = {
    shipment: {
      motivoTraslado: 'Venta', dirPartida: 'Bodega matriz, Quito',
      fechaIniTransporte: new Date('2026-09-15T00:00:00Z'), fechaFinTransporte: new Date('2026-09-15T00:00:00Z'),
      transportista: { razonSocial: 'Transportes Rápidos S.A.', tipoIdentificacion: 'RUC' as const, identificacion: '1790099999001', placa: 'PBX-1234' },
      items: [{ sku: 'TOR-M6', description: 'Tornillo', quantity: 50 }],
    },
    customer: { name: 'ACME S.A.', ruc: '1791234567001', documentType: 'RUC' as const },
    emisor, ambiente: 'PRUEBAS' as const, claveAcceso: CLAVE, estab: '001', ptoEmi: '001', secuencial: '000000002',
  };

  it('arma el destinatario a partir del cliente, sin documento sustento por defecto', () => {
    const input = buildGuiaRemisionInput(args);
    expect(input.destinatario.identificacion).toBe('1791234567001');
    expect(input.destinatario.docSustento).toBeUndefined();
    expect(input.transportista.placa).toBe('PBX-1234');
  });

  it('el resultado produce un XML válido con la cantidad correcta', () => {
    const xml = buildGuiaRemisionXml(buildGuiaRemisionInput(args));
    expect(xml).toContain('<cantidad>50.000000</cantidad>');
    expect(xml).toContain('<codigoInterno>TOR-M6</codigoInterno>');
  });

  it('incluye el documento sustento cuando se pasa la factura ya autorizada', () => {
    const input = buildGuiaRemisionInput({
      ...args,
      invoiceSustento: { estab: '001', ptoEmi: '001', sriSecuencial: '000000042', numeroAutorizacion: '999888777', issueDate: new Date('2026-09-01T00:00:00Z') },
    });
    expect(input.destinatario.docSustento).toEqual({ estab: '001', ptoEmi: '001', secuencial: '000000042', numeroAutorizacion: '999888777', fechaEmision: new Date('2026-09-01T00:00:00Z') });
  });

  it('sin ítems bloquea con mensaje claro', () => {
    expect(() => buildGuiaRemisionInput({ ...args, shipment: { ...args.shipment, items: [] } })).toThrow(/no tiene ítems/);
  });
});
