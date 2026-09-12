import { forecastNextPeriod, classifyTrend, computeTurnoverRatio, classifyRotation } from '../src/services/inventory/engines/demand-forecast.engine';

describe('demand-forecast.engine', () => {
  describe('forecastNextPeriod', () => {
    it('devuelve 0 para una serie vacía', () => {
      expect(forecastNextPeriod([])).toBe(0);
    });

    it('devuelve el único valor si la serie tiene un solo período', () => {
      expect(forecastNextPeriod([50])).toBe(50);
    });

    it('suaviza hacia el valor más reciente en una serie creciente', () => {
      const result = forecastNextPeriod([10, 20, 30, 40, 50], 0.3);
      // Con alpha=0.3 el suavizado queda entre el promedio simple y el último valor.
      expect(result).toBeGreaterThan(20);
      expect(result).toBeLessThan(50);
    });

    it('con alpha=1 el pronóstico es exactamente el último valor (sin suavizado)', () => {
      expect(forecastNextPeriod([10, 20, 99], 1)).toBe(99);
    });
  });

  describe('classifyTrend', () => {
    it('ESTABLE con menos de 2 períodos', () => {
      expect(classifyTrend([10])).toBe('ESTABLE');
      expect(classifyTrend([])).toBe('ESTABLE');
    });

    it('CRECIENTE cuando la segunda mitad supera claramente a la primera', () => {
      expect(classifyTrend([10, 10, 30, 30])).toBe('CRECIENTE');
    });

    it('DECRECIENTE cuando la segunda mitad cae claramente respecto a la primera', () => {
      expect(classifyTrend([30, 30, 10, 10])).toBe('DECRECIENTE');
    });

    it('ESTABLE cuando el cambio es menor al umbral (15%)', () => {
      expect(classifyTrend([100, 100, 105, 108])).toBe('ESTABLE');
    });

    it('ESTABLE cuando toda la serie es cero (sin ventas)', () => {
      expect(classifyTrend([0, 0, 0, 0])).toBe('ESTABLE');
    });
  });

  describe('computeTurnoverRatio', () => {
    it('0 si no hay valor de inventario (evita división por cero)', () => {
      expect(computeTurnoverRatio(1200, 0)).toBe(0);
    });

    it('calcula COGS anualizado / inventario promedio', () => {
      expect(computeTurnoverRatio(1200, 200)).toBe(6);
    });
  });

  describe('classifyRotation', () => {
    it('ALTA desde 6 rotaciones/año', () => {
      expect(classifyRotation(6)).toBe('ALTA');
      expect(classifyRotation(10)).toBe('ALTA');
    });

    it('MEDIA entre 2 y 6', () => {
      expect(classifyRotation(2)).toBe('MEDIA');
      expect(classifyRotation(5.9)).toBe('MEDIA');
    });

    it('BAJA por debajo de 2 (candidato a stock muerto)', () => {
      expect(classifyRotation(1.9)).toBe('BAJA');
      expect(classifyRotation(0)).toBe('BAJA');
    });
  });
});
