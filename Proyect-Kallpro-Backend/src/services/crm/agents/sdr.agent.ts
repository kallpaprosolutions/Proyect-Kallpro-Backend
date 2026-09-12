import { BaseAgent, AgentContext } from './base.agent';

export class SdrAgent extends BaseAgent {
  constructor() {
    super('sdr');
  }

  protected buildUserMessage(context: AgentContext): string {
    return `Califica este lead y genera una respuesta inicial profesional:
Mensaje del prospecto: "${context.messageBody ?? ''}"
Canal: ${context.channel ?? 'UNKNOWN'}
ContactoId: ${context.contactId ?? 'desconocido'}
${context.extra?.bantContext ? `Contexto BANT previo: ${JSON.stringify(context.extra.bantContext)}` : ''}

Tareas:
1. Evalúa la calificación BANT (0-100 cada dimensión)
2. Genera respuesta personalizada que continue la conversación
3. Identifica señales de compra
4. Recomienda próximo paso`;
  }
}

export default SdrAgent;
