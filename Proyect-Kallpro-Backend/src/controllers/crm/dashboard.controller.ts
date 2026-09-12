import { Request } from 'express';
import { getDashboardMetrics, getAgentPerformance } from '../../services/crm/dashboard.service';
import { asyncHandler } from '../../middleware/error-handler';

export const getDashboard = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const metrics = await getDashboardMetrics(companyId);
  res.json(metrics);
});

export const getAgentMetrics = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const performance = await getAgentPerformance(companyId);
  res.json(performance);
});
