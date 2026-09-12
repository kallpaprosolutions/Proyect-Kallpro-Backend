import forge from 'node-forge';
import { prisma } from '../../src/lib/prisma';
import * as fiscal from '../../src/services/finance/fiscal-config.service';
import { previewSignedTestFactura } from '../../src/services/finance/sri-preview.service';

/**
 * Integración con BD real: Etapa 2 (motor de XML + firma) enchufada al flujo real de
 * configuración de Etapa 1 — certificado real cargado vía el servicio, no un mock aislado.
 */
const TAG = `sripreview_${Date.now()}`;
let dbAvailable = false;
let companyId = '';
let establishmentId = '';
let emissionPointId = '';

function buildTestP12(password: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2030-01-01T00:00:00Z');
  cert.setSubject([{ name: 'commonName', value: 'TEST SRI PREVIEW' }]);
  cert.setIssuer([{ name: 'commonName', value: 'TEST SRI PREVIEW' }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password);
  return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');
}

async function cleanup() {
  await prisma.invoice.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.digitalCertificate.deleteMany({ where: { fiscalConfig: { companyId } } }).catch(() => {});
  await prisma.emissionPoint.deleteMany({ where: { establishment: { fiscalConfig: { companyId } } } }).catch(() => {});
  await prisma.establishment.deleteMany({ where: { fiscalConfig: { companyId } } }).catch(() => {});
  await prisma.documentSequence.deleteMany({ where: { companyId, docType: { startsWith: 'SRI_TEST_FACTURA_' } } }).catch(() => {});
  await prisma.companyFiscalConfig.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => {});
}

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
    return;
  }
  process.env.CERT_ENCRYPTION_KEY ||= 'clave-de-test-no-usar-en-produccion';
  const company = await prisma.company.create({ data: { name: `Empresa ${TAG}`, email: `${TAG}@kallpapro.test` } });
  companyId = company.id;

  await fiscal.upsertFiscalConfig(companyId, {
    ruc: '1790012345001', razonSocial: 'Comercial Prueba S.A.', obligadoContabilidad: true, regimen: 'GENERAL',
  });
  const est = await fiscal.createEstablishment(companyId, { code: '001', name: 'Matriz', address: 'Av. Amazonas, Quito', isMatriz: true });
  establishmentId = est.id;
  const point = await fiscal.createEmissionPoint(companyId, establishmentId, { code: '001', name: 'Caja 1' });
  emissionPointId = point.id;
  await fiscal.uploadCertificate(companyId, { alias: 'Cert test', fileBuffer: buildTestP12('clave123'), password: 'clave123' });
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

describe('sri-preview.service — e2e con BD real (Etapa 2)', () => {
  it('arma y firma un comprobante de prueba usando el certificado real cargado en Etapa 1', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const result = await previewSignedTestFactura(companyId, establishmentId, emissionPointId);
    expect(result.claveAcceso).toHaveLength(49);
    expect(result.signedXml).toContain('<ds:Signature');
    expect(result.signedXml).toContain(result.claveAcceso);
    expect(result.unsignedXml).not.toContain('<ds:Signature');
  });

  it('consume secuenciales distintos en cada llamada (sin colisión)', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const a = await previewSignedTestFactura(companyId, establishmentId, emissionPointId);
    const b = await previewSignedTestFactura(companyId, establishmentId, emissionPointId);
    expect(a.secuencial).not.toBe(b.secuencial);
    expect(a.claveAcceso).not.toBe(b.claveAcceso);
  });

  it('rechaza la prueba si el ambiente es PRODUCCION (no debe consumir secuenciales reales)', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    // Etapa 5: setAmbiente(PRODUCCION) exige al menos un comprobante AUTORIZADO en Pruebas.
    await prisma.invoice.create({
      data: { companyId, number: `FAC-V-${TAG}-prod`, type: 'SALES', status: 'SENT', totalAmount: 1 as any, sriEstado: 'AUTORIZADA', sriAmbiente: 'PRUEBAS' },
    });
    await fiscal.setAmbiente(companyId, 'PRODUCCION');
    try {
      await expect(previewSignedTestFactura(companyId, establishmentId, emissionPointId)).rejects.toThrow(/PRUEBAS/);
    } finally {
      await fiscal.setAmbiente(companyId, 'PRUEBAS'); // deja el estado como lo esperan los demás tests
    }
  });
});
