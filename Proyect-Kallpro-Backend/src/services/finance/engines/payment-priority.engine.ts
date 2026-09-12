/**
 * Motor de priorización de pagos (CxP) — PURO (sin BD, sin I/O). Regla transversal 6.
 *
 * Cuatro factores, cada uno 0-100, combinados por peso configurable:
 *
 *   VENCIMIENTO   — cuántos días vencido está el documento. Cuanto más vencido, más urgente.
 *   IMPORTANCIA   — score del proveedor (SupplierScore.totalScore, Sprint compras). Un
 *                   proveedor estratégico bien evaluado no debería quedar en mora aunque el
 *                   monto sea chico: el costo de dañar la relación pesa más que el número.
 *   MONTO         — relativo al mayor saldo pendiente del lote (no absoluto): un pago que es
 *                   el más grande de la cola de hoy pesa más que uno pequeño, sin necesitar
 *                   un umbral fijo en dólares que no aplique igual a todas las empresas.
 *   FLUJO DE CAJA — si la semana de vencimiento del documento tiene caja proyectada negativa
 *                   (getCashFlowForecast), pagarlo ahí agrava el problema: se prioriza
 *                   resolverlo antes (negociar plazo o adelantar pago cuando SÍ hay caja).
 *
 * No hay score de confianza inventado: cada factor viene de un dato real del ERP (aging,
 * SupplierScore, forecast de caja) o de 0 cuando ese dato no existe todavía.
 */

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface PriorityWeights {
  overdue: number;
  importance: number;
  amount: number;
  cashFlow: number;
}

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  overdue: 40,
  importance: 20,
  amount: 20,
  cashFlow: 20,
};

/** Días de vencimiento tras los cuales un documento alcanza el score máximo de urgencia. */
export const OVERDUE_SATURATION_DAYS = 90;

export interface PriorityInput {
  id: string;
  /** Días de vencimiento (negativo o 0 = aún no vence). */
  daysOverdue: number;
  balance: number;
  /** SupplierScore.totalScore (0-100); null si el proveedor aún no tiene evaluación. */
  supplierScore?: number | null;
  /** Semana (1-based, igual a aging.getCashFlowForecast) en la que cae el vencimiento. */
  cashFlowWeek?: number | null;
}

export interface PriorityBreakdownItem {
  factor: 'VENCIMIENTO' | 'IMPORTANCIA' | 'MONTO' | 'FLUJO_CAJA';
  score: number; // 0-100, antes de ponderar
  weight: number;
  detail: string;
}

export interface PriorityResult {
  score: number; // 0-100 final, ponderado
  level: 'ALTA' | 'MEDIA' | 'BAJA';
  breakdown: PriorityBreakdownItem[];
}

export const PRIORITY_ALTA_THRESHOLD = 70;
export const PRIORITY_MEDIA_THRESHOLD = 40;

/**
 * Prioriza un lote de documentos por pagar. `maxBalance` y `tightCashWeeks` se calculan
 * sobre TODO el lote (no por documento individual) porque "monto grande" y "semana de caja
 * ajustada" solo tienen sentido comparados contra el resto de la cola de pagos.
 */
export function scorePayablesPriority(
  items: PriorityInput[],
  maxBalance: number,
  tightCashWeeks: ReadonlySet<number>,
  weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS,
): Map<string, PriorityResult> {
  const results = new Map<string, PriorityResult>();
  const totalWeight = weights.overdue + weights.importance + weights.amount + weights.cashFlow;

  for (const item of items) {
    const overdueScore = item.daysOverdue > 0
      ? clamp(Math.round((item.daysOverdue / OVERDUE_SATURATION_DAYS) * 100), 0, 100)
      : 0;
    const importanceScore = clamp(Math.round(item.supplierScore ?? 50), 0, 100);
    const amountScore = maxBalance > 0 ? clamp(Math.round((item.balance / maxBalance) * 100), 0, 100) : 0;
    const cashFlowTight = item.cashFlowWeek != null && tightCashWeeks.has(item.cashFlowWeek);
    const cashFlowScore = cashFlowTight ? 100 : 0;

    const combined = totalWeight > 0
      ? (overdueScore * weights.overdue + importanceScore * weights.importance
        + amountScore * weights.amount + cashFlowScore * weights.cashFlow) / totalWeight
      : 0;
    const score = clamp(Math.round(combined), 0, 100);

    const level: PriorityResult['level'] =
      score >= PRIORITY_ALTA_THRESHOLD ? 'ALTA'
      : score >= PRIORITY_MEDIA_THRESHOLD ? 'MEDIA'
      : 'BAJA';

    const breakdown: PriorityBreakdownItem[] = [
      { factor: 'VENCIMIENTO', score: overdueScore, weight: weights.overdue, detail: item.daysOverdue > 0 ? `${item.daysOverdue} día(s) vencido` : 'Aún no vence' },
      { factor: 'IMPORTANCIA', score: importanceScore, weight: weights.importance, detail: item.supplierScore != null ? `Score proveedor ${Math.round(item.supplierScore)}/100` : 'Proveedor sin evaluación (neutral 50/100)' },
      { factor: 'MONTO', score: amountScore, weight: weights.amount, detail: `${Math.round(amountScore)}% del mayor saldo pendiente del lote` },
      { factor: 'FLUJO_CAJA', score: cashFlowScore, weight: weights.cashFlow, detail: cashFlowTight ? 'Cae en una semana con caja proyectada negativa' : 'Caja proyectada suficiente esa semana' },
    ];

    results.set(item.id, { score, level, breakdown });
  }

  return results;
}
