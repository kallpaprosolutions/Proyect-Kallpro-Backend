import {
  calculatePayslip, annualIncomeTax, monthlyIncomeTaxWithholding,
  personalExpensesRebate, workedDaysInMonth, monthsOfService,
  aggregateForAccounting, CalcEmployee,
} from '../src/services/payroll.service';
import { PAYROLL_EC } from '../src/data/payrollEcuador';

/**
 * Motor de nómina Ecuador 2026 (Sprint 8).
 * Valores normativos: SBU $482 · IESS personal 9,45% / patronal 11,15% + 1% IECE-SECAP
 * · fondos de reserva 8,33% (13.º mes) · décimos · IR tabla NAC-DGERCGC25-00000043.
 */

const baseEmp = (over: Partial<CalcEmployee> = {}): CalcEmployee => ({
  baseSalary: 1000,
  hireDate: new Date('2024-01-15'),
  monthlyThirteenth: false,
  monthlyFourteenth: false,
  reserveFundsToIESS: false,
  familyBurdens: 0,
  projectedPersonalExpenses: 0,
  ...over,
});

describe('parámetros normativos 2026', () => {
  it('SBU y tasas vigentes', () => {
    expect(PAYROLL_EC.SBU).toBe(482);
    expect(PAYROLL_EC.IESS_PERSONAL_RATE).toBeCloseTo(0.0945);
    expect(PAYROLL_EC.IESS_PATRONAL_RATE).toBeCloseTo(0.1115);
  });
});

describe('impuesto a la renta 2026', () => {
  it('bajo la fracción básica no paga IR', () => {
    expect(annualIncomeTax(12000)).toBe(0);
  });
  it('tramo 5%: 14.000 → (14.000-12.208)×5% = 89,60', () => {
    expect(annualIncomeTax(14000)).toBeCloseTo(89.6, 2);
  });
  it('tramo 15%: 30.000 → 1.412 + (30.000-26.700)×15% = 1.907', () => {
    expect(annualIncomeTax(30000)).toBeCloseTo(1907, 2);
  });
  it('tramo 37% (último): 150.000 → 24.572 + 40.044×37%', () => {
    expect(annualIncomeTax(150000)).toBeCloseTo(24572 + (150000 - 109956) * 0.37, 2);
  });

  it('rebaja gastos personales: tope 7 canastas sin cargas', () => {
    // 18% × min(gastos, 7 × 821,80 = 5.752,60)
    expect(personalExpensesRebate(10000, 0)).toBeCloseTo(0.18 * 5752.6, 2);
    expect(personalExpensesRebate(3000, 0)).toBeCloseTo(540, 2);
  });
  it('rebaja con 3 cargas usa 14 canastas', () => {
    expect(personalExpensesRebate(99999, 3)).toBeCloseTo(0.18 * 14 * 821.8, 2);
  });

  it('sueldo $1.000: proyección anual bajo fracción básica tras aporte IESS → sin retención', () => {
    // 12.000 - 1.134 (9,45%) = 10.866 < 12.208
    expect(monthlyIncomeTaxWithholding(1000, 0, 0)).toBe(0);
  });
  it('sueldo $2.000: retención mensual positiva y decreciente con gastos proyectados', () => {
    // 24.000 - 2.268 = 21.732 → 631? no: 21.732 cae en tramo 20.188–26.700 → 631 + 1.544×12% = 816,28 → /12 = 68,02
    const sinGastos = monthlyIncomeTaxWithholding(2000, 0, 0);
    expect(sinGastos).toBeCloseTo(816.28 / 12, 1);
    const conGastos = monthlyIncomeTaxWithholding(2000, 5000, 0);
    expect(conGastos).toBeLessThan(sinGastos);
  });
});

describe('proporcionalidad y antigüedad', () => {
  it('mes completo si ingresó antes del período', () => {
    expect(workedDaysInMonth(new Date('2024-01-15'), 2026, 7)).toBe(30);
  });
  it('ingreso a mitad de mes: día 16 → 15/30 días', () => {
    expect(workedDaysInMonth(new Date(Date.UTC(2026, 6, 16)), 2026, 7)).toBe(15);
  });
  it('ingreso posterior al mes → 0 días', () => {
    expect(workedDaysInMonth(new Date('2026-09-01'), 2026, 7)).toBe(0);
  });
  it('fondos de reserva desde el 13.º mes', () => {
    expect(monthsOfService(new Date('2025-07-01'), 2026, 7)).toBe(12);
    expect(monthsOfService(new Date('2026-01-01'), 2026, 7)).toBe(6);
  });
});

describe('calculatePayslip — rol mensual completo', () => {
  it('empleado tipo: $1.000, >1 año, décimos provisionados', () => {
    const calc = calculatePayslip(baseEmp(), [], 2026, 7);

    expect(calc.grossEarnings).toBe(1000);
    // Descuentos: solo aporte personal (IR = 0 a este nivel)
    expect(calc.totalDeductions).toBeCloseTo(94.5, 2);
    // Fondos de reserva pagados en rol: +83,30
    expect(calc.otherEarnings).toBeCloseTo(83.3, 2);
    expect(calc.netPay).toBeCloseTo(1000 + 83.3 - 94.5, 2);

    // Costos patronales: 111,50 + 10 + prov. décimo tercero 83,33 + décimo cuarto 40,17 + vacaciones 41,67
    const conceptos = calc.lines.filter((l) => l.kind === 'EMPLOYER').map((l) => l.concept);
    expect(conceptos).toEqual(expect.arrayContaining(['APORTE_PATRONAL', 'IECE_SECAP', 'PROV_DECIMO_TERCERO', 'PROV_DECIMO_CUARTO', 'PROV_VACACIONES']));
    expect(calc.employerCost).toBeCloseTo(111.5 + 10 + 83.33 + (482 / 12) + 1000 / 24, 1);
  });

  it('décimos mensualizados se pagan como ingreso no gravado', () => {
    const calc = calculatePayslip(baseEmp({ monthlyThirteenth: true, monthlyFourteenth: true }), [], 2026, 7);
    const conceptos = calc.lines.map((l) => l.concept);
    expect(conceptos).toContain('DECIMO_TERCERO_MENS');
    expect(conceptos).toContain('DECIMO_CUARTO_MENS');
    expect(conceptos).not.toContain('PROV_DECIMO_TERCERO');
    // 1.000/12 + 482/12 + fondos 83,30
    expect(calc.otherEarnings).toBeCloseTo(83.33 + 40.17 + 83.3, 1);
    // El aporte IESS sigue calculándose SOLO sobre el sueldo (décimos no gravan)
    expect(calc.lines.find((l) => l.concept === 'APORTE_IESS')!.amount).toBeCloseTo(94.5, 2);
  });

  it('menos de un año: sin fondos de reserva', () => {
    const calc = calculatePayslip(baseEmp({ hireDate: new Date('2026-02-01') }), [], 2026, 7);
    expect(calc.lines.map((l) => l.concept)).not.toContain('FONDOS_RESERVA');
    expect(calc.otherEarnings).toBe(0);
  });

  it('horas extras: suplementarias 50% y extraordinarias 100% (hora = sueldo/240)', () => {
    const calc = calculatePayslip(baseEmp(), [
      { type: 'HORAS_SUPLEMENTARIAS', hours: 10 },
      { type: 'HORAS_EXTRAORDINARIAS', hours: 4 },
    ], 2026, 7);
    // hora = 1000/240 = 4,1667 → 10h×1,5 = 62,50 · 4h×2 = 33,33
    expect(calc.lines.find((l) => l.concept === 'HORAS_SUP')!.amount).toBeCloseTo(62.5, 2);
    expect(calc.lines.find((l) => l.concept === 'HORAS_EXT')!.amount).toBeCloseTo(33.33, 2);
    // Gravan IESS: base = 1.095,83
    expect(calc.grossEarnings).toBeCloseTo(1095.83, 2);
    expect(calc.lines.find((l) => l.concept === 'APORTE_IESS')!.amount).toBeCloseTo(1095.83 * 0.0945, 2);
  });

  it('multa se limita al 10% de la remuneración (CT art. 44)', () => {
    const calc = calculatePayslip(baseEmp(), [{ type: 'MULTA', amount: 500 }], 2026, 7);
    expect(calc.lines.find((l) => l.concept === 'MULTA')!.amount).toBeCloseTo(100, 2);
  });

  it('descuentos: anticipo, préstamo IESS y pensión alimenticia bajan el neto', () => {
    const calc = calculatePayslip(baseEmp(), [
      { type: 'ANTICIPO', amount: 200 },
      { type: 'PRESTAMO_QUIROGRAFARIO', amount: 150 },
      { type: 'PENSION_ALIMENTICIA', amount: 120 },
    ], 2026, 7);
    expect(calc.totalDeductions).toBeCloseTo(94.5 + 200 + 150 + 120, 2);
    expect(calc.netPay).toBeCloseTo(1000 + 83.3 - calc.totalDeductions, 2);
  });

  it('ingreso a mitad de mes: sueldo y décimo cuarto proporcionales', () => {
    const calc = calculatePayslip(
      baseEmp({ hireDate: new Date(Date.UTC(2026, 6, 16)), monthlyFourteenth: true }), [], 2026, 7,
    );
    expect(calc.lines.find((l) => l.concept === 'SUELDO')!.amount).toBeCloseTo(500, 2);
    expect(calc.lines.find((l) => l.concept === 'DECIMO_CUARTO_MENS')!.amount).toBeCloseTo((482 / 12) * 0.5, 2);
  });
});

describe('aggregateForAccounting — asiento cuadrado', () => {
  it('el devengo cuadra: gastos = pasivos (con y sin novedades)', () => {
    const emps = [
      baseEmp(),
      baseEmp({ baseSalary: 2500, monthlyThirteenth: true, familyBurdens: 2, projectedPersonalExpenses: 4000 }),
      baseEmp({ baseSalary: 482, hireDate: new Date('2026-03-10'), monthlyFourteenth: true }),
    ];
    const novelties = [
      [{ type: 'HORAS_SUPLEMENTARIAS' as const, hours: 8 }],
      [{ type: 'PRESTAMO_QUIROGRAFARIO' as const, amount: 300 }, { type: 'BONO' as const, amount: 150 }],
      [{ type: 'ANTICIPO' as const, amount: 50 }],
    ];
    const payslips = emps.map((e, i) => {
      const c = calculatePayslip(e, novelties[i], 2026, 7);
      return { lines: c.lines, netPay: c.netPay };
    });
    const t = aggregateForAccounting(payslips);
    const debit = t.salaryExpense + t.iessExpense + t.benefitsExpense;
    const credit = t.iessPayable + t.irPayable + t.benefitsPayable;
    expect(debit).toBeCloseTo(credit, 1);
  });
});
