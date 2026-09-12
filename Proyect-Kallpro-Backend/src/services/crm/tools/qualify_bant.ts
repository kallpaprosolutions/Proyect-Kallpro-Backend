import { AgentContext } from '../agents/base.agent';
import { updateLeadScore } from '../contact.service';

export async function execute(
  args: {
    contactId?: string;
    budget?: number;
    authority?: number;
    need?: number;
    timeline?: number;
    reasoning?: string;
  },
  ctx: AgentContext,
) {
  const contactId = args.contactId ?? ctx.contactId;
  if (!contactId) return { error: 'contactId requerido' };

  const score = await updateLeadScore(contactId, {
    budget: args.budget,
    authority: args.authority,
    need: args.need,
    timeline: args.timeline,
  });

  return {
    contactId,
    bantScore: score.totalScore,
    budget: score.budgetScore,
    authority: score.authorityScore,
    need: score.needScore,
    timeline: score.timelineScore,
    qualified: score.totalScore >= 60,
    reasoning: args.reasoning,
  };
}

export default execute;
