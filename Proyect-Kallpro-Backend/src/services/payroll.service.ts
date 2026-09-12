import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  PAYROLL_EC, IR_TABLE_2026, canastasPorCargas,
  EMPLOYEE_CATEGORIES, NOVELTY_TYPES, NoveltyType,
} from '../data/payrollEcuador';
import { createPayrollAccrualEntry, createPayrollPaymentEntry } from './journal.service';
import { wouldCreateCycle } from './payroll/engines/org-chart.engine';

const r2 = (n: number) => Math.round(n * 100) / 100;

// ═══════════════════════════════════════════════════════════════
// MOTOR DE CÁLCULO (funciones puras — testeables sin BD)
// ═══════════════════════════════════════════════════════════════

export interface CalcEmployee {
  baseSalary: number;
  hireDate: Date;
  monthlyThirteenth: boolean;
  monthlyFourteenth: boolean;
  reserveFundsToIESS: boolean;
  familyBurdens: number;
  projectedPersonalExpenses: number;
}

export interface CalcNovelty { type: NoveltyType; hours?: number; amount?: number; notes?: string | null }

export interface PayslipLineCalc {
  kind: 'EARNING' | 'DEDUCTION' | 'EMPLOYER';
  concept: string;
  label: string;
  amount: number;
  meta?: Record<string, unknown>;
}

export interface PayslipCalc {
  lines: PayslipLineCalc[];
  grossEarnings: number;   // base de aportación IESS
  otherEarnings: number;   // no gravados pagados en el rol
  totalDeductions: number;
  netPay: number;
  employerCost: number;
}

/** Días trabajados en el mes (base 30) considerando la fecha de ingreso. */
export function workedDaysInMonth(hireDate: Date, year: number, month: number): number {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  if (hireDate > monthEnd) return 0;
  if (hireDate <= monthStart) return 30;
  return Math.max(0, 30 - (hireDate.getUTCDate() - 1));
}

/** Meses completos de servicio al inicio del período (derecho a fondos de reserva: > 12). */
export function monthsOfService(hireDate: Date, year: number, month: number): number {
  const ref = new Date(Date.UTC(year, month - 1, 1));
  const months = (ref.getUTCFullYear() - hireDate.getUTCFullYear()) * 12 + (ref.getUTCMonth() - hireDate.getUTCMonth());
  return Math.max(0, months);
}

/** Impuesto a la renta ANUAL según la tabla 2026 (antes de rebaja por gastos personales). */
export function annualIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  const row = IR_TABLE_2026.find((t) => taxableIncome > t.from && (t.to === null || taxableIncome <= t.to))
    ?? IR_TABLE_2026[IR_TABLE_2026.length - 1];
  return r2(row.baseTax + (taxableIncome - row.from) * (row.ratePct / 100));
}

/** Rebaja por gastos personales: 18% del menor entre lo proyectado y el tope por canastas. */
export function personalExpensesRebate(projectedExpenses: number, familyBurdens: number): number {
  const cap = canastasPorCargas(familyBurdens) * PAYROLL_EC.CANASTA_BASICA;
  return r2(PAYROLL_EC.PERSONAL_EXPENSES_REBATE_RATE * Math.min(Math.max(0, projectedExpenses), cap));
}

/**
 * Retención mensual de IR: proyecta la base gravada anual (ingresos gravados × 12),
 * resta el aporte personal anual y la rebaja por gastos personales, y divide para 12.
 * (Los décimos y fondos de reserva NO pagan IR.)
 */
export function monthlyIncomeTaxWithholding(
  monthlyTaxableIncome: number,
  projectedExpenses: number,
  familyBurdens: number,
): number {
  const annualIncome = monthlyTaxableIncome * 12;
  const annualIess = annualIncome * PAYROLL_EC.IESS_PERSONAL_RATE;
  const taxable = annualIncome - annualIess;
  const tax = annualIncomeTax(taxable);
  const rebate = personalExpensesRebate(projectedExpenses, familyBurdens);
  return r2(Math.max(0, tax - rebate) / 12);
}

/** Calcula el rol de pago mensual completo de un empleado. */
export function calculatePayslip(
  emp: CalcEmployee,
  novelties: CalcNovelty[],
  year: number,
  month: number,
): PayslipCalc {
  const lines: PayslipLineCalc[] = [];
  const days = workedDaysInMonth(emp.hireDate, year, month);
  const proportion = days / 30;

  // ── Ingresos gravados IESS ──
  const sueldo = r2(emp.baseSalary * proportion);
  lines.push({ kind: 'EARNING', concept: 'SUELDO', label: `Sueldo (${days}/30 días)`, amount: sueldo, meta: { days } });

  const hourValue = emp.baseSalary / PAYROLL_EC.MONTHLY_HOURS;
  let horasSup = 0, horasExt = 0, bonos = 0, otrosNoGravados = 0;
  for (const n of novelties) {
    const hours = Number(n.hours ?? 0);
    const amount = Number(n.amount ?? 0);
    switch (n.type) {
      case 'HORAS_SUPLEMENTARIAS': {
        const v = r2(hours * hourValue * (1 + PAYROLL_EC.OVERTIME_50));
        horasSup += v;
        lines.push({ kind: 'EARNING', concept: 'HORAS_SUP', label: `Horas suplementarias 50% (${hours}h)`, amount: v, meta: { hours, hourValue: r2(hourValue) } });
        break;
      }
      case 'HORAS_EXTRAORDINARIAS': {
        const v = r2(hours * hourValue * (1 + PAYROLL_EC.OVERTIME_100));
        horasExt += v;
        lines.push({ kind: 'EARNING', concept: 'HORAS_EXT', label: `Horas extraordinarias 100% (${hours}h)`, amount: v, meta: { hours, hourValue: r2(hourValue) } });
        break;
      }
      case 'BONO':
      case 'COMISION': {
        bonos += r2(amount);
        lines.push({ kind: 'EARNING', concept: n.type, label: n.type === 'BONO' ? 'Bono' : 'Comisión', amount: r2(amount), meta: { notes: n.notes ?? undefined } });
        break;
      }
      case 'OTRO_INGRESO': {
        otrosNoGravados += r2(amount);
        lines.push({ kind: 'EARNING', concept: 'OTRO_INGRESO', label: n.notes || 'Otro ingreso (no gravado)', amount: r2(amount) });
        break;
      }
      default: break; // descuentos se procesan abajo
    }
  }

  const baseIess = r2(sueldo + horasSup + horasExt + bonos);

  // ── Beneficios sociales pagados en el rol (NO gravan IESS ni IR) ──
  let decimoTerceroMens = 0, decimoCuartoMens = 0, fondosEnRol = 0;
  if (emp.monthlyThirteenth && baseIess > 0) {
    decimoTerceroMens = r2(baseIess / 12);
    lines.push({ kind: 'EARNING', concept: 'DECIMO_TERCERO_MENS', label: 'Décimo tercer sueldo (mensualizado)', amount: decimoTerceroMens });
  }
  if (emp.monthlyFourteenth && days > 0) {
    decimoCuartoMens = r2((PAYROLL_EC.SBU / 12) * proportion);
    lines.push({ kind: 'EARNING', concept: 'DECIMO_CUARTO_MENS', label: 'Décimo cuarto sueldo (mensualizado)', amount: decimoCuartoMens });
  }
  const hasReserveFunds = monthsOfService(emp.hireDate, year, month) >= 12 && baseIess > 0;
  const fondosReserva = hasReserveFunds ? r2(baseIess * PAYROLL_EC.RESERVE_FUND_RATE) : 0;
  if (hasReserveFunds && !emp.reserveFundsToIESS) {
    fondosEnRol = fondosReserva;
    lines.push({ kind: 'EARNING', concept: 'FONDOS_RESERVA', label: 'Fondos de reserva 8,33% (pagados en rol)', amount: fondosReserva });
  }

  // ── Descuentos ──
  const deductions: PayslipLineCalc[] = [];
  const aportePersonal = r2(baseIess * PAYROLL_EC.IESS_PERSONAL_RATE);
  if (aportePersonal > 0) {
    deductions.push({ kind: 'DEDUCTION', concept: 'APORTE_IESS', label: 'Aporte personal IESS 9,45%', amount: aportePersonal, meta: { base: baseIess } });
  }

  const ir = monthlyIncomeTaxWithholding(baseIess, emp.projectedPersonalExpenses, emp.familyBurdens);
  if (ir > 0) {
    deductions.push({ kind: 'DEDUCTION', concept: 'IMPUESTO_RENTA', label: 'Retención impuesto a la renta', amount: ir, meta: { cargas: emp.familyBurdens } });
  }

  const DEDUCTION_LABELS: Record<string, string> = {
    ANTICIPO: 'Anticipo de sueldo',
    PRESTAMO_QUIROGRAFARIO: 'Préstamo quirografario IESS',
    PRESTAMO_HIPOTECARIO: 'Préstamo hipotecario IESS',
    PENSION_ALIMENTICIA: 'Pensión alimenticia (retención judicial)',
    MULTA: 'Multa / sanción',
    OTRO_DESCUENTO: 'Otro descuento',
  };
  for (const n of novelties) {
    if (!(n.type in DEDUCTION_LABELS)) continue;
    let amount = r2(Number(n.amount ?? 0));
    if (amount <= 0) continue;
    if (n.type === 'MULTA') {
      const cap = r2(baseIess * PAYROLL_EC.MAX_FINE_RATE);
      if (amount > cap) amount = cap; // tope legal 10% (CT art. 44)
    }
    deductions.push({ kind: 'DEDUCTION', concept: n.type, label: n.notes ? `${DEDUCTION_LABELS[n.type]} · ${n.notes}` : DEDUCTION_LABELS[n.type], amount });
  }
  lines.push(...deductions);

  // ── Costos y provisiones patronales (no afectan el neto del empleado) ──
  const employer: PayslipLineCalc[] = [];
  const aportePatronal = r2(baseIess * PAYROLL_EC.IESS_PATRONAL_RATE);
  const ieceSecap = r2(baseIess * PAYROLL_EC.IECE_SECAP_RATE);
  if (baseIess > 0) {
    employer.push({ kind: 'EMPLOYER', concept: 'APORTE_PATRONAL', label: 'Aporte patronal IESS 11,15%', amount: aportePatronal, meta: { base: baseIess } });
    employer.push({ kind: 'EMPLOYER', concept: 'IECE_SECAP', label: 'IECE + SECAP 1%', amount: ieceSecap });
  }
  if (hasReserveFunds && emp.reserveFundsToIESS) {
    employer.push({ kind: 'EMPLOYER', concept: 'FONDOS_RESERVA_IESS', label: 'Fondos de reserva 8,33% (acumulados en IESS)', amount: fondosReserva });
  }
  if (!emp.monthlyThirteenth && baseIess > 0) {
    employer.push({ kind: 'EMPLOYER', concept: 'PROV_DECIMO_TERCERO', label: 'Provisión décimo tercer sueldo (1/12)', amount: r2(baseIess / 12) });
  }
  if (!emp.monthlyFourteenth && days > 0) {
    employer.push({ kind: 'EMPLOYER', concept: 'PROV_DECIMO_CUARTO', label: 'Provisión décimo cuarto sueldo (SBU/12)', amount: r2((PAYROLL_EC.SBU / 12) * proportion) });
  }
  if (baseIess > 0) {
    employer.push({ kind: 'EMPLOYER', concept: 'PROV_VACACIONES', label: 'Provisión vacaciones (1/24)', amount: r2(baseIess * PAYROLL_EC.VACATION_RATE) });
  }
  lines.push(...employer);

  const otherEarnings = r2(decimoTerceroMens + decimoCuartoMens + fondosEnRol + otrosNoGravados);
  const totalDeductions = r2(deductions.reduce((s, d) => s + d.amount, 0));
  const netPay = r2(baseIess + otherEarnings - totalDeductions);
  const employerCost = r2(employer.reduce((s, e) => s + e.amount, 0));

  return { lines, grossEarnings: baseIess, otherEarnings, totalDeductions, netPay, employerCost };
}

// ═══════════════════════════════════════════════════════════════
// EMPLEADOS
// ═══════════════════════════════════════════════════════════════

export interface EmployeeInput {
  cedula: string; firstName: string; lastName: string;
  email?: string; phone?: string; departmentId?: string | null;
  position: string; category: string; baseSalary: number; hireDate: string;
  monthlyThirteenth?: boolean; monthlyFourteenth?: boolean; reserveFundsToIESS?: boolean;
  familyBurdens?: number; projectedPersonalExpenses?: number; bankAccount?: string;
  userId?: string | null;
  managerId?: string | null; // jefatura directa (aprobación de permisos en el calendario de TTHH)
}

function validateEmployee(data: EmployeeInput) {
  if (!data.cedula?.trim()) throw new Error('VALIDATION: cédula requerida');
  if (!data.firstName?.trim() || !data.lastName?.trim()) throw new Error('VALIDATION: nombres y apellidos requeridos');
  if (!data.position?.trim()) throw new Error('VALIDATION: cargo requerido');
  if (!(EMPLOYEE_CATEGORIES as readonly string[]).includes(data.category)) throw new Error('VALIDATION: categoría inválida (JEFATURA | ASISTENTE | SERVICIOS)');
  if (!Number.isFinite(Number(data.baseSalary)) || Number(data.baseSalary) < PAYROLL_EC.SBU) {
    throw new Error(`VALIDATION: el sueldo no puede ser menor al SBU ($${PAYROLL_EC.SBU})`);
  }
  if (!data.hireDate || isNaN(new Date(data.hireDate).getTime())) throw new Error('VALIDATION: fecha de ingreso inválida');
}

// Vista recortada para el organigrama: sin cédula, sueldo ni datos de tributación — TTHH
// también accede a este endpoint y no debe ver información salarial que no le corresponde.
export async function getOrgChart(companyId: string) {
  return prisma.employee.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true, firstName: true, lastName: true, position: true, category: true,
      departmentId: true, managerId: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
}

export async function listEmployees(companyId: string, opts?: { includeInactive?: boolean }) {
  return prisma.employee.findMany({
    where: { companyId, ...(opts?.includeInactive ? {} : { isActive: true }) },
    include: {
      department: { select: { id: true, name: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
}

export async function createEmployee(companyId: string, data: EmployeeInput) {
  validateEmployee(data);
  if (data.departmentId) {
    const dep = await prisma.department.findFirst({ where: { id: data.departmentId, companyId } });
    if (!dep) throw new Error('DEPARTMENT_NOT_FOUND');
  }
  if (data.managerId) {
    const manager = await prisma.employee.findFirst({ where: { id: data.managerId, companyId } });
    if (!manager) throw new Error('MANAGER_NOT_FOUND');
  }
  if (data.userId) {
    const user = await prisma.user.findFirst({ where: { id: data.userId, companyId } });
    if (!user) throw new Error('USER_NOT_FOUND');
    const linked = await prisma.employee.findFirst({ where: { companyId, userId: data.userId } });
    if (linked) throw new Error('USER_ALREADY_LINKED');
  }
  return prisma.employee.create({
    data: {
      companyId,
      cedula: data.cedula.trim(),
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      departmentId: data.departmentId || null,
      position: data.position.trim(),
      category: data.category,
      baseSalary: new Prisma.Decimal(data.baseSalary),
      hireDate: new Date(data.hireDate),
      monthlyThirteenth: !!data.monthlyThirteenth,
      monthlyFourteenth: !!data.monthlyFourteenth,
      reserveFundsToIESS: !!data.reserveFundsToIESS,
      familyBurdens: Number(data.familyBurdens ?? 0),
      projectedPersonalExpenses: new Prisma.Decimal(data.projectedPersonalExpenses ?? 0),
      bankAccount: data.bankAccount?.trim() || null,
      userId: data.userId || null,
      managerId: data.managerId || null,
    },
    include: { department: { select: { id: true, name: true } } },
  });
}

export async function updateEmployee(id: string, companyId: string, data: Partial<EmployeeInput> & { isActive?: boolean }) {
  const emp = await prisma.employee.findFirst({ where: { id, companyId } });
  if (!emp) throw new Error('EMPLOYEE_NOT_FOUND');
  if (data.category && !(EMPLOYEE_CATEGORIES as readonly string[]).includes(data.category)) throw new Error('VALIDATION: categoría inválida');
  if (data.baseSalary != null && Number(data.baseSalary) < PAYROLL_EC.SBU) {
    throw new Error(`VALIDATION: el sueldo no puede ser menor al SBU ($${PAYROLL_EC.SBU})`);
  }
  if (data.managerId) {
    const manager = await prisma.employee.findFirst({ where: { id: data.managerId, companyId } });
    if (!manager) throw new Error('MANAGER_NOT_FOUND');
    const allEmployees = await prisma.employee.findMany({ where: { companyId }, select: { id: true, managerId: true } });
    if (wouldCreateCycle(allEmployees, id, data.managerId)) {
      throw new Error('VALIDATION: esa asignación crearía un ciclo en el organigrama (el jefe elegido depende de este colaborador)');
    }
  }
  if (data.userId) {
    const user = await prisma.user.findFirst({ where: { id: data.userId, companyId } });
    if (!user) throw new Error('USER_NOT_FOUND');
    // un usuario del ERP solo puede representar a un empleado (si no, resolveVisibleEmployeeIds/getOwnEmployeeId sería ambiguo)
    const linked = await prisma.employee.findFirst({ where: { companyId, userId: data.userId, id: { not: id } } });
    if (linked) throw new Error('USER_ALREADY_LINKED');
  }
  return prisma.employee.update({
    where: { id },
    data: {
      ...(data.managerId !== undefined && { managerId: data.managerId || null }),
      ...(data.userId !== undefined && { userId: data.userId || null }),
      ...(data.cedula != null && { cedula: data.cedula.trim() }),
      ...(data.firstName != null && { firstName: data.firstName.trim() }),
      ...(data.lastName != null && { lastName: data.lastName.trim() }),
      ...(data.email !== undefined && { email: data.email?.trim() || null }),
      ...(data.phone !== undefined && { phone: data.phone?.trim() || null }),
      ...(data.departmentId !== undefined && { departmentId: data.departmentId || null }),
      ...(data.position != null && { position: data.position.trim() }),
      ...(data.category != null && { category: data.category }),
      ...(data.baseSalary != null && { baseSalary: new Prisma.Decimal(data.baseSalary) }),
      ...(data.hireDate != null && { hireDate: new Date(data.hireDate) }),
      ...(data.monthlyThirteenth !== undefined && { monthlyThirteenth: !!data.monthlyThirteenth }),
      ...(data.monthlyFourteenth !== undefined && { monthlyFourteenth: !!data.monthlyFourteenth }),
      ...(data.reserveFundsToIESS !== undefined && { reserveFundsToIESS: !!data.reserveFundsToIESS }),
      ...(data.familyBurdens !== undefined && { familyBurdens: Number(data.familyBurdens) }),
      ...(data.projectedPersonalExpenses !== undefined && { projectedPersonalExpenses: new Prisma.Decimal(data.projectedPersonalExpenses ?? 0) }),
      ...(data.bankAccount !== undefined && { bankAccount: data.bankAccount?.trim() || null }),
      ...(data.isActive !== undefined && { isActive: !!data.isActive }),
    },
    include: { department: { select: { id: true, name: true } } },
  });
}

// ═══════════════════════════════════════════════════════════════
// NOVEDADES
// ═══════════════════════════════════════════════════════════════

export async function addNovelty(companyId: string, data: {
  periodId: string; employeeId: string; type: string; hours?: number; amount?: number; notes?: string;
}, userId?: string) {
  if (!(NOVELTY_TYPES as readonly string[]).includes(data.type)) throw new Error('VALIDATION: tipo de novedad inválido');
  const period = await prisma.payrollPeriod.findFirst({ where: { id: data.periodId, companyId } });
  if (!period) throw new Error('PERIOD_NOT_FOUND');
  if (period.status !== 'DRAFT' && period.status !== 'PROCESSED') throw new Error('PERIOD_LOCKED');
  const emp = await prisma.employee.findFirst({ where: { id: data.employeeId, companyId } });
  if (!emp) throw new Error('EMPLOYEE_NOT_FOUND');
  const isHours = data.type === 'HORAS_SUPLEMENTARIAS' || data.type === 'HORAS_EXTRAORDINARIAS';
  if (isHours && !(Number(data.hours) > 0)) throw new Error('VALIDATION: horas > 0 requeridas');
  if (!isHours && !(Number(data.amount) > 0)) throw new Error('VALIDATION: monto > 0 requerido');

  const novelty = await prisma.payrollNovelty.create({
    data: {
      companyId, periodId: data.periodId, employeeId: data.employeeId, type: data.type,
      hours: isHours ? new Prisma.Decimal(data.hours!) : null,
      amount: !isHours ? new Prisma.Decimal(data.amount!) : null,
      notes: data.notes?.trim() || null, createdBy: userId,
    },
  });
  // Si el período ya estaba calculado, se recalcula para reflejar la novedad.
  if (period.status === 'PROCESSED') await generatePayroll(companyId, period.year, period.month, userId);
  return novelty;
}

export async function deleteNovelty(id: string, companyId: string, userId?: string) {
  const novelty = await prisma.payrollNovelty.findFirst({ where: { id, companyId }, include: { period: true } });
  if (!novelty) throw new Error('NOVELTY_NOT_FOUND');
  if (novelty.period.status !== 'DRAFT' && novelty.period.status !== 'PROCESSED') throw new Error('PERIOD_LOCKED');
  await prisma.payrollNovelty.delete({ where: { id } });
  if (novelty.period.status === 'PROCESSED') await generatePayroll(companyId, novelty.period.year, novelty.period.month, userId);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════
// PERÍODOS Y GENERACIÓN DEL ROL
// ═══════════════════════════════════════════════════════════════

export async function listPeriods(companyId: string) {
  return prisma.payrollPeriod.findMany({
    where: { companyId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: { _count: { select: { payslips: true, novelties: true } } },
    take: 36,
  });
}

export async function getOrCreatePeriod(companyId: string, year: number, month: number, userId?: string) {
  if (!year || !month || month < 1 || month > 12) throw new Error('VALIDATION: período inválido');
  return prisma.payrollPeriod.upsert({
    where: { companyId_year_month: { companyId, year, month } },
    update: {},
    create: { companyId, year, month, createdBy: userId },
  });
}

export async function getPeriodDetail(periodId: string, companyId: string) {
  const period = await prisma.payrollPeriod.findFirst({
    where: { id: periodId, companyId },
    include: {
      payslips: {
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, cedula: true, position: true, category: true, department: { select: { name: true } } } },
          lines: { orderBy: { id: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      },
      novelties: { include: { employee: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!period) throw new Error('PERIOD_NOT_FOUND');
  return period;
}

/** Genera (o regenera) los roles de pago de todos los empleados activos del período. */
export async function generatePayroll(companyId: string, year: number, month: number, userId?: string) {
  const period = await getOrCreatePeriod(companyId, year, month, userId);
  if (period.status === 'POSTED' || period.status === 'PAID') throw new Error('PERIOD_LOCKED');

  const [employees, novelties] = await Promise.all([
    prisma.employee.findMany({ where: { companyId, isActive: true } }),
    prisma.payrollNovelty.findMany({ where: { periodId: period.id } }),
  ]);
  if (employees.length === 0) throw new Error('NO_EMPLOYEES');

  const byEmployee = new Map<string, CalcNovelty[]>();
  for (const n of novelties) {
    const list = byEmployee.get(n.employeeId) ?? [];
    list.push({ type: n.type as NoveltyType, hours: n.hours ? Number(n.hours) : undefined, amount: n.amount ? Number(n.amount) : undefined, notes: n.notes });
    byEmployee.set(n.employeeId, list);
  }

  await prisma.$transaction(async (tx) => {
    await tx.payslip.deleteMany({ where: { periodId: period.id } }); // regenerable mientras no esté contabilizado
    for (const emp of employees) {
      const calc = calculatePayslip(
        {
          baseSalary: Number(emp.baseSalary), hireDate: emp.hireDate,
          monthlyThirteenth: emp.monthlyThirteenth, monthlyFourteenth: emp.monthlyFourteenth,
          reserveFundsToIESS: emp.reserveFundsToIESS,
          familyBurdens: emp.familyBurdens, projectedPersonalExpenses: Number(emp.projectedPersonalExpenses),
        },
        byEmployee.get(emp.id) ?? [], year, month,
      );
      if (calc.grossEarnings <= 0 && calc.otherEarnings <= 0) continue; // ingresó después del período
      await tx.payslip.create({
        data: {
          periodId: period.id, employeeId: emp.id,
          grossEarnings: calc.grossEarnings, otherEarnings: calc.otherEarnings,
          totalDeductions: calc.totalDeductions, netPay: calc.netPay, employerCost: calc.employerCost,
          lines: { create: calc.lines.map((l) => ({ kind: l.kind, concept: l.concept, label: l.label, amount: l.amount, meta: (l.meta ?? undefined) as Prisma.InputJsonValue | undefined })) },
        },
      });
    }
    await tx.payrollPeriod.update({ where: { id: period.id }, data: { status: 'PROCESSED', processedAt: new Date() } });
  });

  return getPeriodDetail(period.id, companyId);
}

// ═══════════════════════════════════════════════════════════════
// CONTABILIZACIÓN Y PAGO
// ═══════════════════════════════════════════════════════════════

/** Agrega los totales del período para armar el asiento de devengo. */
export function aggregateForAccounting(payslips: Array<{ lines: Array<{ kind: string; concept: string; amount: unknown }>; netPay: unknown }>) {
  const sum = { salaryExpense: 0, iessExpense: 0, benefitsExpense: 0, iessPayable: 0, irPayable: 0, benefitsPayable: 0, net: 0 };
  for (const p of payslips) {
    sum.net += Number(p.netPay);
    for (const l of p.lines) {
      const amt = Number(l.amount);
      if (l.kind === 'EARNING') {
        if (['SUELDO', 'HORAS_SUP', 'HORAS_EXT', 'BONO', 'COMISION', 'OTRO_INGRESO'].includes(l.concept)) sum.salaryExpense += amt;
        else if (l.concept === 'FONDOS_RESERVA') sum.iessExpense += amt; // gasto de aportes (incluye fondo de reserva)
        else sum.benefitsExpense += amt; // décimos mensualizados
      } else if (l.kind === 'EMPLOYER') {
        if (['APORTE_PATRONAL', 'IECE_SECAP', 'FONDOS_RESERVA_IESS'].includes(l.concept)) {
          sum.iessExpense += amt;
          sum.iessPayable += amt;
        } else {
          sum.benefitsExpense += amt;   // provisiones décimos + vacaciones
          sum.benefitsPayable += amt;
        }
      } else if (l.kind === 'DEDUCTION') {
        if (['APORTE_IESS', 'PRESTAMO_QUIROGRAFARIO', 'PRESTAMO_HIPOTECARIO'].includes(l.concept)) sum.iessPayable += amt;
        else if (l.concept === 'IMPUESTO_RENTA') sum.irPayable += amt;
        else sum.benefitsPayable += amt; // pensiones, multas, anticipos, otros — obligaciones varias
      }
    }
  }
  sum.benefitsPayable += sum.net; // neto por pagar a empleados
  for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] = r2(sum[k]);
  return sum;
}

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Contabiliza el período (asiento de devengo) — POSTED. */
export async function postPeriod(periodId: string, companyId: string, userId?: string) {
  const period = await getPeriodDetail(periodId, companyId);
  if (period.status !== 'PROCESSED') throw new Error(period.status === 'DRAFT' ? 'PERIOD_NOT_PROCESSED' : 'PERIOD_LOCKED');
  if (period.payslips.length === 0) throw new Error('NO_PAYSLIPS');

  const totals = aggregateForAccounting(period.payslips as any);
  const label = `${MONTH_NAMES[period.month - 1]} ${period.year}`;
  const entry = await createPayrollAccrualEntry(companyId, {
    periodId, label, totals, userId,
    employees: period.payslips.length,
  });

  await prisma.payrollPeriod.update({
    where: { id: periodId },
    data: { status: 'POSTED', postedAt: new Date(), journalEntryId: entry.id },
  });
  return { period: await getPeriodDetail(periodId, companyId), journalEntry: entry };
}

/** Registra el pago de los netos (DR neto por pagar / CR caja-bancos) — PAID. */
export async function payPeriod(periodId: string, companyId: string, userId?: string) {
  const period = await getPeriodDetail(periodId, companyId);
  if (period.status !== 'POSTED') throw new Error(period.status === 'PAID' ? 'ALREADY_PAID' : 'PERIOD_NOT_POSTED');

  const net = r2(period.payslips.reduce((s, p) => s + Number(p.netPay), 0));
  const label = `${MONTH_NAMES[period.month - 1]} ${period.year}`;
  const entry = await createPayrollPaymentEntry(companyId, { periodId, label, net, userId });

  await prisma.payrollPeriod.update({
    where: { id: periodId },
    data: { status: 'PAID', paidAt: new Date(), paymentEntryId: entry.id },
  });
  return { period: await getPeriodDetail(periodId, companyId), journalEntry: entry };
}

/** Parámetros vigentes (para mostrar en la UI). */
export function getPayrollConfig() {
  return { ...PAYROLL_EC, irTable: IR_TABLE_2026, categories: EMPLOYEE_CATEGORIES, noveltyTypes: NOVELTY_TYPES };
}
