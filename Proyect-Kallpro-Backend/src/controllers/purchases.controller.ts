import { z } from 'zod';
import { AuthRequest } from '../types/index';
import * as svc from '../services/purchases.service';
import { getProcurementPipeline } from '../services/procurement-pipeline.service';
import { KycSchema, validateKyc, toPrismaPayload } from '../schemas/uafe-kyc.schema';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

// PIPELINE (Hub de Compras Guiado)
export const getPipeline = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await getProcurementPipeline(req.user!.companyId));
});

// PROVEEDORES
export const listSuppliers = asyncHandler(async (req: AuthRequest, res) => {
  const items = await svc.getSuppliers(req.user!.companyId);
  res.json(items);
});

export const getSupplier = asyncHandler(async (req: AuthRequest, res) => {
  const item = await svc.getSupplierById(req.params.id, req.user!.companyId);
  if (!item) throw AppError.notFound('Proveedor no encontrado', 'SUPPLIER_NOT_FOUND');
  res.json(item);
});

export const addSupplier = asyncHandler(async (req: AuthRequest, res) => {
  const parsed = KycSchema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR', parsed.error.flatten());
  const kycError = validateKyc(parsed.data);
  if (kycError) throw AppError.badRequest(kycError, 'KYC_INVALID');
  const payload = toPrismaPayload(parsed.data);
  // Si vienen campos UAFE relevantes, marcar KYC completo
  if (parsed.data.personType && !payload.kycCompletedAt) {
    payload.kycCompletedAt = new Date();
    payload.kycCompletedBy = req.user!.userId;
  }
  const item = await svc.createSupplier(req.user!.companyId, payload);
  res.status(201).json(item);
});

export const editSupplier = asyncHandler(async (req: AuthRequest, res) => {
  const parsed = KycSchema.partial().safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR', parsed.error.flatten());
  // Si vienen campos KYC los validamos
  if (parsed.data.personType) {
    const kycError = validateKyc(parsed.data as z.infer<typeof KycSchema>);
    if (kycError) throw AppError.badRequest(kycError, 'KYC_INVALID');
  }
  const payload = toPrismaPayload(parsed.data as any);
  const item = await svc.updateSupplier(req.params.id, req.user!.companyId, payload, req.user!.userId);
  res.json(item);
});

// ÓRDENES DE COMPRA
export const listPOs = asyncHandler(async (req: AuthRequest, res) => {
  const items = await svc.getPurchaseOrders(req.user!.companyId);
  res.json(items);
});

export const getPO = asyncHandler(async (req: AuthRequest, res) => {
  const item = await svc.getPurchaseOrderById(req.params.id, req.user!.companyId);
  if (!item) throw AppError.notFound('Not found', 'PO_NOT_FOUND');
  res.json(item);
});

export const addPO = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    supplierId: z.string(),
    deliveryDate: z.string().optional(),
    notes: z.string().optional(),
    advancePercent: z.number().min(0).max(100).optional(),
    deliveryLocationId: z.string().optional(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().positive(),
      unitPrice: z.number().min(0),
      quantityUnit: z.enum(['PURCHASE', 'STOCK']).optional(),
    })).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR', parsed.error.flatten());
  const po = await svc.createPurchaseOrder(req.user!.companyId, {
    ...parsed.data,
    deliveryDate: parsed.data.deliveryDate ? new Date(parsed.data.deliveryDate) : undefined,
  });
  res.status(201).json(po);
});

export const payAdvancePO = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const po = await svc.payAdvance(req.params.id, req.user!.companyId);
    res.json(po);
  } catch (e: any) {
    if (e?.message === 'PO_NOT_FOUND') throw AppError.notFound('Orden no encontrada', 'PO_NOT_FOUND');
    if (e?.message === 'ADVANCE_NOT_PENDING') throw AppError.badRequest('No hay anticipo pendiente para esta orden', 'ADVANCE_NOT_PENDING');
    throw e;
  }
});

export const payBalancePO = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const po = await svc.payBalance(req.params.id, req.user!.companyId);
    res.json(po);
  } catch (e: any) {
    if (e?.message === 'PO_NOT_FOUND') throw AppError.notFound('Orden no encontrada', 'PO_NOT_FOUND');
    if (e?.message === 'BALANCE_ALREADY_PAID') throw AppError.badRequest('El saldo ya fue pagado', 'BALANCE_ALREADY_PAID');
    if (e?.message === 'NOT_CONFORM') throw AppError.badRequest('La recepción debe estar conforme (buen estado) antes de pagar el saldo', 'NOT_CONFORM');
    throw e;
  }
});

export const updateStatus = asyncHandler(async (req: AuthRequest, res) => {
  const { status } = req.body;
  if (!['SUBMITTED', 'APPROVED', 'CANCELLED'].includes(status)) {
    throw AppError.badRequest('Invalid status', 'INVALID_STATUS');
  }
  const po = await svc.updatePOStatus(req.params.id, req.user!.companyId, status, req.user!.userId);
  res.json(po);
});

export const submitPO = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const po = await svc.submitPurchaseOrder(req.params.id, req.user!.companyId, req.user!.userId);
    res.json(po);
  } catch (e: any) {
    if (e?.message === 'PO_NOT_FOUND') throw AppError.notFound('Orden no encontrada', 'PO_NOT_FOUND');
    if (e?.message === 'PO_NOT_DRAFT') throw AppError.badRequest('Solo se pueden enviar órdenes en estado borrador', 'PO_NOT_DRAFT');
    throw e;
  }
});

export const approvePO = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    level: z.number().int().min(1).max(5),
    notes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const po = await svc.approvePurchaseOrder(
      req.params.id,
      req.user!.companyId,
      parsed.data.level,
      req.user!.userId,
      parsed.data.notes,
    );
    res.json(po);
  } catch (e: any) {
    if (e?.message === 'PO_NOT_FOUND') throw AppError.notFound('Orden no encontrada', 'PO_NOT_FOUND');
    if (e?.message?.startsWith('PO_WRONG_STATUS')) {
      throw AppError.badRequest(`La orden no está en el estado correcto para aprobar en nivel ${parsed.data?.level}`, 'PO_WRONG_STATUS', e.message);
    }
    throw e;
  }
});

export const rejectPO = asyncHandler(async (req: AuthRequest, res) => {
  const { reason } = req.body;
  if (!reason) throw AppError.badRequest('Se requiere un motivo de rechazo', 'VALIDATION_ERROR');
  try {
    const po = await svc.rejectPurchaseOrder(req.params.id, req.user!.companyId, req.user!.userId, reason);
    res.json(po);
  } catch (e: any) {
    if (e?.message === 'PO_NOT_FOUND') throw AppError.notFound('Orden no encontrada', 'PO_NOT_FOUND');
    if (e?.message === 'PO_NOT_PENDING') throw AppError.badRequest('La orden no está pendiente de aprobación', 'PO_NOT_PENDING');
    throw e;
  }
});

export const receivePO = asyncHandler(async (req: AuthRequest, res) => {
  const { warehouseId, lines, qualityOk, conformityNotes } = req.body;
  if (!warehouseId) throw AppError.badRequest('warehouseId required', 'VALIDATION_ERROR');
  const linesSchema = z.array(z.object({
    itemId: z.string(),
    quantity: z.number().nonnegative(),
  })).optional();
  const parsedLines = linesSchema.safeParse(lines);
  if (!parsedLines.success) throw AppError.badRequest('Invalid lines', 'VALIDATION_ERROR', parsedLines.error.flatten());
  try {
    const po = await svc.receivePurchaseOrder(
      req.params.id, req.user!.companyId, warehouseId, req.user!.userId, parsedLines.data,
      { qualityOk: typeof qualityOk === 'boolean' ? qualityOk : undefined, notes: conformityNotes },
    );
    res.json(po);
  } catch (e: any) {
    if (e?.message === 'PO_NOT_FOUND') throw AppError.notFound('Orden no encontrada', 'PO_NOT_FOUND');
    if (e?.message === 'PO_ALREADY_RECEIVED') throw AppError.badRequest('Esta orden ya fue recibida', 'PO_ALREADY_RECEIVED');
    if (e?.message === 'PO_CANCELLED') throw AppError.badRequest('Esta orden fue cancelada', 'PO_CANCELLED');
    if (e?.message === 'RECEIVE_EXCEEDS_PENDING') throw AppError.badRequest('No puedes recibir más de lo pendiente', 'RECEIVE_EXCEEDS_PENDING');
    if (e?.message === 'NOTHING_TO_RECEIVE') throw AppError.badRequest('No hay cantidades para recibir', 'NOTHING_TO_RECEIVE');
    throw e;
  }
});
