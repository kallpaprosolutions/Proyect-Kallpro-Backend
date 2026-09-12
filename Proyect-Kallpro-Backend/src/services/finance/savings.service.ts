import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
export interface SavingsSummary {
  total: number;
  breakdown: {
    hard: number;
    costAvoidance: number;
    consolidation: number;
    downtimeAvoided: number;
  };
  detail: SavingItem[];
  period: string;
  currency: 'USD';
}

export interface SavingItem {
  id: string;
  type: string;
  amount: number;
  description: string;
  sourceModule: string;
  sourceId?: string | null;
  date: Date;
}

export interface LogSavingInput {
  savingType: 'HARD' | 'COST_AVOIDANCE' | 'CONSOLIDATION' | 'DOWNTIME';
  amountUsd: number;
  sourceModule: string;
  sourceId?: string;
  description?: string;
  periodYear?: number;
  periodMonth?: number;
  evidenceUrl?: string;
  createdBy?: string;
}

async function getHardSavings(companyId: string, year: number, month: number): Promise<number> {
  // Hard savings: diferencia entre precio cotizado vs precio de OC (si hay múltiples cotizaciones)
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      companyId,
      createdAt: {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0),
      },
      status: { in: ['CONFIRMED', 'RECEIVED', 'CLOSED'] },
    },
    include: {
      requisition: {
        include: {
          quotations: { include: { items: true } },
        },
      },
    },
  });

  let totalHard = 0;
  for (const po of pos) {
    if ((po.requisition?.quotations?.length ?? 0) >= 2) {
      const allTotals = (po.requisition!.quotations ?? []).map(q => Number(q.totalAmount));
      const maxQuote = Math.max(...allTotals);
      const thisTotal = Number(po.totalAmount);
      if (maxQuote > thisTotal) {
        totalHard += maxQuote - thisTotal;
      }
    }
  }

  // También incluir savings registrados manualmente tipo HARD
  const manual = await prisma.financeSavingsLog.aggregate({
    where: { companyId, savingType: 'HARD', periodYear: year, periodMonth: month },
    _sum: { amountUsd: true },
  });
  totalHard += Number(manual._sum.amountUsd ?? 0);
  return totalHard;
}

async function getCostAvoidance(companyId: string, year: number, month: number): Promise<number> {
  const manual = await prisma.financeSavingsLog.aggregate({
    where: { companyId, savingType: 'COST_AVOIDANCE', periodYear: year, periodMonth: month },
    _sum: { amountUsd: true },
  });
  return Number(manual._sum.amountUsd ?? 0);
}

async function getConsolidationSavings(companyId: string, year: number, month: number): Promise<number> {
  // Proxy: suppliers con múltiples OCs del mismo mes → saving estimado del 3% por consolidación
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      companyId,
      createdAt: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0) },
    },
    select: { supplierId: true, totalAmount: true },
  });

  const bySupplier: Record<string, number> = {};
  for (const po of pos) {
    bySupplier[po.supplierId] = (bySupplier[po.supplierId] ?? 0) + Number(po.totalAmount);
  }

  // Si hay proveedor con >1 OC → ahorro 3% del total consolidado
  let consolidation = 0;
  for (const [, total] of Object.entries(bySupplier)) {
    consolidation += total * 0.03;
  }

  const manual = await prisma.financeSavingsLog.aggregate({
    where: { companyId, savingType: 'CONSOLIDATION', periodYear: year, periodMonth: month },
    _sum: { amountUsd: true },
  });
  return consolidation + Number(manual._sum.amountUsd ?? 0);
}

async function getDowntimeAvoided(companyId: string, year: number, month: number): Promise<number> {
  // Proxy: productos con stock > reorderPoint = stockouts prevenidos
  // Revenue/hora estimado: revenue anual / (365 * 12)
  const invoicesYear = await prisma.invoice.aggregate({
    where: {
      companyId,
      issueDate: { gte: new Date(year - 1, 0, 1), lte: new Date(year - 1, 11, 31) },
      status: { in: ['PAID', 'CONFIRMED'] },
    },
    _sum: { totalAmount: true },
  });
  const annualRevenue = Number(invoicesYear._sum.totalAmount ?? 0);
  const revenuePerHour = annualRevenue / (365 * 24);

  // Contar productos con stock saludable (> reorderPoint)
  const healthyProducts = await prisma.productStock.count({
    where: {
      product: { companyId, isActive: true },
      quantity: { gt: 0 },
    },
  });

  // Estimado conservador: cada producto con stock saludable evita 0.5h parada/mes
  const downtime = healthyProducts * 0.5 * revenuePerHour;

  const manual = await prisma.financeSavingsLog.aggregate({
    where: { companyId, savingType: 'DOWNTIME', periodYear: year, periodMonth: month },
    _sum: { amountUsd: true },
  });
  return Math.min(downtime, annualRevenue * 0.05) + Number(manual._sum.amountUsd ?? 0);
}

export async function getSavingsSummary(companyId: string, period?: string): Promise<SavingsSummary> {
  const now = period ? new Date(period + '-01') : new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const periodStr = `${year}-${String(month).padStart(2, '0')}`;

  const [hard, costAvoidance, consolidation, downtime] = await Promise.all([
    getHardSavings(companyId, year, month),
    getCostAvoidance(companyId, year, month),
    getConsolidationSavings(companyId, year, month),
    getDowntimeAvoided(companyId, year, month),
  ]);

  const total = hard + costAvoidance + consolidation + downtime;

  const logs = await prisma.financeSavingsLog.findMany({
    where: { companyId, periodYear: year, periodMonth: month },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const detail: SavingItem[] = logs.map(l => ({
    id: l.id,
    type: l.savingType,
    amount: Number(l.amountUsd),
    description: l.description ?? l.savingType,
    sourceModule: l.sourceModule,
    sourceId: l.sourceId,
    date: l.createdAt,
  }));

  return {
    total: Math.round(total),
    breakdown: {
      hard: Math.round(hard),
      costAvoidance: Math.round(costAvoidance),
      consolidation: Math.round(consolidation),
      downtimeAvoided: Math.round(downtime),
    },
    detail,
    period: periodStr,
    currency: 'USD',
  };
}

export async function logSaving(companyId: string, data: LogSavingInput) {
  const now = new Date();
  return prisma.financeSavingsLog.create({
    data: {
      companyId,
      savingType: data.savingType,
      amountUsd: new Prisma.Decimal(data.amountUsd),
      sourceModule: data.sourceModule,
      sourceId: data.sourceId,
      description: data.description,
      periodYear: data.periodYear ?? now.getFullYear(),
      periodMonth: data.periodMonth ?? now.getMonth() + 1,
      evidenceUrl: data.evidenceUrl,
      createdBy: data.createdBy,
    },
  });
}

export default { getSavingsSummary, logSaving };
