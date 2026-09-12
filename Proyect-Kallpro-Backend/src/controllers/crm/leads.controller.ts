import { Request } from 'express';
import { asyncHandler } from '../../middleware/error-handler';
import * as leadService from '../../services/crm/lead.service';

const companyOf = (req: Request) => (req as any).user?.companyId as string;
const userOf = (req: Request) => (req as any).user?.id as string | undefined;

export const listLeadsHandler = asyncHandler(async (req: Request, res) => {
  const result = await leadService.listLeads(companyOf(req), {
    status: req.query.status as string,
    grade: req.query.grade as string,
    temperature: req.query.temperature as string,
    source: req.query.source as string,
    ownerUserId: req.query.ownerUserId as string,
    search: req.query.search as string,
    onlyDuplicates: req.query.onlyDuplicates === 'true',
    minScore: req.query.minScore ? Number(req.query.minScore) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
    sortBy: req.query.sortBy as 'score' | 'createdAt' | undefined,
  });
  res.json(result);
});

export const getLeadStatsHandler = asyncHandler(async (req: Request, res) => {
  res.json(await leadService.getLeadStats(companyOf(req)));
});

export const getLeadHandler = asyncHandler(async (req: Request, res) => {
  res.json(await leadService.getLead(companyOf(req), req.params.id));
});

export const createLeadHandler = asyncHandler(async (req: Request, res) => {
  const lead = await leadService.createLead(companyOf(req), req.body);
  res.status(201).json(lead);
});

export const updateLeadHandler = asyncHandler(async (req: Request, res) => {
  res.json(await leadService.updateLead(companyOf(req), req.params.id, req.body));
});

export const checkDuplicateHandler = asyncHandler(async (req: Request, res) => {
  res.json(await leadService.checkDuplicate(companyOf(req), req.body));
});

export const rescoreLeadHandler = asyncHandler(async (req: Request, res) => {
  const { lead, result } = await leadService.rescoreLead(companyOf(req), req.params.id);
  res.json({ lead, score: result });
});

export const rescoreAllHandler = asyncHandler(async (req: Request, res) => {
  res.json(await leadService.rescoreAllLeads(companyOf(req)));
});

export const assignLeadHandler = asyncHandler(async (req: Request, res) => {
  const { lead, decision } = await leadService.assignLead(
    companyOf(req), req.params.id, req.body?.ownerUserId,
  );
  res.json({ lead, decision });
});

export const registerEventHandler = asyncHandler(async (req: Request, res) => {
  const { eventType, channel, metadata } = req.body;
  res.status(201).json(
    await leadService.registerEvent(companyOf(req), req.params.id, eventType, channel, metadata),
  );
});

export const convertLeadHandler = asyncHandler(async (req: Request, res) => {
  const result = await leadService.convertLead(companyOf(req), req.params.id, req.body ?? {}, userOf(req));
  res.status(201).json(result);
});

export const disqualifyLeadHandler = asyncHandler(async (req: Request, res) => {
  res.json(await leadService.disqualifyLead(companyOf(req), req.params.id, req.body?.reason ?? 'Sin motivo'));
});

/** Catálogos para poblar los selectores de la interfaz, sin quemarlos en el frontend. */
export const getLeadCatalogsHandler = asyncHandler(async (_req: Request, res) => {
  res.json({
    statuses: leadService.LEAD_STATUSES.map(s => ({ value: s, label: leadService.LEAD_STATUS_LABELS[s] })),
    eventTypes: leadService.LEAD_EVENT_TYPES.map(t => ({ value: t, label: leadService.LEAD_EVENT_LABELS[t] })),
    grades: ['A', 'B', 'C', 'D'],
    temperatures: [
      { value: 'hot', label: 'Caliente' },
      { value: 'warm', label: 'Tibio' },
      { value: 'cold', label: 'Frío' },
    ],
    sources: [
      { value: 'web_form', label: 'Formulario web' },
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'telegram', label: 'Telegram' },
      { value: 'gmail', label: 'Correo' },
      { value: 'import', label: 'Importación' },
      { value: 'manual', label: 'Manual' },
      { value: 'api', label: 'API' },
    ],
  });
});
