/**
 * Actividades programadas (A3): clasificación por vencimiento y validación de entrada.
 * Cálculo puro, sin BD (regla transversal 6).
 */

import { computeActivityStatus, normalizeActivityInput, assertActivityEntityType } from '../src/services/activity.service';
import { AppError } from '../src/utils/errors';

/** Los servicios lanzan AppError (mensaje en español para el usuario, código para el test). */
function expectAppErrorCode(fn: () => void, code: string) {
  let thrown: unknown;
  try { fn(); } catch (e) { thrown = e; }
  expect(thrown).toBeInstanceOf(AppError);
  expect((thrown as AppError).code).toBe(code);
}

describe('computeActivityStatus', () => {
  const now = new Date(2026, 8, 10); // 10 de septiembre 2026, mediodía implícito (00:00)

  it('completada siempre es DONE, sin importar la fecha límite', () => {
    expect(computeActivityStatus(new Date(2026, 8, 1), new Date(2026, 8, 5), now)).toBe('DONE');
    expect(computeActivityStatus(new Date(2026, 8, 20), new Date(2026, 8, 5), now)).toBe('DONE');
  });

  it('fecha límite en el pasado y sin completar → OVERDUE', () => {
    expect(computeActivityStatus(new Date(2026, 8, 9), null, now)).toBe('OVERDUE');
    expect(computeActivityStatus(new Date(2026, 7, 1), null, now)).toBe('OVERDUE');
  });

  it('fecha límite es hoy → TODAY', () => {
    expect(computeActivityStatus(new Date(2026, 8, 10), null, now)).toBe('TODAY');
  });

  it('fecha límite es hoy más tarde en el día → sigue siendo TODAY (compara solo el día)', () => {
    const laterToday = new Date(2026, 8, 10, 23, 59);
    expect(computeActivityStatus(laterToday, null, now)).toBe('TODAY');
  });

  it('fecha límite futura → UPCOMING', () => {
    expect(computeActivityStatus(new Date(2026, 8, 11), null, now)).toBe('UPCOMING');
    expect(computeActivityStatus(new Date(2026, 9, 1), null, now)).toBe('UPCOMING');
  });
});

describe('normalizeActivityInput', () => {
  it('acepta un tipo válido y fecha válida', () => {
    const r = normalizeActivityInput({ type: 'LLAMAR', dueDate: '2026-09-15' });
    expect(r.type).toBe('LLAMAR');
    expect(r.note).toBeNull();
    expect(r.dueDate.getTime()).not.toBeNaN();
  });

  it('rechaza un tipo inválido', () => {
    expectAppErrorCode(() => normalizeActivityInput({ type: 'BAILAR', dueDate: '2026-09-15' }), 'INVALID_ACTIVITY_TYPE');
  });

  it('rechaza una fecha inválida', () => {
    expectAppErrorCode(() => normalizeActivityInput({ type: 'REVISAR', dueDate: 'no-es-fecha' }), 'INVALID_DUE_DATE');
  });

  it('recorta espacios en la nota y la deja null si queda vacía', () => {
    const r = normalizeActivityInput({ type: 'OTRO', dueDate: '2026-09-15', note: '   ' });
    expect(r.note).toBeNull();
  });

  it('rechaza una nota demasiado larga', () => {
    const longNote = 'x'.repeat(501);
    expectAppErrorCode(() => normalizeActivityInput({ type: 'OTRO', dueDate: '2026-09-15', note: longNote }), 'NOTE_TOO_LONG');
  });
});

describe('assertActivityEntityType', () => {
  it('acepta los 4 tipos de documento que ya tiene el Chatter', () => {
    for (const t of ['PURCHASE_ORDER', 'SALES_ORDER', 'INVOICE', 'REQUISITION']) {
      expect(() => assertActivityEntityType(t)).not.toThrow();
    }
  });

  it('rechaza un entityType no soportado', () => {
    expectAppErrorCode(() => assertActivityEntityType('PRODUCT'), 'UNSUPPORTED_ENTITY_TYPE');
  });
});
