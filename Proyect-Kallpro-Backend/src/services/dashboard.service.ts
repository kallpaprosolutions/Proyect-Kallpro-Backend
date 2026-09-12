import { prisma } from '../lib/prisma';
export async function getExecutiveDashboard(companyId: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Inicio y fin del mes actual
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59);

  // Inicio hace 6 meses
  const sixMonthsAgo = new Date(year, month - 7, 1);

  const [
    products,
    monthlyPOs,
    last6MonthsPOs,
    suppliers,
    budgets,
    pendingReqs,
    pendingPOs,
    sriMonth,
    lowStockProducts,
    reqStats,
  ] = await Promise.all([
    // Todos los productos activos con stocks
    prisma.product.findMany({
      where: { companyId, isActive: true },
      include: { stocks: true, category: true },
    }),

    // OCs recibidas este mes
    prisma.purchaseOrder.findMany({
      where: { companyId, status: 'RECEIVED', createdAt: { gte: monthStart, lte: monthEnd } },
      select: { totalAmount: true },
    }),

    // OCs de los últimos 6 meses agrupadas por mes
    prisma.purchaseOrder.findMany({
      where: { companyId, status: 'RECEIVED', createdAt: { gte: sixMonthsAgo } },
      select: { totalAmount: true, createdAt: true },
    }),

    // Proveedores con sus OCs recibidas
    prisma.supplier.findMany({
      where: { companyId, isActive: true },
      include: {
        purchaseOrders: {
          where: { status: 'RECEIVED' },
          select: { totalAmount: true },
        },
      },
    }),

    // Presupuesto del mes
    prisma.budgetControl.findMany({
      where: { companyId, year, month },
      include: { department: true },
    }),

    // Requisiciones pendientes de aprobación
    prisma.requisition.count({
      where: { companyId, status: { in: ['PENDING_L1', 'PENDING_L2', 'PENDING_L3'] } },
    }),

    // OCs pendientes
    prisma.purchaseOrder.count({
      where: { companyId, status: { in: ['SUBMITTED', 'APPROVED', 'SENT'] } },
    }),

    // Documentos SRI del mes
    prisma.sriDocument.findMany({
      where: { companyId, status: 'CONFIRMED', fechaEmision: { gte: monthStart, lte: monthEnd } },
      select: { total: true, iva: true, retencionRenta: true },
    }),

    // Productos con bajo stock
    prisma.product.findMany({
      where: { companyId, isActive: true },
      include: { stocks: true },
      take: 20,
    }),

    // Estadísticas de requisiciones
    prisma.requisition.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { id: true },
    }),
  ]);

  // ── Valor de inventario ──────────────────────────────────────
  let totalInventoryValue = 0;
  const topProducts: { name: string; sku: string | null; value: number; qty: number }[] = [];

  for (const p of products) {
    const qty = p.stocks.reduce((sum, s) => sum + Number(s.quantity), 0);
    const cost = p.valuationMethod === 'STANDARD_COST' ? Number(p.standardCost) : Number(p.avgCost);
    const value = qty * cost;
    totalInventoryValue += value;
    if (qty > 0) topProducts.push({ name: p.name, sku: p.sku, value, qty });
  }
  topProducts.sort((a, b) => b.value - a.value);
  const top5Products = topProducts.slice(0, 5);

  // ── Gasto del mes ────────────────────────────────────────────
  const monthlySpend = monthlyPOs.reduce((s, po) => s + Number(po.totalAmount), 0);

  // ── Gasto por mes (últimos 6 meses) ─────────────────────────
  const spendByMonth: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    spendByMonth[key] = 0;
  }
  for (const po of last6MonthsPOs) {
    const d = new Date(po.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (key in spendByMonth) spendByMonth[key] += Number(po.totalAmount);
  }
  const spendTrend = Object.entries(spendByMonth).map(([mes, total]) => ({ mes, total: Math.round(total * 100) / 100 }));

  // ── Top proveedores ──────────────────────────────────────────
  const topSuppliers = suppliers
    .map((s) => ({
      name: s.name,
      total: s.purchaseOrders.reduce((sum, po) => sum + Number(po.totalAmount), 0),
    }))
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // ── Presupuesto vs Actual ────────────────────────────────────
  const budgetVsActual = budgets.map((b) => ({
    department: b.department?.name ?? 'General',
    budgetAmount: Number(b.budgetAmount),
    consumed: Number(b.consumed),
    remaining: Number(b.budgetAmount) - Number(b.consumed),
    percentUsed: Number(b.budgetAmount) > 0
      ? Math.round((Number(b.consumed) / Number(b.budgetAmount)) * 100)
      : 0,
  }));

  // ── SRI del mes ──────────────────────────────────────────────
  const sriTotalMes = sriMonth.reduce((s, d) => s + Number(d.total), 0);
  const sriIVAMes = sriMonth.reduce((s, d) => s + Number(d.iva), 0);
  const sriRetencionMes = sriMonth.reduce((s, d) => s + Number(d.retencionRenta ?? 0), 0);

  // ── Bajo stock ───────────────────────────────────────────────
  const lowStock = lowStockProducts
    .map((p) => {
      const qty = p.stocks.reduce((s, st) => s + Number(st.quantity), 0);
      return { id: p.id, name: p.name, sku: p.sku, qty, minStock: Number(p.minStock) };
    })
    .filter((p) => p.qty <= p.minStock)
    .slice(0, 10);

  // ── Requisiciones por estado ─────────────────────────────────
  const reqByStatus: Record<string, number> = {};
  for (const r of reqStats) {
    reqByStatus[r.status] = r._count.id;
  }

  return {
    kpis: {
      totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
      monthlySpend: Math.round(monthlySpend * 100) / 100,
      pendingApprovals: pendingReqs,
      pendingPOs,
      sriTotalMes: Math.round(sriTotalMes * 100) / 100,
      sriIVAMes: Math.round(sriIVAMes * 100) / 100,
      sriRetencionMes: Math.round(sriRetencionMes * 100) / 100,
    },
    charts: {
      spendTrend,
      top5Products,
      topSuppliers,
    },
    budget: budgetVsActual,
    lowStock,
    requisitions: {
      byStatus: reqByStatus,
      pending: pendingReqs,
    },
  };
}
