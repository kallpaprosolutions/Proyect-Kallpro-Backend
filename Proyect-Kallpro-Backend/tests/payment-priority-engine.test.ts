/**
 * Fase 3 (Asistente Contable CxP) — tests del motor puro de priorización de pagos.
 * Sin BD: función pura (regla transversal 6).
 */

import {
  scorePayablesPriority, DEFAULT_PRIORITY_WEIGHTS, PriorityInput,
  PRIORITY_ALTA_THRESHOLD, PRIORITY_MEDIA_THRESHOLD, OVERDUE_SATURATION_DAYS,
} from '../src/services/finance/engines/payment-priority.engine';

describe('payment-priority.engine', () => {
  it('un documento no vencido, sin importancia de proveedor ni monto relevante, sin caja ajustada → score bajo', () => {
    const items: PriorityInput[] = [{ id: 'a', daysOverdue: -5, balance: 100, supplierScore: null, cashFlowWeek: 1 }];
    const scored = scorePayablesPriority(items, 100, new Set());
    const r = scored.get('a')!;
    expect(r.level).toBe('BAJA');
    // Sin vencimiento (0) + proveedor neutral (50) + monto máximo del lote (100) + sin caja ajustada (0)
    // combinado con los pesos por defecto: (0*40 + 50*20 + 100*20 + 0*20)/100 = 30
    expect(r.score).toBe(30);
  });

  it('un documento muy vencido (>= saturación) alcanza el score máximo del factor vencimiento', () => {
    const items: PriorityInput[] = [{ id: 'a', daysOverdue: OVERDUE_SATURATION_DAYS + 30, balance: 100, supplierScore: 50, cashFlowWeek: 1 }];
    const scored = scorePayablesPriority(items, 100, new Set());
    const r = scored.get('a')!;
    expect(r.breakdown.find((b) => b.factor === 'VENCIMIENTO')!.score).toBe(100);
  });

  it('el factor monto es relativo al mayor saldo del lote, no absoluto', () => {
    const items: PriorityInput[] = [
      { id: 'small', daysOverdue: 0, balance: 50, supplierScore: 50, cashFlowWeek: 1 },
      { id: 'big', daysOverdue: 0, balance: 500, supplierScore: 50, cashFlowWeek: 1 },
    ];
    const scored = scorePayablesPriority(items, 500, new Set());
    expect(scored.get('big')!.breakdown.find((b) => b.factor === 'MONTO')!.score).toBe(100);
    expect(scored.get('small')!.breakdown.find((b) => b.factor === 'MONTO')!.score).toBe(10);
  });

  it('una semana con caja proyectada negativa sube el score de los documentos que caen ahí', () => {
    const base: PriorityInput = { id: 'a', daysOverdue: 0, balance: 100, supplierScore: 50, cashFlowWeek: 2 };
    const withoutTight = scorePayablesPriority([base], 100, new Set());
    const withTight = scorePayablesPriority([base], 100, new Set([2]));
    expect(withoutTight.get('a')!.score).toBeLessThan(withTight.get('a')!.score);
    expect(withTight.get('a')!.breakdown.find((b) => b.factor === 'FLUJO_CAJA')!.score).toBe(100);
  });

  it('proveedor sin evaluación usa un score neutral (50), ni penaliza ni favorece', () => {
    const items: PriorityInput[] = [{ id: 'a', daysOverdue: 0, balance: 100, supplierScore: null, cashFlowWeek: 1 }];
    const scored = scorePayablesPriority(items, 100, new Set());
    expect(scored.get('a')!.breakdown.find((b) => b.factor === 'IMPORTANCIA')!.score).toBe(50);
  });

  it('los niveles ALTA/MEDIA/BAJA respetan los umbrales configurados', () => {
    // Vencido al máximo + proveedor top + monto máximo + caja ajustada = score 100 → ALTA
    const alta = scorePayablesPriority(
      [{ id: 'a', daysOverdue: 200, balance: 100, supplierScore: 100, cashFlowWeek: 1 }],
      100, new Set([1]),
    ).get('a')!;
    expect(alta.score).toBeGreaterThanOrEqual(PRIORITY_ALTA_THRESHOLD);
    expect(alta.level).toBe('ALTA');

    // Nada vencido, proveedor neutral, monto mínimo, sin caja ajustada = score bajo → BAJA
    const baja = scorePayablesPriority(
      [{ id: 'b', daysOverdue: -10, balance: 1, supplierScore: 50, cashFlowWeek: 1 }],
      1000, new Set(),
    ).get('b')!;
    expect(baja.score).toBeLessThan(PRIORITY_MEDIA_THRESHOLD);
    expect(baja.level).toBe('BAJA');
  });

  it('con maxBalance 0 (lote vacío en la práctica) no revienta: el factor monto queda en 0', () => {
    const items: PriorityInput[] = [{ id: 'a', daysOverdue: 0, balance: 0, supplierScore: 50, cashFlowWeek: 1 }];
    const scored = scorePayablesPriority(items, 0, new Set());
    expect(scored.get('a')!.breakdown.find((b) => b.factor === 'MONTO')!.score).toBe(0);
  });

  it('pesos personalizados cambian la combinación (ej. ponderar solo vencimiento)', () => {
    const weights = { overdue: 100, importance: 0, amount: 0, cashFlow: 0 };
    const items: PriorityInput[] = [{ id: 'a', daysOverdue: 45, balance: 1, supplierScore: 0, cashFlowWeek: 1 }];
    const scored = scorePayablesPriority(items, 1000, new Set(), weights);
    // 45/90*100 = 50, y con peso 100% en vencimiento el score final es 50 exacto.
    expect(scored.get('a')!.score).toBe(50);
  });

  it('DEFAULT_PRIORITY_WEIGHTS suma 100 (para que el score final quede naturalmente en 0-100)', () => {
    const sum = DEFAULT_PRIORITY_WEIGHTS.overdue + DEFAULT_PRIORITY_WEIGHTS.importance
      + DEFAULT_PRIORITY_WEIGHTS.amount + DEFAULT_PRIORITY_WEIGHTS.cashFlow;
    expect(sum).toBe(100);
  });
});
