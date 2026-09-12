import { AuthRequest } from '../../types/index';
import * as svc from '../../services/finance/sri-retry.service';
import { asyncHandler } from '../../middleware/error-handler';

export const listPending = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await svc.listPendingSriDocuments(req.user!.companyId));
});

export const retryPending = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await svc.retryPendingSriDocuments(req.user!.companyId, req.user!.userId));
});
