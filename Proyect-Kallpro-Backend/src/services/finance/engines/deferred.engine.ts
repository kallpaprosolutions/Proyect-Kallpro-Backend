// Motor PURO (sin BD) — 06-contabilidad backlog: diferidos (gastos pagados por anticipado /
// ingresos cobrados por anticipado), reconocidos en línea recta — NIC 1 (devengo). Mismo diseño
// que `fixed-asset.engine.ts` (B4): el registro del diferido NO contabiliza la transacción
// original (el pago anticipado o el cobro anticipado ya se registró como activo/pasivo diferido
// en una factura o asiento manual); este motor solo calcula el reconocimiento MENSUAL.

export type DeferredKind = 'GASTO' | 'INGRESO';

export function periodKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function periodIndex(period: string): number {
  const [y, m] = period.split('-').map(Number);
  return y * 12 + (m - 1);
}

function periodFromIndex(idx: number): string {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export interface DeferredDueRef {
  status: string; // ACTIVE | COMPLETED
  startDate: Date;
  lastRecognizedPeriod: string | null;
}

export interface RecognitionDueInfo {
  periodsElapsed: number; // cuántos meses calendario le faltan por reconocer (≥1)
  fromPeriod: string; // primer período pendiente
  toPeriod: string; // período de `asOf` — el que queda guardado en `lastRecognizedPeriod`
}

/**
 * Cuántos períodos (meses) le faltan reconocer a un diferido hasta `asOf`, o `null` si no le
 * toca nada todavía. Mismo razonamiento que `computeDueDepreciationPeriods` en
 * `fixed-asset.engine.ts`: el generador se dispara bajo demanda (sin cron), así que un mes
 * salteado debe recuperarse la próxima vez que se corra, no perderse — perderlo rompería el
 * devengo (NIC 1 §27-28), que es justamente la razón de ser de un diferido.
 */
export function computeDueRecognitionPeriods(item: DeferredDueRef, asOf: Date): RecognitionDueInfo | null {
  if (item.status !== 'ACTIVE') return null;
  if (asOf < item.startDate) return null;
  const toPeriod = periodKey(asOf);
  const startIndex = item.lastRecognizedPeriod != null
    ? periodIndex(item.lastRecognizedPeriod) + 1
    : periodIndex(periodKey(item.startDate));
  const endIndex = periodIndex(toPeriod);
  const periodsElapsed = endIndex - startIndex + 1;
  if (periodsElapsed <= 0) return null;
  return { periodsElapsed, fromPeriod: periodFromIndex(startIndex), toPeriod };
}

/** true si al diferido le toca generar su asiento de reconocimiento hasta el período de `asOf`
 * (uno o más meses pendientes). Atajo booleano de `computeDueRecognitionPeriods`. */
export function isRecognitionDue(item: DeferredDueRef, asOf: Date): boolean {
  return computeDueRecognitionPeriods(item, asOf) !== null;
}

export interface RecognitionResult {
  amount: number; // reconocimiento de el/los período(s) cubiertos (capado al saldo restante)
  newRecognized: number;
  completed: boolean;
}

/**
 * Reconocimiento en línea recta de uno o más períodos (mensual): (monto total / número de meses)
 * × `periods`, para recuperar de una sola vez varios meses salteados. El monto se capa al saldo
 * restante para no pasarse del total, sin importar cuántos períodos se estén recuperando (mismo
 * criterio que `computeMonthlyDepreciation`, evita que el redondeo acumulado deje un residuo
 * eterno).
 */
export function computeMonthlyRecognition(totalAmount: number, months: number, recognizedAmount: number, periods: number = 1): RecognitionResult {
  const remaining = Math.max(0, Math.round((totalAmount - recognizedAmount) * 100) / 100);
  if (months <= 0 || remaining <= 0.005 || periods <= 0) {
    return { amount: 0, newRecognized: recognizedAmount, completed: remaining <= 0.005 };
  }
  const monthly = totalAmount / months;
  const amount = Math.round(Math.min(monthly * periods, remaining) * 100) / 100;
  const newRecognized = Math.round((recognizedAmount + amount) * 100) / 100;
  return { amount, newRecognized, completed: newRecognized >= totalAmount - 0.005 };
}
