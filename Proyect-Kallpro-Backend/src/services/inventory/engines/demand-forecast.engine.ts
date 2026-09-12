// Motor PURO (sin BD) — pronóstico de demanda y tendencia de rotación de productos.
// Método: suavizado exponencial simple (alpha configurable), el estándar de la industria para
// un primer pronóstico sin necesitar series largas ni estacionalidad — ver Duke/Study.com/
// Inventoryops.com (suavizado exponencial vs promedio móvil). La rotación usa la fórmula
// clásica de finanzas: Índice de Rotación = COGS / Inventario promedio (anualizado).

/** Suaviza `history` (unidades vendidas por período, en orden cronológico) y proyecta el
 * siguiente período. `alpha` bajo (0.1-0.2) = más estable; alto (0.4-0.5) = más reactivo a
 * cambios recientes. Default 0.3: compromiso razonable para demanda de PYME (pocos períodos). */
export function forecastNextPeriod(history: number[], alpha = 0.3): number {
  if (history.length === 0) return 0;
  let smoothed = history[0];
  for (let i = 1; i < history.length; i++) {
    smoothed = alpha * history[i] + (1 - alpha) * smoothed;
  }
  return Math.round(smoothed * 100) / 100;
}

export type DemandTrend = 'CRECIENTE' | 'ESTABLE' | 'DECRECIENTE';

/** Compara el promedio de la primera mitad de la serie contra la segunda mitad — más robusto
 * que comparar solo el último período contra el anterior (un mes atípico no cambia la lectura). */
export function classifyTrend(history: number[]): DemandTrend {
  if (history.length < 2) return 'ESTABLE';
  const mid = Math.ceil(history.length / 2);
  const firstHalf = history.slice(0, mid);
  const secondHalf = history.slice(mid);
  if (secondHalf.length === 0) return 'ESTABLE';
  const avg = (arr: number[]) => arr.reduce((s, n) => s + n, 0) / arr.length;
  const before = avg(firstHalf);
  const after = avg(secondHalf);
  if (before === 0 && after === 0) return 'ESTABLE';
  const change = (after - before) / (before || 1);
  if (change > 0.15) return 'CRECIENTE';
  if (change < -0.15) return 'DECRECIENTE';
  return 'ESTABLE';
}

/** Índice de Rotación = COGS del período (anualizado) / valor promedio de inventario. */
export function computeTurnoverRatio(annualizedCogs: number, avgInventoryValue: number): number {
  if (avgInventoryValue <= 0) return 0;
  return Math.round((annualizedCogs / avgInventoryValue) * 100) / 100;
}

export type RotationLevel = 'ALTA' | 'MEDIA' | 'BAJA';

/** Umbrales estándar de industria: ≥6 rotaciones/año = alta, 2-6 = media, <2 = lenta (candidato a stock muerto). */
export function classifyRotation(annualizedTurnover: number): RotationLevel {
  if (annualizedTurnover >= 6) return 'ALTA';
  if (annualizedTurnover >= 2) return 'MEDIA';
  return 'BAJA';
}
