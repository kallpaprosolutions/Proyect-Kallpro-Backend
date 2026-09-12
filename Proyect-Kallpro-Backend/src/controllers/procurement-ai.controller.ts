import { AuthRequest } from '../middleware/auth.middleware';
import {
  recommendSuppliers,
  detectPriceAnomaly,
  generateProcurementInsights,
  validateThreeWayMatch,
} from '../services/procurement-ai.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

export const getSupplierRecommendation = asyncHandler(async (req: AuthRequest, res) => {
  const { requisitionId } = req.body as { requisitionId: string };
  if (!requisitionId) throw AppError.badRequest('requisitionId requerido', 'VALIDATION_ERROR');
  try {
    const result = await recommendSuppliers(req.user!.companyId, requisitionId);
    res.json(result);
  } catch (e: any) {
    if (e?.message?.includes('no encontrada')) throw AppError.notFound(e.message, 'NOT_FOUND');
    throw e;
  }
});

export const checkPriceAnomaly = asyncHandler(async (req: AuthRequest, res) => {
  const { productId, description, unitPrice, supplierId } = req.body as any;
  if (unitPrice === undefined) throw AppError.badRequest('unitPrice requerido', 'VALIDATION_ERROR');
  const result = await detectPriceAnomaly(req.user!.companyId, { productId, description, unitPrice: Number(unitPrice), supplierId });
  res.json(result);
});

export const getProcurementInsights = asyncHandler(async (req: AuthRequest, res) => {
  const result = await generateProcurementInsights(req.user!.companyId);
  res.json(result);
});

export const threeWayMatch = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const result = await validateThreeWayMatch(req.params.id, req.user!.companyId);
    res.json(result);
  } catch (e: any) {
    if (e?.message?.includes('no encontrado')) throw AppError.notFound(e.message, 'NOT_FOUND');
    throw e;
  }
});
