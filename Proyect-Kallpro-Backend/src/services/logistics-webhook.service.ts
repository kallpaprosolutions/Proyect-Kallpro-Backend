/**
 * Webhooks de couriers: el courier hace POST con el evento de tracking, se valida el token de
 * la empresa, se normaliza (engine puro) y se registra con la MISMA `addShipmentEvent` que
 * usa la captura manual — misma máquina de estados, misma facturación al entregar, misma
 * alerta al fallar. Cero lógica de logística duplicada.
 */
import { randomBytes, timingSafeEqual } from 'crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { AppError } from '../utils/errors';
import { getErpConfig, invalidateErpConfig } from './erp-config.service';
import { addShipmentEvent, NEXT_STATUSES } from './logistics.service';
import { normalizeCarrierEvent, isDuplicateEvent } from './engines/carrier-webhook.engine';

function tokensMatch(expected: string, received: string): boolean {
  if (!expected || !received || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export async function rotateWebhookToken(companyId: string): Promise<{ webhookToken: string }> {
  const webhookToken = randomBytes(24).toString('hex');
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { settings: true } });
  const settings = (company?.settings && typeof company.settings === 'object' ? company.settings : {}) as Record<string, any>;
  await prisma.company.update({
    where: { id: companyId },
    data: { settings: { ...settings, logistics: { ...(settings.logistics ?? {}), webhookToken } } },
  });
  invalidateErpConfig(companyId);
  return { webhookToken };
}

export async function getWebhookInfo(companyId: string) {
  const config = await getErpConfig(companyId);
  return {
    enabled: !!config.logistics.webhookToken,
    webhookToken: config.logistics.webhookToken,
    pathTemplate: `/api/logistics/webhooks/${companyId}/{courier}`,
    header: 'X-Webhook-Token',
  };
}

export interface WebhookOutcome {
  accepted: boolean;
  reason?: string;
  shipmentId?: string;
  trackingNumber?: string;
  status?: string;
}

export async function handleCarrierWebhook(companyId: string, carrier: string, token: string | undefined, payload: unknown): Promise<WebhookOutcome> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) throw AppError.notFound('Empresa no encontrada');
  const config = await getErpConfig(companyId);
  if (!config.logistics.webhookToken) throw AppError.forbidden('Webhooks de courier deshabilitados para esta empresa', 'WEBHOOK_DISABLED');
  if (!tokensMatch(config.logistics.webhookToken, token ?? '')) throw AppError.forbidden('Token de webhook inválido', 'WEBHOOK_BAD_TOKEN');

  const normalized = normalizeCarrierEvent(payload);
  if ('error' in normalized) {
    logger.warn('[logistics-webhook] evento no reconocido', { companyId, carrier, error: normalized.error });
    return { accepted: false, reason: normalized.error };
  }

  const shipment = await prisma.shipment.findFirst({
    where: { companyId, OR: [{ carrierGuide: normalized.reference }, { trackingNumber: normalized.reference }] },
    select: { id: true, status: true, trackingNumber: true },
  });
  if (!shipment) return { accepted: false, reason: `No existe un envío con la guía ${normalized.reference}` };
  if (isDuplicateEvent(shipment.status, normalized.status)) {
    return { accepted: true, shipmentId: shipment.id, trackingNumber: shipment.trackingNumber, status: shipment.status, reason: 'Evento repetido, sin cambios' };
  }
  const allowed = NEXT_STATUSES[shipment.status] ?? [];
  if (!allowed.includes(normalized.status)) {
    return { accepted: false, shipmentId: shipment.id, trackingNumber: shipment.trackingNumber, status: shipment.status, reason: `Transición no válida ${shipment.status} → ${normalized.status}` };
  }

  const notes = [normalized.notes, `Courier ${carrier.toUpperCase()}: "${normalized.rawStatus}"`, normalized.eventTime ? `hora courier ${normalized.eventTime.toISOString()}` : null]
    .filter(Boolean).join(' · ');
  const updated = await addShipmentEvent(companyId, shipment.id, {
    status: normalized.status, location: normalized.location, notes, createdBy: `webhook:${carrier.toLowerCase()}`,
  });
  return { accepted: true, shipmentId: shipment.id, trackingNumber: shipment.trackingNumber, status: updated?.status };
}
