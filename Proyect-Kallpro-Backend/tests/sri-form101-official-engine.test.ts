import { computeForm101Values, FORM101_CASILLAS } from '../src/services/finance/engines/sri-form101-official.engine';

/**
 * Motor puro de la réplica del Formulario 101 oficial (2026-10-01, mismo patrón que el 104/103).
 * Estructura de Conciliación Tributaria/Cálculo del Impuesto tomada del formulario oficial real
 * (Resolución NAC-DGERCGC15-00000143) — ver memoria
 * `sri-formularios-104-103-estructura-real-2026-09-28.md` §"Formulario 101".
 */
describe('sri-form101-official.engine — computeForm101Values', () => {
  it('utilidad del ejercicio (801) y pérdida (802) son mutuamente excluyentes', () => {
    const vUtilidad = computeForm101Values({ '6999': 100000, '7999': 60000 });
    expect(vUtilidad['801']).toBe(40000);
    expect(vUtilidad['802']).toBe(0);

    const vPerdida = computeForm101Values({ '6999': 60000, '7999': 100000 });
    expect(vPerdida['801']).toBe(0);
    expect(vPerdida['802']).toBe(40000);
  });

  it('819 (utilidad gravable) aplica la fórmula completa de conciliación', () => {
    const v = computeForm101Values({
      '6999': 200000, '7999': 120000, // utilidad ejercicio = 80000
      '804': 1000, '805': 2000, '807': 5000, '808': 1000, '809': 500,
    });
    // 801=80000, 802=0, 803=80000*15%=12000
    expect(v['801']).toBe(80000);
    expect(v['803']).toBe(12000);
    // 810 = (804*15%) + [(805+806-809)*15%] = (1000*0.15) + ((2000+0-500)*0.15) = 150 + 225 = 375
    expect(v['810']).toBeCloseTo(375, 2);
    // 819 = 801-802-803-804-805-806+807+808+809+810-811-812-813+814-815-816-817+818
    const esperado = 80000 - 0 - 12000 - 1000 - 2000 - 0 + 5000 + 1000 + 500 + 375 - 0 - 0 - 0 + 0 - 0 - 0 - 0 + 0;
    expect(v['819']).toBeCloseTo(esperado, 2);
  });

  it('821 (pérdida sujeta a amortización) solo aparece si 819 es negativo', () => {
    const v = computeForm101Values({ '6999': 10000, '7999': 50000, '807': 0 });
    expect(v['819']).toBeLessThan(0);
    expect(v['821']).toBeCloseTo(-v['819'], 2);

    const v2 = computeForm101Values({ '6999': 200000, '7999': 50000 });
    expect(v2['819']).toBeGreaterThan(0);
    expect(v2['821']).toBe(0);
  });

  it('839 (total impuesto causado) aplica tarifa general sobre 832 y tarifa de reinversión sobre 831', () => {
    const v = computeForm101Values(
      { '6999': 300000, '7999': 100000, '831': 20000 }, // utilidad=200000, 819≈170000 tras 15% trabajadores
      { tarifaGeneral: 0.25, tarifaReinversion: 0.22 },
    );
    expect(v['832']).toBeCloseTo(Math.max(v['819'], 0) - 20000, 2);
    expect(v['839']).toBeCloseTo(20000 * 0.22 + v['832'] * 0.25, 2);
  });

  it('842/843 (impuesto causado vs. anticipo) son mutuamente excluyentes', () => {
    const vMayor = computeForm101Values({ '6999': 500000, '7999': 100000, '841': 10000 });
    expect(vMayor['842']).toBeGreaterThan(0);
    expect(vMayor['843']).toBe(0);

    const vMenor = computeForm101Values({ '6999': 100000, '7999': 100000, '841': 500 });
    expect(vMenor['839']).toBe(0);
    expect(vMenor['843']).toBe(500);
    expect(vMenor['842']).toBe(0);
  });

  it('855/856 (subtotal a pagar vs. saldo a favor) son mutuamente excluyentes y alimentan 859/869', () => {
    const vAPagar = computeForm101Values({ '6999': 500000, '7999': 100000, '845': 1000 });
    expect(vAPagar['855']).toBeGreaterThan(0);
    expect(vAPagar['856']).toBe(0);
    expect(vAPagar['859']).toBeCloseTo(vAPagar['855'], 2);
    expect(vAPagar['869']).toBe(0);

    const vAFavor = computeForm101Values({ '6999': 100000, '7999': 100000, '845': 5000 });
    expect(vAFavor['855']).toBe(0);
    expect(vAFavor['856']).toBeCloseTo(5000, 2);
    expect(vAFavor['859']).toBe(0);
    expect(vAFavor['869']).toBeCloseTo(5000, 2);
  });

  it('879 (anticipo próximo año) suma las 3 cuotas', () => {
    const v = computeForm101Values({ '871': 1000, '872': 1000, '873': 500 });
    expect(v['879']).toBe(2500);
  });

  it('999 (total pagado) suma impuesto a pagar + interés + multa', () => {
    const v = computeForm101Values({ '6999': 500000, '7999': 100000, '903': 10, '904': 5 });
    expect(v['999']).toBeCloseTo(v['902'] + 15, 2);
  });

  it('todas las casillas hoja producen 0 por defecto si no llega ningún valor (sin NaN)', () => {
    const v = computeForm101Values({});
    for (const c of FORM101_CASILLAS) expect(Number.isNaN(v[c.code])).toBe(false);
    expect(v['999']).toBe(0);
  });
});
