import { BaseAgent, AgentContext } from './base.agent';

export class SuccessAgent extends BaseAgent {
  constructor() {
    super('success');
  }

  protected buildUserMessage(context: AgentContext): string {
    return `Gestiona la relación post-venta con este cliente:
Mensaje: "${context.messageBody ?? ''}"
ContactoId: ${context.contactId ?? 'N/A'}
${context.extra?.healthScore ? `Health score: ${context.extra.healthScore}` : ''}
${context.extra?.daysSinceContact ? `Días sin contacto: ${context.extra.daysSinceContact}` : ''}
${context.extra?.churnRisk ? `Riesgo de churn: ${context.extra.churnRisk}` : ''}
${context.extra?.wonDealsValue ? `Valor de contratos: $${context.extra.wonDealsValue}` : ''}

Tareas:
1. Evalúa satisfacción y riesgo de churn
2. Genera respuesta proactiva y de valor
3. Identifica oportunidades de upsell/cross-sell
4. Si riesgo alto: escala para intervención humana urgente
5. Propón próximo QBR o punto de contacto`;
  }
}

export default SuccessAgent;
