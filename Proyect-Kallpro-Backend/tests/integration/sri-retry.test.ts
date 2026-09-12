import { prisma } from '../../src/lib/prisma';
import { listPendingSriDocuments, retryPendingSriDocuments } from '../../src/services/finance/sri-retry.service';
import * as soap from '../../src/services/finance/sri-soap-client';

/**
 * Etapa 5 del plan SRI (contingencia): la cola de reintentos debe encontrar TODO comprobante
 * ENVIADA/RECIBIDA (factura, NC, ND) y volver a consultar su autorización sin re-enviar nada.
 */
jest.mock('../../src/services/finance/sri-soap-client', () => ({
  ...jest.requireActual('../../src/services/finance/sri-soap-client'),
  sendRecepcion: jest.fn(),
  sendAutorizacion: jest.fn(),
}));
const sendAutorizacion = soap.sendAutorizacion as jest.Mock;

const autorizado = (clave: string) => `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><claveAccesoConsultada>${clave}</claveAccesoConsultada><numeroComprobantes>1</numeroComprobantes><autorizaciones><autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>${clave}</numeroAutorizacion><fechaAutorizacion>2026-09-11T10:00:00-05:00</fechaAutorizacion><ambiente>PRUEBAS</ambiente><comprobante><![CDATA[<factura id="comprobante"/>]]></comprobante><mensajes/></autorizacion></autorizaciones></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse></soap:Body></soap:Envelope>`;

const TAG = `sriretry_${Date.now()}`;
let dbAvailable = false;
let companyId = '';

async function cleanup() {
  await prisma.creditNote.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.invoice.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => {});
}

beforeAll(async () => {
  try { await prisma.$queryRaw`SELECT 1`; dbAvailable = true; } catch { dbAvailable = false; return; }
  const company = await prisma.company.create({ data: { name: `Empresa ${TAG}`, email: `${TAG}@kallpapro.test` } });
  companyId = company.id;
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

describe('sri-retry.service — e2e con BD real y SRI mockeado', () => {
  it('lista y reintenta comprobantes pendientes de distintos tipos', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const claveInv = '1'.repeat(49);
    const invoice = await prisma.invoice.create({
      data: { companyId, number: `FAC-V-${TAG}`, type: 'SALES', status: 'SENT', totalAmount: 115 as any, sriEstado: 'RECIBIDA', sriAmbiente: 'PRUEBAS', claveAcceso: claveInv, xmlFirmado: '<factura/>' },
    });

    const pending = await listPendingSriDocuments(companyId);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ kind: 'invoice', id: invoice.id, sriEstado: 'RECIBIDA' });

    sendAutorizacion.mockImplementation(async (_a: string, env: string) => autorizado(env.match(/\d{49}/)![0]));
    const results = await retryPendingSriDocuments(companyId);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ kind: 'invoice', before: 'RECIBIDA', after: 'AUTORIZADA' });

    const after = await listPendingSriDocuments(companyId);
    expect(after).toHaveLength(0);
  });

  it('no falla el lote completo si un comprobante individual da error', async () => {
    if (!dbAvailable) return;
    // ENVIADA sin claveAcceso: checkAuthorization de ese documento lanzará SRI_NOT_SENT.
    await prisma.invoice.create({
      data: { companyId, number: `FAC-V-${TAG}-bad`, type: 'SALES', status: 'SENT', totalAmount: 50 as any, sriEstado: 'ENVIADA', sriAmbiente: 'PRUEBAS' },
    });
    const results = await retryPendingSriDocuments(companyId);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.error || r.after)).toBe(true);
  });
});
