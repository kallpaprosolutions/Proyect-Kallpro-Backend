import { prisma } from '../../lib/prisma';
import axios from 'axios';
import { logger } from '../../lib/logger';
import { getRatios } from './ratios.service';
import { getSavingsSummary } from './savings.service';
import { isAiEnabled } from '../ollama.service';
// Cache de cooldown por companyId (en memoria)
const cooldownMap = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

export interface AIInsight {
  title: string;
  finding: string;
  cause: string;
  impactUsd: number;
  action: string;
  deadline: string;
  priority: 'high' | 'medium' | 'low';
  kpiCode?: string;
}

export interface InsightsResult {
  period: string;
  insights: AIInsight[];
  model: string;
  generatedAt: string;
  cached: boolean;
}

async function buildFinancialContext(companyId: string, period: string): Promise<string> {
  const [allRatios, savings] = await Promise.all([
    getRatios(companyId, period),
    getSavingsSummary(companyId, period),
  ]);

  const criticalRatios = [...allRatios.liquidez, ...allRatios.rentabilidad, ...allRatios.eficiencia]
    .filter(r => r.status === 'red' || r.status === 'yellow')
    .slice(0, 10);

  const context = `
Empresa en Ecuador. Período: ${period}.
Moneda: USD. Normativa: NIIF Pymes + SRI Ecuador.

AHORROS LOGIFI™ este período:
- Total ahorros: $${savings.total.toLocaleString()}
- Hard savings: $${savings.breakdown.hard.toLocaleString()}
- Cost avoidance: $${savings.breakdown.costAvoidance.toLocaleString()}
- Consolidación: $${savings.breakdown.consolidation.toLocaleString()}
- Downtime evitado: $${savings.breakdown.downtimeAvoided.toLocaleString()}

KPIs CON ALERTA (rojo/amarillo):
${criticalRatios.map(r => `- ${r.name} (${r.code}): ${r.value?.toFixed(2)} ${r.unit ?? ''} | Benchmark: ${r.benchmarkLabel ?? r.benchmark} | Estado: ${r.status}`).join('\n')}

KPIs SALUDABLES (verde):
${[...allRatios.liquidez, ...allRatios.rentabilidad].filter(r => r.status === 'green').map(r => `- ${r.name}: ${r.value?.toFixed(2)}`).join('\n')}
`;
  return context;
}

async function generateWithOllama(context: string): Promise<AIInsight[]> {
  // Respeta el interruptor maestro de IA: si está desactivado, no intenta Ollama.
  if (!(await isAiEnabled())) return [];
  const ollamaUrl = process.env.OLLAMA_API_URL ?? 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';

  const prompt = `Eres el asistente financiero de LOGIFI™ ERP para una empresa ecuatoriana. Analiza estos datos y genera exactamente 3 insights ejecutivos accionables en formato JSON.

DATOS:
${context}

Responde ÚNICAMENTE con este JSON (sin texto extra):
[
  {
    "title": "Título del insight (máx 60 chars)",
    "finding": "Hallazgo específico con números reales",
    "cause": "Causa probable del hallazgo",
    "impactUsd": 12345,
    "action": "Acción concreta y específica a tomar",
    "deadline": "7 días | 30 días | 90 días",
    "priority": "high | medium | low",
    "kpiCode": "DSO"
  }
]`;

  try {
    const res = await axios.post(`${ollamaUrl}/api/generate`, {
      model,
      prompt,
      stream: false,
      options: { temperature: 0.3, num_predict: 1024 },
    }, { timeout: 30000 });

    const text = res.data?.response ?? '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as AIInsight[];
    }
  } catch (err) {
    logger.warn('[aiInsights] Ollama falló, usando fallback', { err: (err as Error).message });
  }
  return [];
}

async function generateWithClaude(context: string): Promise<AIInsight[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey });

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `Eres el asistente financiero de LOGIFI™ ERP. Analizas datos de empresas ecuatorianas siguiendo NIIF y normativa SRI. Generas insights ejecutivos accionables con números reales. Respondes ÚNICAMENTE en JSON válido.`,
      messages: [{
        role: 'user',
        content: `Analiza estos datos financieros y genera 3 insights ejecutivos priorizados por impacto en USD:\n\n${context}\n\nResponde con JSON array de 3 elementos con campos: title, finding, cause, impactUsd, action, deadline, priority, kpiCode`,
      }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as AIInsight[];
    }
  } catch (err) {
    logger.warn('[aiInsights] Claude API falló', { err: (err as Error).message });
  }
  return [];
}

function generateFallbackInsights(companyId: string, period: string): AIInsight[] {
  return [
    {
      title: 'Optimizar ciclo de cobro (DSO)',
      finding: `El período ${period} muestra cuentas por cobrar con rotación subóptima`,
      cause: 'Falta de seguimiento automatizado de facturas vencidas',
      impactUsd: 15000,
      action: 'Implementar recordatorios automáticos de cobro en días 15, 30 y 45',
      deadline: '30 días',
      priority: 'high',
      kpiCode: 'DSO',
    },
    {
      title: 'Consolidar órdenes de compra por proveedor',
      finding: 'Múltiples OCs pequeñas al mismo proveedor reducen poder de negociación',
      cause: 'Ausencia de contratos marco y planificación de compras mensual',
      impactUsd: 8000,
      action: 'Agrupar compras por proveedor en órdenes consolidadas mensuales',
      deadline: '7 días',
      priority: 'medium',
      kpiCode: 'SUM',
    },
    {
      title: 'Reducir inventario inmovilizado',
      finding: 'Productos sin movimiento en últimos 60 días generan costo de oportunidad',
      cause: 'Sobrecompra o productos descontinuados sin gestión activa',
      impactUsd: 5000,
      action: 'Revisar productos con DI > 90 días y aplicar descuentos o devoluciones',
      deadline: '90 días',
      priority: 'low',
      kpiCode: 'DI',
    },
  ];
}

export async function getInsights(companyId: string, period?: string): Promise<InsightsResult> {
  const p = period ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  // Verificar cache en DB
  const cached = await prisma.financeAIInsight.findFirst({
    where: {
      companyId,
      period: p,
      expiresAt: { gt: new Date() },
    },
    orderBy: { generatedAt: 'desc' },
  });
  if (cached) {
    return {
      period: p,
      insights: cached.insights as unknown as AIInsight[],
      model: cached.model,
      generatedAt: cached.generatedAt.toISOString(),
      cached: true,
    };
  }

  // Verificar cooldown en memoria
  const lastCall = cooldownMap.get(companyId) ?? 0;
  if (Date.now() - lastCall < COOLDOWN_MS) {
    return {
      period: p,
      insights: generateFallbackInsights(companyId, p),
      model: 'fallback',
      generatedAt: new Date().toISOString(),
      cached: false,
    };
  }

  cooldownMap.set(companyId, Date.now());

  const context = await buildFinancialContext(companyId, p);

  // Intentar Claude > Ollama > Fallback
  let insights: AIInsight[] = [];
  let model = 'fallback';

  if (process.env.ANTHROPIC_API_KEY) {
    insights = await generateWithClaude(context);
    if (insights.length > 0) model = 'claude-haiku-4-5-20251001';
  }
  if (!insights.length && process.env.OLLAMA_API_URL) {
    insights = await generateWithOllama(context);
    if (insights.length > 0) model = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';
  }
  if (!insights.length) {
    insights = generateFallbackInsights(companyId, p);
    model = 'fallback';
  }

  // Persistir en DB (TTL 24h)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.financeAIInsight.create({
    data: {
      companyId,
      period: p,
      insights: insights as object,
      model,
      expiresAt,
    },
  });

  return {
    period: p,
    insights,
    model,
    generatedAt: new Date().toISOString(),
    cached: false,
  };
}

export default { getInsights };
