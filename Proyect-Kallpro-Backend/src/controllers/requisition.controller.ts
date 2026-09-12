import { Request } from 'express';
import * as svc from '../services/requisition.service';
import * as scoring from '../services/scoring.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

export const listRequisitions = asyncHandler(async (req: Request, res) => {
  const { status } = req.query;
  const data = await svc.getRequisitions(req.user!.companyId, status as string | undefined);
  res.json(data);
});

export const getRequisition = asyncHandler(async (req: Request, res) => {
  const data = await svc.getRequisitionById(req.params.id, req.user!.companyId);
  if (!data) throw AppError.notFound('Requisición no encontrada', 'REQUISITION_NOT_FOUND');
  res.json(data);
});

export const addRequisition = asyncHandler(async (req: Request, res) => {
  const { title, notes, priority, departmentId, items, scoringCriteria, neededBy } = req.body;
  if (!title || !items?.length) throw AppError.badRequest('Título e ítems son requeridos', 'VALIDATION_ERROR');
  if (neededBy && Number.isNaN(Date.parse(neededBy))) {
    throw AppError.badRequest('Fecha necesaria inválida', 'VALIDATION_ERROR');
  }
  const result = await svc.createRequisition(req.user!.companyId, {
    title, notes, priority, departmentId,
    requestedBy: req.user!.userId,
    items, scoringCriteria, neededBy,
  });
  res.status(201).json(result);
});

export const approveReq = asyncHandler(async (req: Request, res) => {
  const { level, notes } = req.body;
  if (!level) throw AppError.badRequest('Nivel de aprobación requerido (1, 2 o 3)', 'VALIDATION_ERROR');
  try {
    const data = await svc.approveRequisition(
      req.params.id,
      req.user!.companyId,
      Number(level) as 1 | 2 | 3,
      req.user!.userId,
      notes,
    );
    res.json(data);
  } catch (e: any) {
    if (e?.message?.includes('no está en estado')) throw AppError.badRequest(e.message, 'INVALID_STATUS');
    throw e;
  }
});

export const rejectReq = asyncHandler(async (req: Request, res) => {
  const { reason } = req.body;
  if (!reason) throw AppError.badRequest('Motivo de rechazo requerido', 'VALIDATION_ERROR');
  try {
    const data = await svc.rejectRequisition(req.params.id, req.user!.companyId, req.user!.userId, reason);
    res.json(data);
  } catch (e: any) {
    if (e?.message?.includes('Solo se pueden')) throw AppError.badRequest(e.message, 'INVALID_STATUS');
    throw e;
  }
});

export const listQuotations = asyncHandler(async (req: Request, res) => {
  const data = await svc.getQuotationsForRequisition(req.params.id, req.user!.companyId);
  res.json(data);
});

export const addQuotation = asyncHandler(async (req: Request, res) => {
  const { supplierId, quoteNumber, validUntil, deliveryDays, paymentTerms, notes, items } = req.body;
  if (!supplierId || !items?.length) throw AppError.badRequest('Proveedor e ítems requeridos', 'VALIDATION_ERROR');
  try {
    const data = await svc.createQuotation(req.user!.companyId, req.params.id, req.user!.userId, {
      supplierId, quoteNumber,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      deliveryDays, paymentTerms, notes, items,
    });
    res.status(201).json(data);
  } catch (e: any) {
    if (e?.message?.includes('QUOTATION_LIMIT') || e?.message?.includes('debe estar')) throw AppError.badRequest(e.message, 'INVALID_QUOTATION');
    throw e;
  }
});

export const selectWinner = asyncHandler(async (req: Request, res) => {
  const { quotationId, overrideReason } = req.body;
  if (!quotationId) throw AppError.badRequest('quotationId requerido', 'VALIDATION_ERROR');
  try {
    const data = await svc.selectWinnerAndCreatePO(
      req.params.id,
      quotationId,
      req.user!.companyId,
      req.user!.userId,
      overrideReason,
    );
    res.json(data);
  } catch (e: any) {
    if (e?.message?.includes('MIN_QUOTATIONS')) throw AppError.badRequest(e.message, 'MIN_QUOTATIONS');
    throw e;
  }
});

// ── Evaluación ponderada (pesos) ──
export const saveCriteria = asyncHandler(async (req: Request, res) => {
  const { criteria } = req.body;
  if (!Array.isArray(criteria)) throw AppError.badRequest('criteria debe ser un arreglo', 'VALIDATION_ERROR');
  const sum = criteria.reduce((s: number, c: any) => s + (Number(c.weight) || 0), 0);
  if (Math.abs(sum - 100) > 0.01) throw AppError.badRequest(`Los pesos deben sumar 100 (actual: ${sum})`, 'VALIDATION_ERROR');
  try {
    const data = await scoring.saveCriteria(req.params.id, req.user!.companyId, criteria);
    res.json(data);
  } catch (e: any) {
    if (e?.message === 'REQUISITION_NOT_FOUND') throw AppError.notFound(e.message, 'REQUISITION_NOT_FOUND');
    throw e;
  }
});

export const evaluateQuotations = asyncHandler(async (req: Request, res) => {
  try {
    const data = await scoring.computeWeightedRanking(req.params.id, req.user!.companyId);
    res.json(data);
  } catch (e: any) {
    if (e?.message === 'REQUISITION_NOT_FOUND') throw AppError.notFound(e.message, 'REQUISITION_NOT_FOUND');
    throw e;
  }
});

export const saveManualScores = asyncHandler(async (req: Request, res) => {
  const { manualScores, advanceRequiredPct } = req.body;
  try {
    const data = await scoring.saveManualScores(
      req.params.id,
      req.params.qid,
      req.user!.companyId,
      manualScores ?? {},
      advanceRequiredPct,
    );
    res.json(data);
  } catch (e: any) {
    if (e?.message === 'QUOTATION_NOT_FOUND') throw AppError.notFound(e.message, 'QUOTATION_NOT_FOUND');
    throw e;
  }
});
