import { z } from 'zod';
import { AuthRequest } from '../types/index';
import * as svc from '../services/storage-location.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

const LocationSchema = z.object({
  warehouseId: z.string().min(1),
  zone: z.string().optional(),
  rack: z.string().optional(),
  level: z.string().optional(),
  description: z.string().optional(),
  code: z.string().optional(),
});

export const listLocations = asyncHandler(async (req: AuthRequest, res) => {
  const warehouseId = typeof req.query.warehouseId === 'string' ? req.query.warehouseId : undefined;
  const items = await svc.listLocations(req.user!.companyId, warehouseId);
  res.json(items);
});

export const createLocation = asyncHandler(async (req: AuthRequest, res) => {
  const parsed = LocationSchema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const item = await svc.createLocation(req.user!.companyId, parsed.data);
    res.status(201).json(item);
  } catch (e: any) {
    if (e?.message === 'WAREHOUSE_NOT_FOUND') throw AppError.notFound('Bodega no encontrada', 'WAREHOUSE_NOT_FOUND');
    throw e;
  }
});

export const updateLocation = asyncHandler(async (req: AuthRequest, res) => {
  const parsed = LocationSchema.partial().safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const item = await svc.updateLocation(req.params.id, req.user!.companyId, parsed.data);
    res.json(item);
  } catch (e: any) {
    if (e?.message === 'LOCATION_NOT_FOUND') throw AppError.notFound('Ubicación no encontrada', 'LOCATION_NOT_FOUND');
    throw e;
  }
});

export const deleteLocation = asyncHandler(async (req: AuthRequest, res) => {
  try {
    await svc.deactivateLocation(req.params.id, req.user!.companyId);
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.message === 'LOCATION_NOT_FOUND') throw AppError.notFound('Ubicación no encontrada', 'LOCATION_NOT_FOUND');
    throw e;
  }
});
