import { prisma } from '../../../lib/prisma';
import { AgentContext } from '../agents/base.agent';
export async function execute(
  args: {
    contactId?: string;
    signals: Array<{ type: string; description: string; strength: 'weak' | 'medium' | 'strong' }>;
  },
  ctx: AgentContext,
) {
  const contactId = args.contactId ?? ctx.contactId;
  if (!contactId) return { error: 'contactId requerido' };

  // Add signals as tags to contact
  const contact = await prisma.crmContact.findUnique({ where: { id: contactId }, select: { tags: true } });
  if (!contact) return { error: 'Contacto no encontrado' };

  const signalTags = args.signals
    .filter(s => s.strength === 'strong' || s.strength === 'medium')
    .map(s => `signal:${s.type}`);

  const currentTags = contact.tags as string[];
  const newTags = [...new Set([...currentTags, ...signalTags])];

  await prisma.crmContact.update({
    where: { id: contactId },
    data: { tags: newTags },
  });

  return {
    contactId,
    detectedSignals: args.signals.length,
    strongSignals: args.signals.filter(s => s.strength === 'strong').length,
    signals: args.signals,
  };
}

export default execute;
