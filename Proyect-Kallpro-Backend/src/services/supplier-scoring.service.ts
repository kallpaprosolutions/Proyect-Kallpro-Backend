import { prisma } from '../lib/prisma';
// ─── Score Weights ──────────────────────────────────────────
const WEIGHTS = {
  price:      0.30,
  delivery:   0.25,
  quality:    0.25,
  compliance: 0.20,
};

// ─── Record Performance (called after PO receipt) ───────────
export async function recordPerformance(companyId: string, data: {
  supplierId: string;
  poId: string;
  deliveredDate?: Date;
  promisedDate?: Date;
  invoiceTotal?: number;
  poTotal?: number;
  defectQty?: number;
  totalQty?: number;
  notes?: string;
}) {
  const onTimeDays = data.deliveredDate && data.promisedDate
    ? Math.round((new Date(data.deliveredDate).getTime() - new Date(data.promisedDate).getTime()) / 86400000)
    : null;

  const isOnTime = onTimeDays !== null ? onTimeDays <= 0 : true;

  const priceVariancePct = data.poTotal && data.invoiceTotal
    ? ((data.invoiceTotal - data.poTotal) / data.poTotal) * 100
    : 0;

  const record = await prisma.supplierPerformanceRecord.create({
    data: {
      companyId,
      supplierId: data.supplierId,
      poId:       data.poId,
      deliveredDate:    data.deliveredDate,
      promisedDate:     data.promisedDate,
      onTimeDays,
      isOnTime,
      invoiceTotal:     data.invoiceTotal ?? 0,
      poTotal:          data.poTotal ?? 0,
      priceVariancePct,
      defectQty:        data.defectQty ?? 0,
      totalQty:         data.totalQty ?? 1,
      notes:            data.notes,
    },
  });

  // Recalculate cached score after recording
  await calculateAndSaveScore(data.supplierId, companyId);

  return record;
}

// ─── Calculate & Cache Score ─────────────────────────────────
export async function calculateAndSaveScore(supplierId: string, companyId: string) {
  const records = await prisma.supplierPerformanceRecord.findMany({
    where: { supplierId, companyId },
  });

  if (records.length === 0) {
    // No data yet → initialize with neutral score
    await prisma.supplierScore.upsert({
      where:  { companyId_supplierId: { companyId, supplierId } },
      update: { priceScore: 50, deliveryScore: 50, qualityScore: 50, complianceScore: 50, totalScore: 50, recordsCount: 0 },
      create: { companyId, supplierId, priceScore: 50, deliveryScore: 50, qualityScore: 50, complianceScore: 50, totalScore: 50, recordsCount: 0 },
    });
    return;
  }

  const n = records.length;

  // Price score: 100 - avg absolute price variance % (capped 0–100)
  const avgPriceVar = records.reduce((s, r) => s + Math.abs(Number(r.priceVariancePct)), 0) / n;
  const priceScore  = Math.max(0, Math.min(100, 100 - avgPriceVar * 2));

  // Delivery score: % on-time deliveries * 100
  const onTimeCount   = records.filter(r => r.isOnTime).length;
  const deliveryScore = (onTimeCount / n) * 100;

  // Quality score: 100 - avg defect rate %
  const avgDefectRate  = records.reduce((s, r) => s + (Number(r.defectQty) / Math.max(Number(r.totalQty), 1)) * 100, 0) / n;
  const qualityScore   = Math.max(0, 100 - avgDefectRate);

  // Compliance score: based on average lateness (onTimeDays avg)
  const avgLateDays    = records.filter(r => r.onTimeDays !== null).reduce((s, r) => s + (r.onTimeDays ?? 0), 0) / n;
  const complianceScore = Math.max(0, Math.min(100, 100 - avgLateDays * 3));

  const totalScore =
    priceScore      * WEIGHTS.price +
    deliveryScore   * WEIGHTS.delivery +
    qualityScore    * WEIGHTS.quality +
    complianceScore * WEIGHTS.compliance;

  await prisma.supplierScore.upsert({
    where:  { companyId_supplierId: { companyId, supplierId } },
    update: { priceScore, deliveryScore, qualityScore, complianceScore, totalScore, recordsCount: n },
    create: { companyId, supplierId, priceScore, deliveryScore, qualityScore, complianceScore, totalScore, recordsCount: n },
  });

  return { priceScore, deliveryScore, qualityScore, complianceScore, totalScore, recordsCount: n };
}

// ─── Get Ranking ─────────────────────────────────────────────
export async function getSupplierRanking(companyId: string) {
  // Ensure all active suppliers have at least a neutral score entry
  const suppliers = await prisma.supplier.findMany({
    where:   { companyId, isActive: true },
    include: { score: true },
  });

  // For suppliers without a score record, provide neutral defaults
  const ranked = suppliers.map(s => ({
    id:             s.id,
    name:           s.name,
    ruc:            s.ruc,
    paymentTerms:   s.paymentTerms,
    priceScore:     s.score ? Number(s.score.priceScore) : 50,
    deliveryScore:  s.score ? Number(s.score.deliveryScore) : 50,
    qualityScore:   s.score ? Number(s.score.qualityScore) : 50,
    complianceScore: s.score ? Number(s.score.complianceScore) : 50,
    totalScore:     s.score ? Number(s.score.totalScore) : 50,
    recordsCount:   s.score?.recordsCount ?? 0,
  }));

  return ranked.sort((a, b) => b.totalScore - a.totalScore);
}

// ─── Supplier Performance Detail ─────────────────────────────
export async function getSupplierPerformance(supplierId: string, companyId: string) {
  const [supplier, score, records, orders] = await Promise.all([
    prisma.supplier.findFirst({ where: { id: supplierId, companyId } }),
    prisma.supplierScore.findUnique({ where: { companyId_supplierId: { companyId, supplierId } } }),
    prisma.supplierPerformanceRecord.findMany({
      where:   { supplierId, companyId },
      orderBy: { createdAt: 'desc' },
      take:    24,
    }),
    prisma.purchaseOrder.findMany({
      where:   { supplierId, companyId },
      orderBy: { createdAt: 'desc' },
      take:    10,
      select:  { id: true, poNumber: true, status: true, totalAmount: true, createdAt: true, deliveryDate: true },
    }),
  ]);

  if (!supplier) throw new Error('Proveedor no encontrado');

  // Monthly spend trend (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recentOrders = await prisma.purchaseOrder.findMany({
    where:   { supplierId, companyId, status: 'RECEIVED', createdAt: { gte: sixMonthsAgo } },
    select:  { totalAmount: true, createdAt: true },
  });

  const monthlySpend: Record<string, number> = {};
  recentOrders.forEach(o => {
    const key = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, '0')}`;
    monthlySpend[key] = (monthlySpend[key] ?? 0) + Number(o.totalAmount);
  });

  return {
    supplier,
    score: score ? {
      priceScore:      Number(score.priceScore),
      deliveryScore:   Number(score.deliveryScore),
      qualityScore:    Number(score.qualityScore),
      complianceScore: Number(score.complianceScore),
      totalScore:      Number(score.totalScore),
      recordsCount:    score.recordsCount,
    } : { priceScore: 50, deliveryScore: 50, qualityScore: 50, complianceScore: 50, totalScore: 50, recordsCount: 0 },
    recentRecords: records,
    recentOrders:  orders,
    monthlySpend,
  };
}
