import { prisma } from '../../lib/prisma';
export interface KPI4D {
  code: string;
  name: string;
  value: number | null;
  unit: string;
  benchmark?: number;
  benchmarkLabel?: string;
  status: 'green' | 'yellow' | 'red' | 'neutral';
  trend?: number | null;
  description: string;
  dimension: 'tiempo' | 'dinero' | 'calidad' | 'logistica';
}

export interface Optimization4DResult {
  tiempo: KPI4D[];
  dinero: KPI4D[];
  calidad: KPI4D[];
  logistica: KPI4D[];
  summary: {
    tiempoScore: number;
    dineroScore: number;
    calidadScore: number;
    logisticaScore: number;
    overallScore: number;
  };
}

function kpiStatus(value: number | null, greenMax: number, yellowMax: number, higherIsBetter = false): 'green' | 'yellow' | 'red' | 'neutral' {
  if (value === null) return 'neutral';
  if (higherIsBetter) {
    if (value >= greenMax) return 'green';
    if (value >= yellowMax) return 'yellow';
    return 'red';
  } else {
    if (value <= greenMax) return 'green';
    if (value <= yellowMax) return 'yellow';
    return 'red';
  }
}

function dimScore(kpis: KPI4D[]): number {
  const scored = kpis.filter(k => k.status !== 'neutral');
  if (!scored.length) return 50;
  const green = scored.filter(k => k.status === 'green').length;
  const yellow = scored.filter(k => k.status === 'yellow').length;
  return Math.round(((green * 100 + yellow * 60) / scored.length));
}

export async function get4DKPIs(companyId: string, period?: string): Promise<Optimization4DResult> {
  const now = period ? new Date(period + '-01') : new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  const yearStart = new Date(year, 0, 1);

  // ── Datos base ────────────────────────────────────────────────
  const [purchaseOrders, requisitions, salesOrders, supplierScores, products] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { companyId, createdAt: { gte: yearStart, lte: end } },
      include: { requisition: true },
    }),
    prisma.requisition.findMany({
      where: { companyId, createdAt: { gte: yearStart, lte: end } },
    }),
    prisma.salesOrder.findMany({
      where: { companyId, createdAt: { gte: yearStart, lte: end } },
    }),
    prisma.supplierScore.findMany({ where: { companyId } }),
    prisma.product.findMany({
      where: { companyId, isActive: true },
      include: { stocks: true },
    }),
  ]);

  const poThisPeriod = purchaseOrders.filter(po =>
    po.createdAt >= start && po.createdAt <= end,
  );

  // ── DIMENSIÓN TIEMPO ──────────────────────────────────────────
  // PCT: Procurement Cycle Time (Req → OC)
  let totalPCT = 0, pctCount = 0;
  for (const po of poThisPeriod) {
    if (po.requisition?.createdAt && po.createdAt) {
      const days = (po.createdAt.getTime() - po.requisition.createdAt.getTime()) / 86400000;
      if (days >= 0 && days < 90) { totalPCT += days; pctCount++; }
    }
  }
  const pct = pctCount > 0 ? totalPCT / pctCount : null;

  // LT: Lead Time (OC → entrega estimada)
  let totalLT = 0, ltCount = 0;
  for (const po of poThisPeriod) {
    if (po.deliveryDate && po.createdAt) {
      const days = (po.deliveryDate.getTime() - po.createdAt.getTime()) / 86400000;
      if (days > 0 && days < 180) { totalLT += days; ltCount++; }
    }
  }
  const lt = ltCount > 0 ? totalLT / ltCount : null;

  // DSO proxy
  const invoices = await prisma.invoice.findMany({
    where: { companyId, issueDate: { gte: yearStart, lte: end } },
  });
  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  const unpaid = invoices.filter(i => i.status !== 'PAID').reduce((s, i) => s + Number(i.totalAmount), 0);
  const dso = totalInvoiced > 0 ? (unpaid / totalInvoiced) * 90 : null;

  // DPO proxy
  const poTotal = poThisPeriod.reduce((s, p) => s + Number(p.totalAmount), 0);
  const poOpen = poThisPeriod.filter(p => ['PENDING', 'CONFIRMED'].includes(p.status)).reduce((s, p) => s + Number(p.totalAmount), 0);
  const dpo = poTotal > 0 ? (poOpen / poTotal) * 60 : null;

  // DI: Días inventario
  const totalStock = products.reduce((s, p) => s + p.stocks.reduce((ss, st) => ss + Number(st.quantity), 0), 0);
  const avgCost = products.reduce((s, p) => s + Number(p.avgCost), 0) / Math.max(products.length, 1);
  const inventoryValue = totalStock * avgCost;
  const annualCogs = poTotal * 12;
  const di = annualCogs > 0 ? (inventoryValue / annualCogs) * 365 : null;

  const ccc = (di ?? 30) + (dso ?? 45) - (dpo ?? 40);

  const tiempo: KPI4D[] = [
    { code: 'PCT', name: 'Ciclo Req→OC', value: pct !== null ? Math.round(pct) : null, unit: 'días', benchmark: 3, benchmarkLabel: '≤ 3 días', status: kpiStatus(pct, 3, 7), description: 'Tiempo promedio desde requisición hasta OC emitida', dimension: 'tiempo' },
    { code: 'LT', name: 'Lead Time promedio', value: lt !== null ? Math.round(lt) : null, unit: 'días', benchmark: 7, benchmarkLabel: '≤ 7 días', status: kpiStatus(lt, 7, 15), description: 'Días promedio OC → recepción del proveedor', dimension: 'tiempo' },
    { code: 'DSO', name: 'Días de cobro (DSO)', value: dso !== null ? Math.round(dso) : null, unit: 'días', benchmark: 45, benchmarkLabel: '≤ 45 días', status: kpiStatus(dso, 45, 60), description: 'Días promedio para cobrar a clientes', dimension: 'tiempo' },
    { code: 'DPO', name: 'Días de pago (DPO)', value: dpo !== null ? Math.round(dpo) : null, unit: 'días', benchmark: 40, benchmarkLabel: '35-45 días', status: dpo && dpo >= 35 && dpo <= 45 ? 'green' : dpo && dpo >= 25 && dpo <= 60 ? 'yellow' : 'red', description: 'Días promedio de pago a proveedores', dimension: 'tiempo' },
    { code: 'DI', name: 'Días de inventario (DI)', value: di !== null ? Math.round(di) : null, unit: 'días', benchmark: 45, benchmarkLabel: '≤ 45 días', status: kpiStatus(di, 45, 75), description: 'Días de cobertura del inventario actual', dimension: 'tiempo' },
    { code: 'CCC', name: 'Ciclo conversión de caja', value: Math.round(ccc), unit: 'días', benchmark: 45, benchmarkLabel: '≤ 45 días', status: kpiStatus(ccc, 45, 75), description: 'DI + DSO - DPO: días que el dinero está atrapado', dimension: 'tiempo' },
  ];

  // ── DIMENSIÓN DINERO ──────────────────────────────────────────
  const wc = inventoryValue + (unpaid * 0.7) - (poOpen * 0.6);
  const wcPct = totalInvoiced > 0 ? (wc / totalInvoiced) * 100 : null;
  const roi = poTotal > 0 ? ((totalInvoiced - poTotal) / poTotal) * 100 : null;

  // ABC: porcentaje de gasto en top 20% de proveedores
  const supplierSpend: Record<string, number> = {};
  for (const po of purchaseOrders) {
    supplierSpend[po.supplierId] = (supplierSpend[po.supplierId] ?? 0) + Number(po.totalAmount);
  }
  const spendValues = Object.values(supplierSpend).sort((a, b) => b - a);
  const totalSpend = spendValues.reduce((s, v) => s + v, 0);
  const top20pct = Math.ceil(spendValues.length * 0.2);
  const topSpend = spendValues.slice(0, top20pct).reduce((s, v) => s + v, 0);
  const abcConcentration = totalSpend > 0 ? (topSpend / totalSpend) * 100 : null;

  // SUM: gasto gestionado por LOGIFI (= gasto total en POs)
  const sumPct = totalInvoiced > 0 ? Math.min((poTotal / totalInvoiced) * 100, 100) : null;

  const dinero: KPI4D[] = [
    { code: 'WC', name: 'Working Capital', value: Math.round(wc), unit: 'USD', benchmark: 0, benchmarkLabel: '> 0', status: wc > 0 ? 'green' : 'red', description: 'Capital de trabajo neto disponible', dimension: 'dinero' },
    { code: 'WC_PCT', name: 'WC / Ingresos', value: wcPct !== null ? Math.round(wcPct) : null, unit: '%', benchmark: 25, benchmarkLabel: '≤ 25%', status: kpiStatus(wcPct, 25, 40), description: 'Working capital como % de ingresos', dimension: 'dinero' },
    { code: 'ROI', name: 'ROI Compras', value: roi !== null ? Math.round(roi) : null, unit: '%', benchmark: 20, benchmarkLabel: '≥ 20%', status: kpiStatus(roi, 20, 10, true), description: 'Retorno sobre inversión en compras', dimension: 'dinero' },
    { code: 'ABC', name: 'Concentración ABC (top 20%)', value: abcConcentration !== null ? Math.round(abcConcentration) : null, unit: '%', benchmark: 80, benchmarkLabel: '~80% (Pareto)', status: abcConcentration && abcConcentration >= 70 && abcConcentration <= 90 ? 'green' : 'yellow', description: 'Porcentaje del gasto concentrado en top 20% de proveedores', dimension: 'dinero' },
    { code: 'SUM', name: 'Spend Under Management', value: sumPct !== null ? Math.round(sumPct) : null, unit: '%', benchmark: 80, benchmarkLabel: '≥ 80%', status: kpiStatus(sumPct, 80, 60, true), description: 'Gasto gestionado por LOGIFI vs total empresa', dimension: 'dinero' },
  ];

  // ── DIMENSIÓN CALIDAD ─────────────────────────────────────────
  const perfRecords = await prisma.supplierPerformanceRecord.findMany({
    where: { companyId, createdAt: { gte: yearStart, lte: end } },
  });

  const totalQty = perfRecords.reduce((s, r) => s + Number(r.totalQty), 0);
  const defectQty = perfRecords.reduce((s, r) => s + Number(r.defectQty), 0);
  const dr = totalQty > 0 ? (defectQty / totalQty) * 100 : null;
  const fpy = totalQty > 0 ? ((totalQty - defectQty) / totalQty) * 100 : null;
  const onTime = perfRecords.filter(r => r.isOnTime).length;
  const otif = perfRecords.length > 0 ? (onTime / perfRecords.length) * 100 : null;
  const avgSQS = supplierScores.length > 0
    ? supplierScores.reduce((s, r) => s + Number(r.totalScore), 0) / supplierScores.length
    : null;

  const calidad: KPI4D[] = [
    { code: 'DR', name: 'Tasa de defectos', value: dr !== null ? Math.round(dr * 100) / 100 : null, unit: '%', benchmark: 2, benchmarkLabel: '≤ 2%', status: kpiStatus(dr, 2, 5), description: 'Unidades rechazadas / total recibidas', dimension: 'calidad' },
    { code: 'FPY', name: 'First Pass Yield', value: fpy !== null ? Math.round(fpy * 10) / 10 : null, unit: '%', benchmark: 95, benchmarkLabel: '≥ 95%', status: kpiStatus(fpy, 95, 85, true), description: 'Ítems aceptados en primera revisión', dimension: 'calidad' },
    { code: 'OTIF', name: 'OTIF - A tiempo y completo', value: otif !== null ? Math.round(otif) : null, unit: '%', benchmark: 90, benchmarkLabel: '≥ 90%', status: kpiStatus(otif, 90, 75, true), description: 'Entregas en tiempo Y cantidad correcta', dimension: 'calidad' },
    { code: 'SQS', name: 'Supplier Quality Score', value: avgSQS !== null ? Math.round(avgSQS * 10) / 10 : null, unit: '/100', benchmark: 80, benchmarkLabel: '≥ 80', status: kpiStatus(avgSQS, 80, 65, true), description: 'Score promedio de calidad de proveedores', dimension: 'calidad' },
  ];

  // ── DIMENSIÓN LOGÍSTICA ────────────────────────────────────────
  // CPK proxy: si hay módulo TMS, leer datos reales; si no, proxy
  const salesDelivered = salesOrders.filter(o => ['DELIVERED', 'DISPATCHED'].includes(o.status));
  const salesOnTime = salesDelivered.filter(o =>
    o.deliveryDate && o.updatedAt <= new Date(o.deliveryDate.getTime() + 86400000),
  );
  const otd = salesDelivered.length > 0 ? (salesOnTime.length / salesDelivered.length) * 100 : null;

  // UTL: utilización estimada (si hay transferencias de bodega)
  const transfers = await prisma.inventoryMovement.count({
    where: { companyId, type: 'TRANSFER_IN', createdAt: { gte: start, lte: end } },
  });
  const utl = transfers > 0 ? Math.min(transfers * 8, 95) : null; // proxy

  const logistica: KPI4D[] = [
    { code: 'OTD', name: 'On-Time Delivery', value: otd !== null ? Math.round(otd) : null, unit: '%', benchmark: 95, benchmarkLabel: '≥ 95%', status: kpiStatus(otd, 95, 80, true), description: 'Entregas de ventas a tiempo al cliente', dimension: 'logistica' },
    { code: 'UTL', name: 'Utilización de flota', value: utl, unit: '%', benchmark: 80, benchmarkLabel: '≥ 80%', status: kpiStatus(utl, 80, 60, true), description: 'Uso de capacidad logística disponible', dimension: 'logistica' },
    { code: 'TRANSFERS', name: 'Transferencias entre bodegas', value: transfers, unit: 'movs', benchmark: 0, status: 'neutral', description: 'Movimientos internos de stock este período', dimension: 'logistica' },
  ];

  const tiempoScore = dimScore(tiempo);
  const dineroScore = dimScore(dinero);
  const calidadScore = dimScore(calidad);
  const logisticaScore = dimScore(logistica);
  const overallScore = Math.round((tiempoScore + dineroScore + calidadScore + logisticaScore) / 4);

  return {
    tiempo, dinero, calidad, logistica,
    summary: { tiempoScore, dineroScore, calidadScore, logisticaScore, overallScore },
  };
}

export default { get4DKPIs };
