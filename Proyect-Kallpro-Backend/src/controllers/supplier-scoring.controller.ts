import { AuthRequest } from '../middleware/auth.middleware';
import * as svc from '../services/supplier-scoring.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

export const getSupplierRanking = asyncHandler(async (req: AuthRequest, res) => {
  const ranking = await svc.getSupplierRanking(req.user!.companyId);
  res.json(ranking);
});

export const getSupplierPerformance = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const data = await svc.getSupplierPerformance(req.params.id, req.user!.companyId);
    res.json(data);
  } catch (e: any) {
    if (e?.message?.includes('no encontrado')) throw AppError.notFound(e.message, 'NOT_FOUND');
    throw e;
  }
});

export const recalculateScore = asyncHandler(async (req: AuthRequest, res) => {
  const result = await svc.calculateAndSaveScore(req.params.id, req.user!.companyId);
  res.json({ ok: true, score: result });
});
