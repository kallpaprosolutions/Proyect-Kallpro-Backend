import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error-handler';
import * as quality from '../services/quality.service';
import * as nc from '../services/nonconformity.service';

// ─── Parámetros de calidad (especificaciones) ─────────────────

export const listParametersCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const productId = typeof req.query.productId === 'string' ? req.query.productId : undefined;
  res.json(await quality.listQualityParameters(req.user!.companyId, productId));
});

export const createParameterCtrl = asyncHandler(async (req: AuthRequest, res) => {
  res.status(201).json(await quality.createQualityParameter(req.user!.companyId, req.body));
});

export const updateParameterCtrl = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await quality.updateQualityParameter(req.params.id, req.user!.companyId, req.body));
});

export const deleteParameterCtrl = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await quality.deactivateQualityParameter(req.params.id, req.user!.companyId));
});

// ─── Inspecciones ─────────────────────────────────────────────

export const listInspectionsCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const { productionOrderId, status } = req.query as Record<string, string>;
  res.json(await quality.listInspections(req.user!.companyId, { productionOrderId, status }));
});

export const getInspectionCtrl = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await quality.getInspection(req.params.id, req.user!.companyId));
});

export const createInspectionCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const created = await quality.createInspection(req.user!.companyId, req.user!.userId, req.body);
  res.status(201).json(created);
});

// ─── Liberación de lote y trazabilidad ────────────────────────

export const releaseLotCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const { approve = true, notes } = req.body ?? {};
  res.json(await quality.releaseLot(req.params.id, req.user!.companyId, req.user!.userId, { approve, notes }));
});

export const traceabilityCtrl = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await quality.getTraceability(req.params.id, req.user!.companyId));
});

// ─── No conformidades (CAPA) ──────────────────────────────────

export const listNcCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const { status, severity, productionOrderId } = req.query as Record<string, string>;
  res.json(await nc.listNonConformities(req.user!.companyId, { status, severity, productionOrderId }));
});

export const getNcCtrl = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await nc.getNonConformity(req.params.id, req.user!.companyId));
});

export const createNcCtrl = asyncHandler(async (req: AuthRequest, res) => {
  res.status(201).json(await nc.createNonConformity(req.user!.companyId, req.user!.userId, req.body));
});

export const updateNcCtrl = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await nc.updateNonConformity(req.params.id, req.user!.companyId, req.user!.userId, req.body));
});

// ─── Indicadores (ISO 9001 §9.1) ──────────────────────────────

export const kpisCtrl = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await nc.getQualityKPIs(req.user!.companyId));
});
