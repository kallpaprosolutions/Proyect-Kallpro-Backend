/**
 * Etapa 4 del plan SRI (resto): emisión REAL de guías de remisión electrónicas ante el SRI.
 * Mismo patrón exacto que `electronic-debitnote.service.ts` (persistir antes de enviar,
 * recepción → autorización con reintentos, re-emitir con secuencial nuevo, AUTORIZADA
 * inmutable) — se duplica deliberadamente, no una abstracción genérica sobre cuatro entidades
 * con relaciones distintas.
 *
 * Diferencia con NC/ND: la guía NO exige un documento sustento autorizado — el traslado de
 * mercadería es válido con o sin factura asociada (ej. traslado entre bodegas, muestras,
 * consignación). Si existe una factura AUTORIZADA para el envío, se incluye como referencia.
 */
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { logger } from '../../lib/logger';
import { getNextDocumentNumber } from '../../utils/sequence.helper';
import { logFieldChange } from '../chatter.service';
import { buildClaveAcceso, randomCodigoNumerico } from './engines/clave-acceso.engine';
import { buildGuiaRemisionXml } from './engines/guia-remision-xml.engine';
import { buildGuiaRemisionInput } from './engines/shipment-to-guia.engine';
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

async function logTransmission(companyId: string, deliveryGuideId: string, data: {
  operacion: 'RECEPCION' | 'AUTORIZACION'; claveAcceso: string; resultado: string; mensajes?: SriMensaje[]; rawResponse?: string;
}) {
  await prisma.sriTransmission.create({
    data: { companyId, deliveryGuideId, operacion: data.operacion, claveAcceso: data.claveAcceso, resultado: data.resultado, mensajes: data.mensajes as any, rawResponse: data.rawResponse },
  });
}

async function setEstado(companyId: string, deliveryGuideId: string, userId: string | undefined, from: string, to: SriEstado, extra: Record<string, unknown> = {}) {
  await prisma.deliveryGuide.update({ where: { id: deliveryGuideId }, data: { sriEstado: to, sriUltimoIntento: new Date(), ...extra } as any });
  if (userId) await logFieldChange(companyId, userId, 'DELIVERY_GUIDE', deliveryGuideId, 'SRI_ESTADO', from, to);
}

export async function emitDeliveryGuide(
  companyId: string, deliveryGuideId: string, opts: { establishmentId: string; emissionPointId: string }, userId?: string,
): Promise<EmitResult> {
  const { guide, forSri, customer, invoiceSustento } = await loadDeliveryGuideForSri(companyId, deliveryGuideId);
  if (!REEMITIBLES.includes(guide.sriEstado as SriEstado)) {
    throw AppError.badRequest(
      guide.sriEstado === 'AUTORIZADA' ? 'Esta guía de remisión ya está AUTORIZADA por el SRI' : `La guía ya fue enviada (${guide.sriEstado}); consulta la autorización en vez de re-emitir`,
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
  const secuencial = await prisma.$transaction((tx) => getNextDocumentNumber(tx, companyId, `SRI_GUIA_${estab}_${ptoEmi}`, '', 9));
  const claveAcceso = buildClaveAcceso({
    fechaEmision: new Date(), tipoComprobante: 'GUIA_REMISION', ruc: config.ruc, ambiente,
    estab, ptoEmi, secuencial, codigoNumerico: randomCodigoNumerico(), tipoEmision: config.tipoEmision as any,
  });

  const guiaInput = (() => {
    try {
      return buildGuiaRemisionInput({
        shipment: forSri, customer, invoiceSustento,
        emisor: {
          ruc: config.ruc, razonSocial: config.razonSocial, nombreComercial: config.nombreComercial,
          dirMatriz: point.establishment.address, dirEstablecimiento: point.establishment.address,
          obligadoContabilidad: config.obligadoContabilidad, contribuyenteEspecial: config.contribuyenteEspecial,
        },
        ambiente, claveAcceso, estab, ptoEmi, secuencial,
      });
    } catch (e: any) {
      throw AppError.badRequest(e?.message ?? 'No se pudo armar la guía de remisión', 'SRI_INVALID_GUIA_DATA');
    }
  })();

  let xmlFirmado: string;
  try {
    xmlFirmado = signComprobante('GUIA_REMISION', buildGuiaRemisionXml(guiaInput), cert.fileBuffer, cert.password);
  } catch (e) {
    throw AppError.badRequest(describeSigningError(e), 'SIGNING_FAILED');
  }

  await setEstado(companyId, deliveryGuideId, userId, guide.sriEstado, 'ENVIADA', {
    sriAmbiente: ambiente, establishmentId: point.establishment.id, emissionPointId: point.id,
    sriSecuencial: secuencial, claveAcceso, xmlFirmado, numeroAutorizacion: null, fechaAutorizacion: null, xmlAutorizado: null, sriMensajes: null,
  });

  const rawRecepcion = await soap.sendRecepcion(ambiente, buildRecepcionEnvelope(xmlFirmado));
  let recepcion;
  try {
    recepcion = parseRecepcionResponse(rawRecepcion);
  } catch (e: any) {
    await logTransmission(companyId, deliveryGuideId, { operacion: 'RECEPCION', claveAcceso, resultado: 'ERROR_RED', rawResponse: rawRecepcion });
    throw AppError.badRequest(e?.message ?? 'Respuesta del SRI no reconocida', 'SRI_BAD_RESPONSE');
  }
  await logTransmission(companyId, deliveryGuideId, { operacion: 'RECEPCION', claveAcceso, resultado: recepcion.estado, mensajes: recepcion.mensajes, rawResponse: rawRecepcion });

  const yaRegistrada = recepcion.mensajes.some((m) => m.identificador === SRI_CLAVE_YA_REGISTRADA);
  if (recepcion.estado === 'DEVUELTA' && !yaRegistrada) {
    await setEstado(companyId, deliveryGuideId, userId, 'ENVIADA', 'DEVUELTA', { sriMensajes: recepcion.mensajes as any });
    return { sriEstado: 'DEVUELTA', claveAcceso, mensajes: recepcion.mensajes };
  }
  await setEstado(companyId, deliveryGuideId, userId, 'ENVIADA', 'RECIBIDA', { sriMensajes: recepcion.mensajes as any });

  return pollAuthorization(companyId, deliveryGuideId, claveAcceso, ambiente, userId, 'RECIBIDA');
}

async function loadDeliveryGuideForSri(companyId: string, deliveryGuideId: string) {
  const guide = await prisma.deliveryGuide.findFirst({
    where: { id: deliveryGuideId, companyId },
    include: { items: true, shipment: true },
  });
  if (!guide) throw AppError.notFound('Guía de remisión no encontrada');
  if (guide.status === 'CANCELLED') throw AppError.badRequest('La guía de remisión está anulada', 'DELIVERY_GUIDE_CANCELLED');
  if (guide.shipment.orderType !== 'SALES') throw AppError.badRequest('Solo se emiten electrónicamente guías de envíos de VENTA', 'NOT_SALES_SHIPMENT');

  const order = await prisma.salesOrder.findFirst({ where: { id: guide.shipment.orderId, companyId }, include: { customer: true } });
  if (!order?.customer) throw AppError.badRequest('El pedido del envío no tiene cliente', 'SHIPMENT_WITHOUT_CUSTOMER');

  const relatedInvoice = await prisma.invoice.findFirst({
    where: { companyId, shipmentId: guide.shipmentId, sriEstado: 'AUTORIZADA' },
    include: { establishment: true, emissionPoint: true },
  });
  const invoiceSustento = relatedInvoice && relatedInvoice.establishment && relatedInvoice.emissionPoint && relatedInvoice.sriSecuencial && relatedInvoice.numeroAutorizacion
    ? {
      estab: relatedInvoice.establishment.code, ptoEmi: relatedInvoice.emissionPoint.code, sriSecuencial: relatedInvoice.sriSecuencial,
      numeroAutorizacion: relatedInvoice.numeroAutorizacion, issueDate: relatedInvoice.issueDate,
    }
    : null;

  const c = order.customer;
  return {
    guide,
    forSri: {
      motivoTraslado: guide.motivoTraslado,
      dirPartida: guide.dirPartida,
      fechaIniTransporte: guide.fechaIniTransporte,
      fechaFinTransporte: guide.fechaFinTransporte,
      transportista: {
        razonSocial: guide.transportistaRazonSocial,
        tipoIdentificacion: guide.transportistaTipoIdentificacion as 'RUC' | 'CEDULA' | 'PASAPORTE',
        identificacion: guide.transportistaIdentificacion,
        placa: guide.placa,
      },
      items: guide.items.map((it) => ({ description: it.description, quantity: Number(it.quantity) })),
    },
    customer: { name: c.name, razonSocial: c.razonSocial, ruc: c.ruc, documentType: c.documentType, address: c.address, email: c.email },
    invoiceSustento,
  };
}

async function pollAuthorization(
  companyId: string, deliveryGuideId: string, claveAcceso: string, ambiente: 'PRUEBAS' | 'PRODUCCION', userId: string | undefined, fromEstado: string,
): Promise<EmitResult> {
  let last: EmitResult = { sriEstado: 'RECIBIDA', claveAcceso, mensajes: [] };
  for (let attempt = 1; attempt <= AUTH_POLL_ATTEMPTS; attempt++) {
    const raw = await soap.sendAutorizacion(ambiente, buildAutorizacionEnvelope(claveAcceso));
    let aut;
    try {
      aut = parseAutorizacionResponse(raw);
    } catch (e: any) {
      await logTransmission(companyId, deliveryGuideId, { operacion: 'AUTORIZACION', claveAcceso, resultado: 'ERROR_RED', rawResponse: raw });
      throw AppError.badRequest(e?.message ?? 'Respuesta del SRI no reconocida', 'SRI_BAD_RESPONSE');
    }
    await logTransmission(companyId, deliveryGuideId, { operacion: 'AUTORIZACION', claveAcceso, resultado: aut.estado, mensajes: aut.mensajes, rawResponse: raw });

    if (aut.estado === 'AUTORIZADO') {
      await setEstado(companyId, deliveryGuideId, userId, fromEstado, 'AUTORIZADA', {
        numeroAutorizacion: aut.numeroAutorizacion ?? claveAcceso, fechaAutorizacion: aut.fechaAutorizacion ?? new Date(),
        xmlAutorizado: aut.comprobante ?? null, sriMensajes: aut.mensajes as any,
      });
      return { sriEstado: 'AUTORIZADA', claveAcceso, numeroAutorizacion: aut.numeroAutorizacion ?? claveAcceso, mensajes: aut.mensajes };
    }
    if (aut.estado === 'NO AUTORIZADO') {
      await setEstado(companyId, deliveryGuideId, userId, fromEstado, 'RECHAZADA', { sriMensajes: aut.mensajes as any });
      return { sriEstado: 'RECHAZADA', claveAcceso, mensajes: aut.mensajes };
    }
    last = { sriEstado: 'RECIBIDA', claveAcceso, mensajes: aut.mensajes };
    if (attempt < AUTH_POLL_ATTEMPTS) await sleep(AUTH_POLL_DELAY_MS);
  }
  logger.info('[sri-guia] autorización aún en proceso, se podrá consultar después', { companyId, deliveryGuideId, claveAcceso });
  return last;
}

export async function checkDeliveryGuideAuthorization(companyId: string, deliveryGuideId: string, userId?: string): Promise<EmitResult> {
  const guide = await prisma.deliveryGuide.findFirst({ where: { id: deliveryGuideId, companyId } });
  if (!guide) throw AppError.notFound('Guía de remisión no encontrada');
  if (!guide.claveAcceso || !guide.sriAmbiente) throw AppError.badRequest('La guía aún no se ha enviado al SRI', 'SRI_NOT_SENT');
  if (guide.sriEstado === 'AUTORIZADA') return { sriEstado: 'AUTORIZADA', claveAcceso: guide.claveAcceso, numeroAutorizacion: guide.numeroAutorizacion, mensajes: [] };
  return pollAuthorization(companyId, deliveryGuideId, guide.claveAcceso, guide.sriAmbiente as any, userId, guide.sriEstado);
}

export async function getDeliveryGuideSriStatus(companyId: string, deliveryGuideId: string) {
  const guide = await prisma.deliveryGuide.findFirst({
    where: { id: deliveryGuideId, companyId },
    select: {
      id: true, number: true, sriEstado: true, sriAmbiente: true, sriSecuencial: true, claveAcceso: true,
      numeroAutorizacion: true, fechaAutorizacion: true, sriMensajes: true, sriUltimoIntento: true,
      establishment: { select: { code: true, name: true } }, emissionPoint: { select: { code: true, name: true } },
    },
  });
  if (!guide) throw AppError.notFound('Guía de remisión no encontrada');
  const transmissions = await prisma.sriTransmission.findMany({
    where: { companyId, deliveryGuideId },
    select: { id: true, operacion: true, claveAcceso: true, resultado: true, mensajes: true, createdAt: true },
    orderBy: { createdAt: 'desc' }, take: 20,
  });
  return { ...guide, transmissions };
}

export async function getDeliveryGuideSriXml(companyId: string, deliveryGuideId: string): Promise<{ filename: string; xml: string }> {
  const guide = await prisma.deliveryGuide.findFirst({ where: { id: deliveryGuideId, companyId }, select: { number: true, claveAcceso: true, xmlFirmado: true, xmlAutorizado: true } });
  if (!guide) throw AppError.notFound('Guía de remisión no encontrada');
  const xml = guide.xmlAutorizado || guide.xmlFirmado;
  if (!xml) throw AppError.badRequest('La guía de remisión aún no tiene XML generado', 'SRI_NO_XML');
  return { filename: `${guide.claveAcceso ?? guide.number}.xml`, xml };
}

export { SRI_ESTADOS };
