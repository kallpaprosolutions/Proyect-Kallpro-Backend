import { buildCashflow } from '../src/services/treasury.service';
import { sriDueDay, IESS_DUE_DAY, BANCOS_ECUADOR } from '../src/data/bancosEcuador';
import { classifyDay, netHours, STANDARD_DAILY_HOURS } from '../src/services/attendance.service';

/**
 * Tesorería + Asistencia (Sprint 9): lógica pura.
 * - Vencimientos SRI por 9.º dígito del RUC (día 10…28; especiales día 9) e IESS día 15.
 * - Flujo de caja semanal por fecha de vencimiento.
 * - Clasificación de horas biométricas (CT: suplementarias >8h lun–vie; extraordinarias fin de semana).
 */

describe('vencimientos tributarios Ecuador', () => {
  it('SRI por noveno dígito: 1→10, 5→18, 9→26, 0→28', () => {
    expect(sriDueDay('1234567810001')).toBe(10); // 9no dígito 1
    expect(sriDueDay('1234567850001')).toBe(18);
    expect(sriDueDay('1234567890001')).toBe(26);
    expect(sriDueDay('1234567800001')).toBe(28);
  });
  it('contribuyente especial: día 9 sin importar el RUC', () => {
    expect(sriDueDay('1234567890001', true)).toBe(9);
  });
  it('sin RUC configurado usa la fecha más tardía (28)', () => {
    expect(sriDueDay(null)).toBe(28);
  });
  it('IESS vence el 15', () => {
    expect(IESS_DUE_DAY).toBe(15);
  });
  it('catálogo bancario: principales bancos con BIC verificado', () => {
    const byCode = Object.fromEntries(BANCOS_ECUADOR.map((b) => [b.code, b.swift]));
    expect(byCode.PICHINCHA).toBe('PICHECEQ');
    expect(byCode.PRODUBANCO).toBe('PRODECEQ');
    expect(byCode.PACIFICO).toBe('PACIECEG');
  });
});

describe('buildCashflow — proyección semanal', () => {
  const monday = new Date(Date.UTC(2026, 6, 6)); // 6-jul-2026

  it('ubica cobros y pagos en su semana y acumula el saldo proyectado', () => {
    const rows = buildCashflow(
      1000,
      [{ amount: 500, dueDate: '2026-07-08' }, { amount: 300, dueDate: '2026-07-20' }],
      [{ amount: 400, dueDate: '2026-07-15' }],
      4, monday,
    );
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ inflow: 500, outflow: 0, projected: 1500 });
    expect(rows[1]).toMatchObject({ inflow: 0, outflow: 400, projected: 1100 });
    expect(rows[2]).toMatchObject({ inflow: 300, projected: 1400 });
  });

  it('lo vencido cae en la primera semana', () => {
    const rows = buildCashflow(0, [], [{ amount: 250, dueDate: '2026-06-01' }], 4, monday);
    expect(rows[0].outflow).toBe(250);
    expect(rows[0].projected).toBe(-250);
  });

  it('lo que vence más allá del horizonte cae en la última semana', () => {
    const rows = buildCashflow(0, [{ amount: 100, dueDate: '2026-12-31' }], [], 4, monday);
    expect(rows[3].inflow).toBe(100);
  });
});

describe('asistencia biométrica — clasificación de horas (CT Ecuador)', () => {
  it('día laborable ≤8h: todo ordinario', () => {
    const wed = new Date(Date.UTC(2026, 6, 8)); // miércoles
    expect(classifyDay(wed, 8)).toEqual({ regular: 8, supplementary: 0, extraordinary: 0 });
  });
  it('día laborable >8h: el exceso es suplementario (+50%)', () => {
    const wed = new Date(Date.UTC(2026, 6, 8));
    expect(classifyDay(wed, 10.5)).toEqual({ regular: 8, supplementary: 2.5, extraordinary: 0 });
  });
  it('sábado/domingo: TODO es extraordinario (+100%)', () => {
    const sat = new Date(Date.UTC(2026, 6, 11));
    const sun = new Date(Date.UTC(2026, 6, 12));
    expect(classifyDay(sat, 6)).toEqual({ regular: 0, supplementary: 0, extraordinary: 6 });
    expect(classifyDay(sun, 4)).toEqual({ regular: 0, supplementary: 0, extraordinary: 4 });
  });
  it('jornada estándar es de 8 horas', () => {
    expect(STANDARD_DAILY_HOURS).toBe(8);
  });

  it('netHours descuenta 1h de almuerzo en jornadas > 5h', () => {
    const in8 = new Date('2026-07-08T08:00:00Z');
    const out17 = new Date('2026-07-08T17:00:00Z'); // 9h brutas → 8 netas
    expect(netHours(in8, out17)).toBe(8);
    const out12 = new Date('2026-07-08T12:00:00Z'); // 4h → sin descuento
    expect(netHours(in8, out12)).toBe(4);
    expect(netHours(out17, in8)).toBe(0); // marcaciones invertidas
  });
});
