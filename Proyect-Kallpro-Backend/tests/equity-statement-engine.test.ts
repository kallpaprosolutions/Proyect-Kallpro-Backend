import {
  classifyEquityAccount, buildEquityCategories, buildEquityStatement,
} from '../src/services/finance/engines/equity-statement.engine';

describe('equity-statement.engine', () => {
  describe('classifyEquityAccount', () => {
    it('clasifica capital, reservas y resultados por el código Supercías', () => {
      expect(classifyEquityAccount('301')).toBe('CAPITAL');
      expect(classifyEquityAccount('3010101')).toBe('CAPITAL');
      expect(classifyEquityAccount('304')).toBe('RESERVAS');
      expect(classifyEquityAccount('306')).toBe('RESULTADOS_ACUMULADOS');
      expect(classifyEquityAccount('307')).toBe('RESULTADOS_ACUMULADOS');
    });

    it('cualquier otra cuenta de patrimonio cae a OTROS_PATRIMONIO', () => {
      expect(classifyEquityAccount('303')).toBe('OTROS_PATRIMONIO');
    });
  });

  describe('buildEquityCategories', () => {
    it('agrupa movimientos por categoría: el haber aumenta, el debe disminuye (naturaleza acreedora)', () => {
      const categories = buildEquityCategories([
        { code: '301', opening: 1000, debit: 0, credit: 500 }, // aporte de capital
        { code: '306', opening: 200, debit: 50, credit: 0 },   // dividendo declarado
      ]);
      const capital = categories.find((c) => c.category === 'CAPITAL')!;
      expect(capital.opening).toBe(1000);
      expect(capital.increases).toBe(500);
      expect(capital.decreases).toBe(0);
      expect(capital.closing).toBe(1500);

      const resultados = categories.find((c) => c.category === 'RESULTADOS_ACUMULADOS')!;
      expect(resultados.opening).toBe(200);
      expect(resultados.decreases).toBe(50);
      expect(resultados.closing).toBe(150);

      const reservas = categories.find((c) => c.category === 'RESERVAS')!;
      expect(reservas.opening).toBe(0);
      expect(reservas.closing).toBe(0);
    });

    it('sin movimientos devuelve las 4 categorías en 0', () => {
      const categories = buildEquityCategories([]);
      expect(categories).toHaveLength(4);
      expect(categories.every((c) => c.opening === 0 && c.closing === 0)).toBe(true);
    });
  });

  describe('buildEquityStatement', () => {
    it('cuadra el total final = inicial + aumentos - disminuciones + utilidad del ejercicio', () => {
      const categories = buildEquityCategories([
        { code: '301', opening: 1000, debit: 0, credit: 0 },
        { code: '306', opening: 300, debit: 0, credit: 0 },
      ]);
      const st = buildEquityStatement({
        from: '2026-01-01', to: '2026-01-31', categories,
        utilidadAcumuladaNoDistribuida: 500, // utilidad de ejercicios anteriores no cerrada a 306
        utilidadEjercicio: 80,
      });
      expect(st.totalInicial).toBe(1000 + 300 + 500); // cuentas + utilidad acumulada en vivo
      expect(st.totalAumentos).toBe(0);
      expect(st.totalDisminuciones).toBe(0);
      expect(st.totalFinal).toBe(st.totalInicial + 80);
    });

    it('con aportes y dividendos en el período, el total final refleja ambos movimientos', () => {
      const categories = buildEquityCategories([
        { code: '301', opening: 1000, debit: 0, credit: 200 }, // aporte de capital +200
        { code: '306', opening: 0, debit: 30, credit: 0 },     // dividendo -30
      ]);
      const st = buildEquityStatement({
        from: '2026-02-01', to: '2026-02-28', categories,
        utilidadAcumuladaNoDistribuida: 0,
        utilidadEjercicio: 100,
      });
      expect(st.totalInicial).toBe(1000);
      expect(st.totalAumentos).toBe(200);
      expect(st.totalDisminuciones).toBe(30);
      expect(st.totalFinal).toBe(1000 + 200 - 30 + 100);
    });
  });
});
