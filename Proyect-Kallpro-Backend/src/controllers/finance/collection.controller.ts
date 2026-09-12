import { AuthRequest } from '../../types/index';
import * as collection from '../../services/finance/collection.service';
import { asyncHandler } from '../../middleware/error-handler';
import { AppError } from '../../utils/errors';

export const getRadar = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await collection.getCollectionRadar(req.user!.companyId));
});

export const getHistory = asyncHandler(async (req: AuthRequest, res) => {
  const { customerId } = req.params;
  res.json(await collection.getCollectionHistory(req.user!.companyId, customerId));
});

export const logActivity = asyncHandler(async (req: AuthRequest, res) => {
  const { customerId, invoiceId, type, result, promisedAmount, promisedDate, nextActionAt, notes } = req.body;
  if (!customerId) throw AppError.badRequest('Se requiere el cliente', 'VALIDATION');
  if (!type) throw AppError.badRequest('Se requiere el tipo de gestión', 'VALIDATION');
  const activity = await collection.logCollectionActivity(req.user!.companyId, {
    customerId, invoiceId, type, result, promisedAmount, promisedDate, nextActionAt, notes,
  }, req.user!.userId);
  res.status(201).json(activity);
});
