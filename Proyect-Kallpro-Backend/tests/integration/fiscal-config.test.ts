import { prisma } from '../../src/lib/prisma';
import * as fiscal from '../../src/services/finance/fiscal-config.service';

/**
 * Integración con BD real: Etapa 1 del plan SRI (base normativa). Valida RUC, unicidad de
 * establecimientos/puntos de emisión, y que subir un certificado con contraseña incorrecta
 * falla ANTES de guardar nada (no deja certificados "fantasma" sin poder usarse luego).
 */
const TAG = `fiscal_${Date.now()}`;
let dbAvailable = false;
let companyId = '';

async function cleanup() {
  await prisma.invoice.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.digitalCertificate.deleteMany({ where: { fiscalConfig: { companyId } } }).catch(() => {});
  await prisma.emissionPoint.deleteMany({ where: { establishment: { fiscalConfig: { companyId } } } }).catch(() => {});
  await prisma.establishment.deleteMany({ where: { fiscalConfig: { companyId } } }).catch(() => {});
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
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

describe('fiscal-config.service — e2e con BD real', () => {
  it('rechaza un RUC con formato inválido', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    await expect(fiscal.upsertFiscalConfig(companyId, {
      ruc: '123', razonSocial: 'X', obligadoContabilidad: true, regimen: 'GENERAL',
    })).rejects.toThrow(/RUC/);
  });

  it('crea la configuración fiscal y arranca siempre en ambiente PRUEBAS', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const config = await fiscal.upsertFiscalConfig(companyId, {
      ruc: '1790012345001', razonSocial: 'Comercial Prueba S.A.',
      obligadoContabilidad: true, regimen: 'GENERAL',
    });
    expect(config.ambiente).toBe('PRUEBAS');
  });

  it('no permite dos establecimientos con el mismo código', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    await fiscal.createEstablishment(companyId, { code: '001', name: 'Matriz', address: 'Av. Siempre Viva', isMatriz: true });
    await expect(fiscal.createEstablishment(companyId, { code: '001', name: 'Duplicado', address: 'X' }))
      .rejects.toThrow(/existe/);
  });

  it('crea un punto de emisión bajo un establecimiento real', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const config = await fiscal.getFiscalConfig(companyId);
    const est = config!.establishments[0];
    const point = await fiscal.createEmissionPoint(companyId, est.id, { code: '001', name: 'Caja principal' });
    expect(point.code).toBe('001');
  });

  it('no pasa a Producción sin certificado activo', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    await expect(fiscal.setAmbiente(companyId, 'PRODUCCION')).rejects.toThrow(/certificado/);
  });

  it('rechaza un .p12 con contraseña incorrecta sin guardar nada', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const forge = await import('node-forge');
    const keys = forge.pki.rsa.generateKeyPair(1024);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date('2026-01-01T00:00:00Z');
    cert.validity.notAfter = new Date('2030-01-01T00:00:00Z');
    cert.setSubject([{ name: 'commonName', value: 'TEST' }]);
    cert.setIssuer([{ name: 'commonName', value: 'TEST' }]);
    cert.sign(keys.privateKey);
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'clave-correcta');
    const fileBuffer = Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');

    await expect(fiscal.uploadCertificate(companyId, { alias: 'Test', fileBuffer, password: 'clave-incorrecta' }))
      .rejects.toThrow(/[Cc]ontraseña/);

    const certs = await fiscal.listCertificates(companyId);
    expect(certs).toHaveLength(0);
  });

  it('carga un .p12 válido, lo cifra, y nunca expone el archivo/contraseña en la respuesta', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const forge = await import('node-forge');
    const keys = forge.pki.rsa.generateKeyPair(1024);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date('2026-01-01T00:00:00Z');
    cert.validity.notAfter = new Date('2030-01-01T00:00:00Z');
    cert.setSubject([{ name: 'commonName', value: 'TEST' }]);
    cert.setIssuer([{ name: 'commonName', value: 'TEST' }]);
    cert.sign(keys.privateKey);
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'clave-buena');
    const fileBuffer = Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');

    const created = await fiscal.uploadCertificate(companyId, { alias: 'Certificado 2026', fileBuffer, password: 'clave-buena' });
    expect((created as any).fileDataEnc).toBeUndefined();
    expect((created as any).passwordEnc).toBeUndefined();
    expect(created.active).toBe(true);

    // El firmador interno (Etapa 2) sí puede recuperar el .p12 descifrado
    const forSigning = await fiscal.getActiveCertificateForSigning(companyId);
    expect(forSigning?.password).toBe('clave-buena');
    expect(forSigning?.fileBuffer.equals(fileBuffer)).toBe(true);
  });

  it('no pasa a Producción sin al menos un comprobante AUTORIZADO en Pruebas (Etapa 5)', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    await expect(fiscal.setAmbiente(companyId, 'PRODUCCION')).rejects.toThrow(/comprobante AUTORIZADO/);

    const checklist = await fiscal.getProductionChecklist(companyId);
    expect(checklist).toEqual({ hasActiveCertificate: true, hasActiveEstablishment: true, hasAuthorizedTestDocument: false });
  });

  it('pasa a Producción una vez que existe un comprobante AUTORIZADO en Pruebas', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    await prisma.invoice.create({
      data: {
        companyId, number: `FAC-V-${TAG}`, type: 'SALES', status: 'SENT', totalAmount: 100 as any,
        sriEstado: 'AUTORIZADA', sriAmbiente: 'PRUEBAS',
      },
    });

    const checklist = await fiscal.getProductionChecklist(companyId);
    expect(checklist!.hasAuthorizedTestDocument).toBe(true);

    const config = await fiscal.setAmbiente(companyId, 'PRODUCCION');
    expect(config.ambiente).toBe('PRODUCCION');
  });

  it('cambia el tipo de emisión a CONTINGENCIA y de vuelta a NORMAL', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const c1 = await fiscal.setTipoEmision(companyId, 'CONTINGENCIA');
    expect(c1.tipoEmision).toBe('CONTINGENCIA');
    const c2 = await fiscal.setTipoEmision(companyId, 'NORMAL');
    expect(c2.tipoEmision).toBe('NORMAL');
    await expect(fiscal.setTipoEmision(companyId, 'INVALIDO' as any)).rejects.toThrow(/inválido/);
  });
});
