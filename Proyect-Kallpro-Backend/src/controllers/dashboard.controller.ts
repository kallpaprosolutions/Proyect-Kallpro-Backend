import { Request } from 'express';
import { prisma } from '../lib/prisma';
import { getExecutiveDashboard } from '../services/dashboard.service';
import { getHomeSummary } from '../services/home-summary.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error-handler';

export const getDashboard = asyncHandler(async (req: Request, res) => {
  const data = await getExecutiveDashboard(req.user!.companyId);
  res.json(data);
});

export const getHomeSummaryHandler = asyncHandler(async (req: Request, res) => {
  const data = await getHomeSummary(req.user!.companyId);
  res.json(data);
});

export const getProcurementKPIs = asyncHandler(async (req: AuthRequest, res) => {
  const companyId = req.user!.companyId;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    orders,
    approvedReqs,
    allReqs,
    performanceRecords,
    monthlySpendRaw,
    topSuppliersRaw,
  ] = await Promise.all([
    // All POs this month
    prisma.purchaseOrder.findMany({
      where:   { companyId, createdAt: { gte: startOfMonth } },
      select:  { totalAmount: true, status: true },
    }),
    // Requisitions with timing data
    prisma.requisition.findMany({
      where:  { companyId, status: { in: ['APPROVED', 'QUOTED', 'PO_CREATED'] } },
      select: { createdAt: true, updatedAt: true },
      take:   100,
    }),
    // All reqs this month
    prisma.requisition.count({ where: { companyId, createdAt: { gte: startOfMonth } } }),
    // Performance records for on-time rate
    prisma.supplierPerformanceRecord.findMany({
      where: { companyId, createdAt: { gte: sixMonthsAgo } },
      select: { isOnTime: true },
    }),
    // Monthly spend (6 months)
    prisma.purchaseOrder.groupBy({
      by:    ['createdAt'],
      where: { companyId, status: 'RECEIVED', createdAt: { gte: sixMonthsAgo } },
      _sum:  { totalAmount: true },
    }),
    // Top suppliers by spend
    prisma.purchaseOrder.groupBy({
      by:    ['supplierId'],
      where: { companyId, createdAt: { gte: startOfMonth } },
      _sum:  { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take:  5,
    }),
  ]);

  const totalSpendMonth = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
  const pendingOrders   = orders.filter(o => ['DRAFT','SUBMITTED','APPROVED'].includes(o.status)).length;

  // Avg approval time (days from creation to approval)
  const approvalTimes = approvedReqs
    .map(r => (new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()) / 86400000)
    .filter(d => d >= 0 && d < 30);
  const avgApprovalDays = approvalTimes.length
    ? Number((approvalTimes.reduce((s, d) => s + d, 0) / approvalTimes.length).toFixed(1))
    : 0;

  // On-time delivery rate
  const onTimeCount = performanceRecords.filter(r => r.isOnTime).length;
  const onTimeRate  = performanceRecords.length
    ? Number(((onTimeCount / performanceRecords.length) * 100).toFixed(1))
    : null;

  // Monthly spend aggregated by year-month
  const monthlySpend: { month: string; total: number }[] = [];
  const monthMap: Record<string, number> = {};
  monthlySpendRaw.forEach(row => {
    const d   = new Date(row.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap[key] = (monthMap[key] ?? 0) + Number(row._sum.totalAmount ?? 0);
  });
  Object.entries(monthMap).sort().forEach(([month, total]) =>
    monthlySpend.push({ month, total: Number(total.toFixed(2)) })
  );

  // Top suppliers with names
  const suppliersWithNames = await Promise.all(
    topSuppliersRaw.map(async s => {
      const sup = await prisma.supplier.findUnique({ where: { id: s.supplierId }, select: { name: true } });
      return { supplierId: s.supplierId, name: sup?.name ?? s.supplierId, total: Number(s._sum.totalAmount ?? 0) };
    })
  );

  res.json({
    totalSpendMonth:   Number(totalSpendMonth.toFixed(2)),
    pendingOrders,
    totalOrders:       orders.length,
    totalRequisitions: allReqs,
    avgApprovalDays,
    onTimeDeliveryRate: onTimeRate,
    monthlySpend,
    topSuppliers: suppliersWithNames,
  });
});
