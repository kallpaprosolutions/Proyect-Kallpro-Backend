import { Request } from 'express';
import * as sriService from '../services/sri-document.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

export const uploadDocument = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user.companyId;
  if (!req.file) throw AppError.badRequest('No se recibió ningún archivo', 'NO_FILE');
  try {
    const result = await sriService.uploadSriDocument(
      companyId,
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
    );
    res.status(201).json(result);
  } catch (e: any) {
    if (e?.message?.includes('duplicado')) throw AppError.conflict(e.message, 'DUPLICATE_DOCUMENT');
    throw e;
  }
});

export const createManualDocument = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user.companyId;
  try {
    const result = await sriService.createManualSriDocument(companyId, req.body);
    res.status(201).json(result);
  } catch (e: any) {
    if (e?.message?.includes('duplicado') || e?.message?.includes('duplicada')) throw AppError.conflict(e.message, 'DUPLICATE_DOCUMENT');
    if (e?.message?.startsWith('VALIDATION:')) throw AppError.badRequest(e.message.replace('VALIDATION: ', ''), 'VALIDATION');
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST');
  }
});

export const listDocuments = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user.companyId;
  const { status } = req.query;
  const docs = await sriService.getSriDocuments(companyId, status as string | undefined);
  res.json(docs);
});

export const getDocument = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user.companyId;
  const doc = await sriService.getSriDocumentById(req.params.id, companyId);
  if (!doc) throw AppError.notFound('Documento no encontrado', 'DOCUMENT_NOT_FOUND');
  res.json(doc);
});

export const getJournalPreview = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user.companyId;
  res.json(await sriService.previewJournalEntry(req.params.id, companyId));
});

export const updateDocument = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user.companyId;
  try {
    const doc = await sriService.updateSriDocument(req.params.id, companyId, req.body);
    res.json(doc);
  } catch (e: any) {
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST'); // default original: 400
  }
});

export const confirmDocument = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user.companyId;
  const userId = (req as any).user.id;
  const { override, overrideReason } = req.body || {};
  try {
    const result = await sriService.confirmSriDocument(req.params.id, companyId, userId, { override, overrideReason });
    res.json(result);
  } catch (e: any) {
    if (e?.message === 'MATCH_DISCREPANCY') {
      // Respuesta con campo `matchResult` top-level (shape preservado).
      res.status(409).json({
        error: 'La conciliación a 3 vías encontró discrepancias. Revisa cantidades/precios o confirma con un motivo de override.',
        matchResult: e.matchResult,
      });
      return;
    }
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST');
  }
});

export const deleteDocument = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user.companyId;
  try {
    await sriService.deleteSriDocument(req.params.id, companyId);
    res.json({ ok: true });
  } catch (e: any) {
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST');
  }
});

export const rejectDocument = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user.companyId;
  try {
    const doc = await sriService.rejectSriDocument(req.params.id, companyId, req.body.motivo);
    res.json(doc);
  } catch (e: any) {
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST');
  }
});

export const listPayables = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user.companyId;
  const payables = await sriService.getPayables(companyId);
  res.json(payables);
});

export const payDocument = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user.companyId;
  const paid = req.body?.paid !== false; // default true
  try {
    const doc = await sriService.markPayablePaid(req.params.id, companyId, paid);
    res.json(doc);
  } catch (e: any) {
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST');
  }
});

export const getKpis = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user.companyId;
  const kpis = await sriService.getSriKpis(companyId);
  res.json(kpis);
});

export const getCatalogs = asyncHandler(async (_req: Request, res) => {
  const [tariffs, retentions] = await Promise.all([
    sriService.getIvaTariffs(),
    sriService.getRetentionCatalog(),
  ]);
  res.json({ ivaTariffs: tariffs, retentions });
});
