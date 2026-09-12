import { AgentContext } from '../agents/base.agent';
import { rescoreLead, registerEvent } from '../lead.service';

/**
 * Herramienta `score_lead` (Sprint 13).
 *
 * Permite al agente (típicamente Sofía · SDR) recalcular el score de un lead con las
 * reglas configuradas por la empresa y, opcionalmente, registrar la señal de interacción
 * que acaba de observar en la conversación ("pidió una demo", "preguntó precios").
 *
 * Por qué el agente NO inventa el score: el motor de reglas es auditable y el usuario lo
 * edita desde la interfaz. Si el agente puntuara "a ojo", nadie podría explicar por qué
 * un lead vale 80 y otro 40, y el vendedor dejaría de confiar en el número.
 */
export default async function scoreLead(
  args: { leadId?: string; eventType?: string; channel?: string },
  ctx: AgentContext,
) {
  const leadId = args.leadId ?? (ctx.extra?.leadId as string | undefined);
  if (!leadId) return { error: 'Falta el identificador del lead' };

  try {
    if (args.eventType) {
      const { lead, score } = await registerEvent(ctx.companyId, leadId, args.eventType, args.channel);
      return {
        leadId: lead.id,
        score: score.score,
        grade: score.grade,
        temperature: score.temperature,
        lifecycle: score.lifecycle,
        eventoRegistrado: args.eventType,
        explicacion: score.breakdown.map(b => `${b.ruleName}: ${b.points > 0 ? '+' : ''}${b.points}`),
      };
    }

    const { lead, result } = await rescoreLead(ctx.companyId, leadId);
    return {
      leadId: lead.id,
      score: result.score,
      fitScore: result.fitScore,
      engageScore: result.engageScore,
      grade: result.grade,
      temperature: result.temperature,
      lifecycle: result.lifecycle,
      explicacion: result.breakdown.map(b => `${b.ruleName}: ${b.points > 0 ? '+' : ''}${b.points}`),
    };
  } catch (err: any) {
    return { error: err?.message ?? 'No se pudo calcular el score' };
  }
}
