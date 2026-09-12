import { BaseAgent, AgentContext } from './base.agent';

export class RouterAgent extends BaseAgent {
  constructor() {
    super('router');
  }

  protected buildUserMessage(context: AgentContext): string {
    return `Clasifica y enruta este mensaje entrante:
Canal: ${context.channel ?? 'UNKNOWN'}
Mensaje: "${context.messageBody ?? ''}"
ContactoId: ${context.contactId ?? 'nuevo'}
${context.extra ? `Datos adicionales: ${JSON.stringify(context.extra)}` : ''}

Determina: intent, urgencia, y qué agente especialista debe manejarlo (sdr/researcher/copywriter/closer/success).`;
  }
}

export default RouterAgent;
