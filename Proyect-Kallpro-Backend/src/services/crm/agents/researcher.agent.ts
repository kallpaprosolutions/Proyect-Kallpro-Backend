import { BaseAgent, AgentContext } from './base.agent';

export class ResearcherAgent extends BaseAgent {
  constructor() {
    super('researcher');
  }

  protected buildUserMessage(context: AgentContext): string {
    const company = context.extra?.companyName ?? 'empresa desconocida';
    const ruc = context.extra?.ruc;
    return `Investiga esta empresa prospecto y entrega inteligencia comercial:
Empresa: ${company}
${ruc ? `RUC: ${ruc}` : ''}
${context.extra?.website ? `Sitio web: ${context.extra.website}` : ''}
${context.extra?.sector ? `Sector: ${context.extra.sector}` : ''}
ContactoId: ${context.contactId ?? 'N/A'}

Entrega:
1. Perfil de la empresa (tamaño, sector, operaciones Ecuador)
2. Señales de compra detectadas
3. Posibles pain points con gestión ERP actual
4. Recomendación de pitch personalizado
5. Score de prioridad (1-10)`;
  }
}

export default ResearcherAgent;
