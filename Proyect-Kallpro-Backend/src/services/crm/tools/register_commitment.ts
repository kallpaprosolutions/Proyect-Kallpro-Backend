import { prisma } from '../../../lib/prisma';
import { AgentContext } from '../agents/base.agent';
export async function execute(
  args: {
    dealId?: string;
    commitmentType: 'DEMO' | 'PROPOSAL' | 'TRIAL' | 'PURCHASE' | 'MEETING' | 'FOLLOW_UP';
    description: string;
    dueDate?: string;
  },
  ctx: AgentContext,
) {
  const dealId = args.dealId ?? ctx.dealId;

  // Store commitment as a note on the deal
  if (dealId) {
    const deal = await prisma.crmDeal.findUnique({ where: { id: dealId }, select: { notes: true } });
    if (deal) {
      const timestamp = new Date().toISOString();
      const note = `[${timestamp}] COMPROMISO (${args.commitmentType}): ${args.description}${args.dueDate ? ` | Vence: ${args.dueDate}` : ''}`;
      await prisma.crmDeal.update({
        where: { id: dealId },
        data: { notes: deal.notes ? `${deal.notes}\n${note}` : note },
      });
    }
  }

  return {
    registered: true,
    commitmentType: args.commitmentType,
    description: args.description,
    dueDate: args.dueDate,
    dealId,
    timestamp: new Date().toISOString(),
  };
}

export default execute;
