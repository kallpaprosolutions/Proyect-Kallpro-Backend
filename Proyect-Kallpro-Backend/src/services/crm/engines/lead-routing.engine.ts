/**
 * Motor de enrutamiento de leads — PURO (sin BD, sin I/O). Regla transversal 6.
 *
 * Un lead sin dueño es un lead muerto: la probabilidad de contacto cae drásticamente con
 * las horas. Por eso la asignación ocurre EN EL MOMENTO de la captura, no en una revisión
 * posterior.
 *
 * Las reglas se evalúan por prioridad ascendente y GANA LA PRIMERA que casa, como un
 * cortafuegos. Es más predecible para el usuario que "la más específica gana", que obliga
 * a razonar sobre todas las reglas a la vez.
 *
 * El round-robin es determinista: recibe el cursor actual y devuelve el siguiente, para
 * que el estado viva en la BD y el motor siga siendo puro y testeable.
 */

import { Condition, evaluateAll } from './condition.engine';

export interface AssignmentRuleInput {
  id: string;
  name: string;
  priority: number;
  conditions: Condition[];
  assignMode: 'FIXED' | 'ROUND_ROBIN';
  ownerUserId?: string | null;
  poolUserIds?: string[];
  rrCursor?: number;
  isActive?: boolean;
}

export interface RoutingResult {
  ownerUserId: string | null;
  ruleId: string | null;
  ruleName: string | null;
  /** Nuevo cursor a persistir; null si la regla no es round-robin. */
  nextCursor: number | null;
  reason: string;
}

/**
 * Decide el propietario de un lead.
 *
 * @param fallbackOwnerUserId propietario por defecto del formulario, si ninguna regla casa
 */
export function routeLead(
  lead: Record<string, any>,
  rules: AssignmentRuleInput[],
  fallbackOwnerUserId?: string | null,
): RoutingResult {
  const ordered = (rules ?? [])
    .filter(r => r.isActive !== false)
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  for (const rule of ordered) {
    const conditions = (rule.conditions ?? []) as Condition[];
    if (!evaluateAll(conditions, lead)) continue;

    if (rule.assignMode === 'FIXED') {
      if (!rule.ownerUserId) continue; // regla mal configurada: se ignora, no rompe la captura
      return {
        ownerUserId: rule.ownerUserId,
        ruleId: rule.id,
        ruleName: rule.name,
        nextCursor: null,
        reason: `Regla "${rule.name}" (asignación fija)`,
      };
    }

    const pool = (rule.poolUserIds ?? []).filter(Boolean);
    if (pool.length === 0) continue; // sin equipo no hay a quién asignar

    const cursor = rule.rrCursor ?? 0;
    const index = ((cursor % pool.length) + pool.length) % pool.length; // tolera cursores negativos
    return {
      ownerUserId: pool[index],
      ruleId: rule.id,
      ruleName: rule.name,
      nextCursor: (index + 1) % pool.length,
      reason: `Regla "${rule.name}" (rotación ${index + 1}/${pool.length})`,
    };
  }

  return {
    ownerUserId: fallbackOwnerUserId ?? null,
    ruleId: null,
    ruleName: null,
    nextCursor: null,
    reason: fallbackOwnerUserId
      ? 'Sin regla coincidente: propietario por defecto del formulario'
      : 'Sin regla coincidente y sin propietario por defecto: queda sin asignar',
  };
}
