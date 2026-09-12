import { AgentContext } from '../agents/base.agent';
import { updateDealStage } from '../deal.service';

export async function execute(
  args: { dealId?: string; outcome: 'WON' | 'LOST'; reason?: string },
  ctx: AgentContext,
) {
  const dealId = args.dealId ?? ctx.dealId;
  if (!dealId) return { error: 'dealId requerido' };

  const updated = await updateDealStage(ctx.companyId, dealId, args.outcome, 'ai-agent');

  return {
    dealId,
    newStage: args.outcome,
    closedAt: new Date().toISOString(),
    reason: args.reason,
    value: Number(updated.amountUsd),
  };
}

export default execute;
