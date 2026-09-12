/**
 * Etapa 3 del plan SRI: emisión REAL de facturas de venta ante el SRI.
 *   emitInvoice:        arma XML → firma → RECEPCIÓN → (si RECIBIDA) AUTORIZACIÓN
 *   checkAuthorization: vuelve a consultar la autorización de una clave ya enviada
 *
 * Decisiones (ver plan-contabilidad-tributaria-sri.md §1.3):
 * - El asiento contable NO se toca aquí: se sigue posteando al crear la FAC-V- (la salida de
 *   inventario/COGS ya ocurrió físicamente al despachar, y una DEVUELTA/RECHAZADA del SRI es
 *   casi siempre técnica y se resuelve re-emitiendo con secuencial nuevo, no anulando la venta).
 * - Una factura AUTORIZADA es inmutable ante el SRI: no se re-emite (regla 5); solo NC/ND.
 * - Cada ida y vuelta queda en `SriTransmission` (regla 4) y cada cambio de `sriEstado` en el
 *   Chatter, con el mismo `logFieldChange` del resto de transiciones del ERP.
 */
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { logger } from '../../lib/logger';
import { getNextDocumentNumber } from '../../utils/sequence.helper';
import { logFieldChange } from '../chatter.service';
import { buildClaveAcceso, randomCodigoNumerico } from './engines/clave-acceso.engine';
import { buildFacturaXml } from './engines/factura-xml.engine';
import { buildFacturaInput, InvoiceForSri } from './engines/invoice-to-factura.engine';
import { signComprobante, describeSigningError } from './engines/xml-signer.engine';
import {
  buildRecepcionEnvelope, buildAutorizacionEnvelope, parseRecepcionResponse, parseAutorizacionResponse,
  SriMensaje, SRI_CLAVE_YA_REGISTRADA,
} from './engines/sri-soap.engine';
import * as soap from './sri-soap-client';
import { getActiveCertificateForSigning } from './fiscal-config.service';

export const SRI_ESTADOS = ['NO_ENVIADA', 'ENVIADA', 'RECIBIDA', 'AUTORIZADA', 'DEVUELTA', 'RECHAZADA'] as const;
export type SriEstado = (typeof SRI_ESTADOS)[number];

/** Estados desde los que se puede (re)emitir con un secuencial nuevo. */
const REEMITIBLES: SriEstado[] = ['NO_ENVIADA', 'DEVUELTA', 'RECHAZADA'];

const AUTH_POLL_ATTEMPTS = 3;
const AUTH_POLL_DELAY_MS = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function logTransmission(companyId: string, invoiceId: string, data: {
  operacion: 'RECEPCION' | 'AUTORIZACION'; claveAcceso: string; resultado: string; mensajes?: SriMensaje[]; rawResponse?: string;
}) {
  await prisma.sriTransmission.create({
    data: { companyId, invoiceId, operacion: data.operacion, claveAcceso: data.claveAcceso, resultado: data.resultado, mensajes: data.mensajes as any, rawResponse: data.rawResponse },
  });
}

async function setEstado(companyId: string, invoiceId: string, userId: string | undefined, from: string, to: SriEstado, extra: Record<string, unknown> = {}) {
  await prisma.invoice.update({ where: { id: invoiceId }, data: { sriEstado: to, sriUltimoIntento: new Date(), ...extra } as any });
  if (userId) await logFieldChange(companyId, userId, 'INVOICE', invoiceId, 'SRI_ESTADO', from, to);
}

/** Carga la factura con todo lo que el XML necesita (cliente y líneas con IVA vía envío → pedido).
 * Exportada también para `ats.service.ts` (Etapa 7): son las mismas líneas con tarifa de IVA
 * real que usa la emisión electrónica, reutilizadas para el desglose exacto del ATS sin
 * reparsear el XML firmado ni duplicar la lógica de mapeo envío→pedido. */
export async function loadInvoiceForSri(companyId: string, invoiceId: string): Promise<{ invoice: any; forSri: InvoiceForSri }> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    include: { items: true, salesOrder: { include: { customer: true, items: { include: { product: true } } } } },
  });
  if (!invoice) throw AppError.notFound('Factura no encontrada');
  if (invoice.type !== 'SALES') throw AppError.badRequest('Solo se emiten electrónicamente facturas de VENTA', 'NOT_SALES_INVOICE');
  if (invoice.status === 'CANCELLED') throw AppError.badRequest('La factura está cancelada', 'INVOICE_CANCELLED');
  if (!invoice.salesOrder) {
    throw AppError.badRequest('Solo se emiten electrónicamente facturas generadas desde un pedido de venta (tienen cliente e IVA por línea)', 'INVOICE_WITHOUT_ORDER');
  }

  // Líneas: si la factura nació de un envío, sus cantidades exactas están en ShipmentItem;
  // si no, se toman las del pedido. En ambos casos la tarifa/descuento vienen del pedido.
  let lines: InvoiceForSri['lines'];
  const shipmentItems = invoice.shipmentId
    ? await prisma.shipmentItem.findMany({ where: { shipmentId: invoice.shipmentId } })
    : [];
  if (shipmentItems.length > 0) {
    lines = shipmentItems.map((si) => {
      const oi = invoice.salesOrder!.items.find((x) => x.id === si.salesOrderItemId);
      if (!oi) throw AppError.badRequest('Línea de envío sin línea de pedido asociada', 'SHIPMENT_ITEM_ORPHAN');
      return {
        sku: oi.product?.sku, description: oi.description || oi.product.name,
        quantity: Number(si.quantity), unitPrice: Number(oi.unitPrice), discountPct: Number(oi.discount), taxRate: Number(oi.taxRate),
      };
    });
  } else {
    lines = invoice.salesOrder.items.map((oi) => ({
      sku: oi.product?.sku, description: oi.description || oi.product.name,
      quantity: Number(oi.quantity), unitPrice: Number(oi.unitPrice), discountPct: Number(oi.discount), taxRate: Number(oi.taxRate),
    }));
  }

  const c = invoice.salesOrder.customer;
  return {
    invoice,
    forSri: {
      number: invoice.number,
      issueDate: invoice.issueDate,
      totalAmount: Number(invoice.totalAmount),
      customer: { name: c.name, razonSocial: c.razonSocial, ruc: c.ruc, documentType: c.documentType, address: c.address, email: c.email },
      lines,
    },
  };
}

export interface EmitResult {
  sriEstado: SriEstado;
  claveAcceso: string;
  numeroAutorizacion?: string | null;
  mensajes: SriMensaje[];
}

export async function emitInvoice(
  companyId: string,
  invoiceId: string,
  opts: { establishmentId: string; emissionPointId: string },
  userId?: string,
): Promise<EmitResult> {
  const { invoice, forSri } = await loadInvoiceForSri(companyId, invoiceId);
  if (!REEMITIBLES.includes(invoice.sriEstado as SriEstado)) {
    throw AppError.badRequest(
      invoice.sriEstado === 'AUTORIZADA'
        ? 'Esta factura ya está AUTORIZADA por el SRI y no puede re-emitirse (usa una nota de crédito)'
        : `La factura ya fue enviada (${invoice.sriEstado}); consulta la autorización en vez de re-emitir`,
      'SRI_NOT_REEMITTABLE',
    );
  }

  const config = await prisma.companyFiscalConfig.findUnique({ where: { companyId } });
  if (!config) throw AppError.badRequest('Configura primero los datos fiscales de la empresa (Contabilidad → Facturación Electrónica)', 'FISCAL_CONFIG_MISSING');
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

  // Secuencial real por punto de emisión (contador distinto al de la prueba de firma de Etapa 2).
  const secuencial = await prisma.$transaction((tx) => getNextDocumentNumber(tx, companyId, `SRI_FACTURA_${estab}_${ptoEmi}`, '', 9));
  const claveAcceso = buildClaveAcceso({
    fechaEmision: invoice.issueDate, tipoComprobante: 'FACTURA', ruc: config.ruc, ambiente,
    estab, ptoEmi, secuencial, codigoNumerico: randomCodigoNumerico(), tipoEmision: config.tipoEmision as any,
  });

  const facturaInput = (() => {
    try {
      return buildFacturaInput({
        invoice: forSri,
        emisor: {
          ruc: config.ruc, razonSocial: config.razonSocial, nombreComercial: config.nombreComercial,
          dirMatriz: point.establishment.address, dirEstablecimiento: point.establishment.address,
          obligadoContabilidad: config.obligadoContabilidad, contribuyenteEspecial: config.contribuyenteEspecial,
        },
        ambiente, claveAcceso, estab, ptoEmi, secuencial,
      });
    } catch (e: any) {
      throw AppError.badRequest(e?.message ?? 'No se pudo armar el comprobante', 'SRI_INVALID_INVOICE_DATA');
    }
  })();

  let xmlFirmado: string;
  try {
    xmlFirmado = signComprobante('FACTURA', buildFacturaXml(facturaInput), cert.fileBuffer, cert.password);
  } catch (e) {
    throw AppError.badRequest(describeSigningError(e), 'SIGNING_FAILED');
  }

  // Se persiste ANTES de enviar: si la red falla después de que el SRI lo recibió, la clave y
  // el XML firmado sobreviven y se puede consultar la autorización sin volver a emitir.
  await setEstado(companyId, invoiceId, userId, invoice.sriEstado, 'ENVIADA', {
    sriAmbiente: ambiente, establishmentId: point.establishment.id, emissionPointId: point.id,
    sriSecuencial: secuencial, claveAcceso, xmlFirmado, numeroAutorizacion: null, fechaAutorizacion: null, xmlAutorizado: null, sriMensajes: null,
  });

  const rawRecepcion = await soap.sendRecepcion(ambiente, buildRecepcionEnvelope(xmlFirmado));
  let recepcion;
  try {
    recepcion = parseRecepcionResponse(rawRecepcion);
  } catch (e: any) {
    await logTransmission(companyId, invoiceId, { operacion: 'RECEPCION', claveAcceso, resultado: 'ERROR_RED', rawResponse: rawRecepcion });
    throw AppError.badRequest(e?.message ?? 'Respuesta del SRI no reconocida', 'SRI_BAD_RESPONSE');
  }
  await logTransmission(companyId, invoiceId, { operacion: 'RECEPCION', claveAcceso, resultado: recepcion.estado, mensajes: recepcion.mensajes, rawResponse: rawRecepcion });

  const yaRegistrada = recepcion.mensajes.some((m) => m.identificador === SRI_CLAVE_YA_REGISTRADA);
  if (recepcion.estado === 'DEVUELTA' && !yaRegistrada) {
    await setEstado(companyId, invoiceId, userId, 'ENVIADA', 'DEVUELTA', { sriMensajes: recepcion.mensajes as any });
    return { sriEstado: 'DEVUELTA', claveAcceso, mensajes: recepcion.mensajes };
  }
  await setEstado(companyId, invoiceId, userId, 'ENVIADA', 'RECIBIDA', { sriMensajes: recepcion.mensajes as any });

  return pollAuthorization(companyId, invoiceId, claveAcceso, ambiente, userId, 'RECIBIDA');
}

async function pollAuthorization(
  companyId: string, invoiceId: string, claveAcceso: string, ambiente: 'PRUEBAS' | 'PRODUCCION', userId: string | undefined, fromEstado: string,
): Promise<EmitResult> {
  let last: EmitResult = { sriEstado: 'RECIBIDA', claveAcceso, mensajes: [] };
  for (let attempt = 1; attempt <= AUTH_POLL_ATTEMPTS; attempt++) {
    const raw = await soap.sendAutorizacion(ambiente, buildAutorizacionEnvelope(claveAcceso));
    let aut;
    try {
      aut = parseAutorizacionResponse(raw);
    } catch (e: any) {
      await logTransmission(companyId, invoiceId, { operacion: 'AUTORIZACION', claveAcceso, resultado: 'ERROR_RED', rawResponse: raw });
      throw AppError.badRequest(e?.message ?? 'Respuesta del SRI no reconocida', 'SRI_BAD_RESPONSE');
    }
    await logTransmission(companyId, invoiceId, { operacion: 'AUTORIZACION', claveAcceso, resultado: aut.estado, mensajes: aut.mensajes, rawResponse: raw });

    if (aut.estado === 'AUTORIZADO') {
      await setEstado(companyId, invoiceId, userId, fromEstado, 'AUTORIZADA', {
        numeroAutorizacion: aut.numeroAutorizacion ?? claveAcceso, fechaAutorizacion: aut.fechaAutorizacion ?? new Date(),
        xmlAutorizado: aut.comprobante ?? null, sriMensajes: aut.mensajes as any,
      });
      return { sriEstado: 'AUTORIZADA', claveAcceso, numeroAutorizacion: aut.numeroAutorizacion ?? claveAcceso, mensajes: aut.mensajes };
    }
    if (aut.estado === 'NO AUTORIZADO') {
      await setEstado(companyId, invoiceId, userId, fromEstado, 'RECHAZADA', { sriMensajes: aut.mensajes as any });
      return { sriEstado: 'RECHAZADA', claveAcceso, mensajes: aut.mensajes };
    }
    last = { sriEstado: 'RECIBIDA', claveAcceso, mensajes: aut.mensajes };
    if (attempt < AUTH_POLL_ATTEMPTS) await sleep(AUTH_POLL_DELAY_MS);
  }
  logger.info('[sri] autorización aún en proceso, se podrá consultar después', { companyId, invoiceId, claveAcceso });
  return last;
}

export async function checkAuthorization(companyId: string, invoiceId: string, userId?: string): Promise<EmitResult> {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId } });
  if (!invoice) throw AppError.notFound('Factura no encontrada');
  if (!invoice.claveAcceso || !invoice.sriAmbiente) throw AppError.badRequest('La factura aún no se ha enviado al SRI', 'SRI_NOT_SENT');
  if (invoice.sriEstado === 'AUTORIZADA') {
    return { sriEstado: 'AUTORIZADA', claveAcceso: invoice.claveAcceso, numeroAutorizacion: invoice.numeroAutorizacion, mensajes: [] };
  }
  return pollAuthorization(companyId, invoiceId, invoice.claveAcceso, invoice.sriAmbiente as any, userId, invoice.sriEstado);
}

export async function getSriStatus(companyId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    select: {
      id: true, number: true, type: true, salesOrderId: true, sriEstado: true, sriAmbiente: true, sriSecuencial: true, claveAcceso: true,
      numeroAutorizacion: true, fechaAutorizacion: true, sriMensajes: true, sriUltimoIntento: true,
      establishment: { select: { code: true, name: true } }, emissionPoint: { select: { code: true, name: true } },
    },
  });
  if (!invoice) throw AppError.notFound('Factura no encontrada');
  const transmissions = await prisma.sriTransmission.findMany({
    where: { companyId, invoiceId },
    select: { id: true, operacion: true, claveAcceso: true, resultado: true, mensajes: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return { ...invoice, transmissions };
}

export async function getSriXml(companyId: string, invoiceId: string): Promise<{ filename: string; xml: string }> {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId }, select: { number: true, claveAcceso: true, xmlFirmado: true, xmlAutorizado: true } });
  if (!invoice) throw AppError.notFound('Factura no encontrada');
  const xml = invoice.xmlAutorizado || invoice.xmlFirmado;
  if (!xml) throw AppError.badRequest('La factura aún no tiene XML generado', 'SRI_NO_XML');
  return { filename: `${invoice.claveAcceso ?? invoice.number}.xml`, xml };
}
