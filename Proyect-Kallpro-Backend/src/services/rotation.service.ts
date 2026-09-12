import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
// ── ABC Classification thresholds ─────────────────────────────
// A = top 80% of cumulative value (high rotation)
// B = next 15% (medium rotation)
// C = remaining 5% + zero movement (low / no rotation)

export interface ProductRotationData {
  productId: string;
  name: string;
  sku?: string;
  category?: string;
  totalStock: number;
  totalValue: number;
  avgCost: number;
  unit: string;
  valuationMethod: string;
  movementsLast90: number;   // total OUT movements last 90 days
  consumedLast90: number;    // total qty consumed last 90 days
  avgDailyConsumption: number;
  dio: number;               // Days of Inventory Outstanding
  rotationRate: number;      // turns per year
  abcClass: 'A' | 'B' | 'C' | 'D'; // D = zero movement
  cumulativeValuePct: number;
  minStock: number;
  isLowStock: boolean;
  isZeroStock: boolean;
  lastMovementAt?: Date;
}

export interface ObsolescenceReport {
  totalInventoryValue: number;
  obsoleteValue: number;
  obsoletePct: number;
  lowRotationValue: number;
  avgDIO: number;
  avgRotationRate: number;
  byClass: {
    A: { count: number; value: number; pct: number };
    B: { count: number; value: number; pct: number };
    C: { count: number; value: number; pct: number };
    D: { count: number; value: number; pct: number };
  };
  expiringIn30: number;  // batches expiring in 30 days
  expiringIn90: number;  // batches expiring in 90 days
  expiredBatches: number;
}

export interface MovementTrend {
  date: string; // YYYY-MM
  entries: number;
  exits: number;
  entryValue: number;
  exitValue: number;
  netValue: number;
}

export async function getProductRotationAnalysis(companyId: string): Promise<ProductRotationData[]> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Fetch all products with stocks and recent movements
  const products = await prisma.product.findMany({
    where: { companyId, isActive: true },
    include: {
      category: true,
      stocks: true,
      movements: {
        where: { createdAt: { gte: ninetyDaysAgo }, type: { in: ['OUT', 'ADJUSTMENT_OUT'] } },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Build rotation data
  const data: Omit<ProductRotationData, 'abcClass' | 'cumulativeValuePct'>[] = products.map((p) => {
    const totalStock = p.stocks.reduce((s, st) => s + Number(st.quantity), 0);
    const cost = p.valuationMethod === 'STANDARD_COST' ? Number(p.standardCost) : Number(p.avgCost);
    const totalValue = totalStock * cost;

    const consumedLast90 = p.movements.reduce((s, m) => s + Number(m.quantity), 0);
    const avgDailyConsumption = consumedLast90 / 90;
    const dio = avgDailyConsumption > 0 ? totalStock / avgDailyConsumption : 9999;
    const rotationRate = avgDailyConsumption > 0 ? (avgDailyConsumption * 365) / Math.max(totalStock, 0.001) : 0;

    return {
      productId: p.id,
      name: p.name,
      sku: p.sku ?? undefined,
      category: p.category?.name,
      totalStock,
      totalValue,
      avgCost: cost,
      unit: p.unit,
      valuationMethod: p.valuationMethod,
      movementsLast90: p.movements.length,
      consumedLast90,
      avgDailyConsumption,
      dio,
      rotationRate,
      minStock: Number(p.minStock),
      isLowStock: totalStock > 0 && totalStock <= Number(p.minStock),
      isZeroStock: totalStock === 0,
      lastMovementAt: p.lastMovementAt ?? undefined,
    };
  });

  // Sort by totalValue DESC for ABC
  const sorted = [...data].sort((a, b) => b.totalValue - a.totalValue);
  const totalValue = sorted.reduce((s, d) => s + d.totalValue, 0);

  let cumulative = 0;
  const withABC: ProductRotationData[] = sorted.map((d) => {
    cumulative += d.totalValue;
    const cumulativeValuePct = totalValue > 0 ? (cumulative / totalValue) * 100 : 0;
    let abcClass: 'A' | 'B' | 'C' | 'D';
    if (d.movementsLast90 === 0 && d.consumedLast90 === 0) abcClass = 'D';
    else if (cumulativeValuePct <= 80) abcClass = 'A';
    else if (cumulativeValuePct <= 95) abcClass = 'B';
    else abcClass = 'C';
    return { ...d, abcClass, cumulativeValuePct };
  });

  return withABC;
}

export async function getObsolescenceReport(companyId: string): Promise<ObsolescenceReport> {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [rotationData, batches] = await Promise.all([
    getProductRotationAnalysis(companyId),
    prisma.inventoryBatch.findMany({
      where: { companyId, expiryDate: { not: null } },
      select: { expiryDate: true, remainingQty: true, unitCost: true, isExhausted: true },
    }),
  ]);

  const totalValue = rotationData.reduce((s, d) => s + d.totalValue, 0);
  const byClass = {
    A: { count: 0, value: 0, pct: 0 },
    B: { count: 0, value: 0, pct: 0 },
    C: { count: 0, value: 0, pct: 0 },
    D: { count: 0, value: 0, pct: 0 },
  };

  rotationData.forEach((d) => {
    byClass[d.abcClass].count++;
    byClass[d.abcClass].value += d.totalValue;
  });

  if (totalValue > 0) {
    (['A', 'B', 'C', 'D'] as const).forEach((k) => {
      byClass[k].pct = (byClass[k].value / totalValue) * 100;
    });
  }

  const obsoleteValue = byClass.D.value;
  const lowRotationValue = byClass.C.value;
  const avgDIO = rotationData.length
    ? rotationData.filter((d) => d.dio < 9999).reduce((s, d) => s + d.dio, 0) / Math.max(rotationData.filter((d) => d.dio < 9999).length, 1)
    : 0;
  const avgRotationRate = rotationData.length
    ? rotationData.reduce((s, d) => s + d.rotationRate, 0) / rotationData.length
    : 0;

  const activeBatches = batches.filter((b) => !b.isExhausted && b.expiryDate);
  const expiringIn30 = activeBatches.filter((b) => b.expiryDate! <= in30 && b.expiryDate! > now).length;
  const expiringIn90 = activeBatches.filter((b) => b.expiryDate! <= in90 && b.expiryDate! > now).length;
  const expiredBatches = activeBatches.filter((b) => b.expiryDate! < now).length;

  return {
    totalInventoryValue: totalValue,
    obsoleteValue,
    obsoletePct: totalValue > 0 ? (obsoleteValue / totalValue) * 100 : 0,
    lowRotationValue,
    avgDIO,
    avgRotationRate,
    byClass,
    expiringIn30,
    expiringIn90,
    expiredBatches,
  };
}

export async function getMovementTrend(companyId: string, months = 6): Promise<MovementTrend[]> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months + 1);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const movements = await prisma.inventoryMovement.findMany({
    where: { companyId, createdAt: { gte: startDate } },
    select: { type: true, quantity: true, totalCost: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const trendMap: Record<string, MovementTrend> = {};
  movements.forEach((m) => {
    const key = m.createdAt.toISOString().slice(0, 7); // YYYY-MM
    if (!trendMap[key]) trendMap[key] = { date: key, entries: 0, exits: 0, entryValue: 0, exitValue: 0, netValue: 0 };
    if (m.type === 'IN' || m.type === 'ADJUSTMENT_IN') {
      trendMap[key].entries += Number(m.quantity);
      trendMap[key].entryValue += Number(m.totalCost);
    } else {
      trendMap[key].exits += Number(m.quantity);
      trendMap[key].exitValue += Number(m.totalCost);
    }
    trendMap[key].netValue = trendMap[key].entryValue - trendMap[key].exitValue;
  });

  return Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getExpiringBatches(companyId: string, withinDays = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);

  return prisma.inventoryBatch.findMany({
    where: {
      companyId,
      isExhausted: false,
      expiryDate: { not: null, lte: cutoff },
    },
    include: { product: true, warehouse: true },
    orderBy: { expiryDate: 'asc' },
  });
}

export async function getLotsByProduct(productId: string, companyId: string) {
  return prisma.inventoryBatch.findMany({
    where: { productId, companyId },
    include: { warehouse: true },
    orderBy: [{ isExhausted: 'asc' }, { receivedAt: 'asc' }],
  });
}
