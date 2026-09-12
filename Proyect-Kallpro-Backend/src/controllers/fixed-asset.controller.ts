import { z } from 'zod';
import { AuthRequest } from '../types/index';
import * as svc from '../services/finance/fixed-asset.service';
import { FIXED_ASSET_CATEGORIES } from '../services/finance/engines/fixed-asset.engine';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

function assetError(e: any): AppError | null {
  if (e?.message?.startsWith('VALIDATION:')) return AppError.badRequest(e.message.replace('VALIDATION: ', ''), 'VALIDATION_ERROR');
  if (e?.message === 'FIXED_ASSET_NOT_FOUND') return AppError.notFound('Activo no encontrado', 'FIXED_ASSET_NOT_FOUND');
  if (e?.message === 'FIXED_ASSET_NOT_ACTIVE') return AppError.badRequest('El activo no está activo (ya fue dado de baja o totalmente depreciado)', 'FIXED_ASSET_NOT_ACTIVE');
  if (e?.message === 'FIXED_ASSET_ALREADY_DISPOSED') return AppError.badRequest('El activo ya fue dado de baja', 'FIXED_ASSET_ALREADY_DISPOSED');
  return null;
}

const CATEGORY_KEYS = Object.keys(FIXED_ASSET_CATEGORIES) as [string, ...string[]];

const createSchema = z.object({
  name: z.string().min(1),
  category: z.enum(CATEGORY_KEYS),
  acquisitionDate: z.string(),
  acquisitionCost: z.number().positive(),
  residualValue: z.number().min(0),
  usefulLifeYears: z.number().int().min(0),
  supplierId: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export const listCategories = asyncHandler(async (_req: AuthRequest, res) => {
  res.json(Object.entries(FIXED_ASSET_CATEGORIES).map(([key, info]) => ({ key, ...info })));
});

export const listAssets = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await svc.listFixedAssets(req.user!.companyId));
});

export const getAsset = asyncHandler(async (req: AuthRequest, res) => {
  const item = await svc.getFixedAssetById(req.params.id, req.user!.companyId);
  if (!item) throw AppError.notFound('Activo no encontrado', 'FIXED_ASSET_NOT_FOUND');
  res.json(item);
});

export const createAsset = asyncHandler(async (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const item = await svc.createFixedAsset(req.user!.companyId, {
      ...parsed.data,
      category: parsed.data.category as any,
      acquisitionDate: new Date(parsed.data.acquisitionDate),
    }, req.user!.userId);
    res.status(201).json(item);
  } catch (e: any) {
    throw assetError(e) ?? e;
  }
});

export const updateAsset = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    residualValue: z.number().min(0).optional(),
    usefulLifeYears: z.number().int().min(0).optional(),
    notes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const item = await svc.updateFixedAsset(req.params.id, req.user!.companyId, parsed.data);
    res.json(item);
  } catch (e: any) {
    throw assetError(e) ?? e;
  }
});

export const disposeAsset = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({ note: z.string().min(1, 'El motivo de la baja es obligatorio') });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Motivo de baja requerido', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const item = await svc.disposeFixedAsset(req.params.id, req.user!.companyId, parsed.data.note);
    res.json(item);
  } catch (e: any) {
    throw assetError(e) ?? e;
  }
});

export const generateDue = asyncHandler(async (req: AuthRequest, res) => {
  const result = await svc.generateDueDepreciation(req.user!.companyId, req.user!.userId);
  res.json(result);
});
