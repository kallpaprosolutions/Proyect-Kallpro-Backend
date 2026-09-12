import { prisma } from '../../../lib/prisma';
import { AgentContext } from '../agents/base.agent';
export async function execute(args: { contactId?: string }, ctx: AgentContext) {
  const id = args.contactId ?? ctx.contactId;
  if (!id) return { error: 'contactId requerido' };

  const contact = await prisma.crmContact.findUnique({
    where: { id },
    include: {
      crmCompany: true,
      deals: { orderBy: { updatedAt: 'desc' }, take: 5 },
      conversations: {
        orderBy: { updatedAt: 'desc' },
        take: 3,
        include: { messages: { orderBy: { sentAt: 'desc' }, take: 5 } },
      },
      leadScores: { orderBy: { scoredAt: 'desc' }, take: 1 },
    },
  }) as any;

  if (!contact) return { error: 'Contacto no encontrado' };

  const leadScore = contact.leadScores?.[0] ?? null;

  return {
    id: contact.id,
    name: `${contact.firstName} ${contact.lastName ?? ''}`.trim(),
    email: contact.email,
    phone: contact.phoneE164,
    jobTitle: contact.title,
    company: contact.crmCompany?.legalName,
    companyRuc: contact.crmCompany?.ruc,
    companySector: contact.crmCompany?.industry,
    companyRevenue: contact.crmCompany?.revenueEstUsd,
    tags: contact.tags,
    bantScore: leadScore?.totalScore ?? 0,
    bant: leadScore
      ? {
          budget: leadScore.budgetScore,
          authority: leadScore.authorityScore,
          need: leadScore.needScore,
          timeline: leadScore.timelineScore,
        }
      : null,
    activeDeals: (contact.deals ?? [])
      .filter((d: any) => !['WON', 'LOST', 'won', 'lost'].includes(d.stage))
      .map((d: any) => ({
        id: d.id,
        title: d.name,
        value: Number(d.amountUsd),
        stage: d.stage,
      })),
    lastInteraction: contact.conversations?.[0]?.updatedAt,
    recentMessages: (contact.conversations?.[0]?.messages ?? []).map((m: any) => ({
      direction: m.direction,
      body: m.body.substring(0, 200),
      sentAt: m.sentAt,
    })),
  };
}

export default execute;
