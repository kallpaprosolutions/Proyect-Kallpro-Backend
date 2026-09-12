import { prisma } from '../lib/prisma';
// Días de crédito por término de pago
const CREDIT_DAYS: Record<string, number> = {
  CONTADO: 0, '15_DIAS': 15, '30_DIAS': 30, '60_DIAS': 60, '90_DIAS': 90,
};

export interface Criterion {
  key: string;          // PRICE | DELIVERY | PAYMENT | HISTORY | QUALITY | CUSTOM_x
  label: string;
  weight: number;       // 0-100
  direction: 'lower_better' | 'higher_better' | 'manual';
}

const DEFAULT_CRITERIA: Criterion[] = [
  { key: 'PRICE', label: 'Precio', weight: 100, direction: 'lower_better' },
];

// Criterios cuyo valor crudo ya está en escala 0-100 (no requieren normalización relativa)
const ABSOLUTE_KEYS = new Set(['HISTORY']);

function isManualKey(c: Criterion) {
  return c.direction === 'manual' || c.key === 'QUALITY' || c.key.startsWith('CUSTOM');
}

function rawValue(c: Criterion, ctx: {
  total: number;
  deliveryDays: number | null;
  paymentTerms: string | null;
  advanceRequiredPct: number | null;
  historyScore: number;
  manualScores: Record<string, number>;
}): number {
  switch (c.key) {
    case 'PRICE':    return ctx.total;
    case 'DELIVERY': return ctx.deliveryDays ?? 9999; // penaliza días faltantes
    case 'PAYMENT': {
      const credit = CREDIT_DAYS[ctx.paymentTerms ?? 'CONTADO'] ?? 0;
      const advancePenalty = (ctx.advanceRequiredPct ?? 0) * 0.5;
      return credit - advancePenalty; // más crédito y menos anticipo = mejor
    }
    case 'HISTORY':  return ctx.historyScore;
    default:         return ctx.manualScores[c.key] ?? 0; // QUALITY / CUSTOM_*
  }
}

export async function computeWeightedRanking(requisitionId: string, companyId: string) {
  const req = await prisma.requisition.findFirst({ where: { id: requisitionId, companyId } });
  if (!req) throw new Error('REQUISITION_NOT_FOUND');

  const criteria: Criterion[] = Array.isArray(req.scoringCriteria) && (req.scoringCriteria as any).length
    ? (req.scoringCriteria as any as Criterion[])
    : DEFAULT_CRITERIA;

  const quotations = await prisma.supplierQuotation.findMany({
    where: { requisitionId, companyId },
    include: { supplier: { include: { score: true } } },
  });

  if (quotations.length === 0) return { criteria, ranking: [] };

  // Construir contexto por cotización
  const ctxList = quotations.map((q) => ({
    quotation: q,
    ctx: {
      total: Number(q.totalAmount),
      deliveryDays: q.deliveryDays ?? null,
      paymentTerms: q.paymentTerms ?? null,
      advanceRequiredPct: q.advanceRequiredPct ?? null,
      historyScore: q.supplier.score ? Number(q.supplier.score.totalScore) : 50, // neutral si no hay histórico
      manualScores: (q.manualScores as any as Record<string, number>) ?? {},
    },
  }));

  // Pre-cálculo de min/max por criterio (para normalización relativa)
  const bounds: Record<string, { min: number; max: number }> = {};
  for (const c of criteria) {
    if (isManualKey(c) || ABSOLUTE_KEYS.has(c.key)) continue;
    const raws = ctxList.map((x) => rawValue(c, x.ctx));
    bounds[c.key] = { min: Math.min(...raws), max: Math.max(...raws) };
  }

  function scoreFor(c: Criterion, ctx: typeof ctxList[number]['ctx']): number {
    const raw = rawValue(c, ctx);
    // Absolutos / manuales: el valor crudo ya está 0-100
    if (isManualKey(c) || ABSOLUTE_KEYS.has(c.key)) {
      return Math.max(0, Math.min(100, raw));
    }
    const b = bounds[c.key];
    if (!b) return 0;
    if (c.direction === 'lower_better') {
      if (raw <= 0) return 100;
      return Math.max(0, Math.min(100, 100 * (b.min / raw)));
    }
    // higher_better — desplazar para tolerar negativos (ej. PAYMENT)
    const shiftedMax = b.max - b.min;
    const shifted = raw - b.min;
    if (shiftedMax <= 0) return 100; // todos iguales
    return Math.max(0, Math.min(100, 100 * (shifted / shiftedMax)));
  }

  const totalWeight = criteria.reduce((s, c) => s + (c.weight || 0), 0) || 1;

  const ranking = ctxList.map(({ quotation, ctx }) => {
    const breakdown: Record<string, { raw: number; score: number; weight: number }> = {};
    let weightedTotal = 0;
    for (const c of criteria) {
      const score = scoreFor(c, ctx);
      const raw = rawValue(c, ctx);
      breakdown[c.key] = { raw, score: Math.round(score * 100) / 100, weight: c.weight };
      weightedTotal += score * (c.weight / totalWeight);
    }
    return {
      quotationId: quotation.id,
      supplierId: quotation.supplierId,
      supplierName: quotation.supplier.name,
      totalAmount: Number(quotation.totalAmount),
      deliveryDays: quotation.deliveryDays,
      weightedScore: Math.round(weightedTotal * 100) / 100,
      breakdown,
    };
  }).sort((a, b) => b.weightedScore - a.weightedScore);

  // Persistir resultados en cada cotización (auditoría)
  await prisma.$transaction(
    ranking.map((r) =>
      prisma.supplierQuotation.update({
        where: { id: r.quotationId },
        data: { weightedScore: r.weightedScore, scoreBreakdown: r.breakdown as any },
      })
    )
  );

  return { criteria, ranking, winnerQuotationId: ranking[0]?.quotationId ?? null };
}

export async function saveCriteria(requisitionId: string, companyId: string, criteria: Criterion[]) {
  const req = await prisma.requisition.findFirst({ where: { id: requisitionId, companyId } });
  if (!req) throw new Error('REQUISITION_NOT_FOUND');
  return prisma.requisition.update({
    where: { id: requisitionId },
    data: { scoringCriteria: criteria as any },
  });
}

export async function saveManualScores(
  requisitionId: string,
  quotationId: string,
  companyId: string,
  manualScores: Record<string, number>,
  advanceRequiredPct?: number,
) {
  const q = await prisma.supplierQuotation.findFirst({ where: { id: quotationId, requisitionId, companyId } });
  if (!q) throw new Error('QUOTATION_NOT_FOUND');
  return prisma.supplierQuotation.update({
    where: { id: quotationId },
    data: {
      manualScores: manualScores as any,
      ...(advanceRequiredPct !== undefined ? { advanceRequiredPct } : {}),
    },
  });
}
