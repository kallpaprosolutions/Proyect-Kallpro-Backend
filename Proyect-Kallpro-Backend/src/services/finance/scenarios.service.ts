import { prisma } from '../../lib/prisma';
import { calculateDCFSync } from './dcf.service';
const DEFAULT_WACC = 0.12;
const DEFAULT_PERPETUAL_GROWTH = 0.03;
const DEFAULT_TAX_RATE = 0.3625;

export interface ScenarioParams {
  revenueVarPct: number;   // variación de revenue vs base (ej: 0.20 = +20%)
  costVarPct: number;      // variación de costos vs base
  capexVarPct: number;     // variación de CapEx vs base
  waccOverride?: number;   // override de WACC
  growthOverride?: number; // override de tasa de crecimiento
  name?: string;
  type?: string;
}

export interface ScenarioResult {
  name: string;
  type: string;
  revenue: number;
  ebitda: number;
  ebitdaMargin: number;
  netIncome: number;
  fcf: number;
  enterpriseValue: number;
  equityValue: number;
  revenueVarPct: number;
  ebitdaVarPct: number;
  evVarPct: number;
}

// Escenarios predefinidos
export const PREDEFINED_SCENARIOS: Record<string, ScenarioParams> = {
  optimista: {
    revenueVarPct: 0.20,
    costVarPct: -0.05,
    capexVarPct: 0.10,
    growthOverride: 0.20,
    name: 'Escenario Optimista',
    type: 'optimista',
  },
  base: {
    revenueVarPct: 0,
    costVarPct: 0,
    capexVarPct: 0,
    name: 'Escenario Base',
    type: 'base',
  },
  pesimista: {
    revenueVarPct: -0.20,
    costVarPct: 0.10,
    capexVarPct: -0.10,
    growthOverride: 0.04,
    waccOverride: 0.14,
    name: 'Escenario Pesimista',
    type: 'pesimista',
  },
};

async function getBaseMetrics(companyId: string) {
  const year = new Date().getFullYear();
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      status: { in: ['PAID', 'CONFIRMED', 'SENT'] },
      issueDate: { gte: new Date(year - 1, 0, 1), lte: new Date(year - 1, 11, 31) },
    },
  });
  const pos = await prisma.purchaseOrder.findMany({
    where: { companyId, createdAt: { gte: new Date(year - 1, 0, 1), lte: new Date(year - 1, 11, 31) } },
  });

  const baseRevenue = invoices.reduce((s, i) => s + Number(i.totalAmount), 0) || 500000;
  const baseCogs = pos.reduce((s, p) => s + Number(p.totalAmount), 0) || baseRevenue * 0.7;
  const baseEbitda = baseRevenue - baseCogs - baseRevenue * 0.18;
  const baseEbitdaMargin = baseRevenue > 0 ? baseEbitda / baseRevenue : 0.15;

  return { baseRevenue, baseCogs, baseEbitda, baseEbitdaMargin };
}

export async function simulate(companyId: string, params: ScenarioParams): Promise<ScenarioResult> {
  const base = await getBaseMetrics(companyId);

  const revenue = base.baseRevenue * (1 + params.revenueVarPct);
  const costFactor = 1 + params.costVarPct;
  const cogs = base.baseCogs * costFactor * (revenue / base.baseRevenue);
  const opex = revenue * 0.18 * costFactor;
  const ebitda = revenue - cogs - opex;
  const ebitdaMargin = revenue > 0 ? ebitda / revenue : 0;

  const dep = revenue * 0.03;
  const ebit = ebitda - dep;
  const intGastos = revenue * 0.04;
  const uai = ebit - intGastos;
  const pt = Math.max(0, uai * 0.15);
  const ir = Math.max(0, (uai - pt) * 0.25);
  const netIncome = uai - pt - ir;

  const nopat = ebit * (1 - DEFAULT_TAX_RATE);
  const capex = revenue * 0.05 * (1 + params.capexVarPct);
  const deltaWC = revenue * 0.02;
  const fcf = nopat + dep - capex - deltaWC;

  const growthRate = params.growthOverride ?? (base.baseRevenue > 0 ? 0.10 : 0.08);
  const wacc = params.waccOverride ?? DEFAULT_WACC;
  const netDebt = revenue * 0.15;

  let enterpriseValue = 0;
  let equityValue = 0;
  try {
    const dcf = calculateDCFSync(revenue, netDebt, {
      growthRate,
      ebitdaMargin,
      taxRate: DEFAULT_TAX_RATE,
      wacc,
      perpetualGrowth: DEFAULT_PERPETUAL_GROWTH,
      capexPct: revenue > 0 ? capex / revenue : 0.05,
      wcChangePct: 0.02,
      projectionYears: 5,
    });
    enterpriseValue = dcf.enterpriseValue;
    equityValue = dcf.equityValue;
  } catch {
    enterpriseValue = ebitda * 7;
    equityValue = enterpriseValue - netDebt;
  }

  return {
    name: params.name ?? 'Escenario personalizado',
    type: params.type ?? 'custom',
    revenue,
    ebitda,
    ebitdaMargin: ebitdaMargin * 100,
    netIncome,
    fcf,
    enterpriseValue,
    equityValue,
    revenueVarPct: params.revenueVarPct * 100,
    ebitdaVarPct: base.baseEbitda > 0 ? ((ebitda - base.baseEbitda) / base.baseEbitda) * 100 : 0,
    evVarPct: 0,
  };
}

export async function getThreePredefined(companyId: string): Promise<ScenarioResult[]> {
  return Promise.all([
    simulate(companyId, PREDEFINED_SCENARIOS.pesimista),
    simulate(companyId, PREDEFINED_SCENARIOS.base),
    simulate(companyId, PREDEFINED_SCENARIOS.optimista),
  ]);
}

export async function saveScenario(companyId: string, userId: string, params: ScenarioParams, result: ScenarioResult) {
  return prisma.financeScenario.create({
    data: {
      companyId,
      createdBy: userId,
      name: params.name ?? 'Escenario personalizado',
      type: params.type ?? 'custom',
      parameters: params as object,
      results: result as object,
    },
  });
}

export async function getScenarios(companyId: string) {
  return prisma.financeScenario.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
}

export async function compareScenarios(companyId: string, ids: string[]) {
  if (!ids?.length) {
    return getThreePredefined(companyId);
  }
  const scenarios = await prisma.financeScenario.findMany({
    where: { companyId, id: { in: ids } },
  });
  return scenarios.map(s => s.results);
}

export default { simulate, getThreePredefined, saveScenario, getScenarios, compareScenarios };
