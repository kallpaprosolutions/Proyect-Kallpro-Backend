import { isTemplateDue, periodKey, RecurringTemplateDueRef } from '../src/services/finance/engines/recurring-invoice.engine';

describe('recurring-invoice.engine', () => {
  const base: RecurringTemplateDueRef = {
    isActive: true,
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: null,
    dayOfMonth: 5,
    lastGeneratedPeriod: null,
  };

  describe('periodKey', () => {
    it('formatea AAAA-MM en UTC con mes de dos dígitos', () => {
      expect(periodKey(new Date('2026-03-01T00:00:00Z'))).toBe('2026-03');
      expect(periodKey(new Date('2026-11-15T23:59:00Z'))).toBe('2026-11');
    });
  });

  describe('isTemplateDue', () => {
    it('no está vencida antes del día configurado del mes', () => {
      expect(isTemplateDue(base, new Date('2026-09-04T00:00:00Z'))).toBe(false);
    });

    it('está vencida el día configurado', () => {
      expect(isTemplateDue(base, new Date('2026-09-05T00:00:00Z'))).toBe(true);
    });

    it('sigue vencida después del día configurado (no se "cierra" la ventana)', () => {
      expect(isTemplateDue(base, new Date('2026-09-20T00:00:00Z'))).toBe(true);
    });

    it('no genera dos veces el mismo período', () => {
      const already = { ...base, lastGeneratedPeriod: '2026-09' };
      expect(isTemplateDue(already, new Date('2026-09-20T00:00:00Z'))).toBe(false);
    });

    it('sí genera el mes siguiente aunque ya se haya generado el anterior', () => {
      const already = { ...base, lastGeneratedPeriod: '2026-09' };
      expect(isTemplateDue(already, new Date('2026-10-05T00:00:00Z'))).toBe(true);
    });

    it('ignora plantillas inactivas', () => {
      expect(isTemplateDue({ ...base, isActive: false }, new Date('2026-09-20T00:00:00Z'))).toBe(false);
    });

    it('respeta startDate futura', () => {
      const future = { ...base, startDate: new Date('2026-12-01T00:00:00Z') };
      expect(isTemplateDue(future, new Date('2026-09-05T00:00:00Z'))).toBe(false);
    });

    it('respeta endDate ya vencida (arriendo terminado)', () => {
      const ended = { ...base, endDate: new Date('2026-08-31T00:00:00Z') };
      expect(isTemplateDue(ended, new Date('2026-09-05T00:00:00Z'))).toBe(false);
    });

    it('clampa dayOfMonth=31 a los días reales de febrero (28, año no bisiesto)', () => {
      const day31 = { ...base, dayOfMonth: 31 };
      expect(isTemplateDue(day31, new Date('2026-02-27T00:00:00Z'))).toBe(false);
      expect(isTemplateDue(day31, new Date('2026-02-28T00:00:00Z'))).toBe(true);
    });

    it('clampa dayOfMonth=31 a los días reales de febrero (29, año bisiesto)', () => {
      const day31 = { ...base, dayOfMonth: 31 };
      expect(isTemplateDue(day31, new Date('2028-02-28T00:00:00Z'))).toBe(false);
      expect(isTemplateDue(day31, new Date('2028-02-29T00:00:00Z'))).toBe(true);
    });
  });
});
