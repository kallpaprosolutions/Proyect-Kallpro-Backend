import { BaseAgent, AgentContext } from './base.agent';

export class CloserAgent extends BaseAgent {
  constructor() {
    super('closer');
  }

  protected buildUserMessage(context: AgentContext): string {
    return `Gestiona este escenario de cierre de venta:
Mensaje del prospecto: "${context.messageBody ?? ''}"
DealId: ${context.dealId ?? 'N/A'}
ContactoId: ${context.contactId ?? 'N/A'}
${context.extra?.objection ? `Objeción detectada: ${context.extra.objection}` : ''}
${context.extra?.dealStage ? `Etapa actual: ${context.extra.dealStage}` : ''}
${context.extra?.dealValue ? `Valor del deal: $${context.extra.dealValue}` : ''}

Acciones:
1. Maneja cualquier objeción con técnica apropiada
2. Genera respuesta que avance hacia el cierre
3. Propón siguiente paso concreto (firma contrato, meeting final, etc.)
4. Si detectas señal de cierre, escala para aprobación de cierre`;
  }
}

export default CloserAgent;
