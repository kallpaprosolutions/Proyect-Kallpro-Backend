import { Request } from 'express';
import { asyncHandler } from '../../middleware/error-handler';
import * as config from '../../services/crm/crm-config.service';
import * as forms from '../../services/crm/capture-form.service';
import { rescoreAllLeads } from '../../services/crm/lead.service';
import { CONDITION_OPERATORS, OPERATOR_LABELS } from '../../services/crm/engines/condition.engine';
import { FORECAST_CATEGORIES, FORECAST_CATEGORY_LABELS } from '../../services/crm/engines/forecast.engine';

const companyOf = (req: Request) => (req as any).user?.companyId as string;
const userOf = (req: Request) => (req as any).user?.id as string | undefined;

// ── Etapas del pipeline ──────────────────────────────────────────────────────
export const listStagesHandler = asyncHandler(async (req: Request, res) => {
  res.json(await config.listPipelineStages(companyOf(req)));
});

export const createStageHandler = asyncHandler(async (req: Request, res) => {
  res.status(201).json(await config.createPipelineStage(companyOf(req), req.body));
});

export const updateStageHandler = asyncHandler(async (req: Request, res) => {
  res.json(await config.updatePipelineStage(companyOf(req), req.params.id, req.body));
});

export const deleteStageHandler = asyncHandler(async (req: Request, res) => {
  res.json(await config.deletePipelineStage(companyOf(req), req.params.id));
});

export const reorderStagesHandler = asyncHandler(async (req: Request, res) => {
  res.json(await config.reorderPipelineStages(companyOf(req), req.body.order ?? []));
});

// ── Configuración de scoring ─────────────────────────────────────────────────
export const getScoringConfigHandler = asyncHandler(async (req: Request, res) => {
  res.json(await config.getScoringConfig(companyOf(req)));
});

export const updateScoringConfigHandler = asyncHandler(async (req: Request, res) => {
  res.json(await config.updateScoringConfig(companyOf(req), req.body, userOf(req)));
});

// ── Reglas de scoring ────────────────────────────────────────────────────────
export const listScoringRulesHandler = asyncHandler(async (req: Request, res) => {
  res.json(await config.listScoringRules(companyOf(req)));
});

export const createScoringRuleHandler = asyncHandler(async (req: Request, res) => {
  res.status(201).json(await config.createScoringRule(companyOf(req), req.body));
});

export const updateScoringRuleHandler = asyncHandler(async (req: Request, res) => {
  res.json(await config.updateScoringRule(companyOf(req), req.params.id, req.body));
});

export const deleteScoringRuleHandler = asyncHandler(async (req: Request, res) => {
  res.json(await config.deleteScoringRule(companyOf(req), req.params.id));
});

export const resetScoringRulesHandler = asyncHandler(async (req: Request, res) => {
  res.json(await config.resetScoringRules(companyOf(req)));
});

/** Aplica las reglas vigentes a todos los leads abiertos. */
export const rescoreAllHandler = asyncHandler(async (req: Request, res) => {
  res.json(await rescoreAllLeads(companyOf(req)));
});

// ── Reglas de asignación ─────────────────────────────────────────────────────
export const listAssignmentRulesHandler = asyncHandler(async (req: Request, res) => {
  res.json(await config.listAssignmentRules(companyOf(req)));
});

export const createAssignmentRuleHandler = asyncHandler(async (req: Request, res) => {
  res.status(201).json(await config.createAssignmentRule(companyOf(req), req.body));
});

export const updateAssignmentRuleHandler = asyncHandler(async (req: Request, res) => {
  res.json(await config.updateAssignmentRule(companyOf(req), req.params.id, req.body));
});

export const deleteAssignmentRuleHandler = asyncHandler(async (req: Request, res) => {
  res.json(await config.deleteAssignmentRule(companyOf(req), req.params.id));
});

// ── Formularios de captura ───────────────────────────────────────────────────
export const listFormsHandler = asyncHandler(async (req: Request, res) => {
  res.json(await forms.listForms(companyOf(req)));
});

export const getFormHandler = asyncHandler(async (req: Request, res) => {
  const form = await forms.getForm(companyOf(req), req.params.id);
  const base = process.env.PUBLIC_API_URL ?? `${req.protocol}://${req.get('host')}`;
  res.json({ ...form, embedSnippet: forms.buildEmbedSnippet(form, base) });
});

export const createFormHandler = asyncHandler(async (req: Request, res) => {
  res.status(201).json(await forms.createForm(companyOf(req), req.body, userOf(req)));
});

export const updateFormHandler = asyncHandler(async (req: Request, res) => {
  res.json(await forms.updateForm(companyOf(req), req.params.id, req.body));
});

export const deleteFormHandler = asyncHandler(async (req: Request, res) => {
  res.json(await forms.deleteForm(companyOf(req), req.params.id));
});

export const rotateFormKeyHandler = asyncHandler(async (req: Request, res) => {
  res.json(await forms.rotatePublicKey(companyOf(req), req.params.id));
});

// ── Agentes de IA ────────────────────────────────────────────────────────────
export const getAgentConfigHandler = asyncHandler(async (req: Request, res) => {
  res.json(await config.getAgentConfig(companyOf(req), req.params.code));
});

export const updateAgentHandler = asyncHandler(async (req: Request, res) => {
  res.json(await config.updateAgentConfig(companyOf(req), req.params.code, req.body, userOf(req)));
});

// ── Metadatos para la interfaz ───────────────────────────────────────────────
/**
 * Todo lo que la pantalla de configuración necesita para pintar sus selectores.
 * Va en un solo endpoint para que el frontend no tenga que quemar estas listas
 * (regla transversal 7: nada de enums crudos ni etiquetas duplicadas).
 */
export const getConfigMetaHandler = asyncHandler(async (_req: Request, res) => {
  res.json({
    operators: CONDITION_OPERATORS.map(op => ({ value: op, label: OPERATOR_LABELS[op] })),
    scoringCategories: [
      { value: 'FIT', label: 'Perfil (quién es)', help: 'Cargo, industria, tamaño. No decae con el tiempo.' },
      { value: 'ENGAGEMENT', label: 'Interacción (qué hizo)', help: 'Visitas, respuestas, demos. Decae con el tiempo.' },
      { value: 'NEGATIVE', label: 'Penalización', help: 'Motivos de descarte: competidor, estudiante, correo personal.' },
    ],
    forecastCategories: FORECAST_CATEGORIES.map(c => ({ value: c, label: FORECAST_CATEGORY_LABELS[c] })),
    fieldTypes: forms.FIELD_TYPES,
    mappableLeadFields: forms.MAPPABLE_LEAD_FIELDS.map(f => ({ value: f, label: forms.LEAD_FIELD_LABELS[f] })),
    scorableFields: [
      { value: 'jobTitle', label: 'Cargo' },
      { value: 'companyName', label: 'Empresa' },
      { value: 'ruc', label: 'RUC' },
      { value: 'email', label: 'Correo electrónico' },
      { value: 'phone', label: 'Teléfono' },
      { value: 'city', label: 'Ciudad' },
      { value: 'website', label: 'Sitio web' },
      { value: 'message', label: 'Mensaje' },
      { value: 'source', label: 'Origen' },
      { value: 'utmCampaign', label: 'Campaña (UTM)' },
      { value: 'utmSource', label: 'Fuente (UTM)' },
      { value: 'tags', label: 'Etiquetas' },
    ],
    autonomyModes: [
      { value: 'autopilot', label: 'Piloto automático', help: 'El agente responde y actúa solo.' },
      { value: 'setter_closer', label: 'Agente califica, humano cierra', help: 'Recomendado.' },
      { value: 'semi_assisted', label: 'Redacta y espera aprobación', help: 'Cada mensaje pasa por un humano.' },
      { value: 'manual', label: 'Solo sugiere', help: 'El agente no toca la conversación.' },
    ],
    agentModels: [
      { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 — rápido y económico' },
      { value: 'claude-sonnet-5', label: 'Sonnet 5 — equilibrado' },
      { value: 'claude-opus-4-8', label: 'Opus 4.8 — máxima capacidad' },
    ],
  });
});
