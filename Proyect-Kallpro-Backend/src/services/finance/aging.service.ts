/**
 * Valoración de cartera (CxC) y pagos (CxP) — aging por buckets + forecast de caja.
 * Módulo FINANCIERO (gestión); los saldos contables viven en el mayor (Contabilidad).
 */
import { prisma } from '../../lib/prisma';
import { getPayables } from '../sri-document.service';
import { getCashFlowStatement } from './accounting.service';
export type AgingBuckets = { current: number; d30: number; d60: number; d90: number; over90: number };

const emptyBuckets = (): AgingBuckets => ({ current: 0, d30: 0, d60: 0, d90: 0, over90: 0 });

function bucketKey(daysOverdue: number): keyof AgingBuckets {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return 'd30';
  if (daysOverdue <= 60) return 'd60';
  if (daysOverdue <= 90) return 'd90';
  return 'over90';
}

function daysOverdue(dueDate: Date | null): number {
  if (!dueDate) return 0; // sin vencimiento = corriente
  return Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// ── CxC: facturas de venta abiertas, agrupadas por cliente ──────────────────
export async function getArAging(companyId: string, customerId?: string) {
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      type: 'SALES',
      status: { notIn: ['CANCELLED', 'PAID'] },
      ...(customerId ? { salesOrder: { customerId } } : {}),
    },
    include: { salesOrder: { select: { customerId: true, customer: { select: { id: true, name: true, razonSocial: true } } } } },
    orderBy: { dueDate: 'asc' },
  });

  const totals = emptyBuckets();
  const byCustomer = new Map<string, {
    customerId: string; name: string; total: number; buckets: AgingBuckets;
    invoices: { id: string; number: string; issueDate: Date; dueDate: Date | null; total: number; balance: number; daysOverdue: number }[];
  }>();

  for (const inv of invoices) {
    const balance = r2(Number(inv.totalAmount) - Number(inv.paidAmount));
    if (balance <= 0) continue;
    const od = daysOverdue(inv.dueDate);
    const key = bucketKey(od);
    totals[key] = r2(totals[key] + balance);

    const cust = inv.salesOrder?.customer;
    const cid = cust?.id ?? 'SIN_CLIENTE';
    const entry = byCustomer.get(cid) ?? {
      customerId: cid,
      name: cust?.razonSocial || cust?.name || 'Sin cliente asignado',
      total: 0,
      buckets: emptyBuckets(),
      invoices: [],
    };
    entry.total = r2(entry.total + balance);
    entry.buckets[key] = r2(entry.buckets[key] + balance);
    entry.invoices.push({
      id: inv.id, number: inv.number, issueDate: inv.issueDate, dueDate: inv.dueDate,
      total: Number(inv.totalAmount), balance, daysOverdue: Math.max(0, od),
    });
    byCustomer.set(cid, entry);
  }

  const totalAR = r2(Object.values(totals).reduce((s, v) => s + v, 0));
  return {
    buckets: totals,
    total: totalAR,
    overdue: r2(totals.d30 + totals.d60 + totals.d90 + totals.over90),
    byCustomer: [...byCustomer.values()].sort((a, b) => b.total - a.total),
  };
}

// ── CxP: documentos SRI confirmados pendientes de pago, por proveedor ───────
export async function getApAging(companyId: string) {
  const payables = (await getPayables(companyId)).filter((p: any) => p.paymentStatus !== 'PAID');

  const totals = emptyBuckets();
  const bySupplier = new Map<string, {
    supplierId: string | null; name: string; total: number; buckets: AgingBuckets;
    documents: { id: string; number: string | null; dueDate: Date; total: number; daysOverdue: number; poNumber: string | null }[];
  }>();

  for (const p of payables) {
    const od = daysOverdue(p.dueDate);
    const key = bucketKey(od);
    const amount = r2(Number(p.total));
    totals[key] = r2(totals[key] + amount);

    const sid = p.supplierId ?? p.supplierName ?? 'SIN_PROVEEDOR';
    const entry = bySupplier.get(sid) ?? {
      supplierId: p.supplierId ?? null, name: p.supplierName ?? 'Sin proveedor', total: 0, buckets: emptyBuckets(), documents: [],
    };
    entry.total = r2(entry.total + amount);
    entry.buckets[key] = r2(entry.buckets[key] + amount);
    entry.documents.push({
      id: p.id, number: p.numeroDoc, dueDate: p.dueDate, total: amount,
      daysOverdue: Math.max(0, od), poNumber: p.poNumber,
    });
    bySupplier.set(sid, entry);
  }

  const totalAP = r2(Object.values(totals).reduce((s, v) => s + v, 0));
  return {
    buckets: totals,
    total: totalAP,
    overdue: r2(totals.d30 + totals.d60 + totals.d90 + totals.over90),
    bySupplier: [...bySupplier.values()].sort((a, b) => b.total - a.total),
  };
}

/**
 * Semana (0-based, saturada a `weeks-1`) en la que cae `d` respecto a `now` — misma regla
 * que usa el forecast interno: vencidas caen en la semana 0 (cobro/pago inmediato esperado).
 * Exportada para que payment-priority (ap.service) ubique cada documento en la misma
 * semana que el forecast, sin duplicar la fórmula.
 */
export function weekIndexOf(d: Date | null, weeks: number, now: Date = new Date()): number {
  if (!d) return 0;
  const diff = Math.floor((new Date(d).getTime() - now.getTime()) / (7 * 86_400_000));
  return Math.max(0, Math.min(weeks - 1, diff));
}

// ── Forecast de caja: proyección semanal desde vencimientos CxC/CxP ─────────
export async function getCashFlowForecast(companyId: string, weeks = 8) {
  const [ar, ap, cashNow] = await Promise.all([
    getArAging(companyId),
    getApAging(companyId),
    getCashFlowStatement(companyId).then((c) => c.closingCash),
  ]);

  const now = new Date();
  const weekOf = (d: Date | null): number => weekIndexOf(d, weeks, now);

  const series = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(now.getTime() + i * 7 * 86_400_000);
    return { week: i + 1, startDate: start, inflows: 0, outflows: 0, net: 0, projectedCash: 0 };
  });

  for (const c of ar.byCustomer) for (const inv of c.invoices) series[weekOf(inv.dueDate)].inflows = r2(series[weekOf(inv.dueDate)].inflows + inv.balance);
  for (const s of ap.bySupplier) for (const doc of s.documents) series[weekOf(doc.dueDate)].outflows = r2(series[weekOf(doc.dueDate)].outflows + doc.total);

  let running = cashNow;
  for (const w of series) {
    w.net = r2(w.inflows - w.outflows);
    running = r2(running + w.net);
    w.projectedCash = running;
  }

  return { openingCash: cashNow, weeks: series, endingCash: running, totalInflows: r2(ar.total), totalOutflows: r2(ap.total) };
}
