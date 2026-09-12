/**
 * Calendario de TTHH: máquina de estados de solicitudes de permiso (doble aprobación
 * jefatura → TTHH) y resolución de horario de turnos. Cálculo puro, sin BD (regla
 * transversal 6).
 */

import { resolveInitialStatus, applyManagerDecision, applyHrDecision, canCancel, validateDateRange } from '../src/services/leave.service';
import { resolveShiftTimes } from '../src/services/shift.service';

describe('resolveInitialStatus', () => {
  it('sin jefe asignado: va directo a PENDIENTE_TTHH', () => {
    expect(resolveInitialStatus(false)).toBe('PENDIENTE_TTHH');
  });
  it('con jefe asignado: pasa primero por PENDIENTE_JEFATURA', () => {
    expect(resolveInitialStatus(true)).toBe('PENDIENTE_JEFATURA');
  });
});

describe('applyManagerDecision', () => {
  it('aprueba → pasa a PENDIENTE_TTHH', () => {
    expect(applyManagerDecision('PENDIENTE_JEFATURA', 'APPROVE')).toBe('PENDIENTE_TTHH');
  });
  it('rechaza → RECHAZADO', () => {
    expect(applyManagerDecision('PENDIENTE_JEFATURA', 'REJECT')).toBe('RECHAZADO');
  });
  it('no permite decidir si ya no está en PENDIENTE_JEFATURA', () => {
    expect(() => applyManagerDecision('PENDIENTE_TTHH', 'APPROVE')).toThrow('INVALID_TRANSITION');
    expect(() => applyManagerDecision('APROBADO', 'APPROVE')).toThrow('INVALID_TRANSITION');
  });
});

describe('applyHrDecision', () => {
  it('aprueba → APROBADO (decisión final)', () => {
    expect(applyHrDecision('PENDIENTE_TTHH', 'APPROVE')).toBe('APROBADO');
  });
  it('rechaza → RECHAZADO', () => {
    expect(applyHrDecision('PENDIENTE_TTHH', 'REJECT')).toBe('RECHAZADO');
  });
  it('TTHH no puede decidir si aún falta la jefatura', () => {
    expect(() => applyHrDecision('PENDIENTE_JEFATURA', 'APPROVE')).toThrow('INVALID_TRANSITION');
  });
  it('no permite redecidir una solicitud ya cerrada', () => {
    expect(() => applyHrDecision('APROBADO', 'APPROVE')).toThrow('INVALID_TRANSITION');
    expect(() => applyHrDecision('RECHAZADO', 'APPROVE')).toThrow('INVALID_TRANSITION');
  });
});

describe('canCancel', () => {
  it('se puede cancelar mientras esté pendiente en cualquier etapa', () => {
    expect(canCancel('PENDIENTE_JEFATURA')).toBe(true);
    expect(canCancel('PENDIENTE_TTHH')).toBe(true);
  });
  it('no se puede cancelar una solicitud ya decidida', () => {
    expect(canCancel('APROBADO')).toBe(false);
    expect(canCancel('RECHAZADO')).toBe(false);
    expect(canCancel('CANCELADO')).toBe(false);
  });
});

describe('validateDateRange', () => {
  it('acepta rango válido', () => {
    expect(() => validateDateRange(new Date('2026-09-10'), new Date('2026-09-12'))).not.toThrow();
  });
  it('acepta un solo día (inicio = fin)', () => {
    expect(() => validateDateRange(new Date('2026-09-10'), new Date('2026-09-10'))).not.toThrow();
  });
  it('rechaza fin anterior a inicio', () => {
    expect(() => validateDateRange(new Date('2026-09-12'), new Date('2026-09-10'))).toThrow('VALIDATION:');
  });
  it('rechaza fechas inválidas', () => {
    expect(() => validateDateRange(new Date('no-es-fecha'), new Date('2026-09-10'))).toThrow('VALIDATION:');
  });
});

describe('resolveShiftTimes', () => {
  it('usa el horario de la plantilla cuando no hay override', () => {
    expect(resolveShiftTimes({ startTime: '08:00', endTime: '17:00' }, {})).toEqual({ startTime: '08:00', endTime: '17:00' });
  });
  it('el override manual gana sobre la plantilla', () => {
    expect(resolveShiftTimes({ startTime: '08:00', endTime: '17:00' }, { startTime: '09:00' }))
      .toEqual({ startTime: '09:00', endTime: '17:00' });
  });
  it('sin plantilla, exige horario manual completo', () => {
    expect(() => resolveShiftTimes(null, { startTime: '08:00' })).toThrow('VALIDATION:');
    expect(resolveShiftTimes(null, { startTime: '08:00', endTime: '17:00' })).toEqual({ startTime: '08:00', endTime: '17:00' });
  });
});
