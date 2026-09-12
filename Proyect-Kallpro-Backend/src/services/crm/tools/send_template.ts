import { prisma } from '../../../lib/prisma';
import { AgentContext } from '../agents/base.agent';
import { addMessage } from '../conversation.service';
export async function execute(
  args: {
    templateCode: string;
    conversationId?: string;
    variables?: Record<string, string>;
    requiresApproval?: boolean;
  },
  ctx: AgentContext,
) {
  const conversationId = args.conversationId ?? ctx.conversationId;
  if (!conversationId) return { error: 'conversationId requerido' };

  // Look up template by name (CrmTemplate has 'name' not 'code')
  const template = await prisma.crmTemplate.findFirst({
    where: { name: args.templateCode },
  });

  if (!template) return { error: `Template '${args.templateCode}' no encontrado` };

  // Replace variables
  let body = template.body;
  for (const [key, val] of Object.entries(args.variables ?? {})) {
    body = body.replace(`{{${key}}}`, val);
  }

  const msg = await addMessage(conversationId, body, 'outbound', 'whatsapp', {
    isAI: true,
    requiresApproval: args.requiresApproval ?? true,
  });

  return {
    messageId: msg.id,
    templateCode: args.templateCode,
    status: 'pending_approval',
    preview: body.substring(0, 200),
  };
}

export default execute;
