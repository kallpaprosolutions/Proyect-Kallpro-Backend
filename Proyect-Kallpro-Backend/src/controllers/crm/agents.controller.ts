import { Request } from 'express';
import { prisma } from '../../lib/prisma';
import { AgentContext } from '../../services/crm/agents/base.agent';
import { asyncHandler } from '../../middleware/error-handler';
import { AppError } from '../../utils/errors';

const AGENT_CLASS_MAP: Record<string, string> = {
  router: 'router.agent',
  sdr: 'sdr.agent',
  researcher: 'researcher.agent',
  copywriter: 'copywriter.agent',
  closer: 'closer.agent',
  success: 'success.agent',
};

export const listAgentsHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const agents = await prisma.crmAgent.findMany({
    where: { companyId },
    select: {
      id: true,
      code: true,
      name: true,
      model: true,
      isActive: true,
      autonomyDefault: true,
      createdAt: true,
    },
  });
  res.json(agents);
});

export const getAgentMetricsHandler = asyncHandler(async (req: Request, res) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const runs = await prisma.crmAgentRun.findMany({
    where: {
      agentCode: req.params.code,
      createdAt: { gte: since24h },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { agent: { select: { code: true, name: true } } },
  });

  const total = runs.length;
  const successful = runs.filter(r => r.status === 'SUCCESS').length;
  const avgLatency = total > 0
    ? Math.round(runs.reduce((s, r) => s + (r.latencyMs ?? 0), 0) / total)
    : 0;
  const totalCost = runs.reduce((s, r) => s + Number(r.costUsd ?? 0), 0);

  res.json({
    code: req.params.code,
    runs: {
      total,
      successful,
      failed: total - successful,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      avgLatencyMs: avgLatency,
      totalCostUsd: Math.round(totalCost * 10000) / 10000,
    },
    recentRuns: runs.slice(0, 10).map(r => ({
      id: r.id,
      status: r.status,
      latencyMs: r.latencyMs,
      costUsd: r.costUsd,
      toolsCalled: r.toolsCalled,
      createdAt: r.createdAt,
    })),
  });
});

export const invokeAgentHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const { code } = req.params;
  const agentFile = AGENT_CLASS_MAP[code];

  if (!agentFile) throw AppError.notFound(`Agente '${code}' no encontrado`, 'AGENT_NOT_FOUND');

  const mod = await import(`../../services/crm/agents/${agentFile}`);
  const AgentClass = mod.default ?? Object.values(mod)[0] as any;
  const agent = new AgentClass();

  const context: AgentContext = {
    companyId,
    contactId: req.body.contactId,
    conversationId: req.body.conversationId,
    dealId: req.body.dealId,
    messageBody: req.body.messageBody,
    channel: req.body.channel,
    userId: (req as any).user?.id,
    extra: req.body.extra,
  };

  const result = await agent.invoke(context);
  res.json(result);
});
