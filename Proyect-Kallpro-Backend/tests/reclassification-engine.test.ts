/**
 * Regularización de un mal registro (CxP y contabilidad en general) — test del cálculo
 * puro de las 2 líneas del asiento correctivo. Sin BD (regla transversal 6).
 */

import { computeReclassificationLines } from '../src/services/journal.service';

describe('computeReclassificationLines', () => {
  it('línea original al DEBE → correctivo DEBE cuenta nueva / HABER cuenta vieja', () => {
    const lines = computeReclassificationLines(
      { accountCode: '520228', accountName: 'OTROS GASTOS', debit: 150, credit: 0 },
      { code: '520201', name: 'SUELDOS, SALARIOS Y DEMÁS REMUNERACIONES' },
    );
    expect(lines).toEqual([
      { accountCode: '520201', accountName: 'SUELDOS, SALARIOS Y DEMÁS REMUNERACIONES', debit: 150, credit: 0 },
      { accountCode: '520228', accountName: 'OTROS GASTOS', debit: 0, credit: 150 },
    ]);
  });

  it('línea original al HABER → correctivo HABER cuenta nueva / DEBE cuenta vieja', () => {
    const lines = computeReclassificationLines(
      { accountCode: '2010301', accountName: 'LOCALES', debit: 0, credit: 300 },
      { code: '2010302', name: 'EXTERIOR' },
    );
    expect(lines).toEqual([
      { accountCode: '2010302', accountName: 'EXTERIOR', debit: 0, credit: 300 },
      { accountCode: '2010301', accountName: 'LOCALES', debit: 300, credit: 0 },
    ]);
  });

  it('el asiento correctivo siempre cuadra (débitos = créditos)', () => {
    const lines = computeReclassificationLines(
      { accountCode: 'A', accountName: 'A', debit: 88.5, credit: 0 },
      { code: 'B', name: 'B' },
    );
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it('rechaza una línea original sin monto', () => {
    expect(() => computeReclassificationLines(
      { accountCode: 'A', accountName: 'A', debit: 0, credit: 0 },
      { code: 'B', name: 'B' },
    )).toThrow('La línea original no tiene monto');
  });
});
