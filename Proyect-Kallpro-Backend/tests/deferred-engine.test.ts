import { periodKey, isRecognitionDue, computeDueRecognitionPeriods, computeMonthlyRecognition } from '../src/services/finance/engines/deferred.engine';

describe('deferred.engine — periodKey', () => {
  it('formatea AAAA-MM con cero a la izquierda', () => {
    expect(periodKey(new Date(Date.UTC(2026, 0, 15)))).toBe('2026-01');
    expect(periodKey(new Date(Date.UTC(2026, 10, 1)))).toBe('2026-11');
  });
});

describe('deferred.engine — isRecognitionDue', () => {
  const base = { status: 'ACTIVE', startDate: new Date('2026-01-01'), lastRecognizedPeriod: null };

  it('debe reconocer si está activo, ya empezó y no se procesó este mes', () => {
    expect(isRecognitionDue(base, new Date('2026-03-15'))).toBe(true);
  });

  it('no debe reconocer si ya está COMPLETED', () => {
    expect(isRecognitionDue({ ...base, status: 'COMPLETED' }, new Date('2026-03-15'))).toBe(false);
  });

  it('no debe reconocer antes de la fecha de inicio', () => {
    expect(isRecognitionDue(base, new Date('2025-12-01'))).toBe(false);
  });

  it('no debe reconocer dos veces el mismo mes (idempotencia)', () => {
    expect(isRecognitionDue({ ...base, lastRecognizedPeriod: '2026-03' }, new Date('2026-03-20'))).toBe(false);
  });
});

describe('deferred.engine — computeMonthlyRecognition', () => {
  it('reconoce total/meses en línea recta', () => {
    const r = computeMonthlyRecognition(1200, 12, 0);
    expect(r.amount).toBe(100);
    expect(r.newRecognized).toBe(100);
    expect(r.completed).toBe(false);
  });

  it('el último período capa al saldo restante (absorbe redondeo)', () => {
    // 1000/3 = 333.33... — dos períodos ya reconocidos 666.67, queda 333.33 exacto
    const r = computeMonthlyRecognition(1000, 3, 666.67);
    expect(r.amount).toBe(333.33);
    expect(r.newRecognized).toBe(1000);
    expect(r.completed).toBe(true);
  });

  it('ya reconocido por completo → 0 y completed true', () => {
    const r = computeMonthlyRecognition(500, 5, 500);
    expect(r.amount).toBe(0);
    expect(r.completed).toBe(true);
  });

  it('meses <= 0 no reconoce nada (evita división por cero)', () => {
    const r = computeMonthlyRecognition(500, 0, 0);
    expect(r.amount).toBe(0);
  });

  it('catch-up: periods > 1 multiplica la cuota mensual (recupera meses salteados)', () => {
    // 1200/12 = 100/mes × 5 meses salteados = 500
    const r = computeMonthlyRecognition(1200, 12, 0, 5);
    expect(r.amount).toBe(500);
    expect(r.newRecognized).toBe(500);
  });

  it('catch-up: igual se capa al saldo restante aunque periods sea grande', () => {
    const r = computeMonthlyRecognition(1200, 12, 1100, 6); // cuota 100 × 6 se pasaría del total
    expect(r.amount).toBe(100);
    expect(r.newRecognized).toBe(1200);
    expect(r.completed).toBe(true);
  });
});

describe('deferred.engine — computeDueRecognitionPeriods (catch-up — NIC 1 §27-28, el devengo no debe perder meses salteados)', () => {
  const base = { status: 'ACTIVE', startDate: new Date('2026-01-01T00:00:00Z'), lastRecognizedPeriod: null };

  it('nunca se corrió: cuenta desde el mes de inicio hasta el de corte, inclusive', () => {
    const due = computeDueRecognitionPeriods(base, new Date('2026-07-10T00:00:00Z'));
    expect(due).toEqual({ periodsElapsed: 7, fromPeriod: '2026-01', toPeriod: '2026-07' });
  });

  it('se saltearon varios meses: recupera todos de una vez, no solo el actual', () => {
    const due = computeDueRecognitionPeriods({ ...base, lastRecognizedPeriod: '2026-02' }, new Date('2026-05-10T00:00:00Z'));
    expect(due).toEqual({ periodsElapsed: 3, fromPeriod: '2026-03', toPeriod: '2026-05' });
  });

  it('ya al día: null (nada pendiente)', () => {
    expect(computeDueRecognitionPeriods({ ...base, lastRecognizedPeriod: '2026-05' }, new Date('2026-05-20T00:00:00Z'))).toBeNull();
  });
});
