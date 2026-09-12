import { prisma } from '../lib/prisma';
import { generate } from './ollama.service';
import { getSupplierRanking } from './supplier-scoring.service';
// ─── Recommend Suppliers for a Requisition ───────────────────
export async function recommendSuppliers(companyId: string, requisitionId: string, topN = 3) {
  const [requisition, ranking] = await Promise.all([
    prisma.requisition.findFirst({
      where:   { id: requisitionId, companyId },
      include: { items: { include: { product: { select: { name: true, avgCost: true } } } } },
    }),
    getSupplierRanking(companyId),
  ]);

  if (!requisition) throw new Error('Requisición no encontrada');

  const topSuppliers = ranking.slice(0, Math.max(topN, 5)); // take more for Ollama context

  // Get historical quotation prices per supplier for relevant products
  const productIds = requisition.items
    .filter(i => i.productId)
    .map(i => i.productId as string);

  const quotationHistory = productIds.length > 0 ? await prisma.quotationItem.findMany({
    where: {
      quotation: { companyId, supplierId: { in: topSuppliers.map(s => s.id) } },
      requisitionItem: { productId: { in: productIds } },
    },
    include: {
      quotation: { select: { supplierId: true, supplier: { select: { name: true } } } },
      requisitionItem: { select: { productId: true } },
    },
    take: 50,
  }) : [];

  // Build price summary per supplier
  const supplierPrices: Record<string, { supplierId: string; avgPrice: number; quotes: number }> = {};
  quotationHistory.forEach(q => {
    const sid = q.quotation.supplierId;
    if (!supplierPrices[sid]) supplierPrices[sid] = { supplierId: sid, avgPrice: 0, quotes: 0 };
    supplierPrices[sid].avgPrice = (supplierPrices[sid].avgPrice * supplierPrices[sid].quotes + Number(q.unitPrice)) / (supplierPrices[sid].quotes + 1);
    supplierPrices[sid].quotes++;
  });

  const itemsSummary = requisition.items.map(i => ({
    descripcion: i.description || i.product?.name || '',
    cantidad:    Number(i.quantity),
    costoEstimado: Number(i.estimatedCost),
  }));

  const supplierContext = topSuppliers.slice(0, topN).map(s => ({
    nombre:       s.name,
    score:        Math.round(s.totalScore),
    precio:       Math.round(s.priceScore),
    entrega:      Math.round(s.deliveryScore),
    calidad:      Math.round(s.qualityScore),
    compliance:   Math.round(s.complianceScore),
    historial:    s.recordsCount,
    precioHistAvg: supplierPrices[s.id]?.avgPrice?.toFixed(2) ?? 'sin historial',
  }));

  const prompt = `Eres un especialista en compras ERP. Analiza estos proveedores para una requisición y recomienda el mejor.

REQUISICIÓN: "${requisition.title}"
ÍTEMS A COMPRAR:
${JSON.stringify(itemsSummary, null, 2)}

TOP PROVEEDORES (scores 0-100):
${JSON.stringify(supplierContext, null, 2)}

Score formula: 30% precio, 25% entrega, 25% calidad, 20% compliance histórico.

Responde en español con:
1. Tu recomendación principal (1 proveedor)
2. Razón en 2 oraciones
3. Advertencias si hay (score bajo, sin historial, etc.)
4. Sugerencia de precio objetivo basada en historial

Máximo 150 palabras.`;

  const aiNarrative = await generate(prompt);

  return {
    topSuppliers: topSuppliers.slice(0, topN).map(s => ({
      ...s,
      priceHistAvg: supplierPrices[s.id]?.avgPrice ?? null,
    })),
    aiNarrative,
    requisitionTitle: requisition.title,
  };
}

// ─── Price Anomaly Detection ──────────────────────────────────
export async function detectPriceAnomaly(companyId: string, data: {
  productId?: string;
  description?: string;
  unitPrice: number;
  supplierId?: string;
}) {
  if (!data.productId) return { isAnomaly: false, message: 'Sin producto vinculado para comparar' };

  // Get last 10 quotations for same product
  const recentQuotes = await prisma.quotationItem.findMany({
    where: {
      requisitionItem: { productId: data.productId },
      quotation:       { companyId },
    },
    orderBy: { quotation: { createdAt: 'desc' } },
    take:    10,
    select:  { unitPrice: true },
  });

  if (recentQuotes.length < 2) {
    return { isAnomaly: false, message: 'Historial insuficiente para comparar (mínimo 2 cotizaciones)' };
  }

  const prices    = recentQuotes.map(q => Number(q.unitPrice));
  const avg       = prices.reduce((s, p) => s + p, 0) / prices.length;
  const stddev    = Math.sqrt(prices.reduce((s, p) => s + (p - avg) ** 2, 0) / prices.length);
  const minPrice  = Math.max(avg - 1.5 * stddev, avg * 0.5);
  const maxNormal = avg * 1.30; // 30% above average is anomaly threshold

  const isAnomaly    = data.unitPrice > maxNormal;
  const isUnderpriced = data.unitPrice < minPrice;
  const deviationPct = ((data.unitPrice - avg) / avg * 100).toFixed(1);

  return {
    isAnomaly:     isAnomaly || isUnderpriced,
    isOverpriced:  isAnomaly,
    isUnderpriced,
    currentPrice:  data.unitPrice,
    historicalAvg: Number(avg.toFixed(2)),
    historicalMin: Number(Math.min(...prices).toFixed(2)),
    historicalMax: Number(Math.max(...prices).toFixed(2)),
    expectedRange: { min: Number(minPrice.toFixed(2)), max: Number(maxNormal.toFixed(2)) },
    deviationPct:  Number(deviationPct),
    samplesUsed:   recentQuotes.length,
    message: isAnomaly
      ? `⚠️ Precio ${deviationPct}% sobre el promedio histórico ($${avg.toFixed(2)}). Rango esperado: $${minPrice.toFixed(2)} – $${maxNormal.toFixed(2)}`
      : isUnderpriced
      ? `⚡ Precio inusualmente bajo (${deviationPct}% bajo el promedio). Verificar calidad.`
      : `✓ Precio dentro del rango histórico (promedio: $${avg.toFixed(2)})`,
  };
}

// ─── Generate Procurement Insights ───────────────────────────
export async function generateProcurementInsights(companyId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [orders, pendingReqs, topSuppliers] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where:   { companyId, createdAt: { gte: thirtyDaysAgo } },
      select:  { totalAmount: true, status: true, supplierId: true },
    }),
    prisma.requisition.count({
      where: { companyId, status: { in: ['PENDING_L1', 'PENDING_L2', 'PENDING_L3'] } },
    }),
    prisma.supplierScore.findMany({
      where:   { companyId },
      orderBy: { totalScore: 'asc' },
      take:    3,
      include: { supplier: { select: { name: true } } },
    }),
  ]);

  const totalSpend30d = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
  const receivedOrders = orders.filter(o => o.status === 'RECEIVED').length;
  const lowScoreSuppliers = topSuppliers.filter(s => Number(s.totalScore) < 60);

  const context = {
    gastoUltimos30Dias:   `$${totalSpend30d.toFixed(2)}`,
    totalOrdenes:         orders.length,
    ordenesRecibidas:     receivedOrders,
    requisionesPendientes: pendingReqs,
    proveedoresBajoScore: lowScoreSuppliers.map(s => `${s.supplier.name} (${Math.round(Number(s.totalScore))} pts)`),
  };

  const prompt = `Eres un analista senior de compras de ERP. Basándote en estos KPIs del último mes, genera exactamente 3 recomendaciones estratégicas concretas y accionables.

DATOS:
${JSON.stringify(context, null, 2)}

Formato de respuesta (exacto):
1. [Recomendación 1 - máximo 2 oraciones]
2. [Recomendación 2 - máximo 2 oraciones]
3. [Recomendación 3 - máximo 2 oraciones]

Solo las 3 recomendaciones, sin introducción ni conclusión.`;

  const insights = await generate(prompt);

  return {
    kpis: {
      totalSpend30d,
      totalOrders: orders.length,
      receivedOrders,
      pendingRequisitions: pendingReqs,
      lowScoreSupplierCount: lowScoreSuppliers.length,
    },
    insights,
    lowScoreSuppliers: lowScoreSuppliers.map(s => ({
      supplierId:  s.supplierId,
      name:        s.supplier.name,
      totalScore:  Math.round(Number(s.totalScore)),
    })),
  };
}

// ─── 3-Way Match Validation ───────────────────────────────────
export async function validateThreeWayMatch(sriDocumentId: string, companyId: string) {
  const sriDoc = await prisma.sriDocument.findFirst({
    where:   { id: sriDocumentId, companyId },
    include: { items: true },
  });

  if (!sriDoc) throw new Error('Documento SRI no encontrado');
  if (!sriDoc.purchaseOrderId) {
    return { status: 'NO_PO', message: 'Este documento no tiene OC vinculada', details: [] };
  }

  const po = await prisma.purchaseOrder.findFirst({
    where:   { id: sriDoc.purchaseOrderId, companyId },
    include: { items: { include: { product: { select: { name: true } } } } },
  });

  if (!po) return { status: 'PO_NOT_FOUND', message: 'OC no encontrada', details: [] };

  const details: {
    line: number;
    description: string;
    poQty: number;
    sriQty: number;
    poPrice: number;
    sriPrice: number;
    qtyMatch: boolean;
    priceMatch: boolean;
    priceVariancePct: number;
  }[] = [];

  // Compare SRI items vs PO items (by position)
  let allMatched = true;
  let anyDiscrepancy = false;

  sriDoc.items.forEach((sriItem, idx) => {
    const poItem = po.items[idx];
    if (!poItem) {
      anyDiscrepancy = true;
      details.push({
        line:        idx + 1,
        description: sriItem.descripcion,
        poQty:       0,
        sriQty:      Number(sriItem.cantidad),
        poPrice:     0,
        sriPrice:    Number(sriItem.precioUnitario),
        qtyMatch:    false,
        priceMatch:  false,
        priceVariancePct: 100,
      });
      return;
    }

    const sriQty   = Number(sriItem.cantidad);
    const poQty    = Number(poItem.receivedQuantity ?? poItem.quantity);
    const sriPrice = Number(sriItem.precioUnitario);
    const poPrice  = Number(poItem.unitPrice);

    const qtyDiff      = Math.abs(sriQty - poQty);
    const qtyMatch     = qtyDiff / Math.max(poQty, 1) < 0.01; // within 1%
    const priceVarPct  = Math.abs((sriPrice - poPrice) / Math.max(poPrice, 0.01) * 100);
    const priceMatch   = priceVarPct < 2; // within 2%

    if (!qtyMatch || !priceMatch) { anyDiscrepancy = true; allMatched = false; }

    details.push({
      line:             idx + 1,
      description:      sriItem.descripcion,
      poQty,
      sriQty,
      poPrice,
      sriPrice,
      qtyMatch,
      priceMatch,
      priceVariancePct: Number(priceVarPct.toFixed(2)),
    });
  });

  // Amount-level check
  const poTotal  = Number(po.totalAmount);
  const sriTotal = Number(sriDoc.total);
  const amtVarPct = Math.abs((sriTotal - poTotal) / Math.max(poTotal, 1) * 100);
  const amountMatch = amtVarPct < 2;

  const status = allMatched && amountMatch
    ? 'MATCHED'
    : anyDiscrepancy && !allMatched
    ? 'DISCREPANCY'
    : 'PARTIAL';

  return {
    status,
    poNumber:     po.poNumber,
    poTotal,
    sriTotal,
    amountVariancePct: Number(amtVarPct.toFixed(2)),
    amountMatch,
    details,
    message: status === 'MATCHED'
      ? '✅ Conciliación exitosa: OC, recepción y factura coinciden'
      : status === 'DISCREPANCY'
      ? '❌ Discrepancias encontradas: revisar cantidades y precios'
      : '⚡ Conciliación parcial: algunas líneas tienen variaciones',
  };
}
