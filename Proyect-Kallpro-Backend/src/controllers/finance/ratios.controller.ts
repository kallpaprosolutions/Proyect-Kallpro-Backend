import { Request } from 'express';
import { getRatios, getRatiosByCategory } from '../../services/finance/ratios.service';
import { asyncHandler } from '../../middleware/error-handler';

export const getFinancialRatios = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const category = req.query.category as string | undefined;
  const period = req.query.period as string | undefined;

  if (category && category !== 'all') {
    const ratios = await getRatiosByCategory(companyId, category, period);
    res.json({ category, period, ratios });
  } else {
    const allRatios = await getRatios(companyId, period);
    res.json(allRatios);
  }
});
