import { AgentContext } from '../agents/base.agent';

export type Intent =
  | 'INQUIRY'
  | 'COMPLAINT'
  | 'PURCHASE_INTENT'
  | 'DEMO_REQUEST'
  | 'SUPPORT'
  | 'PRICE_REQUEST'
  | 'UNSUBSCRIBE'
  | 'REFERRAL'
  | 'RENEWAL'
  | 'UNKNOWN';

export async function execute(
  args: { message: string; channel?: string },
  _ctx: AgentContext,
): Promise<{ intent: Intent; confidence: number; urgency: 'low' | 'medium' | 'high' }> {
  const msg = (args.message ?? '').toLowerCase();

  // Rule-based fallback classifier
  if (/precio|costo|cotiz|tarif|plan|cuánto/i.test(msg)) {
    return { intent: 'PRICE_REQUEST', confidence: 0.85, urgency: 'medium' };
  }
  if (/demo|prueba|trial|ver|mostrar/i.test(msg)) {
    return { intent: 'DEMO_REQUEST', confidence: 0.88, urgency: 'high' };
  }
  if (/comprar|adquirir|contratar|quiero|necesito/i.test(msg)) {
    return { intent: 'PURCHASE_INTENT', confidence: 0.90, urgency: 'high' };
  }
  if (/problema|error|falla|no funciona|ayuda|soporte/i.test(msg)) {
    return { intent: 'SUPPORT', confidence: 0.85, urgency: 'high' };
  }
  if (/información|info|detalles|cuéntame|qué es/i.test(msg)) {
    return { intent: 'INQUIRY', confidence: 0.80, urgency: 'low' };
  }
  if (/cancelar|baja|darme de baja|eliminar cuenta/i.test(msg)) {
    return { intent: 'UNSUBSCRIBE', confidence: 0.90, urgency: 'high' };
  }
  if (/renovar|renovación|extender/i.test(msg)) {
    return { intent: 'RENEWAL', confidence: 0.85, urgency: 'medium' };
  }
  if (/recomendé|referí|referido|conocido/i.test(msg)) {
    return { intent: 'REFERRAL', confidence: 0.80, urgency: 'medium' };
  }

  return { intent: 'UNKNOWN', confidence: 0.50, urgency: 'low' };
}

export default execute;
