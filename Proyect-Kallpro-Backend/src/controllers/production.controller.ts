import { z } from 'zod';
import { AuthRequest } from '../types/index';
import * as prod from '../services/production.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

// ─── BOM ──────────────────────────────────────────────────────────────────────

export const listBOMsCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const items = await prod.listBOMs(req.user!.companyId);
  res.json(items);
});

export const getBOMCtrl = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const bom = await prod.getBOM(req.params.id, req.user!.companyId);
    res.json(bom);
  } catch {
    throw AppError.notFound('BOM no encontrado', 'BOM_NOT_FOUND');
  }
});

export const createBOMCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    productId: z.string(),
    version: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
      componentId: z.string(),
      quantity: z.number().positive(),
      unit: z.string().optional(),
      wastePercent: z.number().min(0).max(100).optional(),
      notes: z.string().optional(),
    })).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  const bom = await prod.createBOM(req.user!.companyId, parsed.data);
  res.status(201).json(bom);
});

export const updateBOMCtrl = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const bom = await prod.updateBOM(req.params.id, req.user!.companyId, req.body);
    res.json(bom);
  } catch (e: any) {
    if (e?.message === 'BOM_NOT_FOUND') throw AppError.notFound('BOM no encontrado', 'BOM_NOT_FOUND');
    throw e;
  }
});

// ─── Production Orders ────────────────────────────────────────────────────────

export const listOrdersCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const { status } = req.query as { status?: string };
  const orders = await prod.listProductionOrders(req.user!.companyId, status);
  res.json(orders);
});

export const getOrderCtrl = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const order = await prod.getProductionOrder(req.params.id, req.user!.companyId);
    res.json(order);
  } catch {
    throw AppError.notFound('Orden de producción no encontrada', 'ORDER_NOT_FOUND');
  }
});

export const createOrderCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    productId: z.string(),
    warehouseId: z.string(),
    bomId: z.string().optional(),
    quantity: z.number().positive(),
    plannedStart: z.string().optional(),
    plannedEnd: z.string().optional(),
    notes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  const order = await prod.createProductionOrder(req.user!.companyId, {
    ...parsed.data,
    createdBy: req.user!.userId,
  });
  res.status(201).json(order);
});

export const startOrderCtrl = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const order = await prod.startProduction(req.params.id, req.user!.companyId);
    res.json(order);
  } catch (e: any) {
    if (e?.message === 'ORDER_NOT_FOUND') throw AppError.notFound('Orden no encontrada', 'ORDER_NOT_FOUND');
    if (e?.message === 'ORDER_NOT_PLANNED') throw AppError.badRequest('La orden debe estar en estado PLANNED', 'ORDER_NOT_PLANNED');
    if (e?.message?.startsWith('INSUFFICIENT_STOCK:')) {
      // Respuesta con campo `shortages` top-level (shape preservado).
      res.status(400).json({ error: 'Stock insuficiente', shortages: e.message.split(':')[1].split(';') });
      return;
    }
    throw e;
  }
});

export const completeOrderCtrl = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const order = await prod.completeProduction(req.params.id, req.user!.companyId, req.user!.userId);
    res.json(order);
  } catch (e: any) {
    if (e?.message === 'ORDER_NOT_FOUND') throw AppError.notFound('Orden no encontrada', 'ORDER_NOT_FOUND');
    if (e?.message === 'ORDER_NOT_IN_PROGRESS') throw AppError.badRequest('La orden debe estar en progreso', 'ORDER_NOT_IN_PROGRESS');
    if (e?.message === 'INSUFFICIENT_STOCK') throw AppError.badRequest('Stock insuficiente para consumo', 'INSUFFICIENT_STOCK');
    throw e;
  }
});

export const cancelOrderCtrl = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const order = await prod.cancelProductionOrder(req.params.id, req.user!.companyId);
    res.json(order);
  } catch (e: any) {
    if (e?.message === 'ORDER_NOT_FOUND') throw AppError.notFound('Orden no encontrada', 'ORDER_NOT_FOUND');
    if (e?.message === 'CANNOT_CANCEL_COMPLETED') throw AppError.badRequest('No se puede cancelar una orden completada', 'CANNOT_CANCEL_COMPLETED');
    throw e;
  }
});

export const mrpRequirementsCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const { productId, quantity, warehouseId } = req.query as { productId: string; quantity: string; warehouseId?: string };
  if (!productId || !quantity) throw AppError.badRequest('productId y quantity son requeridos', 'VALIDATION_ERROR');
  try {
    const requirements = await prod.getMRPRequirements(
      req.user!.companyId,
      productId,
      parseFloat(quantity),
      warehouseId,
    );
    res.json(requirements);
  } catch (e: any) {
    if (e?.message === 'BOM_NOT_FOUND') throw AppError.notFound('No hay BOM activo para este producto', 'BOM_NOT_FOUND');
    throw e;
  }
});
