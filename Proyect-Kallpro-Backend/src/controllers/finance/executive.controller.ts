import { Request } from 'express';
import { getSavingsSummary } from '../../services/finance/savings.service';
import { get4DKPIs } from '../../services/finance/optimization4d.service';
import { getRatios } from '../../services/finance/ratios.service';
import { getInsights } from '../../services/finance/aiInsights.service';
import { asyncHandler } from '../../middleware/error-handler';

export const getExecutiveSummary = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const period = req.query.period as string | undefined;

  const [savings, kpis4d, allRatios, insights] = await Promise.all([
    getSavingsSummary(companyId, period),
    get4DKPIs(companyId, period),
    getRatios(companyId, period),
    getInsights(companyId, period).catch(() => null),
  ]);

  // Flatten critical ratios for quick view
  const criticalRatios = [
    ...allRatios.liquidez,
    ...allRatios.rentabilidad,
    ...allRatios.eficiencia,
  ]
    .filter(r => r.status === 'red' || r.status === 'yellow')
    .slice(0, 8);

  const healthyCount = [
    ...allRatios.liquidez,
    ...allRatios.solvencia,
    ...allRatios.rentabilidad,
    ...allRatios.eficiencia,
  ].filter(r => r.status === 'green').length;

  res.json({
    period: savings.period,
    savings,
    optimization4d: kpis4d,
    criticalRatios,
    ratiosSummary: {
      healthy: healthyCount,
      warning: [
        ...allRatios.liquidez,
        ...allRatios.solvencia,
        ...allRatios.rentabilidad,
        ...allRatios.eficiencia,
      ].filter(r => r.status === 'yellow').length,
      critical: [
        ...allRatios.liquidez,
        ...allRatios.solvencia,
        ...allRatios.rentabilidad,
        ...allRatios.eficiencia,
      ].filter(r => r.status === 'red').length,
    },
    aiInsights: insights,
    generatedAt: new Date().toISOString(),
  });
});

export const get4DOptimization = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const period = req.query.period as string | undefined;
  const result = await get4DKPIs(companyId, period);
  res.json(result);
});
