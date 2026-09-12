import { Request } from 'express';
import { asyncHandler } from '../../middleware/error-handler';
import * as forecast from '../../services/crm/forecast.service';

const companyOf = (req: Request) => (req as any).user?.companyId as string;

export const getForecastHandler = asyncHandler(async (req: Request, res) => {
  const period = req.query.period as string | undefined;
  const quota = req.query.quota !== undefined ? Number(req.query.quota) : undefined;
  res.json(await forecast.getForecast(companyOf(req), period, quota));
});

export const getMonthlyTrendHandler = asyncHandler(async (req: Request, res) => {
  const months = req.query.months ? Number(req.query.months) : 6;
  res.json(await forecast.getMonthlyTrend(companyOf(req), months));
});

export const getAccuracyHandler = asyncHandler(async (req: Request, res) => {
  const period = (req.query.period as string) ?? new Date().toISOString().slice(0, 7);
  res.json(await forecast.getAccuracy(companyOf(req), period));
});

export const getVelocityHandler = asyncHandler(async (req: Request, res) => {
  const months = req.query.months ? Number(req.query.months) : 6;
  res.json(await forecast.getVelocity(companyOf(req), months));
});

export const getByOwnerHandler = asyncHandler(async (req: Request, res) => {
  res.json(await forecast.getForecastByOwner(companyOf(req), req.query.period as string | undefined));
});

export const setQuotaHandler = asyncHandler(async (req: Request, res) => {
  const { period, quotaUsd } = req.body;
  res.json(await forecast.setQuota(companyOf(req), period, Number(quotaUsd)));
});

export const closePeriodHandler = asyncHandler(async (req: Request, res) => {
  res.json(await forecast.closePeriod(companyOf(req), req.body.period));
});

export const setDealCategoryHandler = asyncHandler(async (req: Request, res) => {
  res.json(await forecast.setDealCategory(companyOf(req), req.params.dealId, req.body.category));
});

export const clearDealCategoryHandler = asyncHandler(async (req: Request, res) => {
  res.json(await forecast.clearDealCategoryOverride(companyOf(req), req.params.dealId));
});
