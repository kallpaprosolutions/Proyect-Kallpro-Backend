/**
 * Cobranza automática (dunning): decide qué recordatorio toca a cada factura vencida según
 * los escalones configurados en ErpConfig.finance.dunning.steps. Motor puro: recibe las
 * facturas con sus días de mora y los escalones ya disparados, devuelve qué crear.
 *
 * Reglas:
 * - Cada escalón se dispara UNA vez por factura (idempotente por `firedSteps`).
 * - Si una factura entra tarde al sistema (p.ej. ya con 40 días de mora) solo se dispara el
 *   escalón MÁS ALTO aplicable, no los tres de golpe — tres mensajes el mismo día no cobran
 *   más rápido, solo molestan al cliente.
 * - Una promesa de pago vigente pausa los recordatorios (si `pauseWhenPromise`): la gestión
 *   humana ya está en curso y el recordatorio automático la pisaría.
 */
export type DunningChannel = 'EMAIL' | 'WHATSAPP' | 'CALL';

export interface DunningStep {
  daysOverdue: number;
  type: DunningChannel;
  message: string;
}

export interface OverdueInvoiceRef {
  invoiceId: string;
  customerId: string;
  number: string;
  daysOverdue: number;
  balance: number;
  firedSteps: number[];
  hasActivePromise: boolean;
}

export interface DunningAction {
  invoiceId: string;
  customerId: string;
  stepIndex: number;
  step: DunningStep;
}

export function planDunning(
  invoices: OverdueInvoiceRef[],
  steps: DunningStep[],
  opts: { pauseWhenPromise: boolean },
): DunningAction[] {
  const ordered = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.daysOverdue > 0)
    .sort((a, b) => a.step.daysOverdue - b.step.daysOverdue);
  if (ordered.length === 0) return [];

  const actions: DunningAction[] = [];
  for (const inv of invoices) {
    if (inv.daysOverdue <= 0 || inv.balance <= 0) continue;
    if (opts.pauseWhenPromise && inv.hasActivePromise) continue;
    const maxFired = inv.firedSteps.length ? Math.max(...inv.firedSteps) : -1;
    const applicable = ordered.filter(({ step, index }) => step.daysOverdue <= inv.daysOverdue && index > maxFired);
    if (applicable.length === 0) continue;
    const highest = applicable[applicable.length - 1];
    actions.push({ invoiceId: inv.invoiceId, customerId: inv.customerId, stepIndex: highest.index, step: highest.step });
  }
  return actions;
}

/** Plantilla con {{cliente}}, {{factura}}, {{saldo}}, {{dias}}, {{vencimiento}}, {{empresa}}. */
export function renderDunningMessage(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));
}

export const DEFAULT_DUNNING_STEPS: DunningStep[] = [
  {
    daysOverdue: 3,
    type: 'EMAIL',
    message: 'Estimado/a {{cliente}}: le recordamos que la factura {{factura}} por ${{saldo}} venció el {{vencimiento}}. Si ya realizó el pago, ignore este mensaje. Gracias, {{empresa}}.',
  },
  {
    daysOverdue: 15,
    type: 'WHATSAPP',
    message: 'Hola {{cliente}}, la factura {{factura}} (${{saldo}}) lleva {{dias}} días vencida. ¿Podemos coordinar la fecha de pago? — {{empresa}}',
  },
  {
    daysOverdue: 30,
    type: 'CALL',
    message: 'Llamar a {{cliente}}: factura {{factura}} con {{dias}} días de mora y saldo ${{saldo}}. Acordar plan de pago o escalar a gerencia.',
  },
];
