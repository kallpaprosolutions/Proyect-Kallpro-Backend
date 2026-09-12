import { Request } from 'express';
import { getInsights } from '../../services/finance/aiInsights.service';
import { asyncHandler } from '../../middleware/error-handler';

export const getInsightsHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const period = req.params.period as string | undefined;

  const result = await getInsights(companyId, period);
  res.json(result);
});
