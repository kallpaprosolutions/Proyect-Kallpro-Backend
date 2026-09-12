/**
 * Etapa 4 del plan SRI: emisión REAL de notas de crédito de venta ante el SRI. Mismo patrón
 * exacto que `electronic-invoice.service.ts` (persistir antes de enviar, recepción →
 * autorización con reintentos, re-emitir con secuencial nuevo, AUTORIZADA inmutable) — se
 * duplica deliberadamente en vez de forzar una abstracción genérica sobre dos entidades
 * (`Invoice`/`CreditNote`) con columnas iguales pero relaciones distintas; ver
 * `sri-soap.engine.ts`/`sri-soap-client.ts` (esos SÍ son genéricos y se reusan tal cual).
 *
 * Requisito propio de la NC: la factura que modifica (`docModificado`) debe estar
 * `AUTORIZADA` — el SRI rechaza una NC contra un comprobante que él mismo no autorizó.
 */
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { logger } from '../../lib/logger';
import { getNextDocumentNumber } from '../../utils/sequence.helper';
import { logFieldChange } from '../chatter.service';
import { buildClaveAcceso, randomCodigoNumerico } from './engines/clave-acceso.engine';
import { buildNotaCreditoXml } from './engines/nota-credito-xml.engine';
import { buildNotaCreditoInput } from './engines/creditnote-to-nc.engine';
import { signComprobante, describeSigningError } from './engines/xml-signer.engine';
import {
  buildRecepcionEnvelope, buildAutorizacionEnvelope, parseRecepcionResponse, parseAutorizacionResponse,
  SriMensaje, SRI_CLAVE_YA_REGISTRADA,
} from './engines/sri-soap.engine';
import * as soap from './sri-soap-client';
import { getActiveCertificateForSigning } from './fiscal-config.service';
import { SriEstado, SRI_ESTADOS, EmitResult } from './electronic-invoice.service';

const REEMITIBLES: SriEstado[] = ['NO_ENVIADA', 'DEVUELTA', 'RECHAZADA'];
const AUTH_POLL_ATTEMPTS = 3;
const AUTH_POLL_DELAY_MS = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function logTransmission(companyId: string, creditNoteId: string, data: {
  operacion: 'RECEPCION' | 'AUTORIZACION'; claveAcceso: string; resultado: string; mensajes?: SriMensaje[]; rawResponse?: string;
}) {
  await prisma.sriTransmission.create({
    data: { companyId, creditNoteId, operacion: data.operacion, claveAcceso: data.claveAcceso, resultado: data.resultado, mensajes: data.mensajes as any, rawResponse: data.rawResponse },
  });
}

async function setEstado(companyId: string, creditNoteId: string, userId: string | undefined, from: string, to: SriEstado, extra: Record<string, unknown> = {}) {
  await prisma.creditNote.update({ where: { id: creditNoteId }, data: { sriEstado: to, sriUltimoIntento: new Date(), ...extra } as any });
  if (userId) await logFieldChange(companyId, userId, 'CREDIT_NOTE', creditNoteId, 'SRI_ESTADO', from, to);
}

export async function emitCreditNote(
  companyId: string, creditNoteId: string, opts: { establishmentId: string; emissionPointId: string }, userId?: string,
): Promise<EmitResult> {
  const { cn, forSri, customer, invoiceSustento } = await loadCreditNoteForSri(companyId, creditNoteId);
  if (!REEMITIBLES.includes(cn.sriEstado as SriEstado)) {
    throw AppError.badRequest(
      cn.sriEstado === 'AUTORIZADA' ? 'Esta nota de crédito ya está AUTORIZADA por el SRI' : `La NC ya fue enviada (${cn.sriEstado}); consulta la autorización en vez de re-emitir`,
      'SRI_NOT_REEMITTABLE',
    );
  }

  const config = await prisma.companyFiscalConfig.findUnique({ where: { companyId } });
  if (!config) throw AppError.badRequest('Configura primero los datos fiscales de la empresa', 'FISCAL_CONFIG_MISSING');
  const point = await prisma.emissionPoint.findFirst({
    where: { id: opts.emissionPointId, establishmentId: opts.establishmentId, active: true, establishment: { fiscalConfigId: config.id, active: true } },
    include: { establishment: true },
  });
  if (!point) throw AppError.notFound('Punto de emisión no encontrado o inactivo');
  const cert = await getActiveCertificateForSigning(companyId);
  if (!cert) throw AppError.badRequest('No hay un certificado de firma electrónica activo', 'NO_ACTIVE_CERTIFICATE');

  const ambiente = config.ambiente as 'PRUEBAS' | 'PRODUCCION';
  const estab = point.establishment.code;
  const ptoEmi = point.code;
  const secuencial = await prisma.$transaction((tx) => getNextDocumentNumber(tx, companyId, `SRI_NOTACREDITO_${estab}_${ptoEmi}`, '', 9));
  const claveAcceso = buildClaveAcceso({
    fechaEmision: new Date(), tipoComprobante: 'NOTA_CREDITO', ruc: config.ruc, ambiente,
    estab, ptoEmi, secuencial, codigoNumerico: randomCodigoNumerico(), tipoEmision: config.tipoEmision as any,
  });

  const ncInput = (() => {
    try {
      return buildNotaCreditoInput({
        creditNote: forSri, customer, invoiceSustento,
        emisor: {
          ruc: config.ruc, razonSocial: config.razonSocial, nombreComercial: config.nombreComercial,
          dirMatriz: point.establishment.address, dirEstablecimiento: point.establishment.address,
          obligadoContabilidad: config.obligadoContabilidad, contribuyenteEspecial: config.contribuyenteEspecial,
        },
        ambiente, claveAcceso, estab, ptoEmi, secuencial,
      });
    } catch (e: any) {
      throw AppError.badRequest(e?.message ?? 'No se pudo armar la nota de crédito', 'SRI_INVALID_NC_DATA');
    }
  })();

  let xmlFirmado: string;
  try {
    xmlFirmado = signComprobante('NOTA_CREDITO', buildNotaCreditoXml(ncInput), cert.fileBuffer, cert.password);
  } catch (e) {
    throw AppError.badRequest(describeSigningError(e), 'SIGNING_FAILED');
  }

  await setEstado(companyId, creditNoteId, userId, cn.sriEstado, 'ENVIADA', {
    sriAmbiente: ambiente, establishmentId: point.establishment.id, emissionPointId: point.id,
    sriSecuencial: secuencial, claveAcceso, xmlFirmado, numeroAutorizacion: null, fechaAutorizacion: null, xmlAutorizado: null, sriMensajes: null,
  });

  const rawRecepcion = await soap.sendRecepcion(ambiente, buildRecepcionEnvelope(xmlFirmado));
  let recepcion;
  try {
    recepcion = parseRecepcionResponse(rawRecepcion);
  } catch (e: any) {
    await logTransmission(companyId, creditNoteId, { operacion: 'RECEPCION', claveAcceso, resultado: 'ERROR_RED', rawResponse: rawRecepcion });
    throw AppError.badRequest(e?.message ?? 'Respuesta del SRI no reconocida', 'SRI_BAD_RESPONSE');
  }
  await logTransmission(companyId, creditNoteId, { operacion: 'RECEPCION', claveAcceso, resultado: recepcion.estado, mensajes: recepcion.mensajes, rawResponse: rawRecepcion });

  const yaRegistrada = recepcion.mensajes.some((m) => m.identificador === SRI_CLAVE_YA_REGISTRADA);
  if (recepcion.estado === 'DEVUELTA' && !yaRegistrada) {
    await setEstado(companyId, creditNoteId, userId, 'ENVIADA', 'DEVUELTA', { sriMensajes: recepcion.mensajes as any });
    return { sriEstado: 'DEVUELTA', claveAcceso, mensajes: recepcion.mensajes };
  }
  await setEstado(companyId, creditNoteId, userId, 'ENVIADA', 'RECIBIDA', { sriMensajes: recepcion.mensajes as any });

  return pollAuthorization(companyId, creditNoteId, claveAcceso, ambiente, userId, 'RECIBIDA');
}

async function loadCreditNoteForSri(companyId: string, creditNoteId: string) {
  const cn = await prisma.creditNote.findFirst({
    where: { id: creditNoteId, companyId },
    include: { items: true, invoice: { include: { salesOrder: { include: { customer: true } }, establishment: true, emissionPoint: true } } },
  });
  if (!cn) throw AppError.notFound('Nota de crédito no encontrada');
  if (cn.status === 'CANCELLED') throw AppError.badRequest('La nota de crédito está anulada', 'CREDIT_NOTE_CANCELLED');
  if (!cn.invoice) throw AppError.badRequest('La nota de crédito no tiene factura sustento', 'CREDIT_NOTE_WITHOUT_INVOICE');
  if (cn.invoice.sriEstado !== 'AUTORIZADA') {
    throw AppError.badRequest(
      `La factura ${cn.invoice.number} que esta NC modifica todavía no está AUTORIZADA por el SRI — emítela primero`,
      'SUSTENTO_NOT_AUTHORIZED',
    );
  }
  const customer = cn.invoice.salesOrder?.customer;
  if (!customer) throw AppError.badRequest('La factura sustento no tiene cliente (no nació de un pedido de venta)', 'INVOICE_WITHOUT_CUSTOMER');
  if (!cn.invoice.establishment || !cn.invoice.emissionPoint || !cn.invoice.sriSecuencial) {
    throw AppError.badRequest('La factura sustento no tiene el número SRI completo (establecimiento/punto de emisión/secuencial)', 'INVOICE_MISSING_SRI_NUMBER');
  }

  return {
    cn,
    forSri: {
      reason: cn.reason,
      lines: cn.items.map((it) => ({ description: it.description, quantity: Number(it.quantity), unitPrice: Number(it.unitPrice), discountPct: Number(it.discount), taxRate: Number(it.taxRate) })),
    },
    customer: { name: customer.name, razonSocial: customer.razonSocial, ruc: customer.ruc, documentType: customer.documentType, address: customer.address, email: customer.email },
    invoiceSustento: { estab: cn.invoice.establishment.code, ptoEmi: cn.invoice.emissionPoint.code, sriSecuencial: cn.invoice.sriSecuencial, issueDate: cn.invoice.issueDate },
  };
}

async function pollAuthorization(
  companyId: string, creditNoteId: string, claveAcceso: string, ambiente: 'PRUEBAS' | 'PRODUCCION', userId: string | undefined, fromEstado: string,
): Promise<EmitResult> {
  let last: EmitResult = { sriEstado: 'RECIBIDA', claveAcceso, mensajes: [] };
  for (let attempt = 1; attempt <= AUTH_POLL_ATTEMPTS; attempt++) {
    const raw = await soap.sendAutorizacion(ambiente, buildAutorizacionEnvelope(claveAcceso));
    let aut;
    try {
      aut = parseAutorizacionResponse(raw);
    } catch (e: any) {
      await logTransmission(companyId, creditNoteId, { operacion: 'AUTORIZACION', claveAcceso, resultado: 'ERROR_RED', rawResponse: raw });
      throw AppError.badRequest(e?.message ?? 'Respuesta del SRI no reconocida', 'SRI_BAD_RESPONSE');
    }
    await logTransmission(companyId, creditNoteId, { operacion: 'AUTORIZACION', claveAcceso, resultado: aut.estado, mensajes: aut.mensajes, rawResponse: raw });

    if (aut.estado === 'AUTORIZADO') {
      await setEstado(companyId, creditNoteId, userId, fromEstado, 'AUTORIZADA', {
        numeroAutorizacion: aut.numeroAutorizacion ?? claveAcceso, fechaAutorizacion: aut.fechaAutorizacion ?? new Date(),
        xmlAutorizado: aut.comprobante ?? null, sriMensajes: aut.mensajes as any,
      });
      return { sriEstado: 'AUTORIZADA', claveAcceso, numeroAutorizacion: aut.numeroAutorizacion ?? claveAcceso, mensajes: aut.mensajes };
    }
    if (aut.estado === 'NO AUTORIZADO') {
      await setEstado(companyId, creditNoteId, userId, fromEstado, 'RECHAZADA', { sriMensajes: aut.mensajes as any });
      return { sriEstado: 'RECHAZADA', claveAcceso, mensajes: aut.mensajes };
    }
    last = { sriEstado: 'RECIBIDA', claveAcceso, mensajes: aut.mensajes };
    if (attempt < AUTH_POLL_ATTEMPTS) await sleep(AUTH_POLL_DELAY_MS);
  }
  logger.info('[sri-nc] autorización aún en proceso, se podrá consultar después', { companyId, creditNoteId, claveAcceso });
  return last;
}

export async function checkCreditNoteAuthorization(companyId: string, creditNoteId: string, userId?: string): Promise<EmitResult> {
  const cn = await prisma.creditNote.findFirst({ where: { id: creditNoteId, companyId } });
  if (!cn) throw AppError.notFound('Nota de crédito no encontrada');
  if (!cn.claveAcceso || !cn.sriAmbiente) throw AppError.badRequest('La NC aún no se ha enviado al SRI', 'SRI_NOT_SENT');
  if (cn.sriEstado === 'AUTORIZADA') return { sriEstado: 'AUTORIZADA', claveAcceso: cn.claveAcceso, numeroAutorizacion: cn.numeroAutorizacion, mensajes: [] };
  return pollAuthorization(companyId, creditNoteId, cn.claveAcceso, cn.sriAmbiente as any, userId, cn.sriEstado);
}

export async function getCreditNoteSriStatus(companyId: string, creditNoteId: string) {
  const cn = await prisma.creditNote.findFirst({
    where: { id: creditNoteId, companyId },
    select: {
      id: true, number: true, sriEstado: true, sriAmbiente: true, sriSecuencial: true, claveAcceso: true,
      numeroAutorizacion: true, fechaAutorizacion: true, sriMensajes: true, sriUltimoIntento: true,
      establishment: { select: { code: true, name: true } }, emissionPoint: { select: { code: true, name: true } },
    },
  });
  if (!cn) throw AppError.notFound('Nota de crédito no encontrada');
  const transmissions = await prisma.sriTransmission.findMany({
    where: { companyId, creditNoteId },
    select: { id: true, operacion: true, claveAcceso: true, resultado: true, mensajes: true, createdAt: true },
    orderBy: { createdAt: 'desc' }, take: 20,
  });
  return { ...cn, transmissions };
}

export async function getCreditNoteSriXml(companyId: string, creditNoteId: string): Promise<{ filename: string; xml: string }> {
  const cn = await prisma.creditNote.findFirst({ where: { id: creditNoteId, companyId }, select: { number: true, claveAcceso: true, xmlFirmado: true, xmlAutorizado: true } });
  if (!cn) throw AppError.notFound('Nota de crédito no encontrada');
  const xml = cn.xmlAutorizado || cn.xmlFirmado;
  if (!xml) throw AppError.badRequest('La nota de crédito aún no tiene XML generado', 'SRI_NO_XML');
  return { filename: `${cn.claveAcceso ?? cn.number}.xml`, xml };
}

export { SRI_ESTADOS };
