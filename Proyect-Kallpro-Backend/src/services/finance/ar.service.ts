/**
 * Cuentas por Cobrar (CxC) — submódulo operativo dentro de Contabilidad.
 * Orquesta Invoice(type=SALES) + Payment/PaymentApplication + asiento de cobro. El aging y
 * el forecast semanal se reutilizan de finance/aging.service.ts (no se duplican).
 *
 * Buenas prácticas de industria aplicadas (investigación web — HighRadius, Billtrust,
 * Auxis 2026): buckets 0/30/60/90/+90, DSO = (CxC / Ventas del período) × días, y
 * clasificación de dunning por antigüedad para priorizar cobranza.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { getArAging } from './aging.service';
import { createPayment } from '../payment.service';
import { createCustomerCollectionEntry, createReceivableAdjustmentEntry } from '../journal.service';
import { getErpConfig } from '../erp-config.service';
import { assertCanExecutePayment } from '../payment-approval.service';

/** Rol del usuario que ejecuta la acción (para el gate de aprobación por monto — Fase 4). */
async function getActorRole(companyId: string, userId?: string): Promise<string | null> {
  if (!userId) return null;
  const user = await prisma.user.findFirst({ where: { id: userId, companyId }, select: { role: true } });
  return user?.role ?? null;
}

export interface ArFilters {
  customerId?: string;
  overdue?: boolean;
  search?: string; // número de factura
}

export async function listReceivables(companyId: string, filters: ArFilters = {}) {
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      type: 'SALES',
      status: { notIn: ['CANCELLED', 'PAID'] },
      ...(filters.customerId ? { salesOrder: { customerId: filters.customerId } } : {}),
      ...(filters.search ? { number: { contains: filters.search, mode: 'insensitive' } } : {}),
    },
    include: { salesOrder: { select: { customerId: true, customer: { select: { id: true, name: true, razonSocial: true, creditLimit: true } } } } },
    orderBy: { dueDate: 'asc' },
    take: 500,
  });

  const now = Date.now();
  return invoices
    .map((inv) => {
      const balance = Math.round((Number(inv.totalAmount) - Number(inv.paidAmount)) * 100) / 100;
      const daysOverdue = inv.dueDate ? Math.max(0, Math.floor((now - new Date(inv.dueDate).getTime()) / 86_400_000)) : 0;
      return {
        id: inv.id,
        number: inv.number,
        status: inv.status,
        salesOrderId: inv.salesOrderId,
        customerId: inv.salesOrder?.customerId ?? null,
        customerName: inv.salesOrder?.customer?.razonSocial || inv.salesOrder?.customer?.name || 'Sin cliente',
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        totalAmount: Number(inv.totalAmount),
        paidAmount: Number(inv.paidAmount),
        balance,
        daysOverdue,
        dunning: getDunningStatus(daysOverdue),
      };
    })
    .filter((inv) => inv.balance > 0.01)
    .filter((inv) => (filters.overdue ? inv.daysOverdue > 0 : true));
}

/** DSO (Days Sales Outstanding) — práctica estándar: (CxC / Ventas del período) × días. */
export function computeDSO(totalAR: number, periodRevenue: number, periodDays: number): number {
  if (periodRevenue <= 0) return 0;
  return Math.round((totalAR / periodRevenue) * periodDays * 10) / 10;
}

export type DunningStatus = 'AL_DIA' | 'RECORDATORIO' | 'URGENTE' | 'COBRANZA';

/** Clasificación de antigüedad para priorizar cobranza (solo badge — no envía correos). */
export function getDunningStatus(daysOverdue: number): DunningStatus {
  if (daysOverdue <= 0) return 'AL_DIA';
  if (daysOverdue <= 30) return 'RECORDATORIO';
  if (daysOverdue <= 60) return 'URGENTE';
  return 'COBRANZA';
}

export async function getArKpis(companyId: string) {
  const receivables = await listReceivables(companyId);
  const now = Date.now();
  const in7 = now + 7 * 86_400_000;

  const totalReceivable = receivables.reduce((s, r) => s + r.balance, 0);
  const overdue = receivables.filter((r) => r.daysOverdue > 0).reduce((s, r) => s + r.balance, 0);
  const collectNext7 = receivables.filter((r) => {
    if (!r.dueDate) return false;
    const t = new Date(r.dueDate).getTime();
    return t >= now && t <= in7;
  }).reduce((s, r) => s + r.balance, 0);

  // Ventas del período (últimos 30 días) para estimar DSO.
  const since = new Date(now - 30 * 86_400_000);
  const recentSales = await prisma.invoice.aggregate({
    where: { companyId, type: 'SALES', status: { not: 'CANCELLED' }, issueDate: { gte: since } },
    _sum: { totalAmount: true },
  });

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    totalReceivable: round2(totalReceivable),
    overdue: round2(overdue),
    collectNext7: round2(collectNext7),
    countPending: receivables.length,
    dso: computeDSO(totalReceivable, Number(recentSales._sum.totalAmount ?? 0), 30),
  };
}

export async function getAging(companyId: string, customerId?: string) {
  return getArAging(companyId, customerId);
}

export interface CollectInput {
  amount: number;
  bankAccountId?: string;
  reference?: string;
  method?: string;
}

export async function collectReceivable(companyId: string, invoiceId: string, input: CollectInput, userId?: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId, type: 'SALES' } });
  if (!invoice) throw new Error('INVOICE_NOT_FOUND');

  const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
  const amount = Number(input.amount);
  if (!(amount > 0) || amount > balance + 0.005) throw new Error('VALIDATION: monto inválido (excede el saldo)');

  const cfg = await getErpConfig(companyId);
  assertCanExecutePayment(amount, await getActorRole(companyId, userId), cfg.finance);

  const order = invoice.salesOrderId
    ? await prisma.salesOrder.findFirst({ where: { id: invoice.salesOrderId }, select: { customerId: true } })
    : null;
  if (!order?.customerId) throw new Error('La factura no tiene cliente vinculado');

  const payment = await createPayment(companyId, {
    entityType: 'CUSTOMER',
    entityId: order.customerId,
    paymentMethod: (input.method as any) ?? 'BANK_TRANSFER',
    reference: input.reference,
    totalAmount: amount,
    notes: `Cobro CxC · ${invoice.number}`,
    applications: [{ invoiceId, amountApplied: amount }],
  }, userId);

  let journalEntryId: string | null = null;
  try {
    const entry = await createCustomerCollectionEntry(companyId, {
      amount, description: `Cobro factura ${invoice.number}`, entityId: invoiceId, userId,
    });
    journalEntryId = entry?.id ?? null;
  } catch (e) {
    logger.warn('[ar] createCustomerCollectionEntry failed (non-fatal)', { err: e });
  }

  let bankTransaction = null;
  if (input.bankAccountId) {
    const account = await prisma.bankAccount.findFirst({ where: { id: input.bankAccountId, companyId, isActive: true } });
    if (account) {
      bankTransaction = await prisma.bankTransaction.create({
        data: {
          companyId,
          bankAccountId: account.id,
          type: 'INGRESO',
          method: input.method ?? 'BANK_TRANSFER',
          amount: new Prisma.Decimal(amount),
          currency: account.currency,
          date: new Date(),
          reference: input.reference?.trim() || invoice.number,
          sourceType: 'AR_INVOICE',
          sourceId: invoiceId,
          journalEntryId,
          createdBy: userId,
        },
      });
    }
  }

  return { payment, bankTransaction };
}

// ── Ajuste de saldo (write-off) ──────────────────────────────────────────────
// Simétrico a ap.service.writeOffPayable: cierra un residual pequeño sin esperar un cobro
// que no va a llegar (descuento de último momento, saldo declarado incobrable). No hay
// complejidad de notas de crédito "sin enlazar" en CxC — el CreditNote de venta ya actualiza
// `invoice.paidAmount` directo al emitirse (credit-note.service), así que `totalAmount -
// paidAmount` ya es el saldo real; no hace falta un `getComputedBalance` como en CxP.
export interface WriteOffReceivableInput { amount: number; reason: string }

export async function writeOffReceivable(companyId: string, invoiceId: string, input: WriteOffReceivableInput, userId?: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId, type: 'SALES' }, include: { salesOrder: { include: { customer: true } } } });
  if (!invoice) throw new Error('INVOICE_NOT_FOUND');
  if (!input.reason?.trim()) throw new Error('VALIDATION: el motivo del ajuste es obligatorio');

  const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
  const amount = Number(input.amount);
  if (!(amount > 0) || amount > balance + 0.005) throw new Error('VALIDATION: el monto del ajuste debe ser mayor a cero y no exceder el saldo pendiente');

  const cfgWriteOff = await getErpConfig(companyId);
  assertCanExecutePayment(amount, await getActorRole(companyId, userId), cfgWriteOff.finance);

  const customerName = invoice.salesOrder?.customer?.razonSocial ?? invoice.salesOrder?.customer?.name;
  const entry = await createReceivableAdjustmentEntry(companyId, { amount, invoiceId, customerName, reason: input.reason, userId });

  const newPaid = Number(invoice.paidAmount) + amount;
  const fullyCovered = newPaid >= Number(invoice.totalAmount) - 0.005;
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { paidAmount: new Prisma.Decimal(newPaid), status: fullyCovered ? 'PAID' : 'PARTIAL' },
  });

  return { journalEntry: entry };
}

export interface StatementEntry {
  date: Date;
  type: 'CARGO' | 'COBRO' | 'NOTA_CREDITO' | 'NOTA_DEBITO';
  description: string;
  reference: string | null;
  debit: number;
  credit: number;
  balance: number;
  sourceId: string;
}

/**
 * Estado de cuenta del cliente: cronología de cargos (facturas), notas de crédito y cobros
 * con saldo acumulado — documento que se envía al cliente para cobranza/conciliación. Antes
 * solo existía el aging agregado por buckets, sin el detalle cronológico con saldo corrido.
 */
export async function getCustomerStatement(companyId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
  if (!customer) throw new Error('CUSTOMER_NOT_FOUND');

  const invoices = await prisma.invoice.findMany({
    where: { companyId, type: 'SALES', status: { not: 'CANCELLED' }, salesOrder: { customerId } },
    select: { id: true, number: true, issueDate: true, totalAmount: true },
    orderBy: { issueDate: 'asc' },
  });

  const creditNotes = await prisma.creditNote.findMany({
    where: { companyId, status: 'ISSUED', invoice: { salesOrder: { customerId } } },
    select: { id: true, number: true, createdAt: true, total: true },
    orderBy: { createdAt: 'asc' },
  });

  const debitNotes = await prisma.debitNote.findMany({
    where: { companyId, status: 'ISSUED', invoice: { salesOrder: { customerId } } },
    select: { id: true, number: true, createdAt: true, total: true },
    orderBy: { createdAt: 'asc' },
  });

  const payments = await prisma.payment.findMany({
    where: { companyId, entityType: 'CUSTOMER', entityId: customerId },
    select: { id: true, paymentNumber: true, totalAmount: true, createdAt: true, reference: true },
    orderBy: { createdAt: 'asc' },
  });

  type Row = { date: Date; type: StatementEntry['type']; description: string; reference: string | null; debit: number; credit: number; sourceId: string };
  const rows: Row[] = [];

  for (const inv of invoices) {
    rows.push({
      date: inv.issueDate,
      type: 'CARGO',
      description: `Factura ${inv.number}`,
      reference: inv.number,
      debit: Number(inv.totalAmount),
      credit: 0,
      sourceId: inv.id,
    });
  }
  for (const cn of creditNotes) {
    rows.push({
      date: cn.createdAt,
      type: 'NOTA_CREDITO',
      description: `Nota de crédito ${cn.number}`,
      reference: cn.number,
      debit: 0,
      credit: Number(cn.total),
      sourceId: cn.id,
    });
  }
  for (const dn of debitNotes) {
    rows.push({
      date: dn.createdAt,
      type: 'NOTA_DEBITO',
      description: `Nota de débito ${dn.number}`,
      reference: dn.number,
      debit: Number(dn.total),
      credit: 0,
      sourceId: dn.id,
    });
  }
  for (const p of payments) {
    rows.push({
      date: p.createdAt,
      type: 'COBRO',
      description: `Cobro ${p.paymentNumber}`,
      reference: p.reference,
      debit: 0,
      credit: Number(p.totalAmount),
      sourceId: p.id,
    });
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = 0;
  const entries: StatementEntry[] = rows.map((r) => {
    balance = Math.round((balance + r.debit - r.credit) * 100) / 100;
    return { ...r, balance };
  });

  return {
    customer: { id: customer.id, name: customer.razonSocial || customer.name },
    entries,
    finalBalance: balance,
  };
}

export async function getCreditStatus(companyId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
  if (!customer) throw new Error('CUSTOMER_NOT_FOUND');

  const openInvoices = await prisma.invoice.findMany({
    where: { companyId, type: 'SALES', status: { notIn: ['CANCELLED', 'PAID'] }, salesOrder: { customerId } },
    select: { totalAmount: true, paidAmount: true },
  });
  const openBalance = openInvoices.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0);
  const creditLimit = Number(customer.creditLimit ?? 0);

  return {
    customerId,
    creditLimit,
    openBalance: Math.round(openBalance * 100) / 100,
    available: Math.round((creditLimit - openBalance) * 100) / 100,
    overLimit: creditLimit > 0 && openBalance > creditLimit,
  };
}
