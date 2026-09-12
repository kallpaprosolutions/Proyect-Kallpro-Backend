import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
// ============================================================
// DEPARTAMENTOS
// ============================================================

export async function getDepartments(companyId: string) {
  return prisma.department.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
  });
}

export async function createDepartment(companyId: string, data: { name: string; code?: string; managerId?: string }) {
  return prisma.department.create({ data: { ...data, companyId } });
}

// ============================================================
// PRESUPUESTOS
// ============================================================

export async function getBudgets(companyId: string, year?: number, month?: number) {
  return prisma.budgetControl.findMany({
    where: {
      companyId,
      ...(year ? { year } : {}),
      ...(month ? { month } : {}),
    },
    include: { department: true },
    orderBy: [{ year: 'desc' }, { month: 'desc' }, { department: { name: 'asc' } }],
  });
}

export async function upsertBudget(
  companyId: string,
  data: { departmentId?: string; year: number; month: number; budgetAmount: number; notes?: string },
) {
  return prisma.budgetControl.upsert({
    where: {
      companyId_departmentId_year_month: {
        companyId,
        departmentId: data.departmentId ?? null as any,
        year: data.year,
        month: data.month,
      },
    },
    update: {
      budgetAmount: new Prisma.Decimal(data.budgetAmount),
      notes: data.notes,
    },
    create: {
      companyId,
      departmentId: data.departmentId,
      year: data.year,
      month: data.month,
      budgetAmount: new Prisma.Decimal(data.budgetAmount),
      notes: data.notes,
    },
    include: { department: true },
  });
}

export async function updateConsumed(
  companyId: string,
  departmentId: string | null | undefined,
  year: number,
  month: number,
  amountToAdd: number,
) {
  const budget = await prisma.budgetControl.findFirst({
    where: { companyId, departmentId: departmentId ?? null, year, month },
  });
  if (!budget) return null;

  return prisma.budgetControl.update({
    where: { id: budget.id },
    data: { consumed: new Prisma.Decimal(Number(budget.consumed) + amountToAdd) },
  });
}

// ============================================================
// RESUMEN DEL MES
// ============================================================

export async function getBudgetSummary(companyId: string, year: number, month: number) {
  const budgets = await prisma.budgetControl.findMany({
    where: { companyId, year, month },
    include: { department: true },
  });

  return budgets.map((b) => {
    const budgetAmt = Number(b.budgetAmount);
    const consumed = Number(b.consumed);
    const remaining = budgetAmt - consumed;
    const percentUsed = budgetAmt > 0 ? Math.round((consumed / budgetAmt) * 100) : 0;
    return {
      id: b.id,
      departmentId: b.departmentId,
      departmentName: b.department?.name ?? 'General',
      budgetAmount: budgetAmt,
      consumed,
      remaining,
      percentUsed,
      status: percentUsed >= 100 ? 'EXCEEDED' : percentUsed >= 90 ? 'CRITICAL' : percentUsed >= 70 ? 'WARNING' : 'OK',
    };
  });
}

// ============================================================
// PLANILLA ANUAL (presupuesto vs real vs variación)
// ============================================================

export async function getAnnualWorksheet(companyId: string, year: number) {
  const [departments, budgets] = await Promise.all([
    prisma.department.findMany({ where: { companyId }, orderBy: { name: 'asc' } }),
    prisma.budgetControl.findMany({ where: { companyId, year } }),
  ]);

  // Filas: cada departamento + "General" (departmentId null)
  const rows = [
    ...departments.map((d) => ({ departmentId: d.id as string | null, departmentName: d.name })),
    { departmentId: null as string | null, departmentName: 'General' },
  ];

  return rows.map((row) => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const b = budgets.find((x) => x.departmentId === row.departmentId && x.month === i + 1);
      const budget = b ? Number(b.budgetAmount) : 0;
      const actual = b ? Number(b.consumed) : 0;
      return { month: i + 1, budget, actual, variance: budget - actual };
    });
    const budgetTotal = months.reduce((s, m) => s + m.budget, 0);
    const actualTotal = months.reduce((s, m) => s + m.actual, 0);
    const variance = budgetTotal - actualTotal;
    const variancePct = budgetTotal > 0 ? Math.round((variance / budgetTotal) * 1000) / 10 : 0;
    return {
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      months,
      budgetTotal,
      actualTotal,
      variance,
      variancePct,
    };
  });
}

export async function bulkUpsertBudget(
  companyId: string,
  data: { departmentId?: string | null; year: number; months: number[] },
) {
  const results = [];
  for (let i = 0; i < 12; i++) {
    const amount = Number(data.months[i] ?? 0);
    results.push(
      await upsertBudget(companyId, {
        departmentId: data.departmentId ?? undefined,
        year: data.year,
        month: i + 1,
        budgetAmount: amount,
      }),
    );
  }
  return results;
}

// ============================================================
// VERIFICAR PRESUPUESTO DISPONIBLE (para requisiciones)
// ============================================================

export async function checkBudgetAvailability(
  companyId: string,
  departmentId: string | null | undefined,
  estimatedAmount: number,
): Promise<{ available: boolean; remaining: number; budget: number; consumed: number }> {
  const now = new Date();
  const budget = await prisma.budgetControl.findFirst({
    where: { companyId, departmentId: departmentId ?? null, year: now.getFullYear(), month: now.getMonth() + 1 },
  });
  if (!budget) return { available: true, remaining: Infinity, budget: 0, consumed: 0 };

  const consumed = Number(budget.consumed);
  const total = Number(budget.budgetAmount);
  const remaining = total - consumed;
  return {
    available: remaining >= estimatedAmount,
    remaining,
    budget: total,
    consumed,
  };
}
