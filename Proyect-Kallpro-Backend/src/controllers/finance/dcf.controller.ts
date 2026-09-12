import { Request } from 'express';
import {
  calculateDCF,
  saveDCFModel,
  listDCFModels,
  DCFAssumptions,
} from '../../services/finance/dcf.service';
import { asyncHandler } from '../../middleware/error-handler';
import { AppError } from '../../utils/errors';

export const calculateDCFHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const raw = req.body;

  // Validaciones básicas
  if (typeof raw.wacc !== 'number' || typeof raw.perpetualGrowth !== 'number') {
    throw AppError.badRequest('wacc y perpetualGrowth son requeridos', 'VALIDATION_ERROR');
  }

  // Frontend sends percentages (e.g. wacc=12 means 12%), convert to decimals
  const needsConversion = raw.wacc > 1 || raw.growthRate > 1 || raw.perpetualGrowth > 1;
  const assumptions: DCFAssumptions = needsConversion ? {
    ...raw,
    growthRate: raw.growthRate / 100,
    ebitdaMargin: raw.ebitdaMargin / 100,
    taxRate: raw.taxRate ? raw.taxRate / 100 : undefined,
    wacc: raw.wacc / 100,
    perpetualGrowth: raw.perpetualGrowth / 100,
    capexPct: raw.capexPct / 100,
    wcChangePct: raw.wcChangePct / 100,
  } : raw;

  try {
    const result = await calculateDCF(companyId, assumptions);
    res.json(result);
  } catch (err: any) {
    if (err?.message?.includes('WACC debe ser mayor')) throw AppError.badRequest(err.message, 'INVALID_WACC');
    throw err;
  }
});

export const saveDCFModelHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const userId = (req as any).user?.id;
  const { name, assumptions, results } = req.body;

  if (!name || !assumptions || !results) {
    throw AppError.badRequest('name, assumptions y results son requeridos', 'VALIDATION_ERROR');
  }

  const model = await saveDCFModel(companyId, userId, name, assumptions, results);
  res.status(201).json(model);
});

export const listDCFModelsHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const models = await listDCFModels(companyId);
  res.json(models);
});
