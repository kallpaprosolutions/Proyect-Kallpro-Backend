/**
 * Logística — envíos con tracking manual estilo courier (Servientrega/Tramaco/DHL).
 * Cubre pedidos de venta (SALES) y entregas de OC entrantes (PURCHASE).
 * MVP: eventos registrados manualmente; el modelo queda listo para webhooks de carriers.
 */
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { invoiceSalesOrder, recalculateOrderStatus } from './sales.service';
export const SHIPMENT_STATUSES = [
  'PENDING', 'PICKED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED',
] as const;
export type ShipmentStatus = typeof SHIPMENT_STATUSES[number];

/** Transiciones válidas del tracking (FAILED puede reintentarse volviendo a tránsito) */
export const NEXT_STATUSES: Record<string, ShipmentStatus[]> = {
  PENDING: ['PICKED', 'DISPATCHED', 'FAILED'],
  PICKED: ['DISPATCHED', 'FAILED'],
  DISPATCHED: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'],
  IN_TRANSIT: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'], // múltiples checkpoints de tránsito
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: ['IN_TRANSIT', 'OUT_FOR_DELIVERY'],
};

function genTrackingNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `KP-${s}`;
}

/** Datos de la orden vinculada para mostrar junto al envío */
async function orderInfo(companyId: string, orderType: string, orderId: string) {
  if (orderType === 'SALES') {
    const o = await prisma.salesOrder.findFirst({
      where: { id: orderId, companyId },
      select: { id: true, orderNumber: true, status: true, deliveryAddress: true, customer: { select: { name: true, razonSocial: true, phone: true } } },
    });
    if (!o) return null;
    return { number: o.orderNumber, status: o.status, party: o.customer?.razonSocial || o.customer?.name || null, phone: o.customer?.phone ?? null, address: o.deliveryAddress ?? null, url: `/sales/orders/${o.id}` };
  }
  const o = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, companyId },
    select: { id: true, poNumber: true, status: true, supplier: { select: { name: true, razonSocial: true, phone: true } } },
  });
  if (!o) return null;
  return { number: o.poNumber, status: o.status, party: o.supplier?.razonSocial || o.supplier?.name || null, phone: o.supplier?.phone ?? null, address: null, url: `/purchases/${o.id}` };
}

export async function createShipment(companyId: string, data: {
  orderType: 'SALES' | 'PURCHASE';
  orderId: string;
  carrier?: string;
  carrierGuide?: string;
  destAddress?: string;
  recipientName?: string;
  recipientPhone?: string;
  estimatedDelivery?: Date;
  freightCost?: number;
  createdBy?: string;
}) {
  const info = await orderInfo(companyId, data.orderType, data.orderId);
  if (!info) throw new Error('ORDER_NOT_FOUND');

  const existing = await prisma.shipment.findFirst({ where: { companyId, orderType: data.orderType, orderId: data.orderId, status: { notIn: ['DELIVERED', 'FAILED'] } } });
  if (existing) throw new Error('SHIPMENT_ALREADY_ACTIVE');

  return prisma.shipment.create({
    data: {
      companyId,
      orderType: data.orderType,
      orderId: data.orderId,
      trackingNumber: genTrackingNumber(),
      carrier: data.carrier || null,
      carrierGuide: data.carrierGuide || null,
      destAddress: data.destAddress ?? info.address,
      recipientName: data.recipientName ?? info.party,
      recipientPhone: data.recipientPhone ?? info.phone,
      estimatedDelivery: data.estimatedDelivery,
      freightCost: data.freightCost ?? 0,
      createdBy: data.createdBy,
      events: { create: { status: 'PENDING', notes: 'Guía de envío creada', createdBy: data.createdBy } },
    },
    include: { events: true },
  });
}

export async function listShipments(companyId: string, filters: { orderType?: string; status?: string; q?: string } = {}) {
  const shipments = await prisma.shipment.findMany({
    where: {
      companyId,
      ...(filters.orderType ? { orderType: filters.orderType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q ? {
        OR: [
          { trackingNumber: { contains: filters.q, mode: 'insensitive' } },
          { carrierGuide: { contains: filters.q, mode: 'insensitive' } },
          { recipientName: { contains: filters.q, mode: 'insensitive' } },
        ],
      } : {}),
    },
    include: { events: { orderBy: { eventTime: 'desc' }, take: 1 } },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });

  return Promise.all(shipments.map(async (s) => ({
    ...s,
    lastEvent: s.events[0] ?? null,
    order: await orderInfo(companyId, s.orderType, s.orderId),
  })));
}

export async function getShipment(companyId: string, id: string) {
  const s = await prisma.shipment.findFirst({
    where: { id, companyId },
    include: { events: { orderBy: { eventTime: 'desc' } } },
  });
  if (!s) return null;
  return { ...s, order: await orderInfo(companyId, s.orderType, s.orderId), nextStatuses: NEXT_STATUSES[s.status] ?? [] };
}

export async function getShipmentByOrder(companyId: string, orderType: string, orderId: string) {
  const s = await prisma.shipment.findFirst({
    where: { companyId, orderType, orderId },
    include: { events: { orderBy: { eventTime: 'desc' } } },
    orderBy: { createdAt: 'desc' },
  });
  if (!s) return null;
  return { ...s, nextStatuses: NEXT_STATUSES[s.status] ?? [] };
}

export async function trackByNumber(companyId: string, trackingNumber: string) {
  const s = await prisma.shipment.findFirst({
    where: { companyId, OR: [{ trackingNumber }, { carrierGuide: trackingNumber }] },
    include: { events: { orderBy: { eventTime: 'desc' } } },
  });
  if (!s) return null;
  return { ...s, order: await orderInfo(companyId, s.orderType, s.orderId), nextStatuses: NEXT_STATUSES[s.status] ?? [] };
}

export async function addShipmentEvent(companyId: string, shipmentId: string, data: {
  status: string; location?: string; notes?: string; createdBy?: string;
}) {
  const shipment = await prisma.shipment.findFirst({ where: { id: shipmentId, companyId } });
  if (!shipment) throw new Error('SHIPMENT_NOT_FOUND');

  const allowed = NEXT_STATUSES[shipment.status] ?? [];
  if (!allowed.includes(data.status as ShipmentStatus)) {
    throw new Error(`INVALID_TRANSITION:${shipment.status}->${data.status}`);
  }

  const [, updated] = await prisma.$transaction([
    prisma.shipmentEvent.create({
      data: { shipmentId, status: data.status, location: data.location, notes: data.notes, createdBy: data.createdBy },
    }),
    prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: data.status,
        ...(data.status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      },
    }),
  ]);

  // Envío fallido de un pedido de venta → actividad "REVISAR" para quien creó el pedido (o el
  // envío), vencimiento hoy: el mismo widget "Mis actividades" del Inicio la muestra en rojo,
  // sin depender de que alguien revise la lista de envíos. No bloqueante.
  if (data.status === 'FAILED' && shipment.orderType === 'SALES') {
    try {
      const order = await prisma.salesOrder.findFirst({ where: { id: shipment.orderId, companyId }, select: { orderNumber: true, createdBy: true, customer: { select: { name: true } } } });
      const assigneeId = [order?.createdBy, shipment.createdBy, data.createdBy].find((u) => u && !u.startsWith('webhook:'));
      if (order && assigneeId) {
        const { createActivity } = await import('./activity.service');
        await createActivity(companyId, assigneeId, {
          entityType: 'SALES_ORDER', entityId: shipment.orderId, type: 'REVISAR', dueDate: new Date(),
          note: `Envío ${shipment.trackingNumber} del pedido ${order.orderNumber} (${order.customer?.name ?? 'cliente'}) marcado FALLIDO${data.notes ? `: ${data.notes}` : ''}. Contactar al cliente y reprogramar.`,
        });
      }
    } catch (e) {
      logger.warn('[logistics] alerta de envío fallido no creada (non-fatal)', { err: e });
    }
  }

  // Entregado un pedido de venta → el pedido pasa a DELIVERED y se EMITE la factura.
  if (data.status === 'DELIVERED' && shipment.orderType === 'SALES') {
    await prisma.salesOrder.updateMany({
      where: { id: shipment.orderId, companyId, status: { in: ['DISPATCHED', 'INVOICED'] } },
      data: { status: 'DELIVERED' },
    });
    // Facturación POR ENVÍO al entregar (idempotente por shipmentId, no-bloqueante)
    try {
      await invoiceSalesOrder(companyId, shipment.id, data.createdBy ?? undefined);
    } catch (e) {
      logger.warn('[logistics] invoiceSalesOrder failed (non-fatal)', { err: e });
    }
    // Sincronizar el estado global del pedido (cubre el caso sin ítems por facturar)
    try { await recalculateOrderStatus(shipment.orderId, companyId, data.createdBy ?? undefined); }
    catch (e) { logger.warn('[logistics] recalculateOrderStatus failed (non-fatal)', { err: e }); }
  }

  return getShipment(companyId, updated.id);
}

export async function getLogisticsKpis(companyId: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [inTransit, pending, deliveredToday, failed, freight] = await Promise.all([
    prisma.shipment.count({ where: { companyId, status: { in: ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] } } }),
    prisma.shipment.count({ where: { companyId, status: { in: ['PENDING', 'PICKED'] } } }),
    prisma.shipment.count({ where: { companyId, status: 'DELIVERED', deliveredAt: { gte: today } } }),
    prisma.shipment.count({ where: { companyId, status: 'FAILED' } }),
    prisma.shipment.aggregate({ where: { companyId, createdAt: { gte: monthStart } }, _sum: { freightCost: true }, _count: { _all: true } }),
  ]);
  const freightMonth = Number(freight._sum.freightCost ?? 0);
  return { inTransit, pending, deliveredToday, failed, freightMonth, avgFreight: freight._count._all ? Math.round((freightMonth / freight._count._all) * 100) / 100 : 0 };
}
