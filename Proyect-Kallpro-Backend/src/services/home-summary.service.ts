import { prisma } from '../lib/prisma';

/**
 * Resumen consolidado para el Dashboard Home.
 * Principio de storytelling: OBSERVAR → INTERPRETAR → DECIDIR.
 * Devuelve KPIs de todos los módulos, tendencias de 7 días y alertas accionables.
 */
export async function getHomeSummary(companyId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // 7 días atrás para sparklines
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [
    salesThisMonth,
    salesPrevMonth,
    salesLast7Days,
    purchasesThisMonth,
    purchasesPrevMonth,
    lowStockCount,
    totalProducts,
    pendingApprovals,
    pendingPOs,
    activeDeals,
    newLeadsMonth,
    activeProductionOrders,
    pendingPayments,
    recentActivity,
  ] = await Promise.all([
    // Ventas este mes (facturas contabilizadas/pagadas)
    prisma.invoice.aggregate({
      where: { companyId, status: { in: ['POSTED', 'PAID'] }, createdAt: { gte: startOfMonth } },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    // Ventas mes anterior
    prisma.invoice.aggregate({
      where: { companyId, status: { in: ['POSTED', 'PAID'] }, createdAt: { gte: prevMonthStart, lte: prevMonthEnd } },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    // Ventas últimos 7 días (sparkline)
    prisma.invoice.findMany({
      where: { companyId, status: { in: ['POSTED', 'PAID'] }, createdAt: { gte: sevenDaysAgo } },
      select: { totalAmount: true, createdAt: true },
    }),
    // Compras este mes (OCs recibidas)
    prisma.purchaseOrder.aggregate({
      where: { companyId, status: 'RECEIVED', createdAt: { gte: startOfMonth } },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    // Compras mes anterior
    prisma.purchaseOrder.aggregate({
      where: { companyId, status: 'RECEIVED', createdAt: { gte: prevMonthStart, lte: prevMonthEnd } },
      _sum: { totalAmount: true },
    }),
    // Productos con bajo stock
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count FROM (
        SELECT p.id FROM products p
        JOIN product_stock s ON s."productId" = p.id
        WHERE p."companyId" = ${companyId} AND p."isActive" = true
        GROUP BY p.id, p."minStock"
        HAVING COALESCE(SUM(s.quantity), 0) <= p."minStock"
      ) sub
    `,
    // Total productos activos
    prisma.product.count({ where: { companyId, isActive: true } }),
    // Requisiciones pendientes de aprobación
    prisma.requisition.count({
      where: { companyId, status: { in: ['PENDING_L1', 'PENDING_L2', 'PENDING_L3'] } },
    }),
    // OCs pendientes de recepción
    prisma.purchaseOrder.count({
      where: { companyId, status: { in: ['SUBMITTED', 'APPROVED', 'SENT'] } },
    }),
    // Deals activos del CRM
    prisma.crmDeal.aggregate({
      where: { companyId, stage: { notIn: ['won', 'lost'] } },
      _sum: { amountUsd: true },
      _count: { id: true },
    }),
    // Leads nuevos este mes
    prisma.crmLead.count({
      where: { companyId, createdAt: { gte: startOfMonth } },
    }),
    // Órdenes de producción activas
    prisma.productionOrder.count({
      where: { companyId, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
    }),
    // Facturas pendientes de cobro
    prisma.invoice.aggregate({
      where: { companyId, status: 'POSTED' },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    // Actividad reciente (últimos 5 mensajes chatter)
    prisma.documentMessage.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        body: true,
        entityType: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  // Sparkline de ventas: agrupar por día
  const salesByDay = buildDailySeries(
    salesLast7Days.map(s => ({ amount: s.totalAmount, createdAt: s.createdAt })),
    sevenDaysAgo, 7,
  );

  // Calcular variaciones
  const salesCurrentVal = Number(salesThisMonth._sum.totalAmount ?? 0);
  const salesPrevVal = Number(salesPrevMonth._sum.totalAmount ?? 0);
  const salesVariation = salesPrevVal > 0
    ? ((salesCurrentVal - salesPrevVal) / salesPrevVal * 100)
    : salesCurrentVal > 0 ? 100 : 0;

  const purchasesCurrentVal = Number(purchasesThisMonth._sum.totalAmount ?? 0);
  const purchasesPrevVal = Number(purchasesPrevMonth._sum.totalAmount ?? 0);
  const purchasesVariation = purchasesPrevVal > 0
    ? ((purchasesCurrentVal - purchasesPrevVal) / purchasesPrevVal * 100)
    : purchasesCurrentVal > 0 ? 100 : 0;

  // Alertas accionables
  const alerts: { type: 'danger' | 'warning' | 'info'; title: string; description: string; path: string }[] = [];

  const lowStockVal = Number(lowStockCount[0]?.count ?? 0);
  if (lowStockVal > 0) {
    alerts.push({
      type: 'danger',
      title: `${lowStockVal} producto${lowStockVal > 1 ? 's' : ''} con bajo stock`,
      description: 'Requieren reabastecimiento inmediato',
      path: '/inventory?filter=low-stock',
    });
  }
  if (pendingApprovals > 0) {
    alerts.push({
      type: 'warning',
      title: `${pendingApprovals} requisición${pendingApprovals > 1 ? 'es' : ''} por aprobar`,
      description: 'Esperando tu revisión',
      path: '/compras/requisiciones?status=pending',
    });
  }
  if (pendingPOs > 0) {
    alerts.push({
      type: 'info',
      title: `${pendingPOs} OC${pendingPOs > 1 ? 's' : ''} pendiente${pendingPOs > 1 ? 's' : ''} de recepción`,
      description: 'Seguimiento de entregas',
      path: '/compras?status=pending',
    });
  }
  const pendingCollections = Number(pendingPayments._sum.totalAmount ?? 0);
  if (pendingCollections > 0) {
    alerts.push({
      type: 'warning',
      title: `$${Math.round(pendingCollections).toLocaleString('es')} por cobrar`,
      description: `${pendingPayments._count.id} factura${pendingPayments._count.id > 1 ? 's' : ''} pendiente${pendingPayments._count.id > 1 ? 's' : ''} de pago`,
      path: '/sales/invoices?status=POSTED',
    });
  }

  return {
    kpis: {
      salesMonth: {
        value: Math.round(salesCurrentVal * 100) / 100,
        count: salesThisMonth._count.id,
        variation: Math.round(salesVariation * 10) / 10,
        sparkline: salesByDay,
      },
      purchasesMonth: {
        value: Math.round(purchasesCurrentVal * 100) / 100,
        count: purchasesThisMonth._count.id,
        variation: Math.round(purchasesVariation * 10) / 10,
      },
      pendingApprovals,
      pendingPOs,
      pipeline: {
        value: Math.round(Number(activeDeals._sum.amountUsd ?? 0) * 100) / 100,
        count: activeDeals._count.id,
      },
      newLeads: newLeadsMonth,
      activeProduction: activeProductionOrders,
      lowStock: lowStockVal,
      totalProducts,
      pendingCollections: {
        value: Math.round(pendingCollections * 100) / 100,
        count: pendingPayments._count.id,
      },
    },
    alerts,
    recentActivity: recentActivity.map((a: any) => ({
      id: a.id,
      body: a.body.length > 80 ? a.body.substring(0, 80) + '…' : a.body,
      entityType: a.entityType,
      createdAt: a.createdAt,
      userName: [a.user?.firstName, a.user?.lastName].filter(Boolean).join(' ') || 'Sistema',
    })),
  };
}

function buildDailySeries(
  records: { amount: any; createdAt: Date }[],
  startDate: Date,
  days: number,
): number[] {
  const series: number[] = Array(days).fill(0);
  for (const r of records) {
    const d = new Date(r.createdAt);
    const dayIndex = Math.floor((d.getTime() - startDate.getTime()) / 86400000);
    if (dayIndex >= 0 && dayIndex < days) {
      series[dayIndex] += Number(r.amount);
    }
  }
  return series.map(v => Math.round(v * 100) / 100);
}
