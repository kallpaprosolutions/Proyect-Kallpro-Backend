import { prisma } from '../../lib/prisma';
export interface DCFAssumptions {
  growthRate: number;       // tasa crecimiento revenue (ej: 0.12 = 12%)
  ebitdaMargin: number;     // margen EBITDA (ej: 0.20 = 20%)
  taxRate?: number;         // IR efectivo, default 0.3625 Ecuador
  wacc: number;             // costo promedio ponderado de capital
  perpetualGrowth: number;  // tasa crecimiento perpetuo (g), default 0.03
  capexPct: number;         // CapEx como % de revenue (ej: 0.05)
  wcChangePct: number;      // variación WC como % de revenue (ej: 0.02)
  projectionYears?: number; // años proyección, default 5
  baseRevenue?: number;     // si no se pasa, se calcula del último período
  saveModel?: boolean;
  modelName?: string;
}

export interface YearlyProjection {
  year: number;
  revenue: number;
  ebitda: number;
  nopat: number;
  capex: number;
  deltaWC: number;
  fcf: number;
  pvFcf: number;
}

export interface DCFResult {
  enterpriseValue: number;
  equityValue: number;
  pvExplicitFlows: number;
  pvTerminal: number;
  terminalValue: number;
  netDebt: number;
  yearlyProjections: YearlyProjection[];
  sensitivity: SensitivityMatrix;
  assumptionsUsed: DCFAssumptions;
  wacc: number;
  impliedMultiples: { evEbitda: number; evRevenue: number };
}

export interface SensitivityMatrix {
  waccRange: number[];
  growthRange: number[];
  values: number[][];  // [wacc_index][growth_index] = equity_value
}

async function getBaseRevenue(companyId: string): Promise<number> {
  const year = new Date().getFullYear();
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      status: { in: ['PAID', 'CONFIRMED', 'SENT'] },
      issueDate: {
        gte: new Date(year - 1, 0, 1),
        lte: new Date(year - 1, 11, 31),
      },
    },
  });
  const annualRevenue = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  // Si no hay datos del año anterior, usar año actual pro-rateado
  if (annualRevenue === 0) {
    const currentYearInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        status: { in: ['PAID', 'CONFIRMED', 'SENT'] },
        issueDate: { gte: new Date(year, 0, 1) },
      },
    });
    const ytd = currentYearInvoices.reduce((s, i) => s + Number(i.totalAmount), 0);
    const monthsPassed = new Date().getMonth() + 1;
    return monthsPassed > 0 ? (ytd / monthsPassed) * 12 : 100000;
  }
  return annualRevenue;
}

async function getNetDebt(companyId: string): Promise<number> {
  // Proxy: deuda = 60% del total pasivo estimado (compras * 1.5 * 0.6)
  const pos = await prisma.purchaseOrder.aggregate({
    where: { companyId, createdAt: { gte: new Date(new Date().getFullYear() - 1, 0, 1) } },
    _sum: { totalAmount: true },
  });
  const compras = Number(pos._sum.totalAmount ?? 0);
  const pasivo = compras * 1.5;
  const caja = compras * 0.08;
  return pasivo * 0.6 - caja; // Deuda financiera - Caja
}

export function calculateDCFSync(baseRevenue: number, netDebt: number, assumptions: DCFAssumptions): DCFResult {
  const {
    growthRate,
    ebitdaMargin,
    taxRate = 0.3625,
    wacc,
    perpetualGrowth,
    capexPct,
    wcChangePct,
    projectionYears = 5,
  } = assumptions;

  if (wacc <= perpetualGrowth) {
    throw new Error('WACC debe ser mayor que la tasa de crecimiento perpetuo (g)');
  }
  if (wacc <= 0 || wacc >= 1) throw new Error('WACC debe estar entre 0 y 100%');
  if (growthRate < -0.5 || growthRate > 1) throw new Error('Tasa de crecimiento fuera de rango');

  let pvFlows = 0;
  const yearlyProjections: YearlyProjection[] = [];
  const currentYear = new Date().getFullYear();

  for (let y = 1; y <= projectionYears; y++) {
    const revenueY = baseRevenue * Math.pow(1 + growthRate, y);
    const ebitdaY = revenueY * ebitdaMargin;
    const nopatY = ebitdaY * (1 - taxRate);
    const capexY = revenueY * capexPct;
    const dwcY = revenueY * wcChangePct;
    const fcfY = nopatY - capexY - dwcY;
    const pvFcfY = fcfY / Math.pow(1 + wacc, y);

    pvFlows += pvFcfY;
    yearlyProjections.push({
      year: currentYear + y,
      revenue: revenueY,
      ebitda: ebitdaY,
      nopat: nopatY,
      capex: capexY,
      deltaWC: dwcY,
      fcf: fcfY,
      pvFcf: pvFcfY,
    });
  }

  const lastFCF = yearlyProjections[projectionYears - 1].fcf;
  const terminalValue = (lastFCF * (1 + perpetualGrowth)) / (wacc - perpetualGrowth);
  const pvTerminal = terminalValue / Math.pow(1 + wacc, projectionYears);

  const enterpriseValue = pvFlows + pvTerminal;
  const equityValue = enterpriseValue - netDebt;

  const lastEbitda = yearlyProjections[projectionYears - 1].ebitda;
  const lastRevenue = yearlyProjections[projectionYears - 1].revenue;

  // Matriz de sensibilidad ±2pp WACC × ±3pp growth
  const waccRange = [wacc - 0.02, wacc - 0.01, wacc, wacc + 0.01, wacc + 0.02];
  const growthRange = [growthRate - 0.03, growthRate - 0.015, growthRate, growthRate + 0.015, growthRate + 0.03];
  const sensitivityValues: number[][] = waccRange.map(w => {
    return growthRange.map(g => {
      if (w <= assumptions.perpetualGrowth || w >= 1) return 0;
      try {
        const res = calculateDCFSync(baseRevenue, netDebt, { ...assumptions, wacc: w, growthRate: g });
        return Math.round(res.equityValue);
      } catch {
        return 0;
      }
    });
  });

  return {
    enterpriseValue: Math.round(enterpriseValue),
    equityValue: Math.round(equityValue),
    pvExplicitFlows: Math.round(pvFlows),
    pvTerminal: Math.round(pvTerminal),
    terminalValue: Math.round(terminalValue),
    netDebt: Math.round(netDebt),
    yearlyProjections,
    sensitivity: {
      waccRange: waccRange.map(w => Math.round(w * 10000) / 100),
      growthRange: growthRange.map(g => Math.round(g * 10000) / 100),
      values: sensitivityValues,
    },
    assumptionsUsed: assumptions,
    wacc,
    impliedMultiples: {
      evEbitda: lastEbitda > 0 ? enterpriseValue / lastEbitda : 0,
      evRevenue: lastRevenue > 0 ? enterpriseValue / lastRevenue : 0,
    },
  };
}

export async function calculateDCF(companyId: string, assumptions: DCFAssumptions): Promise<DCFResult> {
  const baseRevenue = assumptions.baseRevenue ?? (await getBaseRevenue(companyId));
  const netDebt = await getNetDebt(companyId);
  const result = calculateDCFSync(baseRevenue, netDebt, assumptions);
  return result;
}

export async function saveDCFModel(
  companyId: string,
  userId: string,
  name: string,
  assumptions: DCFAssumptions,
  results: DCFResult,
) {
  return prisma.financeDCFModel.create({
    data: {
      companyId,
      createdBy: userId,
      name,
      assumptions: assumptions as object,
      results: {
        enterpriseValue: results.enterpriseValue,
        equityValue: results.equityValue,
        pvExplicitFlows: results.pvExplicitFlows,
        pvTerminal: results.pvTerminal,
        terminalValue: results.terminalValue,
        netDebt: results.netDebt,
        wacc: results.wacc,
        impliedMultiples: results.impliedMultiples,
      } as object,
      yearlyProjections: results.yearlyProjections as unknown as object,
      sensitivity: results.sensitivity as object,
    },
  });
}

export async function listDCFModels(companyId: string) {
  return prisma.financeDCFModel.findMany({
    where: { companyId },
    orderBy: { savedAt: 'desc' },
    take: 20,
  });
}

export default { calculateDCF, calculateDCFSync, saveDCFModel, listDCFModels };
