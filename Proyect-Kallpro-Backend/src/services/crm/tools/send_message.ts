import { prisma } from '../../../lib/prisma';
import { AgentContext } from '../agents/base.agent';
import { addMessage } from '../conversation.service';
export async function execute(
  args: {
    conversationId?: string;
    message: string;
    channel?: string;
    requiresApproval?: boolean;
  },
  ctx: AgentContext,
) {
  const conversationId = args.conversationId ?? ctx.conversationId;
  if (!conversationId) return { error: 'conversationId requerido' };

  const channel = (args.channel ?? ctx.channel ?? 'INTERNAL') as any;
  const requiresApproval = args.requiresApproval ?? true; // AI messages require approval by default

  const msg = await addMessage(conversationId, args.message, 'outbound', channel, {
    isAI: true,
    agentCode: 'ai',
    requiresApproval,
  });

  return {
    messageId: msg.id,
    status: requiresApproval ? 'PENDING_APPROVAL' : 'SENT',
    preview: args.message.substring(0, 100),
  };
}

export default execute;
