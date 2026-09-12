/**
 * Configuración del CRM editable desde la interfaz (Sprint 13).
 *
 * Cubre las cuatro cosas que antes estaban quemadas en el código o solo en la BD:
 * etapas del pipeline, reglas de scoring, umbrales de scoring y reglas de asignación.
 *
 * Todo lleva `companyId` y toda consulta filtra por él (regla transversal 1). Los
 * defaults se siembran de forma perezosa la primera vez que una empresa entra al CRM,
 * para que nadie vea una pantalla vacía sin saber por dónde empezar.
 */

import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import {
  DEFAULT_SCORING_CONFIG, defaultScoringRules,
  ScoringConfigInput, ScoringRuleInput,
} from './engines/lead-scoring.engine';
import { defaultPipelineStages, StageConfigInput, ForecastCategory } from './engines/forecast.engine';
import { AssignmentRuleInput } from './engines/lead-routing.engine';
import { Condition } from './engines/condition.engine';

// ════════════════════════════════════════════════════════════════════
// Etapas del pipeline
// ════════════════════════════════════════════════════════════════════

/** Devuelve las etapas de la empresa, sembrando las por defecto la primera vez. */
export async function getPipelineStages(companyId: string): Promise<StageConfigInput[]> {
  const existing = await prisma.crmPipelineStage.findMany({
    where: { companyId, isActive: true },
    orderBy: { sequence: 'asc' },
  });

  if (existing.length > 0) return existing.map(toStageConfig);

  await prisma.crmPipelineStage.createMany({
    data: defaultPipelineStages().map(s => ({ ...s, companyId })),
    skipDuplicates: true,
  });

  const seeded = await prisma.crmPipelineStage.findMany({
    where: { companyId, isActive: true },
    orderBy: { sequence: 'asc' },
  });
  return seeded.map(toStageConfig);
}

function toStageConfig(row: any): StageConfigInput {
  return {
    code: row.code,
    name: row.name,
    sequence: row.sequence,
    probability: row.probability,
    forecastCategory: row.forecastCategory as ForecastCategory,
    isWon: row.isWon,
    isLost: row.isLost,
    targetDays: row.targetDays,
  };
}

export async function listPipelineStages(companyId: string) {
  await getPipelineStages(companyId); // siembra si hace falta
  return prisma.crmPipelineStage.findMany({
    where: { companyId },
    orderBy: { sequence: 'asc' },
  });
}

export async function createPipelineStage(companyId: string, data: any) {
  const dup = await prisma.crmPipelineStage.findFirst({ where: { companyId, code: data.code } });
  if (dup) throw AppError.conflict(`Ya existe una etapa con el código "${data.code}"`, 'STAGE_CODE_TAKEN');
  return prisma.crmPipelineStage.create({ data: { ...data, companyId } });
}

export async function updatePipelineStage(companyId: string, id: string, data: any) {
  const stage = await prisma.crmPipelineStage.findFirst({ where: { id, companyId } });
  if (!stage) throw AppError.notFound('Etapa no encontrada', 'STAGE_NOT_FOUND');
  // El código es la clave con la que se guardan las oportunidades; cambiarlo dejaría
  // huérfanas todas las que están en esa etapa.
  if (data.code && data.code !== stage.code) {
    throw AppError.badRequest('El código de la etapa no se puede cambiar; crea una etapa nueva', 'STAGE_CODE_IMMUTABLE');
  }
  return prisma.crmPipelineStage.update({ where: { id }, data });
}

export async function deletePipelineStage(companyId: string, id: string) {
  const stage = await prisma.crmPipelineStage.findFirst({ where: { id, companyId } });
  if (!stage) throw AppError.notFound('Etapa no encontrada', 'STAGE_NOT_FOUND');

  const inUse = await prisma.crmDeal.count({ where: { companyId, stage: stage.code } });
  if (inUse > 0) {
    // Desactivar en vez de borrar: si se borra, las oportunidades pierden su etapa y el
    // pronóstico deja de cuadrar (regla transversal 5: los estados no se destruyen).
    throw AppError.badRequest(
      `No se puede eliminar: ${inUse} oportunidad(es) están en esta etapa. Desactívala en su lugar.`,
      'STAGE_IN_USE',
    );
  }
  await prisma.crmPipelineStage.delete({ where: { id } });
  return { deleted: true };
}

/** Reordena las etapas de una vez (arrastrar y soltar en la interfaz). */
export async function reorderPipelineStages(companyId: string, order: Array<{ id: string; sequence: number }>) {
  const ids = order.map(o => o.id);
  const owned = await prisma.crmPipelineStage.count({ where: { companyId, id: { in: ids } } });
  if (owned !== ids.length) throw AppError.badRequest('Alguna etapa no pertenece a la empresa', 'STAGE_NOT_FOUND');

  await prisma.$transaction(
    order.map(o => prisma.crmPipelineStage.update({ where: { id: o.id }, data: { sequence: o.sequence } })),
  );
  return listPipelineStages(companyId);
}

// ════════════════════════════════════════════════════════════════════
// Configuración de scoring (umbrales y pesos)
// ════════════════════════════════════════════════════════════════════

export async function getScoringConfig(companyId: string): Promise<ScoringConfigInput & { id?: string }> {
  const existing = await prisma.crmScoringConfig.findUnique({ where: { companyId } });
  if (existing) return existing as any;

  const created = await prisma.crmScoringConfig.create({
    data: { companyId, ...DEFAULT_SCORING_CONFIG },
  });
  return created as any;
}

export async function updateScoringConfig(companyId: string, data: Partial<ScoringConfigInput>, userId?: string) {
  await getScoringConfig(companyId); // garantiza que la fila existe

  if (data.fitWeight !== undefined || data.engagementWeight !== undefined) {
    const current = await prisma.crmScoringConfig.findUnique({ where: { companyId } });
    const fit = data.fitWeight ?? current!.fitWeight;
    const eng = data.engagementWeight ?? current!.engagementWeight;
    if (fit + eng !== 100) {
      throw AppError.badRequest('Los pesos de perfil e interacción deben sumar 100', 'WEIGHTS_MUST_SUM_100');
    }
  }

  if (data.mqlThreshold !== undefined && data.sqlThreshold !== undefined && data.mqlThreshold >= data.sqlThreshold) {
    throw AppError.badRequest('El umbral MQL debe ser menor que el SQL', 'INVALID_THRESHOLDS');
  }

  return prisma.crmScoringConfig.update({
    where: { companyId },
    data: { ...data, updatedBy: userId },
  });
}

// ════════════════════════════════════════════════════════════════════
// Reglas de scoring
// ════════════════════════════════════════════════════════════════════

export async function getScoringRules(companyId: string): Promise<ScoringRuleInput[]> {
  const rows = await listScoringRules(companyId);
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    category: r.category as ScoringRuleInput['category'],
    field: r.field,
    operator: r.operator as ScoringRuleInput['operator'],
    value: r.value,
    points: r.points,
    maxPoints: r.maxPoints,
    halfLifeDays: r.halfLifeDays,
    isActive: r.isActive,
    priority: r.priority,
  }));
}

export async function listScoringRules(companyId: string) {
  const existing = await prisma.crmScoringRule.findMany({
    where: { companyId },
    orderBy: [{ category: 'asc' }, { priority: 'asc' }],
  });
  if (existing.length > 0) return existing;

  await prisma.crmScoringRule.createMany({
    data: defaultScoringRules().map(r => ({
      companyId,
      name: r.name,
      category: r.category,
      field: r.field,
      operator: r.operator,
      value: r.value,
      points: r.points,
      maxPoints: r.maxPoints ?? null,
      description: r.description ?? null,
    })),
  });

  return prisma.crmScoringRule.findMany({
    where: { companyId },
    orderBy: [{ category: 'asc' }, { priority: 'asc' }],
  });
}

const VALID_CATEGORIES = ['FIT', 'ENGAGEMENT', 'NEGATIVE'];

export async function createScoringRule(companyId: string, data: any) {
  if (!VALID_CATEGORIES.includes(data.category)) {
    throw AppError.badRequest('Categoría de regla inválida', 'INVALID_CATEGORY');
  }
  return prisma.crmScoringRule.create({
    data: {
      companyId,
      name: data.name,
      category: data.category,
      field: data.field,
      operator: data.operator,
      value: data.value ?? [],
      points: Math.abs(data.points ?? 0), // los negativos se guardan en positivo; el motor los resta
      maxPoints: data.maxPoints ?? null,
      halfLifeDays: data.halfLifeDays ?? null,
      description: data.description ?? null,
      priority: data.priority ?? 100,
      isActive: data.isActive ?? true,
    },
  });
}

export async function updateScoringRule(companyId: string, id: string, data: any) {
  const rule = await prisma.crmScoringRule.findFirst({ where: { id, companyId } });
  if (!rule) throw AppError.notFound('Regla no encontrada', 'RULE_NOT_FOUND');
  if (data.category && !VALID_CATEGORIES.includes(data.category)) {
    throw AppError.badRequest('Categoría de regla inválida', 'INVALID_CATEGORY');
  }
  return prisma.crmScoringRule.update({
    where: { id },
    data: {
      ...data,
      ...(data.points !== undefined && { points: Math.abs(data.points) }),
    },
  });
}

export async function deleteScoringRule(companyId: string, id: string) {
  const rule = await prisma.crmScoringRule.findFirst({ where: { id, companyId } });
  if (!rule) throw AppError.notFound('Regla no encontrada', 'RULE_NOT_FOUND');
  await prisma.crmScoringRule.delete({ where: { id } });
  return { deleted: true };
}

/** Restaura el juego de reglas recomendado (borra las actuales). */
export async function resetScoringRules(companyId: string) {
  await prisma.crmScoringRule.deleteMany({ where: { companyId } });
  return listScoringRules(companyId);
}

// ════════════════════════════════════════════════════════════════════
// Reglas de asignación
// ════════════════════════════════════════════════════════════════════

export async function getAssignmentRules(companyId: string): Promise<AssignmentRuleInput[]> {
  const rows = await prisma.crmAssignmentRule.findMany({
    where: { companyId },
    orderBy: { priority: 'asc' },
  });
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    priority: r.priority,
    conditions: (r.conditions as unknown as Condition[]) ?? [],
    assignMode: r.assignMode as 'FIXED' | 'ROUND_ROBIN',
    ownerUserId: r.ownerUserId,
    poolUserIds: r.poolUserIds,
    rrCursor: r.rrCursor,
    isActive: r.isActive,
  }));
}

export async function listAssignmentRules(companyId: string) {
  return prisma.crmAssignmentRule.findMany({
    where: { companyId },
    orderBy: { priority: 'asc' },
  });
}

export async function createAssignmentRule(companyId: string, data: any) {
  if (data.assignMode === 'FIXED' && !data.ownerUserId) {
    throw AppError.badRequest('Una regla de asignación fija necesita un responsable', 'OWNER_REQUIRED');
  }
  if (data.assignMode === 'ROUND_ROBIN' && (!data.poolUserIds || data.poolUserIds.length === 0)) {
    throw AppError.badRequest('Una regla por rotación necesita al menos un vendedor en el equipo', 'POOL_REQUIRED');
  }
  return prisma.crmAssignmentRule.create({
    data: {
      companyId,
      name: data.name,
      priority: data.priority ?? 100,
      conditions: data.conditions ?? [],
      assignMode: data.assignMode ?? 'ROUND_ROBIN',
      ownerUserId: data.ownerUserId ?? null,
      poolUserIds: data.poolUserIds ?? [],
      isActive: data.isActive ?? true,
    },
  });
}

export async function updateAssignmentRule(companyId: string, id: string, data: any) {
  const rule = await prisma.crmAssignmentRule.findFirst({ where: { id, companyId } });
  if (!rule) throw AppError.notFound('Regla de asignación no encontrada', 'RULE_NOT_FOUND');
  return prisma.crmAssignmentRule.update({ where: { id }, data });
}

export async function deleteAssignmentRule(companyId: string, id: string) {
  const rule = await prisma.crmAssignmentRule.findFirst({ where: { id, companyId } });
  if (!rule) throw AppError.notFound('Regla de asignación no encontrada', 'RULE_NOT_FOUND');
  await prisma.crmAssignmentRule.delete({ where: { id } });
  return { deleted: true };
}

// ════════════════════════════════════════════════════════════════════
// Agentes de IA — edición desde la interfaz
// ════════════════════════════════════════════════════════════════════

const EDITABLE_AGENT_FIELDS = [
  'name', 'model', 'systemPrompt', 'maxTokens', 'temperature',
  'autonomyDefault', 'isActive', 'tools',
] as const;

const VALID_AUTONOMY = ['autopilot', 'setter_closer', 'semi_assisted', 'manual'];

/** Configuración completa del agente, incluida su instrucción (el listado no la trae). */
export async function getAgentConfig(companyId: string, code: string) {
  const agent = await prisma.crmAgent.findFirst({
    where: { companyId, code },
    select: {
      id: true, code: true, name: true, model: true, systemPrompt: true,
      maxTokens: true, temperature: true, tools: true, autonomyDefault: true,
      isActive: true, updatedAt: true,
    },
  });
  if (!agent) throw AppError.notFound(`Agente "${code}" no configurado para esta empresa`, 'AGENT_NOT_FOUND');
  return agent;
}

export async function updateAgentConfig(companyId: string, code: string, data: any, userId?: string) {
  const agent = await prisma.crmAgent.findFirst({ where: { companyId, code } });
  if (!agent) throw AppError.notFound(`Agente "${code}" no configurado para esta empresa`, 'AGENT_NOT_FOUND');

  if (data.autonomyDefault && !VALID_AUTONOMY.includes(data.autonomyDefault)) {
    throw AppError.badRequest('Modo de autonomía inválido', 'INVALID_AUTONOMY');
  }
  if (data.temperature !== undefined && (data.temperature < 0 || data.temperature > 1)) {
    throw AppError.badRequest('La temperatura debe estar entre 0 y 1', 'INVALID_TEMPERATURE');
  }
  if (data.maxTokens !== undefined && (data.maxTokens < 128 || data.maxTokens > 8192)) {
    throw AppError.badRequest('El máximo de tokens debe estar entre 128 y 8192', 'INVALID_MAX_TOKENS');
  }
  if (data.systemPrompt !== undefined && String(data.systemPrompt).trim().length < 20) {
    throw AppError.badRequest('La instrucción del agente es demasiado corta', 'PROMPT_TOO_SHORT');
  }

  const payload: Record<string, any> = {};
  for (const field of EDITABLE_AGENT_FIELDS) {
    if (data[field] !== undefined) payload[field] = data[field];
  }

  const updated = await prisma.crmAgent.update({ where: { id: agent.id }, data: payload });

  // Se deja rastro de quién cambió el comportamiento del agente: un prompt mal editado
  // puede cambiar lo que el sistema le dice a un cliente real.
  await prisma.crmAgentRun.create({
    data: {
      companyId,
      agentId: agent.id,
      agentCode: code,
      inputContext: { action: 'config_update', changedBy: userId, fields: Object.keys(payload) } as any,
      output: { ok: true } as any,
      status: 'config_update',
    },
  }).catch(() => undefined); // el registro de auditoría nunca debe tumbar la edición

  return updated;
}
