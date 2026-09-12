import { toCsv } from '../src/utils/csv.helper';
import { PeriodClosedError, utcYearMonth } from '../src/services/finance/fiscal-period.service';
import { accountTypeFromCode } from '../src/services/finance/accounting.service';

/**
 * Sprint 6 — Contabilidad Pro: lógica pura (sin BD).
 * CSV (formato Excel-es), error de período cerrado y tipado de cuentas Supercías.
 */

describe('csv.helper.toCsv — formato Excel español', () => {
  it('usa ; como separador y BOM UTF-8 al inicio', () => {
    const csv = toCsv(['A', 'B'], [['x', 'y']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('A;B');
    expect(csv).toContain('x;y');
  });

  it('números con coma decimal y 2 decimales', () => {
    const csv = toCsv(['Monto'], [[1234.5]]);
    expect(csv).toContain('1234,50');
  });

  it('escapa celdas con ; comillas o saltos de línea', () => {
    const csv = toCsv(['Desc'], [['venta; al "cliente"\nprincipal']]);
    expect(csv).toContain('"venta; al ""cliente""\nprincipal"');
  });

  it('null/undefined → celda vacía', () => {
    const csv = toCsv(['A', 'B', 'C'], [[null, undefined, 'z']]);
    expect(csv.split('\r\n')[1]).toBe(';;z');
  });
});

describe('fiscal-period.PeriodClosedError', () => {
  it('lleva el período en el mensaje (PERIOD_CLOSED:YYYY-MM)', () => {
    const e = new PeriodClosedError(2026, 6);
    expect(e.message).toBe('PERIOD_CLOSED:2026-06');
  });

  it('rellena el mes con cero a la izquierda', () => {
    expect(new PeriodClosedError(2026, 11).message).toBe('PERIOD_CLOSED:2026-11');
    expect(new PeriodClosedError(2026, 1).message).toBe('PERIOD_CLOSED:2026-01');
  });
});

describe('utcYearMonth — regresión QA e2e: bug de zona horaria en cierre de período', () => {
  // Hallazgo real (2026-07-04, QA manual): un asiento fechado "2026-08-01" (string
  // "solo fecha" → se parsea como medianoche UTC) quedaba clasificado como JULIO en un
  // servidor con offset negativo (Ecuador, UTC-5), porque getMonth()/getFullYear() leen
  // en hora LOCAL: medianoche UTC del 1 de agosto es aún 31 de julio a las 19:00 en
  // UTC-5. Con julio cerrado, el asiento de agosto quedaba bloqueado incorrectamente.
  // utcYearMonth() usa los componentes UTC, inmune al offset del servidor.
  it('clasifica "2026-08-01" (medianoche UTC) como agosto, no julio, sin importar la TZ local', () => {
    const d = new Date('2026-08-01');
    expect(utcYearMonth(d)).toEqual({ year: 2026, month: 8 });
  });

  it('clasifica el último instante de julio como julio (no se cuela a agosto)', () => {
    const d = new Date(Date.UTC(2026, 6, 31, 23, 59, 59, 999));
    expect(utcYearMonth(d)).toEqual({ year: 2026, month: 7 });
  });

  it('funciona en el cambio de año (31 dic → enero)', () => {
    expect(utcYearMonth(new Date('2026-01-01'))).toEqual({ year: 2026, month: 1 });
    expect(utcYearMonth(new Date(Date.UTC(2025, 11, 31, 23, 59, 59, 999)))).toEqual({ year: 2025, month: 12 });
  });
});

describe('accountTypeFromCode — plan Supercías (Formulario 101)', () => {
  it.each([
    ['10101', 'ACTIVO'],
    ['2010301', 'PASIVO'],
    ['301', 'PATRIMONIO'],
    ['4101', 'INGRESO'],
    ['5101', 'COSTO'],
    ['5202', 'GASTO'],
  ])('%s → %s', (code, expected) => {
    expect(accountTypeFromCode(code)).toBe(expected);
  });
});
