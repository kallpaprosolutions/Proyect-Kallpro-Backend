import { prisma } from '../../lib/prisma';
import { getFunnelMetrics, getDealsAtRisk } from './deal.service';
import { calculateForecast } from './forecast.service';
// CrmDeal uses amountUsd (not value)
// CrmAgentRun uses createdAt (not startedAt), companyId directly

export async function getDashboardMetrics(companyId: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [
    totalContacts,
    newContactsThisMonth,
    totalDeals,
    openDeals,
    wonThisMonth,
    lostThisMonth,
    wonLastMonth,
    avgDealSize,
    funnelMetrics,
    dealsAtRisk,
    forecast,
    agentRunsToday,
  ] = await Promise.all([
    prisma.crmContact.count({ where: { companyId } }),
    prisma.crmContact.count({ where: { companyId, createdAt: { gte: monthStart } } }),
    prisma.crmDeal.count({ where: { companyId } }),
    prisma.crmDeal.count({ where: { companyId, stage: { notIn: ['WON', 'LOST', 'won', 'lost'] } } }),
    prisma.crmDeal.findMany({
      where: { companyId, stage: { in: ['WON', 'won'] }, closedAt: { gte: monthStart, lte: monthEnd } },
      select: { amountUsd: true },
    }),
    prisma.crmDeal.count({
      where: { companyId, stage: { in: ['LOST', 'lost'] }, closedAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.crmDeal.findMany({
      where: { companyId, stage: { in: ['WON', 'won'] }, closedAt: { gte: lastMonthStart, lte: lastMonthEnd } },
      select: { amountUsd: true },
    }),
    prisma.crmDeal.aggregate({
      where: { companyId, stage: { in: ['WON', 'won'] } },
      _avg: { amountUsd: true },
    }),
    getFunnelMetrics(companyId),
    getDealsAtRisk(companyId),
    calculateForecast(companyId),
    prisma.crmAgentRun.count({
      where: {
        companyId,
        createdAt: { gte: todayStart },
      },
    }),
  ]);

  const wonValueThisMonth = wonThisMonth.reduce((s, d) => s + Number(d.amountUsd), 0);
  const wonValueLastMonth = wonLastMonth.reduce((s, d) => s + Number(d.amountUsd), 0);
  const wonCountThisMonth = wonThisMonth.length;
  const conversionRate = (wonCountThisMonth + lostThisMonth) > 0
    ? (wonCountThisMonth / (wonCountThisMonth + lostThisMonth)) * 100
    : 0;
  const revenueGrowth = wonValueLastMonth > 0
    ? ((wonValueThisMonth - wonValueLastMonth) / wonValueLastMonth) * 100
    : 0;

  return {
    contacts: {
      total: totalContacts,
      newThisMonth: newContactsThisMonth,
    },
    deals: {
      total: totalDeals,
      open: openDeals,
      wonThisMonth: wonCountThisMonth,
      lostThisMonth,
      wonValueThisMonth,
      avgDealSize: Math.round(Number(avgDealSize._avg.amountUsd ?? 0)),
      conversionRate: Math.round(conversionRate * 10) / 10,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
    },
    pipeline: {
      totalValue: funnelMetrics.reduce((s, f) => s + f.totalValue, 0),
      weightedValue: funnelMetrics.reduce((s, f) => s + f.weightedValue, 0),
      byStage: funnelMetrics,
    },
    forecast: {
      thisMonth: forecast.weightedForecast,
      wonThisMonth: wonValueThisMonth,
    },
    dealsAtRisk: dealsAtRisk.slice(0, 5),
    agents: {
      runsToday: agentRunsToday,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function getAgentPerformance(companyId: string) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const agents = await prisma.crmAgent.findMany({
    where: { companyId },
    include: {
      runs: {
        where: { createdAt: { gte: since24h } },
        select: {
          status: true,
          tokensInput: true,
          tokensOutput: true,
          costUsd: true,
          latencyMs: true,
        },
      },
    },
  });

  return agents.map(agent => {
    const runs = agent.runs;
    const successful = runs.filter(r => r.status === 'success');
    return {
      code: agent.code,
      name: agent.name,
      runsLast24h: runs.length,
      successRate: runs.length > 0 ? (successful.length / runs.length) * 100 : 0,
      avgLatencyMs: runs.length > 0
        ? Math.round(runs.reduce((s, r) => s + (r.latencyMs ?? 0), 0) / runs.length)
        : 0,
      totalCostUsd: runs.reduce((s, r) => s + Number(r.costUsd ?? 0), 0),
      totalTokens: runs.reduce((s, r) => s + (r.tokensInput ?? 0) + (r.tokensOutput ?? 0), 0),
    };
  });
}
