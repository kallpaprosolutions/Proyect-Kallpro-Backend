import api from './client';

/** Timeout amplio para llamadas de IA local (la inferencia puede tardar minutos sin GPU). */
const AI_TIMEOUT = 300_000;

export const ollamaApi = {
  /** Verifica si Ollama está corriendo y el modelo disponible */
  getStatus: () => api.get('/ai/status'),

  /** Genera descripción automática para un producto */
  generateProductDescription: (name: string, category?: string, unit?: string) =>
    api.post('/ai/product-description', { name, category, unit }),

  /** Recomendaciones de reposición basadas en stock actual */
  getReorderRecommendations: () => api.get('/ai/reorder-recommendations'),

  /** Análisis de impacto financiero del inventario */
  getFinancialInsight: (data: {
    totalValue: number; obsoleteValue: number; obsoletePct: number;
    avgDIO: number;
    classA: { count: number; value: number };
    classD: { count: number; value: number };
  }) => api.post('/ai/financial-insight', data),

  /** Asistente ERP de chat — pregunta libre */
  ask: (question: string, context?: string) => api.post('/ai/ask', { question, context }),

  /** Predicción de demanda para un producto específico */
  getDemandPrediction: (productId: string) => api.get(`/ai/demand/${productId}`),

  /** Smart forecast: historial + predicción + días de stock */
  getSmartForecast: (productId: string) => api.get(`/ai/smart-forecast/${productId}`),

  /** Health score del inventario con acciones prioritarias */
  getInventoryHealthScore: () => api.get('/ai/health-score'),

  /** Generador de consultas SQL (para uso en dev) */
  generateSQL: (description: string, schema?: string) =>
    api.post('/ai/sql', { description, schema }),

  // ── IA estructurada (Vercel AI SDK + generateObject + Zod sobre Ollama) ──
  // Timeout largo: la inferencia LLM local puede tardar (más aún sin GPU con 7b).

  /** Estado del pipeline estructurado (ping a Ollama con generateObject) */
  structuredStatus: () => api.get('/ai/structured/status', { timeout: AI_TIMEOUT }),

  /** Extrae datos estructurados de una factura SRI a partir de texto plano */
  extractInvoice: (text: string) =>
    api.post('/ai/structured/extract-invoice', { text }, { timeout: AI_TIMEOUT }),

  /** Sugiere la cuenta contable más apropiada para un concepto */
  suggestAccount: (description: string, candidates?: { code: string; name: string }[]) =>
    api.post('/ai/structured/suggest-account', { description, candidates }, { timeout: AI_TIMEOUT }),

  /** Detecta si un precio nuevo es una anomalía respecto al histórico */
  checkPriceAnomaly: (productName: string, newPrice: number, historicalPrices?: number[]) =>
    api.post('/ai/structured/price-anomaly', { productName, newPrice, historicalPrices }, { timeout: AI_TIMEOUT }),
};

/** Tipos del resultado de extracción de factura (espejo del backend) */
export interface AiInvoiceExtraction {
  rucEmisor: string;
  razonSocialEmisor: string;
  numeroDoc: string;
  fechaEmision: string;
  subtotal: number;
  iva: number;
  total: number;
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
  confidence: number;
}
