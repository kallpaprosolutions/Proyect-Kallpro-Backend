/**
 * Etapa 4 del plan SRI (resto): emisión REAL de notas de débito de venta ante el SRI. Mismo
 * patrón exacto que `electronic-creditnote.service.ts` (persistir antes de enviar, recepción →
 * autorización con reintentos, re-emitir con secuencial nuevo, AUTORIZADA inmutable) — se
 * duplica deliberadamente, no una abstracción genérica sobre tres entidades con relaciones
 * distintas (Invoice/CreditNote/DebitNote); ver `sri-soap.engine.ts`/`sri-soap-client.ts` (esos
 * SÍ son genéricos y se reusan tal cual).
 *
 * Requisito propio de la ND (igual que la NC): la factura que debita (`docModificado`) debe
 * estar `AUTORIZADA` — el SRI rechaza una ND contra un comprobante que él mismo no autorizó.
 */
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { logger } from '../../lib/logger';
import { getNextDocumentNumber } from '../../utils/sequence.helper';
import { logFieldChange } from '../chatter.service';
import { buildClaveAcceso, randomCodigoNumerico } from './engines/clave-acceso.engine';
import { buildNotaDebitoXml } from './engines/nota-debito-xml.engine';
import { buildNotaDebitoInput } from './engines/debitnote-to-nd.engine';
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

async function logTransmission(companyId: string, debitNoteId: string, data: {
  operacion: 'RECEPCION' | 'AUTORIZACION'; claveAcceso: string; resultado: string; mensajes?: SriMensaje[]; rawResponse?: string;
}) {
  await prisma.sriTransmission.create({
    data: { companyId, debitNoteId, operacion: data.operacion, claveAcceso: data.claveAcceso, resultado: data.resultado, mensajes: data.mensajes as any, rawResponse: data.rawResponse },
  });
}

async function setEstado(companyId: string, debitNoteId: string, userId: string | undefined, from: string, to: SriEstado, extra: Record<string, unknown> = {}) {
  await prisma.debitNote.update({ where: { id: debitNoteId }, data: { sriEstado: to, sriUltimoIntento: new Date(), ...extra } as any });
  if (userId) await logFieldChange(companyId, userId, 'DEBIT_NOTE', debitNoteId, 'SRI_ESTADO', from, to);
}

export async function emitDebitNote(
  companyId: string, debitNoteId: string, opts: { establishmentId: string; emissionPointId: string }, userId?: string,
): Promise<EmitResult> {
  const { dn, forSri, customer, invoiceSustento } = await loadDebitNoteForSri(companyId, debitNoteId);
  if (!REEMITIBLES.includes(dn.sriEstado as SriEstado)) {
    throw AppError.badRequest(
      dn.sriEstado === 'AUTORIZADA' ? 'Esta nota de débito ya está AUTORIZADA por el SRI' : `La ND ya fue enviada (${dn.sriEstado}); consulta la autorización en vez de re-emitir`,
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
  const secuencial = await prisma.$transaction((tx) => getNextDocumentNumber(tx, companyId, `SRI_NOTADEBITO_${estab}_${ptoEmi}`, '', 9));
  const claveAcceso = buildClaveAcceso({
    fechaEmision: new Date(), tipoComprobante: 'NOTA_DEBITO', ruc: config.ruc, ambiente,
    estab, ptoEmi, secuencial, codigoNumerico: randomCodigoNumerico(), tipoEmision: config.tipoEmision as any,
  });

  const ndInput = (() => {
    try {
      return buildNotaDebitoInput({
        debitNote: forSri, customer, invoiceSustento,
        emisor: {
          ruc: config.ruc, razonSocial: config.razonSocial, nombreComercial: config.nombreComercial,
          dirMatriz: point.establishment.address, dirEstablecimiento: point.establishment.address,
          obligadoContabilidad: config.obligadoContabilidad, contribuyenteEspecial: config.contribuyenteEspecial,
        },
        ambiente, claveAcceso, estab, ptoEmi, secuencial,
      });
    } catch (e: any) {
      throw AppError.badRequest(e?.message ?? 'No se pudo armar la nota de débito', 'SRI_INVALID_ND_DATA');
    }
  })();

  let xmlFirmado: string;
  try {
    xmlFirmado = signComprobante('NOTA_DEBITO', buildNotaDebitoXml(ndInput), cert.fileBuffer, cert.password);
  } catch (e) {
    throw AppError.badRequest(describeSigningError(e), 'SIGNING_FAILED');
  }

  await setEstado(companyId, debitNoteId, userId, dn.sriEstado, 'ENVIADA', {
    sriAmbiente: ambiente, establishmentId: point.establishment.id, emissionPointId: point.id,
    sriSecuencial: secuencial, claveAcceso, xmlFirmado, numeroAutorizacion: null, fechaAutorizacion: null, xmlAutorizado: null, sriMensajes: null,
  });

  const rawRecepcion = await soap.sendRecepcion(ambiente, buildRecepcionEnvelope(xmlFirmado));
  let recepcion;
  try {
    recepcion = parseRecepcionResponse(rawRecepcion);
  } catch (e: any) {
    await logTransmission(companyId, debitNoteId, { operacion: 'RECEPCION', claveAcceso, resultado: 'ERROR_RED', rawResponse: rawRecepcion });
    throw AppError.badRequest(e?.message ?? 'Respuesta del SRI no reconocida', 'SRI_BAD_RESPONSE');
  }
  await logTransmission(companyId, debitNoteId, { operacion: 'RECEPCION', claveAcceso, resultado: recepcion.estado, mensajes: recepcion.mensajes, rawResponse: rawRecepcion });

  const yaRegistrada = recepcion.mensajes.some((m) => m.identificador === SRI_CLAVE_YA_REGISTRADA);
  if (recepcion.estado === 'DEVUELTA' && !yaRegistrada) {
    await setEstado(companyId, debitNoteId, userId, 'ENVIADA', 'DEVUELTA', { sriMensajes: recepcion.mensajes as any });
    return { sriEstado: 'DEVUELTA', claveAcceso, mensajes: recepcion.mensajes };
  }
  await setEstado(companyId, debitNoteId, userId, 'ENVIADA', 'RECIBIDA', { sriMensajes: recepcion.mensajes as any });

  return pollAuthorization(companyId, debitNoteId, claveAcceso, ambiente, userId, 'RECIBIDA');
}

async function loadDebitNoteForSri(companyId: string, debitNoteId: string) {
  const dn = await prisma.debitNote.findFirst({
    where: { id: debitNoteId, companyId },
    include: { concepts: true, invoice: { include: { salesOrder: { include: { customer: true } }, establishment: true, emissionPoint: true } } },
  });
  if (!dn) throw AppError.notFound('Nota de débito no encontrada');
  if (dn.status === 'CANCELLED') throw AppError.badRequest('La nota de débito está anulada', 'DEBIT_NOTE_CANCELLED');
  if (!dn.invoice) throw AppError.badRequest('La nota de débito no tiene factura sustento', 'DEBIT_NOTE_WITHOUT_INVOICE');
  if (dn.invoice.sriEstado !== 'AUTORIZADA') {
    throw AppError.badRequest(
      `La factura ${dn.invoice.number} que esta ND debita todavía no está AUTORIZADA por el SRI — emítela primero`,
      'SUSTENTO_NOT_AUTHORIZED',
    );
  }
  const customer = dn.invoice.salesOrder?.customer;
  if (!customer) throw AppError.badRequest('La factura sustento no tiene cliente (no nació de un pedido de venta)', 'INVOICE_WITHOUT_CUSTOMER');
  if (!dn.invoice.establishment || !dn.invoice.emissionPoint || !dn.invoice.sriSecuencial) {
    throw AppError.badRequest('La factura sustento no tiene el número SRI completo (establecimiento/punto de emisión/secuencial)', 'INVOICE_MISSING_SRI_NUMBER');
  }

  return {
    dn,
    forSri: {
      taxRate: Number(dn.taxRate),
      concepts: dn.concepts.map((c) => ({ description: c.description, amount: Number(c.amount) })),
    },
    customer: { name: customer.name, razonSocial: customer.razonSocial, ruc: customer.ruc, documentType: customer.documentType, address: customer.address, email: customer.email },
    invoiceSustento: { estab: dn.invoice.establishment.code, ptoEmi: dn.invoice.emissionPoint.code, sriSecuencial: dn.invoice.sriSecuencial, issueDate: dn.invoice.issueDate },
  };
}

async function pollAuthorization(
  companyId: string, debitNoteId: string, claveAcceso: string, ambiente: 'PRUEBAS' | 'PRODUCCION', userId: string | undefined, fromEstado: string,
): Promise<EmitResult> {
  let last: EmitResult = { sriEstado: 'RECIBIDA', claveAcceso, mensajes: [] };
  for (let attempt = 1; attempt <= AUTH_POLL_ATTEMPTS; attempt++) {
    const raw = await soap.sendAutorizacion(ambiente, buildAutorizacionEnvelope(claveAcceso));
    let aut;
    try {
      aut = parseAutorizacionResponse(raw);
    } catch (e: any) {
      await logTransmission(companyId, debitNoteId, { operacion: 'AUTORIZACION', claveAcceso, resultado: 'ERROR_RED', rawResponse: raw });
      throw AppError.badRequest(e?.message ?? 'Respuesta del SRI no reconocida', 'SRI_BAD_RESPONSE');
    }
    await logTransmission(companyId, debitNoteId, { operacion: 'AUTORIZACION', claveAcceso, resultado: aut.estado, mensajes: aut.mensajes, rawResponse: raw });

    if (aut.estado === 'AUTORIZADO') {
      await setEstado(companyId, debitNoteId, userId, fromEstado, 'AUTORIZADA', {
        numeroAutorizacion: aut.numeroAutorizacion ?? claveAcceso, fechaAutorizacion: aut.fechaAutorizacion ?? new Date(),
        xmlAutorizado: aut.comprobante ?? null, sriMensajes: aut.mensajes as any,
      });
      return { sriEstado: 'AUTORIZADA', claveAcceso, numeroAutorizacion: aut.numeroAutorizacion ?? claveAcceso, mensajes: aut.mensajes };
    }
    if (aut.estado === 'NO AUTORIZADO') {
      await setEstado(companyId, debitNoteId, userId, fromEstado, 'RECHAZADA', { sriMensajes: aut.mensajes as any });
      return { sriEstado: 'RECHAZADA', claveAcceso, mensajes: aut.mensajes };
    }
    last = { sriEstado: 'RECIBIDA', claveAcceso, mensajes: aut.mensajes };
    if (attempt < AUTH_POLL_ATTEMPTS) await sleep(AUTH_POLL_DELAY_MS);
  }
  logger.info('[sri-nd] autorización aún en proceso, se podrá consultar después', { companyId, debitNoteId, claveAcceso });
  return last;
}

export async function checkDebitNoteAuthorization(companyId: string, debitNoteId: string, userId?: string): Promise<EmitResult> {
  const dn = await prisma.debitNote.findFirst({ where: { id: debitNoteId, companyId } });
  if (!dn) throw AppError.notFound('Nota de débito no encontrada');
  if (!dn.claveAcceso || !dn.sriAmbiente) throw AppError.badRequest('La ND aún no se ha enviado al SRI', 'SRI_NOT_SENT');
  if (dn.sriEstado === 'AUTORIZADA') return { sriEstado: 'AUTORIZADA', claveAcceso: dn.claveAcceso, numeroAutorizacion: dn.numeroAutorizacion, mensajes: [] };
  return pollAuthorization(companyId, debitNoteId, dn.claveAcceso, dn.sriAmbiente as any, userId, dn.sriEstado);
}

export async function getDebitNoteSriStatus(companyId: string, debitNoteId: string) {
  const dn = await prisma.debitNote.findFirst({
    where: { id: debitNoteId, companyId },
    select: {
      id: true, number: true, sriEstado: true, sriAmbiente: true, sriSecuencial: true, claveAcceso: true,
      numeroAutorizacion: true, fechaAutorizacion: true, sriMensajes: true, sriUltimoIntento: true,
      establishment: { select: { code: true, name: true } }, emissionPoint: { select: { code: true, name: true } },
    },
  });
  if (!dn) throw AppError.notFound('Nota de débito no encontrada');
  const transmissions = await prisma.sriTransmission.findMany({
    where: { companyId, debitNoteId },
    select: { id: true, operacion: true, claveAcceso: true, resultado: true, mensajes: true, createdAt: true },
    orderBy: { createdAt: 'desc' }, take: 20,
  });
  return { ...dn, transmissions };
}

export async function getDebitNoteSriXml(companyId: string, debitNoteId: string): Promise<{ filename: string; xml: string }> {
  const dn = await prisma.debitNote.findFirst({ where: { id: debitNoteId, companyId }, select: { number: true, claveAcceso: true, xmlFirmado: true, xmlAutorizado: true } });
  if (!dn) throw AppError.notFound('Nota de débito no encontrada');
  const xml = dn.xmlAutorizado || dn.xmlFirmado;
  if (!xml) throw AppError.badRequest('La nota de débito aún no tiene XML generado', 'SRI_NO_XML');
  return { filename: `${dn.claveAcceso ?? dn.number}.xml`, xml };
}

export { SRI_ESTADOS };
