/**
 * AI estructurada (Vercel AI SDK + Ollama) — `generateObject` + Zod.
 *
 * A diferencia de ollama.service.ts (texto libre vía axios), este servicio
 * produce objetos VALIDADOS por Zod: nada de parseo frágil de strings.
 *
 * El backend es CommonJS (ts-node), y el AI SDK v5 es ESM-only → se carga con
 * `import()` dinámico. Se usa el endpoint OpenAI-compatible de Ollama (/v1) con
 * `@ai-sdk/openai`, evitando providers que exigen zod v4.
 *
 * Configurable por env: OLLAMA_API_URL (default http://localhost:11434),
 * OLLAMA_MODEL (default qwen2.5:7b).
 */

import { z } from 'zod';

const OLLAMA_BASE = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

// El backend es CommonJS y ts-node transpila `import()` → `require()`, lo que
// rompería los paquetes ESM-only (`ai`, `@ai-sdk/openai`). Este import dinámico
// vía Function queda OCULTO al transpilador → se ejecuta como import() nativo.
const esmImport: (specifier: string) => Promise<any> = new Function(
  'specifier',
  'return import(specifier)',
) as any;

// ── Carga lazy del modelo (ESM dinámico sobre Ollama /v1 OpenAI-compatible) ──
async function getModel() {
  const { createOpenAI } = await esmImport('@ai-sdk/openai');
  const provider = createOpenAI({
    baseURL: `${OLLAMA_BASE}/v1`, // endpoint OpenAI-compatible de Ollama
    apiKey: 'ollama', // Ollama ignora la API key
  });
  return provider(OLLAMA_MODEL);
}

async function genObject<T>(schema: z.ZodType<T>, prompt: string, system?: string): Promise<T> {
  const { generateObject } = await esmImport('ai');
  const model = await getModel();
  const { object } = await generateObject({
    model,
    schema: schema as any,
    prompt,
    ...(system ? { system } : {}),
    temperature: 0,
  });
  return object as T;
}

// ── Health del pipeline estructurado ──────────────────────────────────────────
export const PingSchema = z.object({
  ok: z.boolean(),
  model: z.string().describe('Nombre del modelo que responde'),
});

export async function aiStructuredPing() {
  try {
    const obj = await genObject(
      PingSchema,
      'Responde con ok=true y model con el nombre del modelo de lenguaje que eres.',
    );
    return { reachable: true, model: OLLAMA_MODEL, echo: obj };
  } catch (e: any) {
    return { reachable: false, model: OLLAMA_MODEL, error: e?.message ?? String(e) };
  }
}

// ── 1) Extracción de factura SRI ──────────────────────────────────────────────
export const InvoiceLineSchema = z.object({
  description: z.string().describe('Descripción del ítem'),
  quantity: z.number().describe('Cantidad'),
  unitPrice: z.number().describe('Precio unitario sin IVA'),
  total: z.number().describe('Total de la línea'),
});

export const InvoiceExtractionSchema = z.object({
  rucEmisor: z.string().describe('RUC del emisor (13 dígitos)'),
  razonSocialEmisor: z.string().describe('Razón social del emisor'),
  numeroDoc: z.string().describe('Número de comprobante, formato 001-001-000000123'),
  fechaEmision: z.string().describe('Fecha de emisión en formato ISO con guiones: YYYY-MM-DD (ej: 2026-05-15)'),
  subtotal: z.number().describe('Subtotal sin IVA'),
  iva: z.number().describe('Monto de IVA'),
  total: z.number().describe('Total con IVA'),
  items: z.array(InvoiceLineSchema).describe('Líneas de detalle de la factura'),
  confidence: z.number().min(0).max(100).describe('Nivel de confianza como entero entre 0 y 100 (100 = certeza total, 50 = dudoso, 0 = adivinado)'),
});
export type InvoiceExtraction = z.infer<typeof InvoiceExtractionSchema>;

/** Normaliza fechas de distintos formatos a ISO YYYY-MM-DD (robustez ante modelos débiles) */
export function normalizeDate(raw: string): string {
  if (!raw) return raw;
  const s = raw.trim();
  // YYYY-MM-DD ya válido
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // YYYYMMDD
  let m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // DD/MM/YYYY o DD-MM-YYYY
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s; // se deja tal cual si no se reconoce
}

export async function extractInvoice(rawText: string): Promise<InvoiceExtraction> {
  const obj = await genObject(
    InvoiceExtractionSchema,
    `Extrae los datos estructurados de esta factura electrónica del SRI (Ecuador). ` +
      `Devuelve montos como números sin símbolo de moneda ni separadores de miles. ` +
      `Si algún dato no aparece, infiérelo de forma conservadora y baja la confianza.\n\n` +
      `--- FACTURA ---\n${rawText}`,
    'Eres un experto en comprobantes electrónicos del SRI de Ecuador (facturas, RIDE, XML). Extraes datos con precisión contable.',
  );
  // Post-proceso determinístico: garantiza formato de fecha ISO sin depender del modelo
  return { ...obj, fechaEmision: normalizeDate(obj.fechaEmision) };
}

// ── 2) Sugerencia de cuenta contable ──────────────────────────────────────────
export const AccountSuggestionSchema = z.object({
  accountCode: z.string().describe('Código de la cuenta sugerida (debe existir en el plan)'),
  accountName: z.string().describe('Nombre de la cuenta sugerida'),
  confidence: z.number().min(0).max(100).describe('Nivel de confianza como entero entre 0 y 100 (100 = certeza total)'),
  reasoning: z.string().describe('Justificación breve (1 oración)'),
});
export type AccountSuggestion = z.infer<typeof AccountSuggestionSchema>;

export async function suggestAccount(
  description: string,
  candidates: { code: string; name: string }[],
): Promise<AccountSuggestion> {
  const list = candidates.map((c) => `${c.code} — ${c.name}`).join('\n');
  return genObject(
    AccountSuggestionSchema,
    `Concepto a clasificar: "${description}"\n\n` +
      `Plan de cuentas disponible (elige EXACTAMENTE una de esta lista):\n${list}\n\n` +
      `Sugiere la cuenta contable más apropiada. accountCode debe ser uno de los códigos listados.`,
    'Eres un contador experto en NIIF y en el plan de cuentas de la Superintendencia de Compañías de Ecuador.',
  );
}

// ── 3) Detección de anomalía de precio ────────────────────────────────────────
export const PriceAnomalySchema = z.object({
  isAnomaly: z.boolean().describe('true si el precio es anómalo'),
  severity: z.enum(['none', 'low', 'medium', 'high']),
  deviationPct: z.number().describe('Desviación % respecto al histórico'),
  explanation: z.string().describe('Explicación breve'),
  suggestedAction: z.string().describe('Acción sugerida para el comprador'),
});
export type PriceAnomaly = z.infer<typeof PriceAnomalySchema>;

export async function checkPriceAnomaly(input: {
  productName: string;
  newPrice: number;
  historicalPrices: number[];
}): Promise<PriceAnomaly> {
  const hist = input.historicalPrices.length ? input.historicalPrices.join(', ') : 'sin histórico';
  return genObject(
    PriceAnomalySchema,
    `Producto: ${input.productName}\n` +
      `Precio nuevo cotizado: ${input.newPrice}\n` +
      `Precios históricos de compra: ${hist}\n\n` +
      `Evalúa si el precio nuevo es una anomalía (sobreprecio o subprecio sospechoso).`,
    'Eres un analista de compras que detecta anomalías de precio para prevenir sobrecostos y fraude.',
  );
}
