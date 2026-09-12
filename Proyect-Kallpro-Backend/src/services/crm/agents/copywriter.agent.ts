import { BaseAgent, AgentContext } from './base.agent';

export class CopywriterAgent extends BaseAgent {
  constructor() {
    super('copywriter');
  }

  protected buildUserMessage(context: AgentContext): string {
    const contentType = context.extra?.contentType ?? 'propuesta';
    return `Genera contenido de ventas personalizado para este prospecto:
Tipo de contenido: ${contentType}
${context.extra?.companyName ? `Empresa: ${context.extra.companyName}` : ''}
${context.extra?.sector ? `Sector: ${context.extra.sector}` : ''}
${context.extra?.painPoints ? `Pain points: ${JSON.stringify(context.extra.painPoints)}` : ''}
${context.extra?.dealValue ? `Valor estimado del deal: $${context.extra.dealValue}` : ''}
Canal de entrega: ${context.channel ?? 'WhatsApp'}

Genera:
1. Asunto/título atractivo
2. Cuerpo del mensaje (adaptado al canal: conciso para WhatsApp, detallado para email)
3. Call-to-action claro
4. Variante A/B alternativa`;
  }
}

export default CopywriterAgent;
