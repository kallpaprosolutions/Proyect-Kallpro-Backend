import { z } from 'zod';
import { AuthRequest } from '../types/index';
import * as svc from '../services/logistics.service';
import * as webhookSvc from '../services/logistics-webhook.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

export const getKpis = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await svc.getLogisticsKpis(req.user!.companyId));
});

export const getWebhookInfo = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await webhookSvc.getWebhookInfo(req.user!.companyId));
});

export const rotateWebhookToken = asyncHandler(async (req: AuthRequest, res) => {
  await webhookSvc.rotateWebhookToken(req.user!.companyId);
  res.json(await webhookSvc.getWebhookInfo(req.user!.companyId));
});

export const list = asyncHandler(async (req: AuthRequest, res) => {
  const { orderType, status, q } = req.query as Record<string, string | undefined>;
  res.json(await svc.listShipments(req.user!.companyId, { orderType, status, q }));
});

export const getOne = asyncHandler(async (req: AuthRequest, res) => {
  const s = await svc.getShipment(req.user!.companyId, req.params.id);
  if (!s) throw AppError.notFound('Envío no encontrado', 'SHIPMENT_NOT_FOUND');
  res.json(s);
});

export const byOrder = asyncHandler(async (req: AuthRequest, res) => {
  const { orderType, orderId } = req.params;
  const s = await svc.getShipmentByOrder(req.user!.companyId, orderType.toUpperCase(), orderId);
  res.json(s); // null si no hay envío (el frontend muestra CTA "Crear guía")
});

export const track = asyncHandler(async (req: AuthRequest, res) => {
  const s = await svc.trackByNumber(req.user!.companyId, req.params.trackingNumber);
  if (!s) throw AppError.notFound('Guía no encontrada', 'SHIPMENT_NOT_FOUND');
  res.json(s);
});

export const create = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    orderType: z.enum(['SALES', 'PURCHASE']),
    orderId: z.string().min(1),
    carrier: z.string().optional(),
    carrierGuide: z.string().optional(),
    destAddress: z.string().optional(),
    recipientName: z.string().optional(),
    recipientPhone: z.string().optional(),
    estimatedDelivery: z.string().optional(),
    freightCost: z.number().min(0).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const s = await svc.createShipment(req.user!.companyId, {
      ...parsed.data,
      estimatedDelivery: parsed.data.estimatedDelivery ? new Date(parsed.data.estimatedDelivery) : undefined,
      createdBy: req.user!.userId,
    });
    res.status(201).json(s);
  } catch (e: any) {
    if (e?.message === 'ORDER_NOT_FOUND') throw AppError.notFound('Orden no encontrada', 'ORDER_NOT_FOUND');
    if (e?.message === 'SHIPMENT_ALREADY_ACTIVE') throw AppError.conflict('La orden ya tiene un envío activo', 'SHIPMENT_ALREADY_ACTIVE');
    throw e;
  }
});

export const addEvent = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    status: z.string().min(1),
    location: z.string().optional(),
    notes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR');
  try {
    res.json(await svc.addShipmentEvent(req.user!.companyId, req.params.id, { ...parsed.data, createdBy: req.user!.userId }));
  } catch (e: any) {
    if (e?.message === 'SHIPMENT_NOT_FOUND') throw AppError.notFound('Envío no encontrado', 'SHIPMENT_NOT_FOUND');
    if (e?.message?.startsWith('INVALID_TRANSITION')) {
      throw AppError.badRequest(`Transición de estado no válida (${e.message.split(':')[1]})`, 'INVALID_TRANSITION', e.message);
    }
    throw e;
  }
});
