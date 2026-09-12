import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types/index';
import * as ollama from '../services/ollama.service';
import { asyncHandler } from '../middleware/error-handler';

/**
 * Controlador Ollama (IA). Envuelto en asyncHandler, pero conserva sus respuestas
 * 503 `{ error, detail }` como respuesta de dominio (servicio de IA no disponible),
 * porque el frontend distingue ese estado. No se delegan al errorHandler global.
 */

// ── Health check ──────────────────────────────────────────────
export const getOllamaStatus = asyncHandler(async (_req: AuthRequest, res) => {
  const status = await ollama.pingOllama();
  res.json(status);
});

// ── Generate product description ──────────────────────────────
export const genProductDesc = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const { name, category, unit } = req.body;
    if (!name) { res.status(400).json({ error: 'name requerido' }); return; }
    const description = await ollama.generateProductDescription(name, category, unit);
    res.json({ description });
  } catch (e: any) {
    res.status(503).json({ error: 'Ollama no disponible', detail: e.message });
  }
});

// ── Reorder recommendations ───────────────────────────────────
export const getReorderRecommendations = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const companyId = req.user!.companyId;

    // Fetch low-stock products from DB
    const stocks = await prisma.productStock.findMany({
      where: { product: { companyId } },
      include: { product: true },
    });

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        product: { companyId },
        type: 'OUT',
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      select: { productId: true, quantity: true },
    });

    const consumptionMap: Record<string, number> = {};
    movements.forEach((m) => {
      consumptionMap[m.productId] = (consumptionMap[m.productId] || 0) + Number(m.quantity);
    });

    // Aggregate stock per product
    const stockMap: Record<string, { name: string; stock: number; minStock: number }> = {};
    stocks.forEach((s) => {
      const pid = s.productId;
      if (!stockMap[pid]) {
        stockMap[pid] = { name: s.product.name, stock: 0, minStock: Number(s.product.minStock) };
      }
      stockMap[pid].stock += Number(s.quantity);
    });

    const products = Object.entries(stockMap).map(([pid, data]) => ({
      name: data.name,
      stock: data.stock,
      minStock: data.minStock,
      avgDailyConsumption: (consumptionMap[pid] || 0) / 90,
    }));

    const recommendation = await ollama.analyzeStockReorder(products);
    res.json({ recommendation, analyzedCount: products.length });
  } catch (e: any) {
    res.status(503).json({ error: 'Error al analizar stock', detail: e.message });
  }
});

// ── Financial impact analysis ─────────────────────────────────
export const getFinancialInsight = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const { totalValue, obsoleteValue, obsoletePct, avgDIO, classA, classD } = req.body;
    const insight = await ollama.analyzeFinancialImpact({ totalValue, obsoleteValue, obsoletePct, avgDIO, classA, classD });
    res.json({ insight });
  } catch (e: any) {
    res.status(503).json({ error: 'Ollama no disponible', detail: e.message });
  }
});

// ── General ERP assistant chat ────────────────────────────────
export const askAssistant = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const { question, context } = req.body;
    if (!question || !question.trim()) { res.status(400).json({ error: 'question requerido' }); return; }
    const answer = await ollama.askErpAssistant(question, context);
    res.json({ answer });
  } catch (e: any) {
    if (String(e.message).includes('AI_DISABLED')) {
      res.json({ answer: 'La asistencia con IA está desactivada. Puedes activarla en Configuración → Inteligencia Artificial.', disabled: true });
      return;
    }
    res.status(503).json({ error: 'Ollama no disponible', detail: e.message });
  }
});

// ── SQL generator ─────────────────────────────────────────────
export const generateSQL = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const { description, schema } = req.body;
    if (!description) { res.status(400).json({ error: 'description requerido' }); return; }
    const sql = await ollama.generateSQLQuery(description, schema);
    res.json({ sql });
  } catch (e: any) {
    res.status(503).json({ error: 'Ollama no disponible', detail: e.message });
  }
});

// ── Smart Forecast (combina predicción + rotación) ─────────────
export const getSmartForecast = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const { productId } = req.params;
    const companyId = req.user!.companyId;

    const product = await prisma.product.findFirst({
      where: { id: productId, companyId },
      include: { stocks: true },
    });
    if (!product) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

    const since = new Date();
    since.setMonth(since.getMonth() - 12);

    const movements = await prisma.inventoryMovement.findMany({
      where: { productId, type: { in: ['OUT', 'TRANSFER_OUT'] }, createdAt: { gte: since } },
      select: { quantity: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const monthMap: Record<string, number> = {};
    movements.forEach((m) => {
      const key = m.createdAt.toISOString().slice(0, 7);
      monthMap[key] = (monthMap[key] || 0) + Number(m.quantity);
    });

    const monthlyData = Object.entries(monthMap).map(([month, quantity]) => ({ month, quantity }));
    const totalStock = product.stocks.reduce((s, st) => s + Number(st.quantity), 0);

    const prediction = await ollama.predictDemand(product.name, monthlyData);

    // Calcular días de stock actuales
    const avg90Days = movements
      .filter(m => m.createdAt >= new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
      .reduce((s, m) => s + Number(m.quantity), 0) / 90;
    const daysOfStock = avg90Days > 0 ? Math.round(totalStock / avg90Days) : 9999;

    res.json({
      productId,
      productName: product.name,
      currentStock: totalStock,
      daysOfStock,
      avgDailyConsumption: Math.round(avg90Days * 100) / 100,
      monthlyHistory: monthlyData,
      prediction,
      needsAttention: daysOfStock < 21,
    });
  } catch (e: any) {
    res.status(503).json({ error: 'Ollama no disponible', detail: e.message });
  }
});

// ── Inventory Health Score ────────────────────────────────────
export const getInventoryHealthScore = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const companyId = req.user!.companyId;

    const products = await prisma.product.findMany({
      where: { companyId, isActive: true },
      include: { stocks: true },
    });

    const ninetyAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const movements = await prisma.inventoryMovement.findMany({
      where: { companyId, type: { in: ['OUT', 'TRANSFER_OUT'] }, createdAt: { gte: ninetyAgo } },
      select: { productId: true, quantity: true },
    });

    const consumptionMap: Record<string, number> = {};
    movements.forEach(m => { consumptionMap[m.productId] = (consumptionMap[m.productId] || 0) + Number(m.quantity); });

    let zeroStock = 0, lowStock = 0, healthy = 0, totalValue = 0, deadStock = 0;
    products.forEach(p => {
      const qty = p.stocks.reduce((s, st) => s + Number(st.quantity), 0);
      const val = qty * Number(p.avgCost);
      totalValue += val;
      if (qty === 0) zeroStock++;
      else if (qty <= Number(p.minStock)) lowStock++;
      else healthy++;
      if (!consumptionMap[p.id] && qty > 0) deadStock++;
    });

    const total = products.length || 1;
    const healthScore = Math.round(
      100 - (zeroStock / total) * 40 - (lowStock / total) * 20 - (deadStock / total) * 25
    );

    const expiringBatches = await prisma.inventoryBatch.count({
      where: {
        companyId, isExhausted: false,
        expiryDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), not: null },
      },
    });

    const summaryText = `
ERP Inventario KallpaPro — Resumen ejecutivo:
- Score de salud: ${healthScore}/100
- Total productos: ${total} | Valor total: $${totalValue.toFixed(2)}
- Stock cero: ${zeroStock} productos | Stock bajo: ${lowStock} productos
- Stock muerto (sin movimiento 90 días): ${deadStock} productos
- Lotes próximos a vencer (<30 días): ${expiringBatches}
- Productos saludables: ${healthy}
Genera 3 acciones prioritarias concretas en español para mejorar la gestión de inventario.`;

    const actions = await ollama.askErpAssistant(summaryText, 'inventario');

    res.json({
      score: Math.max(0, healthScore),
      breakdown: { zeroStock, lowStock, healthy, deadStock, total },
      totalValue: Math.round(totalValue * 100) / 100,
      expiringBatches,
      actions,
    });
  } catch (e: any) {
    res.status(503).json({ error: 'Ollama no disponible', detail: e.message });
  }
});

// ── Demand prediction ─────────────────────────────────────────
export const getDemandPrediction = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const { productId } = req.params;
    const companyId = req.user!.companyId;

    const product = await prisma.product.findFirst({ where: { id: productId, companyId } });
    if (!product) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

    // Get last 12 months of OUT movements grouped by month
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const movements = await prisma.inventoryMovement.findMany({
      where: { productId, type: 'OUT', createdAt: { gte: since } },
      select: { quantity: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const monthMap: Record<string, number> = {};
    movements.forEach((m) => {
      const key = m.createdAt.toISOString().slice(0, 7);
      monthMap[key] = (monthMap[key] || 0) + Number(m.quantity);
    });

    const monthlyData = Object.entries(monthMap).map(([month, quantity]) => ({ month, quantity }));
    const prediction = await ollama.predictDemand(product.name, monthlyData);
    res.json({ prediction, productName: product.name, months: monthlyData.length });
  } catch (e: any) {
    res.status(503).json({ error: 'Ollama no disponible', detail: e.message });
  }
});
