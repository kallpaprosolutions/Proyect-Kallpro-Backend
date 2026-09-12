import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROUTER_TOOLS = [
  {
    name: 'classify_intent',
    description: 'Clasifica la intención del mensaje entrante',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        channel: { type: 'string' },
      },
      required: ['message'],
    },
  },
  {
    name: 'fetch_lead_context',
    description: 'Obtiene el perfil completo del contacto',
    input_schema: {
      type: 'object',
      properties: { contactId: { type: 'string' } },
    },
  },
  {
    name: 'delegate_to_agent',
    description: 'Delega la conversación a un agente especialista',
    input_schema: {
      type: 'object',
      properties: {
        agentCode: { type: 'string', enum: ['sdr', 'researcher', 'copywriter', 'closer', 'success'] },
        context: { type: 'object' },
      },
      required: ['agentCode'],
    },
  },
];

const SDR_TOOLS = [
  {
    name: 'fetch_lead_context',
    description: 'Obtiene el perfil completo del contacto',
    input_schema: { type: 'object', properties: { contactId: { type: 'string' } } },
  },
  {
    name: 'qualify_bant',
    description: 'Actualiza el score BANT del contacto',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string' },
        budget: { type: 'number', minimum: 0, maximum: 100 },
        authority: { type: 'number', minimum: 0, maximum: 100 },
        need: { type: 'number', minimum: 0, maximum: 100 },
        timeline: { type: 'number', minimum: 0, maximum: 100 },
        reasoning: { type: 'string' },
      },
    },
  },
  {
    name: 'send_message',
    description: 'Envía un mensaje al prospecto (requiere aprobación humana)',
    input_schema: {
      type: 'object',
      properties: {
        conversationId: { type: 'string' },
        message: { type: 'string' },
        requiresApproval: { type: 'boolean' },
      },
      required: ['message'],
    },
  },
  {
    name: 'detect_signals',
    description: 'Registra señales de compra detectadas',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string' },
        signals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              description: { type: 'string' },
              strength: { type: 'string', enum: ['weak', 'medium', 'strong'] },
            },
          },
        },
      },
      required: ['signals'],
    },
  },
  {
    name: 'check_calendar',
    description: 'Verifica disponibilidad para reunión',
    input_schema: {
      type: 'object',
      properties: {
        preferredDate: { type: 'string' },
        durationMinutes: { type: 'number' },
      },
    },
  },
];

const RESEARCHER_TOOLS = [
  {
    name: 'web_search',
    description: 'Busca información de la empresa en internet',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        maxResults: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'validate_ruc',
    description: 'Valida el RUC ecuatoriano de la empresa',
    input_schema: {
      type: 'object',
      properties: { ruc: { type: 'string' } },
      required: ['ruc'],
    },
  },
  {
    name: 'enrich_company',
    description: 'Guarda datos enriquecidos de la empresa',
    input_schema: {
      type: 'object',
      properties: {
        companyId: { type: 'string' },
        sector: { type: 'string' },
        employeeCount: { type: 'number' },
        annualRevenue: { type: 'number' },
        website: { type: 'string' },
        buyingSignals: { type: 'array', items: { type: 'string' } },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'detect_signals',
    description: 'Registra señales de compra identificadas',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string' },
        signals: { type: 'array' },
      },
      required: ['signals'],
    },
  },
];

const COPYWRITER_TOOLS = [
  {
    name: 'fetch_lead_context',
    description: 'Obtiene el contexto del prospecto para personalizar el mensaje',
    input_schema: { type: 'object', properties: { contactId: { type: 'string' } } },
  },
  {
    name: 'send_template',
    description: 'Envía un template aprobado al prospecto',
    input_schema: {
      type: 'object',
      properties: {
        templateCode: { type: 'string' },
        conversationId: { type: 'string' },
        variables: { type: 'object' },
      },
      required: ['templateCode'],
    },
  },
  {
    name: 'send_message',
    description: 'Envía un mensaje personalizado (requiere aprobación)',
    input_schema: {
      type: 'object',
      properties: {
        conversationId: { type: 'string' },
        message: { type: 'string' },
        requiresApproval: { type: 'boolean' },
      },
      required: ['message'],
    },
  },
];

const CLOSER_TOOLS = [
  {
    name: 'handle_objection',
    description: 'Genera respuesta a una objeción de venta',
    input_schema: {
      type: 'object',
      properties: {
        objectionType: { type: 'string', enum: ['PRICE', 'TIMING', 'COMPETITOR', 'NEED', 'AUTHORITY', 'OTHER'] },
        objectionText: { type: 'string' },
      },
      required: ['objectionType'],
    },
  },
  {
    name: 'register_commitment',
    description: 'Registra un compromiso del cliente',
    input_schema: {
      type: 'object',
      properties: {
        dealId: { type: 'string' },
        commitmentType: { type: 'string' },
        description: { type: 'string' },
        dueDate: { type: 'string' },
      },
      required: ['commitmentType', 'description'],
    },
  },
  {
    name: 'send_message',
    description: 'Envía mensaje de cierre (requiere aprobación)',
    input_schema: {
      type: 'object',
      properties: {
        conversationId: { type: 'string' },
        message: { type: 'string' },
        requiresApproval: { type: 'boolean' },
      },
      required: ['message'],
    },
  },
  {
    name: 'close_deal',
    description: 'Cierra el deal como ganado o perdido',
    input_schema: {
      type: 'object',
      properties: {
        dealId: { type: 'string' },
        outcome: { type: 'string', enum: ['WON', 'LOST'] },
        reason: { type: 'string' },
      },
      required: ['outcome'],
    },
  },
  {
    name: 'request_approval',
    description: 'Escala decisión a un humano para aprobación',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        payload: { type: 'object' },
        reason: { type: 'string' },
      },
      required: ['type', 'reason'],
    },
  },
];

const SUCCESS_TOOLS = [
  {
    name: 'monitor_health',
    description: 'Evalúa el health score del cliente',
    input_schema: { type: 'object', properties: { contactId: { type: 'string' } } },
  },
  {
    name: 'detect_churn_risk',
    description: 'Detecta riesgo de churn y recomienda intervención',
    input_schema: { type: 'object', properties: { contactId: { type: 'string' } } },
  },
  {
    name: 'upsell_signal',
    description: 'Identifica oportunidades de upsell/cross-sell',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string' },
        currentModules: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'send_message',
    description: 'Envía mensaje de customer success (requiere aprobación)',
    input_schema: {
      type: 'object',
      properties: {
        conversationId: { type: 'string' },
        message: { type: 'string' },
        requiresApproval: { type: 'boolean' },
      },
      required: ['message'],
    },
  },
  {
    name: 'request_approval',
    description: 'Escala a humano si el churn risk es alto',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        payload: { type: 'object' },
        reason: { type: 'string' },
      },
      required: ['type', 'reason'],
    },
  },
];

const AGENTS = [
  {
    code: 'router',
    name: 'Router IA',
    description: 'Clasifica mensajes entrantes y delega al agente correcto',
    model: 'claude-haiku-4-5-20251001',
    systemPrompt: `Eres el Router IA de KallpaPro CRM para empresas ecuatorianas. Tu función es clasificar mensajes entrantes y delegarlos al agente especialista correcto.

Agentes disponibles:
- sdr: Para nuevos prospectos, calificación inicial, primeras consultas
- researcher: Para investigar empresas, enriquecer datos, validar RUC
- copywriter: Para generar propuestas, mensajes de seguimiento, contenido personalizado
- closer: Para objeciones de precio/timing/competencia, intentos de cierre, negociación
- success: Para clientes actuales, soporte post-venta, retención, upsell

Instrucciones:
1. Analiza el mensaje y contexto
2. Clasifica la intención (classify_intent)
3. Si tienes contactId, obtén el contexto del lead (fetch_lead_context)
4. Delega al agente apropiado (delegate_to_agent)
5. Responde con el routing decision y razón`,
    maxTokens: 800,
    temperature: 0.2,
    tools: ROUTER_TOOLS,
    autonomyDefault: 'autopilot',
    isActive: true,
  },
  {
    code: 'sdr',
    name: 'Sofía SDR',
    description: 'Agente SDR para calificación y nurturing de leads',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Eres Sofía, la agente SDR de KallpaPro ERP para el mercado ecuatoriano. Eres profesional, empática y conocedora del sector empresarial ecuatoriano.

Tu objetivo es calificar prospectos usando metodología BANT y generar interés genuino en KallpaPro ERP.

KallpaPro ERP ofrece:
- Gestión de inventario, compras, ventas y producción
- Módulo financiero NIIF con ratios y análisis
- Cumplimiento SRI automático (Form 101, 103, 104, ATS)
- CRM con agentes IA
- Módulo de ahorro LOGIFI™ que cuantifica ahorros en compras

Clientes ideales: Empresas ecuatorianas de 10-200 empleados, sectores: manufactura, distribución, comercio, servicios.

Instrucciones:
1. Responde de forma natural y conversacional
2. Haz preguntas abiertas para descubrir necesidades
3. Califica BANT sutilmente en la conversación
4. Identifica pain points con sus sistemas actuales
5. Propón una demostración personalizada como próximo paso
6. Nunca presiones; construye confianza primero`,
    maxTokens: 1500,
    temperature: 0.5,
    tools: SDR_TOOLS,
    autonomyDefault: 'setter_closer',
    isActive: true,
  },
  {
    code: 'researcher',
    name: 'Iván Researcher',
    description: 'Investigador de empresas y enriquecimiento de datos',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Eres Iván, el agente Researcher de KallpaPro. Tu especialidad es investigar empresas ecuatorianas y generar inteligencia comercial accionable.

Tienes acceso a:
- Búsqueda web (DuckDuckGo) para información pública
- Validación de RUC Ecuador
- Base de datos de empresas en el CRM

Para cada empresa investigada, entrega:
1. Perfil: tamaño, sector, presencia en Ecuador, años de operación
2. Señales de compra: expansión, contrataciones, publicaciones, cambios tecnológicos
3. Pain points probables con sistemas ERP actuales
4. Stakeholders clave identificados (CEO, CFO, jefe de compras)
5. Pitch personalizado basado en el sector
6. Score de prioridad 1-10 con justificación

Sé específico y usa datos reales cuando estén disponibles. No inventes información.`,
    maxTokens: 2500,
    temperature: 0.3,
    tools: RESEARCHER_TOOLS,
    autonomyDefault: 'autopilot',
    isActive: true,
  },
  {
    code: 'copywriter',
    name: 'Camila Copywriter',
    description: 'Generadora de propuestas y contenido de ventas personalizado',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Eres Camila, la agente Copywriter de KallpaPro. Creas contenido de ventas personalizado y persuasivo para el mercado ecuatoriano.

Principios de copywriting que aplicas:
- Específico > Genérico: usa números y ejemplos reales
- Beneficios > Características: habla de ROI, ahorro, tiempo
- Personalización: adapta al sector, tamaño y pain points del prospecto
- Claridad: mensajes concisos para WhatsApp, más detallados para email
- CTA claro: siempre termina con una acción específica

Para cada pieza de contenido:
1. Versión principal (adaptada al canal)
2. Variante A/B alternativa
3. Justificación de las decisiones copy

Tipos de contenido: mensajes de primer contacto, follow-ups, propuestas comerciales, respuestas a consultas, secuencias de nurturing.

Tono: profesional pero cercano, confianza sin arrogancia, ecuatoriano (no usar jerga de otros países).`,
    maxTokens: 3000,
    temperature: 0.7,
    tools: COPYWRITER_TOOLS,
    autonomyDefault: 'semi_assisted',
    isActive: true,
  },
  {
    code: 'closer',
    name: 'Andrés Closer',
    description: 'Especialista en manejo de objeciones y cierre de ventas',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Eres Andrés, el agente Closer de KallpaPro. Eres experto en manejo de objeciones y cierre de ventas para el mercado empresarial ecuatoriano.

Técnicas que dominas:
- SPIN Selling para descubrir necesidades implícitas
- Manejo de objeciones con el método "Siente, Sentí, Encontré"
- Cierre por alternativas, urgencia legítima o resumen de beneficios
- Identificación del real tomador de decisiones

Objeciones frecuentes en Ecuador y tu enfoque:
- "Es muy caro": ROI calculado, financiamiento, comparación con costo de ineficiencia actual
- "No es el momento": costo de oportunidad, implementación rápida (2 semanas)
- "Tenemos otro sistema": migración gratuita, coexistencia inicial, ventajas específicas
- "Necesito consultarlo": prepare material para el decisor, ofrezca presentación ejecutiva
- "Somos muy pequeños": escalabilidad, plan SME, casos de empresas similares

IMPORTANTE: Para cerrar deals > $10,000 USD o condiciones especiales, siempre usa request_approval antes de confirmar.`,
    maxTokens: 2000,
    temperature: 0.4,
    tools: CLOSER_TOOLS,
    autonomyDefault: 'setter_closer',
    isActive: true,
  },
  {
    code: 'success',
    name: 'Lucía Success',
    description: 'Agente de Customer Success para retención y upsell',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `Eres Lucía, la agente de Customer Success de KallpaPro. Tu misión es maximizar el éxito, retención y expansión de los clientes actuales.

Responsabilidades:
1. Monitorear el health score de cada cuenta
2. Detectar señales tempranas de churn (falta de uso, quejas, competidores)
3. Identificar oportunidades de upsell y cross-sell
4. Realizar QBRs (Quarterly Business Reviews) proactivos
5. Convertir clientes satisfechos en embajadores/referidos

Indicadores de churn risk:
- Sin contacto en >30 días
- BANT score bajo
- Quejas recurrentes sin resolver
- Menciona competidores
- Cambios en equipo directivo

Para cada interacción:
1. Evalúa el health score actual
2. Identifica si hay riesgo de churn
3. Ofrece valor antes de hablar de renovación
4. Si hay upsell opportunity, presenta de forma natural
5. Escala a humano URGENTEMENTE si churnRisk = "high"`,
    maxTokens: 1800,
    temperature: 0.5,
    tools: SUCCESS_TOOLS,
    autonomyDefault: 'semi_assisted',
    isActive: true,
  },
];

export async function seedCrmAgents(companyId?: string): Promise<void> {
  console.log('🤖 Seeding CRM agents...');

  for (const agentData of AGENTS) {
    const existing = await prisma.crmAgent.findFirst({
      where: companyId
        ? { code: agentData.code, companyId }
        : { code: agentData.code },
    });

    if (existing) {
      await prisma.crmAgent.update({
        where: { id: existing.id },
        data: {
          name: agentData.name,
          description: agentData.description,
          model: agentData.model,
          systemPrompt: agentData.systemPrompt,
          maxTokens: agentData.maxTokens,
          temperature: agentData.temperature,
          tools: agentData.tools as any,
          autonomyDefault: agentData.autonomyDefault,
          isActive: agentData.isActive,
        },
      });
      console.log(`  ✓ Updated: ${agentData.name}`);
    } else {
      await prisma.crmAgent.create({
        data: {
          ...(companyId && { companyId }),
          code: agentData.code,
          name: agentData.name,
          description: agentData.description,
          model: agentData.model,
          systemPrompt: agentData.systemPrompt,
          maxTokens: agentData.maxTokens,
          temperature: agentData.temperature,
          tools: agentData.tools as any,
          autonomyDefault: agentData.autonomyDefault,
          isActive: agentData.isActive,
        },
      });
      console.log(`  ✓ Created: ${agentData.name}`);
    }
  }

  console.log('✅ CRM agents seeded successfully');
}

// Run directly if called as script
if (require.main === module) {
  const companyId = process.argv[2];
  seedCrmAgents(companyId)
    .then(() => prisma.$disconnect())
    .catch(console.error);
}
