import forge from 'node-forge';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import * as fiscal from '../../src/services/finance/fiscal-config.service';
import { emitDeliveryGuide, checkDeliveryGuideAuthorization, getDeliveryGuideSriStatus, getDeliveryGuideSriXml } from '../../src/services/finance/electronic-deliveryguide.service';
import * as soap from '../../src/services/finance/sri-soap-client';

/**
 * Integración con BD real de la Etapa 4 (guía de remisión electrónica, resto), SOAP mockeado.
 * A diferencia de NC/ND, la guía NO exige un documento sustento autorizado — el traslado es
 * válido con o sin factura asociada; se cubre el caso CON factura (más rico) y el caso SIN.
 */
jest.mock('../../src/services/finance/sri-soap-client', () => ({
  ...jest.requireActual('../../src/services/finance/sri-soap-client'),
  sendRecepcion: jest.fn(),
  sendAutorizacion: jest.fn(),
}));
const sendRecepcion = soap.sendRecepcion as jest.Mock;
const sendAutorizacion = soap.sendAutorizacion as jest.Mock;

const recibida = () => `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion"><RespuestaRecepcionComprobante><estado>RECIBIDA</estado><comprobantes/></RespuestaRecepcionComprobante></ns2:validarComprobanteResponse></soap:Body></soap:Envelope>`;
const autorizado = (clave: string) => `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><claveAccesoConsultada>${clave}</claveAccesoConsultada><numeroComprobantes>1</numeroComprobantes><autorizaciones><autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>${clave}</numeroAutorizacion><fechaAutorizacion>2026-09-11T10:00:00-05:00</fechaAutorizacion><ambiente>PRUEBAS</ambiente><comprobante><![CDATA[<guiaRemision id="comprobante"/>]]></comprobante><mensajes/></autorizacion></autorizaciones></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse></soap:Body></soap:Envelope>`;

const TAG = `eigd_${Date.now()}`;
let dbAvailable = false;
let companyId = '';
let establishmentId = '';
let emissionPointId = '';
let customerId = '';
let productId = '';

function buildTestP12(password: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2030-01-01T00:00:00Z');
  cert.setSubject([{ name: 'commonName', value: 'TEST' }]);
  cert.setIssuer([{ name: 'commonName', value: 'TEST' }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password)).getBytes(), 'binary');
}

async function createShipmentWithGuide(): Promise<string> {
  const tag = Math.random().toString(36).slice(2, 6);
  const order = await prisma.salesOrder.create({
    data: {
      companyId, orderNumber: `PV-${TAG}-${tag}`, customerId, status: 'INVOICED',
      subtotal: new Prisma.Decimal(100), taxAmount: new Prisma.Decimal(15), total: new Prisma.Decimal(115),
      items: { create: [{ productId, quantity: new Prisma.Decimal(10), unitPrice: new Prisma.Decimal(10), subtotal: new Prisma.Decimal(100), taxRate: new Prisma.Decimal(15), taxAmount: new Prisma.Decimal(15), total: new Prisma.Decimal(115), invoicedQty: new Prisma.Decimal(10) }] },
    },
    include: { items: true },
  });
  const shipment = await prisma.shipment.create({
    data: {
      companyId, orderType: 'SALES', orderId: order.id, trackingNumber: `KP-${TAG}-${tag}`,
      items: { create: [{ salesOrderItemId: order.items[0].id, productId, quantity: new Prisma.Decimal(10) }] },
    },
  });
  const guide = await prisma.deliveryGuide.create({
    data: {
      companyId, number: `GR-${TAG}-${tag}`, shipmentId: shipment.id,
      motivoTraslado: 'Venta', dirPartida: 'Bodega matriz, Quito',
      fechaIniTransporte: new Date('2026-09-15T00:00:00Z'), fechaFinTransporte: new Date('2026-09-15T00:00:00Z'),
      transportistaRazonSocial: 'Transportes Rápidos S.A.', transportistaTipoIdentificacion: 'RUC',
      transportistaIdentificacion: '1790099999001', placa: 'PBX-1234',
      items: { create: [{ description: 'Tornillo M6', quantity: new Prisma.Decimal(10) }] },
    },
  });
  return guide.id;
}

async function cleanup() {
  await prisma.sriTransmission.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.deliveryGuideItem.deleteMany({ where: { deliveryGuide: { companyId } } }).catch(() => {});
  await prisma.deliveryGuide.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.documentMessage.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.shipmentItem.deleteMany({ where: { shipment: { companyId } } }).catch(() => {});
  await prisma.shipment.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.invoiceItem.deleteMany({ where: { invoice: { companyId } } }).catch(() => {});
  await prisma.invoice.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.salesOrderItem.deleteMany({ where: { order: { companyId } } }).catch(() => {});
  await prisma.salesOrder.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.product.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.customer.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.digitalCertificate.deleteMany({ where: { fiscalConfig: { companyId } } }).catch(() => {});
  await prisma.emissionPoint.deleteMany({ where: { establishment: { fiscalConfig: { companyId } } } }).catch(() => {});
  await prisma.establishment.deleteMany({ where: { fiscalConfig: { companyId } } }).catch(() => {});
  await prisma.documentSequence.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.companyFiscalConfig.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => {});
}

beforeAll(async () => {
  try { await prisma.$queryRaw`SELECT 1`; dbAvailable = true; } catch { dbAvailable = false; return; }
  process.env.CERT_ENCRYPTION_KEY ||= 'clave-de-test-no-usar-en-produccion';
  const company = await prisma.company.create({ data: { name: `Empresa ${TAG}`, email: `${TAG}@kallpapro.test` } });
  companyId = company.id;
  await fiscal.upsertFiscalConfig(companyId, { ruc: '1790012345001', razonSocial: 'Comercial Prueba S.A.', obligadoContabilidad: true, regimen: 'GENERAL' });
  const est = await fiscal.createEstablishment(companyId, { code: '001', name: 'Matriz', address: 'Quito', isMatriz: true });
  establishmentId = est.id;
  emissionPointId = (await fiscal.createEmissionPoint(companyId, establishmentId, { code: '001' })).id;
  await fiscal.uploadCertificate(companyId, { alias: 'Test', fileBuffer: buildTestP12('clave123'), password: 'clave123' });

  const customer = await prisma.customer.create({ data: { companyId, name: 'ACME S.A.', ruc: '1791234567001', documentType: 'RUC', address: 'Av. 10 de Agosto' } });
  customerId = customer.id;
  const product = await prisma.product.create({ data: { companyId, name: 'Tornillo M6', sku: 'TOR-M6', salePrice: new Prisma.Decimal(10) } });
  productId = product.id;
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

beforeEach(() => { sendRecepcion.mockReset(); sendAutorizacion.mockReset(); });

describe('electronic-deliveryguide.service — e2e con BD real y SRI mockeado', () => {
  it('flujo feliz sin factura: guía firmada → RECIBIDA → AUTORIZADA sin docSustento', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const guideId = await createShipmentWithGuide();

    sendRecepcion.mockResolvedValue(recibida());
    sendAutorizacion.mockImplementation(async (_a: string, env: string) => autorizado(env.match(/\d{49}/)![0]));

    const r = await emitDeliveryGuide(companyId, guideId, { establishmentId, emissionPointId });
    expect(r.sriEstado).toBe('AUTORIZADA');
    expect(r.claveAcceso).toHaveLength(49);
    expect(r.claveAcceso.slice(8, 10)).toBe('06'); // codDoc de guía de remisión

    const envelope: string = sendRecepcion.mock.calls[0][1];
    const xmlSent = Buffer.from(envelope.match(/<xml>([^<]+)<\/xml>/)![1], 'base64').toString('utf8');
    expect(xmlSent).toContain('<ds:Signature');
    expect(xmlSent).toContain('<placa>PBX-1234</placa>');
    expect(xmlSent).not.toContain('<codDocSustento>');

    const status = await getDeliveryGuideSriStatus(companyId, guideId);
    expect(status.sriEstado).toBe('AUTORIZADA');

    const { xml } = await getDeliveryGuideSriXml(companyId, guideId);
    expect(xml).toContain('<guiaRemision');
  }, 20_000);

  it('incluye el documento sustento cuando existe una factura AUTORIZADA para el envío', async () => {
    if (!dbAvailable) return;
    const guideId = await createShipmentWithGuide();
    const guide = await prisma.deliveryGuide.findUnique({ where: { id: guideId } });
    const invoice = await prisma.invoice.create({
      data: {
        companyId, number: `FAC-V-${TAG}-inv`, type: 'SALES', status: 'SENT',
        totalAmount: new Prisma.Decimal(115), issueDate: new Date(), shipmentId: guide!.shipmentId,
        sriEstado: 'AUTORIZADA', sriAmbiente: 'PRUEBAS', establishmentId, emissionPointId,
        sriSecuencial: '000000099', claveAcceso: '9'.repeat(49), numeroAutorizacion: '555444333',
      },
    });

    sendRecepcion.mockResolvedValue(recibida());
    sendAutorizacion.mockImplementation(async (_a: string, env: string) => autorizado(env.match(/\d{49}/)![0]));
    await emitDeliveryGuide(companyId, guideId, { establishmentId, emissionPointId });

    const envelope: string = sendRecepcion.mock.calls[0][1];
    const xmlSent = Buffer.from(envelope.match(/<xml>([^<]+)<\/xml>/)![1], 'base64').toString('utf8');
    expect(xmlSent).toContain('<codDocSustento>01</codDocSustento>');
    expect(xmlSent).toContain(`<numAutDocSustento>${invoice.numeroAutorizacion}</numAutDocSustento>`);
  }, 20_000);

  it('una guía AUTORIZADA no se puede re-emitir', async () => {
    if (!dbAvailable) return;
    const guideId = await createShipmentWithGuide();
    sendRecepcion.mockResolvedValue(recibida());
    sendAutorizacion.mockImplementation(async (_a: string, env: string) => autorizado(env.match(/\d{49}/)![0]));
    await emitDeliveryGuide(companyId, guideId, { establishmentId, emissionPointId });
    await expect(emitDeliveryGuide(companyId, guideId, { establishmentId, emissionPointId })).rejects.toThrow(/AUTORIZADA/);
  }, 20_000);

  it('checkDeliveryGuideAuthorization consulta sin re-enviar', async () => {
    if (!dbAvailable) return;
    const guideId = await createShipmentWithGuide();
    sendRecepcion.mockResolvedValueOnce(recibida());
    sendAutorizacion.mockResolvedValue(`<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><numeroComprobantes>0</numeroComprobantes><autorizaciones/></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse></soap:Body></soap:Envelope>`);
    const r1 = await emitDeliveryGuide(companyId, guideId, { establishmentId, emissionPointId });
    expect(r1.sriEstado).toBe('RECIBIDA');
    expect(sendRecepcion).toHaveBeenCalledTimes(1);

    sendAutorizacion.mockImplementation(async (_a: string, env: string) => autorizado(env.match(/\d{49}/)![0]));
    const r2 = await checkDeliveryGuideAuthorization(companyId, guideId);
    expect(r2.sriEstado).toBe('AUTORIZADA');
    expect(sendRecepcion).toHaveBeenCalledTimes(1);
  }, 20_000);
});
