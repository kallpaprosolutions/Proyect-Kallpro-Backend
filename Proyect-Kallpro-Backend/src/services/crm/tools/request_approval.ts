import { AgentContext } from '../agents/base.agent';
import { logger } from '../../../lib/logger';

// Import WS emitter lazily to avoid circular deps
export async function execute(
  args: {
    type: 'SEND_MESSAGE' | 'CLOSE_DEAL' | 'SEND_PROPOSAL' | 'OTHER';
    payload: any;
    reason: string;
  },
  ctx: AgentContext,
) {
  try {
    const { crmWS } = await import('../../websocket/crmChannel');
    crmWS.emit(`crm:inbox:company:${ctx.companyId}`, 'agent:escalation', {
      companyId: ctx.companyId,
      contactId: ctx.contactId,
      dealId: ctx.dealId,
      type: args.type,
      payload: args.payload,
      reason: args.reason,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // WS not available — just log
    logger.warn('[request_approval] WS not available, skipping escalation emit');
  }

  return {
    status: 'ESCALATED',
    message: 'Solicitud de aprobación enviada al equipo humano',
    type: args.type,
    reason: args.reason,
  };
}

export default execute;
