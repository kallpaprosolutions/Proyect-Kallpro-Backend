import { AuthRequest } from '../types/index';
import * as rot from '../services/rotation.service';
import { asyncHandler } from '../middleware/error-handler';

export const getRotationAnalysis = asyncHandler(async (req: AuthRequest, res) => {
  const data = await rot.getProductRotationAnalysis(req.user!.companyId);
  res.json(data);
});

export const getObsolescence = asyncHandler(async (req: AuthRequest, res) => {
  const data = await rot.getObsolescenceReport(req.user!.companyId);
  res.json(data);
});

export const getMovementTrendCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const months = parseInt(req.query.months as string) || 6;
  const data = await rot.getMovementTrend(req.user!.companyId, months);
  res.json(data);
});

export const getExpiringCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const days = parseInt(req.query.days as string) || 90;
  const data = await rot.getExpiringBatches(req.user!.companyId, days);
  res.json(data);
});

export const getLotsByProductCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const data = await rot.getLotsByProduct(req.params.productId, req.user!.companyId);
  res.json(data);
});
