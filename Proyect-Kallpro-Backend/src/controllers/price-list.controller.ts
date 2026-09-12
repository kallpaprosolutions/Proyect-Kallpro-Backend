import { z } from 'zod';
import { AuthRequest } from '../types/index';
import * as svc from '../services/price-list.service';
import { getErpConfig } from '../services/erp-config.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

/**
 * Controlador de Listas de Precios — refactor de referencia (Sprint 2.2).
 *
 * Patrón: handlers envueltos en `asyncHandler` (sin try/catch). Los códigos que el
 * servicio lanza (PRICE_LIST_NOT_FOUND, ITEM_NOT_FOUND, PRODUCT_NOT_FOUND,
 * NO_PRICE_AVAILABLE) los traduce el `errorHandler` global vía LEGACY_ERROR_CODES.
 * Para errores propios del controlador se lanza un `AppError`.
 */

/** Tope de descuento del rol del usuario actual (para validación en vivo en el front). */
export const discountCap = asyncHandler(async (req: AuthRequest, res) => {
  const cfg = await getErpConfig(req.user!.companyId);
  const role = req.user!.role;
  res.json({ role, cap: cfg.sales.maxDiscountByRole[role] ?? 0 });
});

export const list = asyncHandler(async (req: AuthRequest, res) => {
  const items = await svc.getPriceLists(req.user!.companyId);
  res.json(items);
});

export const getOne = asyncHandler(async (req: AuthRequest, res) => {
  const item = await svc.getPriceListById(req.params.id, req.user!.companyId);
  if (!item) throw AppError.notFound('Lista de precios no encontrada', 'PRICE_LIST_NOT_FOUND');
  res.json(item);
});

const listSchema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string().nullish(),
  isActive: z.boolean().optional(),
});

export const create = asyncHandler(async (req: AuthRequest, res) => {
  const parsed = listSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  }
  const item = await svc.createPriceList(req.user!.companyId, {
    name: parsed.data.name,
    startDate: new Date(parsed.data.startDate),
    endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
    isActive: parsed.data.isActive,
  }, req.user!.userId);
  res.status(201).json(item);
});

export const update = asyncHandler(async (req: AuthRequest, res) => {
  const parsed = listSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  }
  const item = await svc.updatePriceList(req.params.id, req.user!.companyId, {
    ...parsed.data,
    startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
    endDate: parsed.data.endDate !== undefined ? (parsed.data.endDate ? new Date(parsed.data.endDate) : null) : undefined,
  }, req.user!.userId);
  res.json(item);
});

export const remove = asyncHandler(async (req: AuthRequest, res) => {
  await svc.deletePriceList(req.params.id, req.user!.companyId, req.user!.userId);
  res.json({ ok: true });
});

const itemSchema = z.object({
  productId: z.string(),
  unitPrice: z.number().min(0),
  minQuantity: z.number().positive().optional(),
});

export const upsertItem = asyncHandler(async (req: AuthRequest, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  }
  const item = await svc.upsertPriceListItem(req.user!.companyId, req.params.id, parsed.data);
  res.status(201).json(item);
});

export const removeItem = asyncHandler(async (req: AuthRequest, res) => {
  await svc.deletePriceListItem(req.user!.companyId, req.params.itemId);
  res.json({ ok: true });
});

/** Resuelve el precio de un producto/cantidad (para autollenar el formulario de cotización). */
export const resolve = asyncHandler(async (req: AuthRequest, res) => {
  const productId = req.query.productId as string;
  const quantity = Number(req.query.quantity ?? 1);
  if (!productId) throw AppError.badRequest('productId requerido', 'PRODUCT_ID_REQUIRED');
  const result = await svc.resolveUnitPrice(req.user!.companyId, productId, quantity);
  res.json(result);
});
