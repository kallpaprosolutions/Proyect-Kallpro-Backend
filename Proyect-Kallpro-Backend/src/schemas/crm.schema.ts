import { z } from 'zod';

/**
 * Esquemas de validación CRM (Sprint 2.3 · paso 3).
 *
 * Validan los campos OBLIGATORIOS de cada endpoint; `.passthrough()` conserva los
 * campos opcionales adicionales que el servicio sabe manejar (no los descarta).
 * Reemplazan las verificaciones inline tipo `if (!data.firstName)`.
 */

export const contactCreateSchema = z.object({
  firstName: z.string().min(1, 'firstName es requerido'),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
}).passthrough();

export const companyCreateSchema = z.object({
  name: z.string().min(1, 'name es requerido'),
}).passthrough();

export const validateRucSchema = z.object({
  ruc: z.string().min(1, 'ruc es requerido'),
}).passthrough();

export const dealCreateSchema = z.object({
  title: z.string().min(1, 'title es requerido'),
  contactId: z.string().min(1, 'contactId es requerido'),
}).passthrough();

export const dealStageSchema = z.object({
  stage: z.string().min(1, 'stage es requerido'),
}).passthrough();

export const messageCreateSchema = z.object({
  body: z.string().min(1, 'body es requerido'),
}).passthrough();

export const conversationStatusSchema = z.object({
  status: z.string().min(1, 'status es requerido'),
}).passthrough();

// ════════════════════════════════════════════════════════════════════
// CRM Pro (Sprint 13) — leads, configuración y pronóstico
// ════════════════════════════════════════════════════════════════════

/**
 * Se usa `.passthrough()` en los formularios públicos a propósito: los campos que el
 * usuario define desde la interfaz no se pueden declarar aquí. La validación real
 * (obligatorios, tipos, mapeo) la hace `capture-form.service` contra la definición
 * guardada del formulario.
 */
export const leadCreateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email('Correo electrónico inválido').optional(),
  phone: z.string().optional(),
}).passthrough().refine(
  d => Boolean(d.email || d.phone || d.firstName),
  { message: 'El lead necesita al menos nombre, correo o teléfono' },
);

export const leadEventSchema = z.object({
  eventType: z.string().min(1, 'eventType es requerido'),
  channel: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const leadDisqualifySchema = z.object({
  reason: z.string().min(3, 'Indica un motivo de descarte'),
});

export const leadConvertSchema = z.object({
  createDeal: z.boolean().optional(),
  dealName: z.string().optional(),
  dealAmount: z.number().nonnegative('El monto no puede ser negativo').optional(),
  dealStage: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  existingContactId: z.string().optional(),
  existingCrmCompanyId: z.string().optional(),
}).passthrough();

const conditionOperator = z.enum([
  'EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'IN', 'NOT_IN',
  'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'EXISTS', 'NOT_EXISTS', 'EVENT_COUNT',
]);

export const scoringRuleSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  category: z.enum(['FIT', 'ENGAGEMENT', 'NEGATIVE']),
  field: z.string().min(1, 'El campo es requerido'),
  operator: conditionOperator,
  value: z.array(z.string()).default([]),
  points: z.number().int().min(0).max(100, 'Los puntos van de 0 a 100'),
  maxPoints: z.number().int().positive().nullable().optional(),
  halfLifeDays: z.number().int().positive().nullable().optional(),
  description: z.string().optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const scoringConfigSchema = z.object({
  fitWeight: z.number().int().min(0).max(100).optional(),
  engagementWeight: z.number().int().min(0).max(100).optional(),
  halfLifeDays: z.number().int().min(0).max(3650).optional(),
  mqlThreshold: z.number().int().min(0).max(100).optional(),
  sqlThreshold: z.number().int().min(0).max(100).optional(),
  gradeAThreshold: z.number().int().min(0).max(100).optional(),
  gradeBThreshold: z.number().int().min(0).max(100).optional(),
  gradeCThreshold: z.number().int().min(0).max(100).optional(),
  hotThreshold: z.number().int().min(0).max(100).optional(),
  warmThreshold: z.number().int().min(0).max(100).optional(),
});

export const pipelineStageSchema = z.object({
  code: z.string().min(1, 'El código es requerido').regex(/^[a-z0-9_]+$/, 'El código solo admite minúsculas, números y guion bajo'),
  name: z.string().min(1, 'El nombre es requerido'),
  sequence: z.number().int().optional(),
  probability: z.number().int().min(0).max(100, 'La probabilidad va de 0 a 100'),
  forecastCategory: z.enum(['PIPELINE', 'BEST_CASE', 'COMMIT', 'CLOSED', 'OMITTED']).optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
  entryCriteria: z.string().optional(),
  targetDays: z.number().int().min(0).optional(),
  color: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const assignmentRuleSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  priority: z.number().int().optional(),
  conditions: z.array(z.object({
    field: z.string().min(1),
    operator: conditionOperator,
    value: z.array(z.string()).default([]),
  })).default([]),
  assignMode: z.enum(['FIXED', 'ROUND_ROBIN']),
  ownerUserId: z.string().nullable().optional(),
  poolUserIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const captureFormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  fields: z.array(z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: z.enum(['text', 'email', 'phone', 'textarea', 'select', 'number', 'checkbox']),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    options: z.array(z.string()).optional(),
    mapsTo: z.string().optional(),
  })).optional(),
  consentText: z.string().optional(),
  requireConsent: z.boolean().optional(),
  successMessage: z.string().optional(),
  redirectUrl: z.string().url('La URL de redirección no es válida').or(z.literal('')).nullable().optional(),
  defaultOwnerUserId: z.string().nullable().optional(),
  autoScore: z.boolean().optional(),
  autoAssign: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const agentConfigSchema = z.object({
  name: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  systemPrompt: z.string().min(20, 'La instrucción del agente es demasiado corta').optional(),
  maxTokens: z.number().int().min(128).max(8192).optional(),
  temperature: z.number().min(0).max(1).optional(),
  autonomyDefault: z.enum(['autopilot', 'setter_closer', 'semi_assisted', 'manual']).optional(),
  isActive: z.boolean().optional(),
  tools: z.array(z.any()).optional(),
});

export const forecastQuotaSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'El período debe tener el formato AAAA-MM'),
  quotaUsd: z.number().nonnegative('La cuota no puede ser negativa'),
});

export const forecastPeriodSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'El período debe tener el formato AAAA-MM'),
});

export const dealCategorySchema = z.object({
  category: z.enum(['PIPELINE', 'BEST_CASE', 'COMMIT', 'CLOSED', 'OMITTED']),
});

export const stageReorderSchema = z.object({
  order: z.array(z.object({
    id: z.string().min(1),
    sequence: z.number().int(),
  })).min(1, 'Envía al menos una etapa'),
});
