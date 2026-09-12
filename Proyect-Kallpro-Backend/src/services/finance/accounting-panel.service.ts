import { prisma } from '../../lib/prisma';

// ============================================================
// TABLERO CONTABLE ACCIONABLE (Sprint 11 — patrón Odoo 18)
// ============================================================
// Contadores "vivos" para el Resumen de Contabilidad: cada tarjeta lleva al
// usuario directo a la lista que necesita atender (como el tablero por diario
// de Odoo: "12 Por validar → clic → la lista filtrada").

export interface AccountingPanel {
  /** Documentos SRI (facturas de compra) esperando revisión. */
  sriPorRevisar: { count: number; total: number };
  /** Facturas de venta vencidas y no cobradas (CxC). */
  cxcVencidas: { count: number; total: number };
  /** Facturas de compra vencidas y no pagadas (CxP). */
  cxpVencidas: { count: number; total: number };
  /** Facturas de venta en borrador (aún no cuentan para el 104). */
  facturasBorrador: { count: number; total: number };
  /** Asientos del mes en curso. */
  asientosMes: { count: number; totalDebit: number };
  /** Estado del período fiscal del mes en curso. */
  periodoActual: { year: number; month: number; status: 'OPEN' | 'CLOSED' | 'NONE' };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function getAccountingPanel(companyId: string): Promise<AccountingPanel> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startOfMonth = new Date(year, month - 1, 1);

  const overdueWhere = (type: 'SALES' | 'PURCHASE') => ({
    companyId,
    type,
    status: { notIn: ['PAID', 'CANCELLED', 'DRAFT'] },
    dueDate: { lt: now },
  });

  const [sriDocs, cxc, cxp, drafts, asientos, fiscalPeriod] = await Promise.all([
    prisma.sriDocument.findMany({
      where: { companyId, status: 'PENDING_REVIEW' },
      select: { total: true },
    }),
    prisma.invoice.findMany({
      where: overdueWhere('SALES'),
      select: { totalAmount: true, paidAmount: true },
    }),
    prisma.invoice.findMany({
      where: overdueWhere('PURCHASE'),
      select: { totalAmount: true, paidAmount: true },
    }),
    prisma.invoice.findMany({
      where: { companyId, type: 'SALES', status: 'DRAFT' },
      select: { totalAmount: true },
    }),
    prisma.journalEntry.aggregate({
      where: { companyId, entryDate: { gte: startOfMonth }, status: 'POSTED' },
      _count: true,
      _sum: { totalDebit: true },
    }),
    prisma.fiscalPeriod.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
    }),
  ]);

  const saldo = (rows: { totalAmount: unknown; paidAmount: unknown }[]) =>
    r2(rows.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0));

  return {
    sriPorRevisar: { count: sriDocs.length, total: r2(sriDocs.reduce((s, d) => s + Number(d.total), 0)) },
    cxcVencidas: { count: cxc.length, total: saldo(cxc) },
    cxpVencidas: { count: cxp.length, total: saldo(cxp) },
    facturasBorrador: { count: drafts.length, total: r2(drafts.reduce((s, d) => s + Number(d.totalAmount), 0)) },
    asientosMes: { count: asientos._count, totalDebit: r2(Number(asientos._sum.totalDebit ?? 0)) },
    periodoActual: {
      year, month,
      status: !fiscalPeriod ? 'NONE' : fiscalPeriod.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
    },
  };
}
