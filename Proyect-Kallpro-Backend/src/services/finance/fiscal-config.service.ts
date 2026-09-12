/**
 * Base normativa de facturación electrónica SRI (Etapa 1 del plan
 * `Arquitectura KallpaPro/plan-contabilidad-tributaria-sri.md`). Solo configuración: NO firma
 * ni envía nada al SRI todavía (eso es Etapa 2-3). Provee lo que las etapas siguientes
 * necesitan: ambiente (pruebas/producción), establecimientos, puntos de emisión y el
 * certificado .p12 cifrado en reposo.
 */
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { encryptBuffer, decryptBuffer, encryptString, decryptString } from './engines/cert-crypto.engine';
import { inspectP12 } from './engines/p12-inspector.engine';

const AMBIENTES = ['PRUEBAS', 'PRODUCCION'] as const;
const REGIMENES = ['GENERAL', 'RIMPE_EMPRENDEDOR', 'RIMPE_NEGOCIO_POPULAR'] as const;
const TIPOS_EMISION = ['NORMAL', 'CONTINGENCIA'] as const;

function certEncryptionKey(): string {
  const key = process.env.CERT_ENCRYPTION_KEY;
  if (!key) throw AppError.badRequest('CERT_ENCRYPTION_KEY no está configurada en el servidor', 'MISSING_ENCRYPTION_KEY');
  return key;
}

// ── Config fiscal de la empresa (1:1) ──────────────────────────────────────
export async function getFiscalConfig(companyId: string) {
  const config = await prisma.companyFiscalConfig.findUnique({
    where: { companyId },
    include: {
      establishments: { include: { emissionPoints: true }, orderBy: { code: 'asc' } },
      certificates: {
        select: { id: true, alias: true, validFrom: true, validTo: true, active: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  return config; // null si la empresa aún no configuró nada — el frontend muestra el wizard inicial
}

export interface FiscalConfigInput {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  obligadoContabilidad: boolean;
  contribuyenteEspecial?: string;
  regimen: (typeof REGIMENES)[number];
}

// RUC de sociedad ecuatoriano: 13 dígitos totales = 10 dígitos base + "001" (código de establecimiento).
function validateRuc(ruc: string) {
  if (!/^\d{10}001$/.test(ruc)) {
    throw AppError.badRequest('El RUC debe tener 13 dígitos y terminar en 001', 'INVALID_RUC');
  }
}

export async function upsertFiscalConfig(companyId: string, input: FiscalConfigInput) {
  validateRuc(input.ruc);
  if (!REGIMENES.includes(input.regimen)) {
    throw AppError.badRequest('Régimen tributario inválido', 'INVALID_REGIMEN');
  }
  return prisma.companyFiscalConfig.upsert({
    where: { companyId },
    update: {
      ruc: input.ruc,
      razonSocial: input.razonSocial,
      nombreComercial: input.nombreComercial ?? null,
      obligadoContabilidad: input.obligadoContabilidad,
      contribuyenteEspecial: input.contribuyenteEspecial ?? null,
      regimen: input.regimen,
    },
    create: {
      companyId,
      ruc: input.ruc,
      razonSocial: input.razonSocial,
      nombreComercial: input.nombreComercial ?? null,
      obligadoContabilidad: input.obligadoContabilidad,
      contribuyenteEspecial: input.contribuyenteEspecial ?? null,
      regimen: input.regimen,
      ambiente: 'PRUEBAS', // siempre arranca en Pruebas; cambiar a Producción es una acción aparte y explícita
    },
  });
}

// Cambiar de ambiente es deliberadamente una función separada de `upsertFiscalConfig`: en el
// frontend exige un modal de confirmación explícito (afecta documentos reales ante el SRI).
export async function setAmbiente(companyId: string, ambiente: (typeof AMBIENTES)[number]) {
  if (!AMBIENTES.includes(ambiente)) {
    throw AppError.badRequest('Ambiente inválido (debe ser PRUEBAS o PRODUCCION)', 'INVALID_AMBIENTE');
  }
  const config = await prisma.companyFiscalConfig.findUnique({ where: { companyId } });
  if (!config) throw AppError.badRequest('Configura primero los datos fiscales de la empresa', 'FISCAL_CONFIG_MISSING');

  if (ambiente === 'PRODUCCION') {
    const activeCert = await prisma.digitalCertificate.findFirst({
      where: { fiscalConfigId: config.id, active: true },
    });
    if (!activeCert) {
      throw AppError.badRequest(
        'No puedes pasar a Producción sin un certificado de firma electrónica activo',
        'NO_ACTIVE_CERTIFICATE',
      );
    }
    const establishmentCount = await prisma.establishment.count({ where: { fiscalConfigId: config.id, active: true } });
    if (establishmentCount === 0) {
      throw AppError.badRequest(
        'No puedes pasar a Producción sin al menos un establecimiento activo',
        'NO_ACTIVE_ESTABLISHMENT',
      );
    }

    // Etapa 5 del plan SRI: exige al menos un comprobante AUTORIZADO en Pruebas antes de
    // habilitar Producción — evita que el primer comprobante real de la empresa sea también
    // el primero que se prueba de punta a punta contra el SRI.
    const [invoiceOk, creditNoteOk, debitNoteOk, deliveryGuideOk] = await Promise.all([
      prisma.invoice.count({ where: { companyId, sriEstado: 'AUTORIZADA', sriAmbiente: 'PRUEBAS' } }),
      prisma.creditNote.count({ where: { companyId, sriEstado: 'AUTORIZADA', sriAmbiente: 'PRUEBAS' } }),
      prisma.debitNote.count({ where: { companyId, sriEstado: 'AUTORIZADA', sriAmbiente: 'PRUEBAS' } }),
      prisma.deliveryGuide.count({ where: { companyId, sriEstado: 'AUTORIZADA', sriAmbiente: 'PRUEBAS' } }),
    ]);
    if (invoiceOk + creditNoteOk + debitNoteOk + deliveryGuideOk === 0) {
      throw AppError.badRequest(
        'No puedes pasar a Producción sin al menos un comprobante AUTORIZADO por el SRI en el ambiente de Pruebas',
        'NO_AUTHORIZED_TEST_DOCUMENT',
      );
    }
  }

  return prisma.companyFiscalConfig.update({ where: { companyId }, data: { ambiente } });
}

/** Checklist de requisitos para pasar a Producción (Etapa 5), sin efectos secundarios — alimenta la UI. */
export async function getProductionChecklist(companyId: string) {
  const config = await prisma.companyFiscalConfig.findUnique({ where: { companyId } });
  if (!config) return null;
  const [activeCert, establishmentCount, invoiceOk, creditNoteOk, debitNoteOk, deliveryGuideOk] = await Promise.all([
    prisma.digitalCertificate.count({ where: { fiscalConfigId: config.id, active: true } }),
    prisma.establishment.count({ where: { fiscalConfigId: config.id, active: true } }),
    prisma.invoice.count({ where: { companyId, sriEstado: 'AUTORIZADA', sriAmbiente: 'PRUEBAS' } }),
    prisma.creditNote.count({ where: { companyId, sriEstado: 'AUTORIZADA', sriAmbiente: 'PRUEBAS' } }),
    prisma.debitNote.count({ where: { companyId, sriEstado: 'AUTORIZADA', sriAmbiente: 'PRUEBAS' } }),
    prisma.deliveryGuide.count({ where: { companyId, sriEstado: 'AUTORIZADA', sriAmbiente: 'PRUEBAS' } }),
  ]);
  return {
    hasActiveCertificate: activeCert > 0,
    hasActiveEstablishment: establishmentCount > 0,
    hasAuthorizedTestDocument: invoiceOk + creditNoteOk + debitNoteOk + deliveryGuideOk > 0,
  };
}

/** Cambia el tipo de emisión (NORMAL|CONTINGENCIA) — afecta el dígito de la clave de acceso de todo comprobante nuevo. */
export async function setTipoEmision(companyId: string, tipoEmision: (typeof TIPOS_EMISION)[number]) {
  if (!TIPOS_EMISION.includes(tipoEmision)) {
    throw AppError.badRequest('Tipo de emisión inválido (debe ser NORMAL o CONTINGENCIA)', 'INVALID_TIPO_EMISION');
  }
  const config = await prisma.companyFiscalConfig.findUnique({ where: { companyId } });
  if (!config) throw AppError.badRequest('Configura primero los datos fiscales de la empresa', 'FISCAL_CONFIG_MISSING');
  return prisma.companyFiscalConfig.update({ where: { companyId }, data: { tipoEmision } });
}

async function requireFiscalConfig(companyId: string) {
  const config = await prisma.companyFiscalConfig.findUnique({ where: { companyId } });
  if (!config) throw AppError.badRequest('Configura primero los datos fiscales de la empresa', 'FISCAL_CONFIG_MISSING');
  return config;
}

// ── Establecimientos ────────────────────────────────────────────────────────
export async function createEstablishment(companyId: string, data: { code: string; name: string; address: string; isMatriz?: boolean }) {
  const config = await requireFiscalConfig(companyId);
  if (!/^\d{3}$/.test(data.code)) throw AppError.badRequest('El código de establecimiento debe ser de 3 dígitos', 'INVALID_ESTABLISHMENT_CODE');
  const existing = await prisma.establishment.findUnique({
    where: { fiscalConfigId_code: { fiscalConfigId: config.id, code: data.code } },
  });
  if (existing) throw AppError.conflict('Ya existe un establecimiento con ese código', 'DUPLICATE_ESTABLISHMENT_CODE');
  return prisma.establishment.create({
    data: { fiscalConfigId: config.id, code: data.code, name: data.name, address: data.address, isMatriz: !!data.isMatriz },
  });
}

export async function updateEstablishment(companyId: string, id: string, data: { name?: string; address?: string; active?: boolean }) {
  const config = await requireFiscalConfig(companyId);
  const est = await prisma.establishment.findFirst({ where: { id, fiscalConfigId: config.id } });
  if (!est) throw AppError.notFound('Establecimiento no encontrado');
  return prisma.establishment.update({ where: { id }, data });
}

// ── Puntos de emisión ───────────────────────────────────────────────────────
export async function createEmissionPoint(companyId: string, establishmentId: string, data: { code: string; name?: string }) {
  const config = await requireFiscalConfig(companyId);
  const est = await prisma.establishment.findFirst({ where: { id: establishmentId, fiscalConfigId: config.id } });
  if (!est) throw AppError.notFound('Establecimiento no encontrado');
  if (!/^\d{3}$/.test(data.code)) throw AppError.badRequest('El código de punto de emisión debe ser de 3 dígitos', 'INVALID_EMISSION_POINT_CODE');
  const existing = await prisma.emissionPoint.findUnique({
    where: { establishmentId_code: { establishmentId, code: data.code } },
  });
  if (existing) throw AppError.conflict('Ya existe un punto de emisión con ese código en este establecimiento', 'DUPLICATE_EMISSION_POINT_CODE');
  return prisma.emissionPoint.create({ data: { establishmentId, code: data.code, name: data.name ?? null } });
}

export async function updateEmissionPoint(companyId: string, id: string, data: { name?: string; active?: boolean }) {
  const config = await requireFiscalConfig(companyId);
  const point = await prisma.emissionPoint.findFirst({
    where: { id, establishment: { fiscalConfigId: config.id } },
  });
  if (!point) throw AppError.notFound('Punto de emisión no encontrado');
  return prisma.emissionPoint.update({ where: { id }, data });
}

// ── Certificado digital (.p12) ──────────────────────────────────────────────
// Nunca se devuelve `fileDataEnc`/`passwordEnc` — ni siquiera cifrados — en ninguna respuesta.
const CERT_PUBLIC_SELECT = {
  id: true, alias: true, validFrom: true, validTo: true, active: true, createdAt: true,
} as const;

export async function uploadCertificate(
  companyId: string,
  data: { alias: string; fileBuffer: Buffer; password: string },
) {
  const config = await requireFiscalConfig(companyId);
  const appKey = certEncryptionKey();

  // Falla rápido si la contraseña no abre el .p12 — evita descubrirlo el día de emitir una factura real.
  const info = inspectP12(data.fileBuffer, data.password);
  if (info.validTo < new Date()) {
    throw AppError.badRequest('Este certificado ya venció; sube uno vigente', 'CERTIFICATE_EXPIRED');
  }

  const fileDataEnc = encryptBuffer(data.fileBuffer, appKey);
  const passwordEnc = encryptString(data.password, appKey);

  // Un solo certificado activo a la vez por empresa (el que se usa para firmar); subir uno
  // nuevo desactiva el anterior en la misma transacción, nunca queda ambigüedad de cuál firma.
  return prisma.$transaction(async (tx) => {
    await tx.digitalCertificate.updateMany({ where: { fiscalConfigId: config.id, active: true }, data: { active: false } });
    return tx.digitalCertificate.create({
      data: {
        fiscalConfigId: config.id,
        alias: data.alias,
        fileDataEnc,
        passwordEnc,
        validFrom: info.validFrom,
        validTo: info.validTo,
        active: true,
      },
      select: CERT_PUBLIC_SELECT,
    });
  });
}

export async function listCertificates(companyId: string) {
  const config = await requireFiscalConfig(companyId);
  return prisma.digitalCertificate.findMany({
    where: { fiscalConfigId: config.id },
    select: CERT_PUBLIC_SELECT,
    orderBy: { createdAt: 'desc' },
  });
}

export async function deactivateCertificate(companyId: string, id: string) {
  const config = await requireFiscalConfig(companyId);
  const cert = await prisma.digitalCertificate.findFirst({ where: { id, fiscalConfigId: config.id } });
  if (!cert) throw AppError.notFound('Certificado no encontrado');
  return prisma.digitalCertificate.update({ where: { id }, data: { active: false }, select: CERT_PUBLIC_SELECT });
}

/**
 * Descifra el certificado activo para uso interno del firmador (Etapa 2). NO es un endpoint:
 * solo lo debe llamar `signer.ts` en el momento exacto de firmar, nunca exponerse por HTTP.
 */
export async function getActiveCertificateForSigning(companyId: string): Promise<{ fileBuffer: Buffer; password: string } | null> {
  const config = await prisma.companyFiscalConfig.findUnique({ where: { companyId } });
  if (!config) return null;
  const cert = await prisma.digitalCertificate.findFirst({ where: { fiscalConfigId: config.id, active: true } });
  if (!cert) return null;
  const appKey = certEncryptionKey();
  return {
    fileBuffer: decryptBuffer(Buffer.from(cert.fileDataEnc), appKey),
    password: decryptString(cert.passwordEnc, appKey),
  };
}
