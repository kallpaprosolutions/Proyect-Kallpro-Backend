import { prisma } from '../../../lib/prisma';
import { AgentContext } from '../agents/base.agent';
export async function execute(
  args: { contactId?: string; dealId?: string },
  ctx: AgentContext,
) {
  const contactId = args.contactId ?? ctx.contactId;
  if (!contactId) return { error: 'contactId requerido' };

  const contact = await prisma.crmContact.findUnique({
    where: { id: contactId },
    include: {
      conversations: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
      leadScores: { orderBy: { scoredAt: 'desc' }, take: 1 },
      deals: { where: { stage: { in: ['WON', 'won'] } }, select: { amountUsd: true } },
    },
  }) as any;

  if (!contact) return { error: 'Contacto no encontrado' };

  const daysSinceContact = contact.conversations?.[0]
    ? Math.floor((Date.now() - new Date(contact.conversations[0].updatedAt).getTime()) / 86400000)
    : 999;

  const bantScore = contact.leadScores?.[0]?.totalScore ?? 0;
  const wonDealsValue = (contact.deals ?? []).reduce((s: number, d: any) => s + Number(d.amountUsd), 0);

  let healthScore = 100;
  if (daysSinceContact > 30) healthScore -= 30;
  else if (daysSinceContact > 14) healthScore -= 15;
  if (bantScore < 40) healthScore -= 20;
  if (wonDealsValue === 0) healthScore -= 10;

  const churnRisk = healthScore < 50 ? 'high' : healthScore < 70 ? 'medium' : 'low';

  return {
    contactId,
    healthScore: Math.max(0, healthScore),
    churnRisk,
    daysSinceContact,
    bantScore,
    wonDealsValue,
    recommendations: healthScore < 70
      ? ['Programar check-in', 'Enviar contenido de valor']
      : ['Mantener cadencia regular'],
  };
}

export default execute;
