/**
 * Ollama Service — integración con Qwen2.5 vía API local de Ollama
 * Ollama debe estar corriendo en http://localhost:11434
 * Modelo: qwen2.5:7b (configurable en .env como OLLAMA_MODEL)
 */

import axios from 'axios';
import { prisma } from '../lib/prisma';
const OLLAMA_BASE  = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL   || 'qwen2.5:7b';

// ── Interruptor maestro de IA (config) ─────────────────────────────────────────
// Cuando está desactivado, NINGUNA función intenta conectar con Ollama: se corta
// de inmediato (sin esperar el timeout de red), evitando cuelgues y ruido en logs.
// El valor se persiste en Company.aiEnabled y se togglea desde Configuración.
// Se cachea en memoria y se hidrata desde la BD en el primer uso.
let aiEnabledCache: boolean | null = null;

/** Actualiza el cache del interruptor (lo llama Configuración al togglear). */
export function setAiEnabled(value: boolean): void {
  aiEnabledCache = value;
}

/** Devuelve si la IA está habilitada (hidrata desde Company.aiEnabled la 1ª vez). */
export async function isAiEnabled(): Promise<boolean> {
  if (aiEnabledCache !== null) return aiEnabledCache;
  try {
    const company = await prisma.company.findFirst({ select: { aiEnabled: true } });
    aiEnabledCache = company?.aiEnabled ?? (process.env.AI_ENABLED !== 'false');
  } catch {
    aiEnabledCache = process.env.AI_ENABLED !== 'false';
  }
  return aiEnabledCache ?? true;
}

/** Lanza si la IA está desactivada (los controladores lo traducen a un mensaje claro). */
async function assertAiEnabled(): Promise<void> {
  if (!(await isAiEnabled())) {
    throw new Error('AI_DISABLED: La IA (Ollama) está desactivada en Configuración');
  }
}

// ── Core request ──────────────────────────────────────────────────────────────

export async function generate(prompt: string, system?: string): Promise<string> {
  await assertAiEnabled();
  const body: Record<string, unknown> = {
    model: OLLAMA_MODEL,
    prompt,
    stream: false,
    options: { temperature: 0.6, num_predict: 1024 },
  };
  if (system) body.system = system;

  const res = await axios.post(`${OLLAMA_BASE}/api/generate`, body, {
    timeout: 60_000,
  });
  return (res.data.response as string).trim();
}

async function chat(messages: { role: 'user' | 'assistant' | 'system'; content: string }[]): Promise<string> {
  await assertAiEnabled();
  const res = await axios.post(
    `${OLLAMA_BASE}/api/chat`,
    { model: OLLAMA_MODEL, messages, stream: false, options: { temperature: 0.6, num_predict: 1024 } },
    { timeout: 60_000 },
  );
  return (res.data.message?.content as string).trim();
}

// ── Health check ─────────────────────────────────────────────────────────────

export async function pingOllama(): Promise<{ ok: boolean; disabled: boolean; model: string; base: string }> {
  if (!(await isAiEnabled())) {
    return { ok: false, disabled: true, model: OLLAMA_MODEL, base: OLLAMA_BASE };
  }
  try {
    await axios.get(`${OLLAMA_BASE}/api/tags`, { timeout: 5_000 });
    return { ok: true, disabled: false, model: OLLAMA_MODEL, base: OLLAMA_BASE };
  } catch {
    return { ok: false, disabled: false, model: OLLAMA_MODEL, base: OLLAMA_BASE };
  }
}

// ── ERP-specific helpers ──────────────────────────────────────────────────────

/**
 * Genera descripción de producto para catálogo ERP
 */
export async function generateProductDescription(
  name: string, category?: string, unit?: string,
): Promise<string> {
  const prompt =
    `Eres un asistente de ERP empresarial. Genera una descripción concisa (máximo 2 oraciones) para el siguiente producto en catálogo:
Nombre: ${name}
${category ? `Categoría: ${category}` : ''}
${unit ? `Unidad: ${unit}` : ''}
Responde solo con la descripción, sin comillas ni explicaciones adicionales.`;
  return generate(prompt);
}

/**
 * Analiza el inventario y genera recomendaciones de reposición
 */
export async function analyzeStockReorder(
  products: { name: string; stock: number; minStock: number; avgDailyConsumption: number }[],
): Promise<string> {
  const lowStock = products.filter((p) => p.stock <= p.minStock);
  if (lowStock.length === 0) return 'No hay productos que requieran reposición urgente.';

  const list = lowStock
    .map((p) => `- ${p.name}: stock ${p.stock} (mín ${p.minStock}), consumo diario ~${p.avgDailyConsumption.toFixed(2)}`)
    .join('\n');

  return generate(
    `Analiza los siguientes productos con stock bajo en un ERP y genera recomendaciones de reposición priorizadas (qué comprar primero y en qué cantidad aproximada):\n${list}\nSé conciso, máximo 8 líneas.`,
  );
}

/**
 * Genera un análisis de impacto financiero del inventario
 */
export async function analyzeFinancialImpact(data: {
  totalValue: number;
  obsoleteValue: number;
  obsoletePct: number;
  avgDIO: number;
  classA: { count: number; value: number };
  classD: { count: number; value: number };
}): Promise<string> {
  const prompt = `Eres un analista financiero ERP. Analiza estos datos de inventario y da 3-4 recomendaciones prácticas:
Valor total inventario: $${data.totalValue.toLocaleString('es')}
Valor obsoleto: $${data.obsoleteValue.toLocaleString('es')} (${data.obsoletePct.toFixed(1)}%)
Días de inventario promedio (DIO): ${data.avgDIO.toFixed(1)}
Productos clase A: ${data.classA.count} productos = $${data.classA.value.toLocaleString('es')}
Productos clase D (sin movimiento): ${data.classD.count} productos = $${data.classD.value.toLocaleString('es')}
Sé directo y específico. Máximo 5 líneas.`;
  return generate(prompt);
}

/**
 * Asistente de consulta general ERP — responde preguntas de negocio
 */
export async function askErpAssistant(
  question: string,
  context?: string,
): Promise<string> {
  const system = `Eres KallpaPro AI, asistente experto en ERP empresarial, contabilidad, inventarios, compras y finanzas para empresas medianas en Latinoamérica.
Responde en español, de forma clara y directa. Si no tienes suficiente información, pide detalles.
${context ? `Contexto del módulo actual: ${context}` : ''}`;
  return chat([
    { role: 'system', content: system },
    { role: 'user', content: question },
  ]);
}

/**
 * Genera código SQL / query sugerida basado en descripción
 */
export async function generateSQLQuery(description: string, schema?: string): Promise<string> {
  const prompt = schema
    ? `Dado este esquema:\n${schema}\n\nGenera una consulta SQL para: ${description}\nSolo SQL, sin explicación.`
    : `Genera una consulta SQL para: ${description}\nSolo SQL, sin explicación.`;
  return generate(prompt);
}

/**
 * Analiza tendencias de movimiento y predice demanda
 */
export async function predictDemand(
  productName: string,
  monthlyData: { month: string; quantity: number }[],
): Promise<string> {
  const history = monthlyData
    .map((m) => `${m.month}: ${m.quantity} unidades`)
    .join(', ');
  return generate(
    `Analiza el historial de consumo de "${productName}": ${history}\nPredice el consumo para los próximos 2 meses y da una recomendación de stock de seguridad. Máximo 4 líneas.`,
  );
}
