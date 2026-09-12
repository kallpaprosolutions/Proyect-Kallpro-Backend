import { Request } from 'express';
import { getSavingsSummary, logSaving, LogSavingInput } from '../../services/finance/savings.service';
import { asyncHandler } from '../../middleware/error-handler';
import { AppError } from '../../utils/errors';

export const getSavingsSummaryHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const period = req.query.period as string | undefined;
  const summary = await getSavingsSummary(companyId, period);
  res.json(summary);
});

export const logSavingHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const userId = (req as any).user?.id;
  const data: LogSavingInput = { ...req.body, createdBy: userId };

  if (!data.savingType || !data.amountUsd || !data.sourceModule) {
    throw AppError.badRequest('savingType, amountUsd y sourceModule son requeridos', 'VALIDATION_ERROR');
  }

  const saving = await logSaving(companyId, data);
  res.status(201).json(saving);
});
