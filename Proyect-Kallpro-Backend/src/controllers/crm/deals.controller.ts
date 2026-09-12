import { Request } from 'express';
import {
  createDeal,
  getDeal,
  listDeals,
  updateDeal,
  updateDealStage,
  getFunnelMetrics,
  getDealsAtRisk,
  PipelineStage,
  PIPELINE_STAGES,
} from '../../services/crm/deal.service';
import { asyncHandler } from '../../middleware/error-handler';
import { AppError } from '../../utils/errors';
import { getDealItems, setDealItems, convertDealToQuotation } from '../../services/crm/deal-conversion.service';

export const getDealItemsHandler = asyncHandler(async (req: Request, res) => {
  res.json(await getDealItems((req as any).user?.companyId, req.params.id));
});

export const setDealItemsHandler = asyncHandler(async (req: Request, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items) throw AppError.badRequest('items debe ser un arreglo', 'VALIDATION_ERROR');
  res.json(await setDealItems((req as any).user?.companyId, req.params.id, items.map((i: any) => ({
    productId: String(i.productId ?? ''), description: i.description ?? null, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice),
  }))));
});

export const generateQuotationHandler = asyncHandler(async (req: Request, res) => {
  const user = (req as any).user;
  res.status(201).json(await convertDealToQuotation(user?.companyId, req.params.id, user?.userId ?? user?.id, user?.role));
});

export const createDealHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  if (!req.body.title || !req.body.contactId) {
    throw AppError.badRequest('title y contactId son requeridos', 'VALIDATION_ERROR');
  }
  const deal = await createDeal(companyId, req.body);
  res.status(201).json(deal);
});

export const getDealHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const deal = await getDeal(companyId, req.params.id);
  if (!deal) throw AppError.notFound('Deal no encontrado', 'DEAL_NOT_FOUND');
  res.json(deal);
});

export const listDealsHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const result = await listDeals(companyId, {
    stage: req.query.stage as PipelineStage,
    contactId: req.query.contactId as string,
    assignedTo: req.query.assignedTo as string,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  });
  res.json(result);
});

export const updateDealHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  await updateDeal(companyId, req.params.id, req.body);
  res.json({ updated: true });
});

export const updateDealStageHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const userId = (req as any).user?.id;
  const { stage } = req.body;

  if (!stage || !PIPELINE_STAGES.includes(stage as PipelineStage)) {
    throw AppError.badRequest(`stage inválido. Valores: ${PIPELINE_STAGES.join(', ')}`, 'INVALID_STAGE');
  }

  const deal = await updateDealStage(companyId, req.params.id, stage as PipelineStage, userId);
  res.json(deal);
});

export const getFunnelMetricsHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const metrics = await getFunnelMetrics(companyId);
  res.json(metrics);
});

export const getDealsAtRiskHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const days = req.query.days ? Number(req.query.days) : 7;
  const deals = await getDealsAtRisk(companyId, days);
  res.json(deals);
});
