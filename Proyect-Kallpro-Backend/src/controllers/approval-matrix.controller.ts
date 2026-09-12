import { z } from 'zod';
import { AuthRequest } from '../types/index';
import * as svc from '../services/approval-matrix.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

const LevelSchema = z.object({
  level: z.number().int().min(1).max(5),
  label: z.string().min(1),
  minAmount: z.number().min(0),
  maxAmount: z.number().optional().nullable(),
  approverRole: z.string().min(1),
});

export const getMatrix = asyncHandler(async (req: AuthRequest, res) => {
  const matrix = await svc.getMatrix(req.user!.companyId);
  res.json(matrix);
});

export const upsertMatrix = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({ levels: z.array(LevelSchema).min(1).max(5) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR', parsed.error.flatten());
  const matrix = await svc.upsertMatrix(req.user!.companyId, parsed.data.levels);
  res.json(matrix);
});

export const seedDefault = asyncHandler(async (req: AuthRequest, res) => {
  const matrix = await svc.seedDefaultMatrix(req.user!.companyId);
  res.json(matrix);
});
