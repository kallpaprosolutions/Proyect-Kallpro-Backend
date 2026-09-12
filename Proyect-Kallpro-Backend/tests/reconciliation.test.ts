import { matchStatementLines } from '../src/services/reconciliation.service';

/**
 * Matcher de conciliación bancaria (puro):
 *  - AUTO: referencia idéntica, o candidato ÚNICO con monto exacto en ±3 días.
 *  - SUGERENCIA (semiautomático): monto exacto hasta ±15 días, o candidatos ambiguos.
 *  - Un movimiento solo puede asignarse a una línea.
 */

const tx = (id: string, type: 'INGRESO' | 'EGRESO', amount: number, date: string, reference?: string) => ({
  id, type, amount, date: new Date(`${date}T00:00:00Z`), reference: reference ?? null, status: 'REGISTRADO',
});
const line = (key: number, amount: number, date: string, reference?: string) => ({
  key, date, description: `linea ${key}`, reference, amount,
});

describe('matchStatementLines', () => {
  it('concilia AUTOMÁTICAMENTE monto exacto con fecha dentro de ±3 días', () => {
    const { auto, suggestions } = matchStatementLines(
      [line(0, -690.76, '2026-07-10')],
      [tx('t1', 'EGRESO', 690.76, '2026-07-09')],
    );
    expect(auto.get(0)?.transactionId).toBe('t1');
    expect(suggestions.size).toBe(0);
  });

  it('la referencia idéntica gana aunque la fecha esté lejos', () => {
    const { auto } = matchStatementLines(
      [line(0, -500, '2026-07-30', 'CHQ-001')],
      [tx('t1', 'EGRESO', 500, '2026-07-02', 'CHQ-001')],
    );
    expect(auto.get(0)).toMatchObject({ transactionId: 't1', score: 100 });
  });

  it('fecha entre 4 y 15 días → SUGERENCIA (semiautomático), no auto', () => {
    const { auto, suggestions } = matchStatementLines(
      [line(0, 1200, '2026-07-20')],
      [tx('t1', 'INGRESO', 1200, '2026-07-10')],
    );
    expect(auto.size).toBe(0);
    expect(suggestions.get(0)).toHaveLength(1);
    expect(suggestions.get(0)![0].transactionId).toBe('t1');
  });

  it('candidatos ambiguos en ventana automática → sugerencias, nunca auto', () => {
    const { auto, suggestions } = matchStatementLines(
      [line(0, -100, '2026-07-10')],
      [tx('t1', 'EGRESO', 100, '2026-07-09'), tx('t2', 'EGRESO', 100, '2026-07-11')],
    );
    expect(auto.size).toBe(0);
    expect(suggestions.get(0)!.map((s) => s.transactionId).sort()).toEqual(['t1', 't2']);
  });

  it('respeta el signo: un crédito del extracto no matchea un egreso', () => {
    const { auto, suggestions } = matchStatementLines(
      [line(0, 300, '2026-07-10')],
      [tx('t1', 'EGRESO', 300, '2026-07-10')],
    );
    expect(auto.size).toBe(0);
    expect(suggestions.size).toBe(0);
  });

  it('un movimiento no se asigna a dos líneas', () => {
    const { auto, suggestions } = matchStatementLines(
      [line(0, -50, '2026-07-10'), line(1, -50, '2026-07-10')],
      [tx('t1', 'EGRESO', 50, '2026-07-10')],
    );
    const assigned = [...auto.values()].map((m) => m.transactionId);
    expect(assigned).toEqual(['t1']);
    // La segunda línea queda sin candidatos (t1 ya está tomado)
    const other = auto.has(0) ? 1 : 0;
    expect(auto.has(other)).toBe(false);
    expect(suggestions.get(other) ?? []).toHaveLength(0);
  });

  it('movimientos ya conciliados no participan', () => {
    const conciliado = { ...tx('t1', 'EGRESO', 75, '2026-07-10'), status: 'CONCILIADO' };
    const { auto, suggestions } = matchStatementLines([line(0, -75, '2026-07-10')], [conciliado]);
    expect(auto.size).toBe(0);
    expect(suggestions.size).toBe(0);
  });

  it('sin contraparte (comisión bancaria) → ni auto ni sugerencias', () => {
    const { auto, suggestions } = matchStatementLines(
      [line(0, -4.5, '2026-07-10')],
      [tx('t1', 'EGRESO', 690.76, '2026-07-09')],
    );
    expect(auto.size).toBe(0);
    expect(suggestions.size).toBe(0);
  });
});
