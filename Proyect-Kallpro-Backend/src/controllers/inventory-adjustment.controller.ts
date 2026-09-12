import { z } from 'zod';
import { AuthRequest } from '../types/index';
import * as svc from '../services/inventory-adjustment.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

export const listAdjustments = asyncHandler(async (req: AuthRequest, res) => {
  const { status } = req.query as { status?: string };
  const items = await svc.listAdjustments(req.user!.companyId, status);
  res.json(items);
});

export const createAdjustment = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    productId: z.string().min(1),
    warehouseId: z.string().min(1),
    type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT']),
    quantity: z.number().positive(),
    unitCost: z.number().min(0).optional(),
    reason: z.string().min(3, 'Indica el motivo del ajuste'),
    notes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const item = await svc.createAdjustmentRequest(req.user!.companyId, parsed.data, req.user!.userId);
    res.status(201).json(item);
  } catch (e: any) {
    if (e?.message === 'PRODUCT_NOT_FOUND') throw AppError.notFound('Producto no encontrado', 'PRODUCT_NOT_FOUND');
    if (e?.message === 'WAREHOUSE_NOT_FOUND') throw AppError.notFound('Bodega no encontrada', 'WAREHOUSE_NOT_FOUND');
    throw e;
  }
});

export const approveAdjustment = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const item = await svc.approveAdjustment(
      req.params.id,
      req.user!.companyId,
      req.user!.userId,
      req.user!.role,
    );
    res.json(item);
  } catch (e: any) {
    switch (e?.message) {
      case 'ADJUSTMENT_NOT_FOUND': throw AppError.notFound('Ajuste no encontrado', 'ADJUSTMENT_NOT_FOUND');
      case 'NOT_PENDING': throw AppError.conflict('El ajuste ya fue procesado', 'NOT_PENDING');
      case 'SELF_APPROVAL': throw AppError.forbidden('No puedes aprobar un ajuste que tú mismo solicitaste. Requiere la firma de otra persona de finanzas o gerencia.', 'SELF_APPROVAL');
      case 'NOT_AUTHORIZED': throw AppError.forbidden('Tu rol no puede aprobar ajustes de inventario', 'NOT_AUTHORIZED');
      case 'INSUFFICIENT_STOCK': throw AppError.badRequest('Stock insuficiente para aplicar el ajuste de salida', 'INSUFFICIENT_STOCK');
      default: throw e;
    }
  }
});

export const rejectAdjustment = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({ reason: z.string().min(3, 'Indica el motivo del rechazo') });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Indica el motivo del rechazo', 'VALIDATION_ERROR');
  try {
    const item = await svc.rejectAdjustment(req.params.id, req.user!.companyId, req.user!.userId, parsed.data.reason);
    res.json(item);
  } catch (e: any) {
    switch (e?.message) {
      case 'ADJUSTMENT_NOT_FOUND': throw AppError.notFound('Ajuste no encontrado', 'ADJUSTMENT_NOT_FOUND');
      case 'NOT_PENDING': throw AppError.conflict('El ajuste ya fue procesado', 'NOT_PENDING');
      case 'SELF_APPROVAL': throw AppError.forbidden('No puedes rechazar un ajuste que tú mismo solicitaste.', 'SELF_APPROVAL');
      default: throw e;
    }
  }
});
