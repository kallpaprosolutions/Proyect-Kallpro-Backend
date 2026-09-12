import { AgentContext } from '../agents/base.agent';
import { execute as monitorHealth } from './monitor_health';

export async function execute(args: { contactId?: string }, ctx: AgentContext) {
  const health = await monitorHealth(args, ctx);
  if ('error' in health) return health;

  return {
    ...health,
    interventionNeeded: health.churnRisk === 'high',
    suggestedActions: health.churnRisk === 'high'
      ? ['Llamada urgente del account manager', 'Ofrecer revisión QBR', 'Descuento de retención']
      : health.churnRisk === 'medium'
      ? ['Enviar caso de éxito relevante', 'Check-in mensual']
      : ['Continuar cadencia estándar'],
  };
}

export default execute;
