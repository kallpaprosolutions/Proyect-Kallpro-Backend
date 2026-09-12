import { computeMonthlyDepreciation, isDepreciationDue, periodKey, FixedAssetDueRef } from '../src/services/finance/engines/fixed-asset.engine';

describe('fixed-asset.engine', () => {
  describe('computeMonthlyDepreciation', () => {
    it('línea recta: (costo - residual) / (vida útil en meses)', () => {
      // Equipo de cómputo $3,600, sin residual, 3 años → $100/mes
      const r = computeMonthlyDepreciation(3600, 0, 3, 0);
      expect(r.amount).toBe(100);
      expect(r.newAccumulated).toBe(100);
      expect(r.fullyDepreciated).toBe(false);
    });

    it('descuenta el valor residual de la base depreciable', () => {
      // Vehículo $20,000, residual $2,000, 5 años → (18000/60) = 300/mes
      const r = computeMonthlyDepreciation(20000, 2000, 5, 0);
      expect(r.amount).toBe(300);
    });

    it('terrenos (vida útil 0) nunca deprecian', () => {
      const r = computeMonthlyDepreciation(50000, 0, 0, 0);
      expect(r.amount).toBe(0);
      expect(r.fullyDepreciated).toBe(false);
    });

    it('capa el último período al saldo depreciable restante (no se pasa del costo)', () => {
      // Base depreciable 1000, ya acumulado 950, cuota normal sería 100 → debe capar a 50
      const r = computeMonthlyDepreciation(1000, 0, 1, 950); // 1 año, cuota normal 83.33
      expect(r.amount).toBe(50);
      expect(r.newAccumulated).toBe(1000);
      expect(r.fullyDepreciated).toBe(true);
    });

    it('ya totalmente depreciado: amount 0, fullyDepreciated true', () => {
      const r = computeMonthlyDepreciation(1000, 0, 3, 1000);
      expect(r.amount).toBe(0);
      expect(r.fullyDepreciated).toBe(true);
    });
  });

  describe('periodKey', () => {
    it('formatea AAAA-MM en UTC', () => {
      expect(periodKey(new Date('2026-03-01T00:00:00Z'))).toBe('2026-03');
    });
  });

  describe('isDepreciationDue', () => {
    const base: FixedAssetDueRef = { status: 'ACTIVE', acquisitionDate: new Date('2026-01-01T00:00:00Z'), lastDepreciatedPeriod: null };

    it('vencido si está activo y aún no se generó ese período', () => {
      expect(isDepreciationDue(base, new Date('2026-09-10T00:00:00Z'))).toBe(true);
    });

    it('no vencido si ya se generó el período', () => {
      expect(isDepreciationDue({ ...base, lastDepreciatedPeriod: '2026-09' }, new Date('2026-09-20T00:00:00Z'))).toBe(false);
    });

    it('no vencido antes de la fecha de adquisición', () => {
      expect(isDepreciationDue(base, new Date('2025-12-01T00:00:00Z'))).toBe(false);
    });

    it('ignora activos no ACTIVE (totalmente depreciados o dados de baja)', () => {
      expect(isDepreciationDue({ ...base, status: 'FULLY_DEPRECIATED' }, new Date('2026-09-10T00:00:00Z'))).toBe(false);
      expect(isDepreciationDue({ ...base, status: 'DISPOSED' }, new Date('2026-09-10T00:00:00Z'))).toBe(false);
    });
  });
});
