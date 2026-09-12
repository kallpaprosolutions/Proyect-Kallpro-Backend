import forge from 'node-forge';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import * as fiscal from '../../src/services/finance/fiscal-config.service';
import { emitInvoice } from '../../src/services/finance/electronic-invoice.service';
import { emitCreditNote, checkCreditNoteAuthorization, getCreditNoteSriStatus, getCreditNoteSriXml } from '../../src/services/finance/electronic-creditnote.service';
import * as soap from '../../src/services/finance/sri-soap-client';

/**
 * Integración con BD real de la Etapa 4 (NC electrónica), SOAP mockeado. Cubre el requisito
 * propio de la NC: la factura sustento debe estar AUTORIZADA antes de poder emitir la NC.
 */
jest.mock('../../src/services/finance/sri-soap-client', () => ({
  ...jest.requireActual('../../src/services/finance/sri-soap-client'),
  sendRecepcion: jest.fn(),
  sendAutorizacion: jest.fn(),
}));
const sendRecepcion = soap.sendRecepcion as jest.Mock;
const sendAutorizacion = soap.sendAutorizacion as jest.Mock;

const recibida = () => `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion"><RespuestaRecepcionComprobante><estado>RECIBIDA</estado><comprobantes/></RespuestaRecepcionComprobante></ns2:validarComprobanteResponse></soap:Body></soap:Envelope>`;
const autorizado = (clave: string) => `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><claveAccesoConsultada>${clave}</claveAccesoConsultada><numeroComprobantes>1</numeroComprobantes><autorizaciones><autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>${clave}</numeroAutorizacion><fechaAutorizacion>2026-09-11T10:00:00-05:00</fechaAutorizacion><ambiente>PRUEBAS</ambiente><comprobante><![CDATA[<factura id="comprobante"/>]]></comprobante><mensajes/></autorizacion></autorizaciones></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse></soap:Body></soap:Envelope>`;

const TAG = `einc_${Date.now()}`;
let dbAvailable = false;
let companyId = '';
let establishmentId = '';
let emissionPointId = '';
let salesOrderItemId = '';
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

async function createAuthorizedInvoice(): Promise<string> {
  const inv = await prisma.invoice.create({
    data: {
      companyId, number: `FAC-V-${TAG}-${Math.random().toString(36).slice(2, 6)}`, type: 'SALES', status: 'SENT',
      totalAmount: new Prisma.Decimal(115), issueDate: new Date(), salesOrderId,
      items: { create: [{ description: 'Tornillo M6', quantity: 100, unitPrice: new Prisma.Decimal(1), lineTotal: new Prisma.Decimal(115) }] },
    },
  });
  sendRecepcion.mockResolvedValueOnce(recibida());
  sendAutorizacion.mockImplementationOnce(async (_a: string, env: string) => autorizado(env.match(/\d{49}/)![0]));
  const r = await emitInvoice(companyId, inv.id, { establishmentId, emissionPointId });
  expect(r.sriEstado).toBe('AUTORIZADA');
  return inv.id;
}

async function createCreditNote(invoiceId: string): Promise<string> {
  const cn = await prisma.creditNote.create({
    data: {
      companyId, number: `NC-${TAG}-${Math.random().toString(36).slice(2, 6)}`, invoiceId, reason: 'Devolución parcial',
      subtotal: new Prisma.Decimal(50), taxAmount: new Prisma.Decimal(7.5), total: new Prisma.Decimal(57.5),
      items: { create: [{ salesOrderItemId, productId: (await prisma.salesOrderItem.findUnique({ where: { id: salesOrderItemId } }))!.productId, description: 'Tornillo M6', quantity: new Prisma.Decimal(50), unitPrice: new Prisma.Decimal(1), taxRate: new Prisma.Decimal(15) }] },
    },
  });
  return cn.id;
}

async function cleanup() {
  await prisma.sriTransmission.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.creditNoteItem.deleteMany({ where: { creditNote: { companyId } } }).catch(() => {});
  await prisma.creditNote.deleteMany({ where: { companyId } }).catch(() => {});
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
    include: { items: true },
  });
  salesOrderId = order.id;
  salesOrderItemId = order.items[0].id;
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

beforeEach(() => { sendRecepcion.mockReset(); sendAutorizacion.mockReset(); });

describe('electronic-creditnote.service — e2e con BD real y SRI mockeado', () => {
  it('bloquea la emisión si la factura sustento no está AUTORIZADA', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const invoice = await prisma.invoice.create({
      data: { companyId, number: `FAC-V-${TAG}-noauth`, type: 'SALES', status: 'SENT', totalAmount: new Prisma.Decimal(57.5), issueDate: new Date(), salesOrderId },
    });
    const creditNoteId = await createCreditNote(invoice.id);
    await expect(emitCreditNote(companyId, creditNoteId, { establishmentId, emissionPointId })).rejects.toThrow(/AUTORIZADA por el SRI — emítela primero/);
    expect(sendRecepcion).not.toHaveBeenCalled();
  });

  it('flujo feliz: factura autorizada → NC firmada → RECIBIDA → AUTORIZADA con el docModificado correcto', async () => {
    if (!dbAvailable) return;
    const invoiceId = await createAuthorizedInvoice();
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    const creditNoteId = await createCreditNote(invoiceId);

    sendRecepcion.mockReset().mockResolvedValue(recibida()); // limpia la llamada de emitir la factura sustento
    sendAutorizacion.mockReset().mockImplementation(async (_a: string, env: string) => autorizado(env.match(/\d{49}/)![0]));

    const r = await emitCreditNote(companyId, creditNoteId, { establishmentId, emissionPointId });
    expect(r.sriEstado).toBe('AUTORIZADA');
    expect(r.claveAcceso).toHaveLength(49);
    expect(r.claveAcceso.slice(8, 10)).toBe('04'); // codDoc de nota de crédito en la clave de acceso

    const envelope: string = sendRecepcion.mock.calls[0][1];
    const xmlSent = Buffer.from(envelope.match(/<xml>([^<]+)<\/xml>/)![1], 'base64').toString('utf8');
    expect(xmlSent).toContain('<ds:Signature');
    expect(xmlSent).toContain(`<numDocModificado>001-001-${invoice!.sriSecuencial}</numDocModificado>`);
    expect(xmlSent).toContain('<motivo>Devolución parcial</motivo>');
    expect(xmlSent).toContain('<valorModificacion>57.50</valorModificacion>');

    const status = await getCreditNoteSriStatus(companyId, creditNoteId);
    expect(status.sriEstado).toBe('AUTORIZADA');
    expect(status.transmissions.map((t) => `${t.operacion}:${t.resultado}`)).toEqual(['AUTORIZACION:AUTORIZADO', 'RECEPCION:RECIBIDA']);

    const { xml } = await getCreditNoteSriXml(companyId, creditNoteId);
    expect(xml).toContain('<factura'); // xmlAutorizado tal como lo devolvió el SRI (fixture)
  }, 20_000);

  it('una NC AUTORIZADA no se puede re-emitir', async () => {
    if (!dbAvailable) return;
    const invoiceId = await createAuthorizedInvoice();
    const creditNoteId = await createCreditNote(invoiceId);
    sendRecepcion.mockReset().mockResolvedValue(recibida());
    sendAutorizacion.mockReset().mockImplementation(async (_a: string, env: string) => autorizado(env.match(/\d{49}/)![0]));
    await emitCreditNote(companyId, creditNoteId, { establishmentId, emissionPointId });
    await expect(emitCreditNote(companyId, creditNoteId, { establishmentId, emissionPointId })).rejects.toThrow(/AUTORIZADA/);
  }, 20_000);

  it('checkCreditNoteAuthorization consulta sin re-enviar', async () => {
    if (!dbAvailable) return;
    const invoiceId = await createAuthorizedInvoice();
    const creditNoteId = await createCreditNote(invoiceId);
    sendRecepcion.mockReset(); // limpia la llamada de emitir la factura sustento, antes de contar
    sendRecepcion.mockResolvedValueOnce(recibida());
    // SIN_RESPUESTA no corta el reintento (hasta AUTH_POLL_ATTEMPTS=3 intentos dentro de la
    // misma llamada) — se mockea para TODOS los intentos de esta llamada, no solo el primero.
    sendAutorizacion.mockResolvedValue(`<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><numeroComprobantes>0</numeroComprobantes><autorizaciones/></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse></soap:Body></soap:Envelope>`);
    const r1 = await emitCreditNote(companyId, creditNoteId, { establishmentId, emissionPointId });
    expect(r1.sriEstado).toBe('RECIBIDA');
    expect(sendRecepcion).toHaveBeenCalledTimes(1);

    sendAutorizacion.mockImplementation(async (_a: string, env: string) => autorizado(env.match(/\d{49}/)![0]));
    const r2 = await checkCreditNoteAuthorization(companyId, creditNoteId);
    expect(r2.sriEstado).toBe('AUTORIZADA');
    expect(sendRecepcion).toHaveBeenCalledTimes(1); // check no vuelve a enviar recepción
  }, 20_000);
});
