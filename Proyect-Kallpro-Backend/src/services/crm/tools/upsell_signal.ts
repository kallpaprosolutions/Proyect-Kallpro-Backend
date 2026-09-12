import { prisma } from '../../../lib/prisma';
import { AgentContext } from '../agents/base.agent';
const UPSELL_TRIGGERS: Record<string, string[]> = {
  'finance': ['Menciona reportes', 'Pregunta sobre análisis financiero', 'Habla de presupuesto'],
  'crm': ['Tiene equipo de ventas', 'Menciona gestión de clientes', 'Habla de seguimiento'],
  'production': ['Maneja inventario grande', 'Menciona manufactura', 'Habla de órdenes de producción'],
};

export async function execute(
  args: { contactId?: string; currentModules?: string[] },
  ctx: AgentContext,
) {
  const contactId = args.contactId ?? ctx.contactId;
  if (!contactId) return { error: 'contactId requerido' };

  const currentModules = args.currentModules ?? [];
  const opportunities: Array<{ module: string; reason: string; estimatedValue: number }> = [];

  for (const [module, triggers] of Object.entries(UPSELL_TRIGGERS)) {
    if (!currentModules.includes(module)) {
      opportunities.push({
        module,
        reason: triggers[0],
        estimatedValue: 150 + Math.random() * 200, // placeholder
      });
    }
  }

  return {
    contactId,
    upsellOpportunities: opportunities,
    topOpportunity: opportunities[0] ?? null,
    recommendedAction: opportunities.length > 0
      ? `Presentar módulo ${opportunities[0]?.module} con demo personalizada`
      : 'Cliente tiene todas las funcionalidades. Enfocarse en renovación.',
  };
}

export default execute;
