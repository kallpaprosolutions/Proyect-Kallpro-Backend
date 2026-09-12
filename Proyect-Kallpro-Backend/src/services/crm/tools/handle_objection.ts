import { AgentContext } from '../agents/base.agent';

const OBJECTION_RESPONSES: Record<string, { response: string; nextStep: string }> = {
  PRICE: {
    response: 'Entiendo su preocupación por el precio. KallpaPro ofrece ROI en < 6 meses. ¿Le gustaría ver un análisis personalizado de ahorro para su empresa?',
    nextStep: 'Enviar caso de estudio de ahorro o calculadora ROI',
  },
  TIMING: {
    response: 'El momento es importante. La implementación toma solo 2 semanas. Podemos reservar su espacio ahora y comenzar cuando esté listo.',
    nextStep: 'Ofrecer reserva sin compromiso',
  },
  COMPETITOR: {
    response: 'Valoramos la comparación. KallpaPro está diseñado específicamente para el mercado ecuatoriano con cumplimiento SRI integrado. ¿Qué es lo más importante para ustedes?',
    nextStep: 'Enviar tabla comparativa personalizada',
  },
  NEED: {
    response: '¿Podría contarme más sobre sus procesos actuales? Muchos de nuestros clientes no sabían que tenían este problema hasta que lo descubrieron con KallpaPro.',
    nextStep: 'Realizar diagnóstico rápido gratuito',
  },
  AUTHORITY: {
    response: 'Entiendo. ¿Quién más estaría involucrado en esta decisión? Podemos preparar un resumen ejecutivo para su equipo directivo.',
    nextStep: 'Preparar material para decisores',
  },
};

export async function execute(
  args: {
    objectionType: 'PRICE' | 'TIMING' | 'COMPETITOR' | 'NEED' | 'AUTHORITY' | 'OTHER';
    objectionText?: string;
    contactContext?: string;
  },
  _ctx: AgentContext,
) {
  const template = OBJECTION_RESPONSES[args.objectionType];

  return {
    objectionType: args.objectionType,
    suggestedResponse: template?.response ?? 'Agradezco su comentario. ¿Podría contarme más detalles para poder ayudarle mejor?',
    nextStep: template?.nextStep ?? 'Escalar a ejecutivo de ventas',
    requiresHumanReview: args.objectionType === 'OTHER' || args.objectionType === 'AUTHORITY',
  };
}

export default execute;
