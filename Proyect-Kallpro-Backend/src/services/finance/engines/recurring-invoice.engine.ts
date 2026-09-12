// Motor PURO (sin BD) — B3 del plan de mejoras: decide si una plantilla de factura recurrente
// (arriendo, servicio básico, suscripción) ya está vencida y debe generar su documento del mes.
// Todas las fechas se tratan en UTC (regla del proyecto: evita el bug de TZ que ya mordió el
// cierre de período — ver Sprint 6) para que "el día 5" sea el mismo día sin importar dónde
// corra el proceso.

export interface RecurringTemplateDueRef {
  isActive: boolean;
  startDate: Date;
  endDate: Date | null;
  dayOfMonth: number; // 1-28
  lastGeneratedPeriod: string | null; // "AAAA-MM" del último período ya generado
}

/** Período (AAAA-MM, UTC) de una fecha — clave de idempotencia: un mes genera una sola vez. */
export function periodKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/**
 * true si la plantilla debe generar su factura del período de `asOf`. Clampa `dayOfMonth` a los
 * días reales del mes (ej. día 31 en febrero se evalúa el 28/29, nunca se corre a marzo).
 */
export function isTemplateDue(template: RecurringTemplateDueRef, asOf: Date): boolean {
  if (!template.isActive) return false;
  if (asOf < template.startDate) return false;
  if (template.endDate && asOf > template.endDate) return false;
  if (template.lastGeneratedPeriod === periodKey(asOf)) return false;
  const effectiveDay = Math.min(template.dayOfMonth, daysInMonth(asOf.getUTCFullYear(), asOf.getUTCMonth()));
  return asOf.getUTCDate() >= effectiveDay;
}
