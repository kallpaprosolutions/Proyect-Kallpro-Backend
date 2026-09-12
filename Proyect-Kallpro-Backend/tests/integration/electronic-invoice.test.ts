import forge from 'node-forge';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import * as fiscal from '../../src/services/finance/fiscal-config.service';
import { emitInvoice, checkAuthorization, getSriStatus } from '../../src/services/finance/electronic-invoice.service';
import * as soap from '../../src/services/finance/sri-soap-client';

/**
 * Integración con BD real de la Etapa 3, con el transporte SOAP mockeado (el SRI real se
 * ejercita a mano en el navegador). Cubre la máquina de estados completa: ENVIADA → RECIBIDA →
 * AUTORIZADA, DEVUELTA re-emitible con secuencial nuevo, "clave ya registrada" (43) que salta a
 * autorización, y que una AUTORIZADA es inmutable.
 */
jest.mock('../../src/services/finance/sri-soap-client', () => ({
  ...jest.requireActual('../../src/services/finance/sri-soap-client'),
  sendRecepcion: jest.fn(),
  sendAutorizacion: jest.fn(),
}));
const sendRecepcion = soap.sendRecepcion as jest.Mock;
const sendAutorizacion = soap.sendAutorizacion as jest.Mock;

const recibida = () => `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion"><RespuestaRecepcionComprobante><estado>RECIBIDA</estado><comprobantes/></RespuestaRecepcionComprobante></ns2:validarComprobanteResponse></soap:Body></soap:Envelope>`;
const devuelta = (id: string, msg: string) => `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion"><RespuestaRecepcionComprobante><estado>DEVUELTA</estado><comprobantes><comprobante><claveAcceso>x</claveAcceso><mensajes><mensaje><identificador>${id}</identificador><mensaje>${msg}</mensaje><tipo>ERROR</tipo></mensaje></mensajes></comprobante></comprobantes></RespuestaRecepcionComprobante></ns2:validarComprobanteResponse></soap:Body></soap:Envelope>`;
const autorizado = (clave: string) => `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><claveAccesoConsultada>${clave}</claveAccesoConsultada><numeroComprobantes>1</numeroComprobantes><autorizaciones><autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>${clave}</numeroAutorizacion><fechaAutorizacion>2026-09-11T10:00:00-05:00</fechaAutorizacion><ambiente>PRUEBAS</ambiente><comprobante><![CDATA[<factura id="comprobante"/>]]></comprobante><mensajes/></autorizacion></autorizaciones></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse></soap:Body></soap:Envelope>`;
const enProceso = (clave: string) => `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><claveAccesoConsultada>${clave}</claveAccesoConsultada><numeroComprobantes>0</numeroComprobantes><autorizaciones/></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse></soap:Body></soap:Envelope>`;

const TAG = `einv_${Date.now()}`;
let dbAvailable = false;
let companyId = '';
let establishmentId = '';
let emissionPointId = '';
let salesOrderId = '';

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

async function createInvoice(): Promise<string> {
  const inv = await prisma.invoice.create({
    data: {
      companyId, number: `FAC-V-${TAG}-${Math.random().toString(36).slice(2, 6)}`, type: 'SALES', status: 'SENT',
      totalAmount: new Prisma.Decimal(115), issueDate: new Date(), salesOrderId,
      items: { create: [{ description: 'Tornillo M6', quantity: 100, unitPrice: new Prisma.Decimal(1), lineTotal: new Prisma.Decimal(115) }] },
    },
  });
  return inv.id;
}

async function cleanup() {
  await prisma.sriTransmission.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.documentMessage.deleteMany({ where: { companyId } }).catch(() => {});
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
  await prisma.user.deleteMany({ where: { companyId } }).catch(() => {});
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
  const product = await prisma.product.create({ data: { companyId, name: 'Tornillo M6', sku: 'TOR-M6', salePrice: new Prisma.Decimal(1) } });
  const order = await prisma.salesOrder.create({
    data: {
      companyId, orderNumber: `PV-${TAG}`, customerId: customer.id, status: 'INVOICED',
      subtotal: new Prisma.Decimal(100), taxAmount: new Prisma.Decimal(15), total: new Prisma.Decimal(115),
      items: { create: [{ productId: product.id, quantity: new Prisma.Decimal(100), unitPrice: new Prisma.Decimal(1), subtotal: new Prisma.Decimal(100), taxRate: new Prisma.Decimal(15), taxAmount: new Prisma.Decimal(15), total: new Prisma.Decimal(115), invoicedQty: new Prisma.Decimal(100) }] },
    },
  });
  salesOrderId = order.id;
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

beforeEach(() => { sendRecepcion.mockReset(); sendAutorizacion.mockReset(); });

describe('electronic-invoice.service — e2e con BD real y SRI mockeado', () => {
  it('flujo feliz: firma → RECIBIDA → AUTORIZADA, con clave, autorización y bitácora de transmisiones', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const invoiceId = await createInvoice();
    sendRecepcion.mockResolvedValue(recibida());
    sendAutorizacion.mockImplementation(async (_amb: string, env: string) => autorizado(env.match(/\d{49}/)![0]));

    const r = await emitInvoice(companyId, invoiceId, { establishmentId, emissionPointId });
    expect(r.sriEstado).toBe('AUTORIZADA');
    expect(r.claveAcceso).toHaveLength(49);
    expect(r.numeroAutorizacion).toBe(r.claveAcceso);

    // Lo enviado al SRI es el XML firmado en base64 dentro del sobre
    const envelope: string = sendRecepcion.mock.calls[0][1];
    const xmlSent = Buffer.from(envelope.match(/<xml>([^<]+)<\/xml>/)![1], 'base64').toString('utf8');
    expect(xmlSent).toContain('<ds:Signature');
    expect(xmlSent).toContain('<importeTotal>115.00</importeTotal>');
    expect(xmlSent).toContain('<identificacionComprador>1791234567001</identificacionComprador>');

    const status = await getSriStatus(companyId, invoiceId);
    expect(status.sriEstado).toBe('AUTORIZADA');
    expect(status.sriSecuencial).toBe('000000001');
    expect(status.transmissions.map((t) => `${t.operacion}:${t.resultado}`)).toEqual(['AUTORIZACION:AUTORIZADO', 'RECEPCION:RECIBIDA']);
    const db = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(db?.xmlFirmado).toContain('<ds:Signature');
    expect(db?.xmlAutorizado).toContain('<factura');
  });

  it('una factura AUTORIZADA no se puede re-emitir (regla 5)', async () => {
    if (!dbAvailable) return;
    const invoiceId = await createInvoice();
    sendRecepcion.mockResolvedValue(recibida());
    sendAutorizacion.mockImplementation(async (_a: string, env: string) => autorizado(env.match(/\d{49}/)![0]));
    await emitInvoice(companyId, invoiceId, { establishmentId, emissionPointId });
    await expect(emitInvoice(companyId, invoiceId, { establishmentId, emissionPointId })).rejects.toThrow(/AUTORIZADA/);
  });

  it('DEVUELTA guarda los mensajes del SRI y permite re-emitir con un secuencial NUEVO', async () => {
    if (!dbAvailable) return;
    const invoiceId = await createInvoice();
    sendRecepcion.mockResolvedValueOnce(devuelta('39', 'FIRMA INVALIDA'));
    const r1 = await emitInvoice(companyId, invoiceId, { establishmentId, emissionPointId });
    expect(r1.sriEstado).toBe('DEVUELTA');
    expect(r1.mensajes[0].mensaje).toBe('FIRMA INVALIDA');
    expect(sendAutorizacion).not.toHaveBeenCalled();
    const first = await prisma.invoice.findUnique({ where: { id: invoiceId } });

    sendRecepcion.mockResolvedValueOnce(recibida());
    sendAutorizacion.mockImplementation(async (_a: string, env: string) => autorizado(env.match(/\d{49}/)![0]));
    const r2 = await emitInvoice(companyId, invoiceId, { establishmentId, emissionPointId });
    expect(r2.sriEstado).toBe('AUTORIZADA');
    const second = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(second?.sriSecuencial).not.toBe(first?.sriSecuencial);
    expect(second?.claveAcceso).not.toBe(first?.claveAcceso);
  });

  it('código 43 (clave ya registrada) no es error: salta directo a consultar autorización', async () => {
    if (!dbAvailable) return;
    const invoiceId = await createInvoice();
    sendRecepcion.mockResolvedValueOnce(devuelta('43', 'CLAVE ACCESO REGISTRADA'));
    sendAutorizacion.mockImplementation(async (_a: string, env: string) => autorizado(env.match(/\d{49}/)![0]));
    const r = await emitInvoice(companyId, invoiceId, { establishmentId, emissionPointId });
    expect(r.sriEstado).toBe('AUTORIZADA');
  });

  it('si el SRI aún no responde la autorización queda RECIBIDA y checkAuthorization la completa después', async () => {
    if (!dbAvailable) return;
    const invoiceId = await createInvoice();
    sendRecepcion.mockResolvedValueOnce(recibida());
    sendAutorizacion.mockImplementation(async (_a: string, env: string) => enProceso(env.match(/\d{49}/)![0]));
    const r1 = await emitInvoice(companyId, invoiceId, { establishmentId, emissionPointId });
    expect(r1.sriEstado).toBe('RECIBIDA');

    sendAutorizacion.mockImplementation(async (_a: string, env: string) => autorizado(env.match(/\d{49}/)![0]));
    const r2 = await checkAuthorization(companyId, invoiceId);
    expect(r2.sriEstado).toBe('AUTORIZADA');
  }, 20_000);

  it('sin punto de emisión válido no consume secuencial ni contacta al SRI', async () => {
    if (!dbAvailable) return;
    const invoiceId = await createInvoice();
    await expect(emitInvoice(companyId, invoiceId, { establishmentId, emissionPointId: 'no-existe' })).rejects.toThrow(/Punto de emisión/);
    expect(sendRecepcion).not.toHaveBeenCalled();
  });
});
