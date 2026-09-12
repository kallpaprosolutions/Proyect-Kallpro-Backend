/**
 * Cuentas por Pagar (CxP) — submódulo operativo dentro de Contabilidad.
 * Orquesta SriDocument (compras confirmadas), Payment/PaymentApplication (aplicación de
 * pagos, parciales o totales) y el asiento contable (journal.service). El aging y el
 * forecast semanal se reutilizan de finance/aging.service.ts (no se duplican).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { getPayables } from '../sri-document.service';
import { getApAging, getCashFlowForecast, weekIndexOf } from './aging.service';
import { createPayment } from '../payment.service';
import { createSupplierPaymentEntry, createPaymentAdjustmentEntry } from '../journal.service';
import { computeDueDate } from '../../utils/payment-terms';
import { getErpConfig } from '../erp-config.service';
import { assertCanExecutePayment } from '../payment-approval.service';
import {
  scorePayablesPriority, DEFAULT_PRIORITY_WEIGHTS,
  type PriorityInput, type PriorityResult,
} from './engines/payment-priority.engine';

/** Rol del usuario que ejecuta la acción (para el gate de aprobación por monto — Fase 4). */
async function getActorRole(companyId: string, userId?: string): Promise<string | null> {
  if (!userId) return null;
  const user = await prisma.user.findFirst({ where: { id: userId, companyId }, select: { role: true } });
  return user?.role ?? null;
}

export type ApPayable = Awaited<ReturnType<typeof getPayables>>[number];

export interface ApFilters {
  supplierId?: string;
  overdue?: boolean;
  search?: string; // número de doc o RUC
}

function applyFilters(payables: ApPayable[], filters: ApFilters): ApPayable[] {
  let list = payables.filter((p) => p.balance > 0.01);
  if (filters.supplierId) list = list.filter((p) => p.supplierId === filters.supplierId);
  if (filters.overdue) list = list.filter((p) => new Date(p.dueDate).getTime() < Date.now());
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    list = list.filter((p) => (p.numeroDoc ?? '').toLowerCase().includes(q) || (p.rucEmisor ?? '').toLowerCase().includes(q) || (p.supplierName ?? '').toLowerCase().includes(q));
  }
  return list;
}

export async function listPayables(companyId: string, filters: ApFilters = {}) {
  const all = await getPayables(companyId);
  return applyFilters(all, filters).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}

/** DPO (Days Payable Outstanding) — práctica estándar: (CxP promedio / Compras del período) × días. */
export function computeDPO(totalPayable: number, periodPurchases: number, periodDays: number): number {
  if (periodPurchases <= 0) return 0;
  return Math.round((totalPayable / periodPurchases) * periodDays * 10) / 10;
}

export async function getApKpis(companyId: string) {
  const payables = (await getPayables(companyId)).filter((p) => p.balance > 0.01);
  const now = Date.now();
  const in7 = now + 7 * 86_400_000;

  const totalPayable = payables.reduce((s, p) => s + p.balance, 0);
  const overdue = payables.filter((p) => new Date(p.dueDate).getTime() < now).reduce((s, p) => s + p.balance, 0);
  const dueNext7 = payables.filter((p) => {
    const t = new Date(p.dueDate).getTime();
    return t >= now && t <= in7;
  }).reduce((s, p) => s + p.balance, 0);

  // Compras del período (últimos 30 días) para estimar DPO.
  const since = new Date(now - 30 * 86_400_000);
  const recentPurchases = await prisma.sriDocument.aggregate({
    where: { companyId, status: 'CONFIRMED', tipoDocumento: { in: ['FACTURA', 'LIQUIDACION_COMPRA', 'NOTA_DEBITO'] }, fechaEmision: { gte: since } },
    _sum: { total: true },
  });

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    totalPayable: round2(totalPayable),
    overdue: round2(overdue),
    dueNext7: round2(dueNext7),
    countPending: payables.length,
    dpo: computeDPO(totalPayable, Number(recentPurchases._sum.total ?? 0), 30),
  };
}

export async function getAging(companyId: string, supplierId?: string) {
  const aging = await getApAging(companyId);
  if (!supplierId) return aging;
  return { ...aging, bySupplier: aging.bySupplier.filter((s) => s.supplierId === supplierId) };
}

export interface PayPayableInput {
  amount: number;
  bankAccountId?: string;
  reference?: string;
  method?: string;
}

/**
 * Saldo REAL de un documento: total − pagado − notas de crédito ya enlazadas (getPayables
 * neta las NC en cada llamada, sin persistir un "consumido"; por eso siempre refleja el
 * estado actual). `doc.total - doc.paidAmount` a secas ignora las NC — usarlo para validar
 * pagos/ajustes dejaría pagar o condonar más de lo que realmente se debe.
 */
async function getComputedBalance(companyId: string, sriDocumentId: string, fallback: number): Promise<number> {
  const payables = await getPayables(companyId);
  const found = payables.find((p) => p.id === sriDocumentId);
  return found ? found.balance : fallback;
}

export async function payPayable(companyId: string, sriDocumentId: string, input: PayPayableInput, userId?: string) {
  const doc = await prisma.sriDocument.findFirst({ where: { id: sriDocumentId, companyId }, include: { retentions: true, supplier: true } });
  if (!doc) throw new Error('SRI_DOCUMENT_NOT_FOUND');
  if (doc.status !== 'CONFIRMED') throw new Error('Solo se pueden pagar documentos confirmados');
  if (!doc.supplierId) throw new Error('El documento no tiene proveedor vinculado');

  const balance = await getComputedBalance(companyId, sriDocumentId, Number(doc.total) - Number(doc.paidAmount));
  const amount = Number(input.amount);
  if (!(amount > 0) || amount > balance + 0.005) throw new Error('VALIDATION: monto inválido (excede el saldo)');

  const cfg = await getErpConfig(companyId);
  assertCanExecutePayment(amount, await getActorRole(companyId, userId), cfg.finance);

  const payment = await createPayment(companyId, {
    entityType: 'SUPPLIER',
    entityId: doc.supplierId,
    paymentMethod: (input.method as any) ?? 'BANK_TRANSFER',
    reference: input.reference,
    totalAmount: amount,
    notes: `Pago CxP · ${doc.numeroDoc ?? doc.id}`,
    applications: [{ sriDocumentId, amountApplied: amount }],
  }, userId);

  let journalEntryId: string | null = null;
  try {
    const retTotal = (doc.retentions ?? []).reduce((s, r) => s + Number(r.valor ?? 0), 0);
    const neto = Math.max(0, amount - (amount >= balance - 0.005 ? retTotal : 0));
    const entry = await createSupplierPaymentEntry(companyId, {
      amount: neto, reference: doc.numeroDoc ?? undefined, supplierName: doc.razonSocialEmisor, userId,
    });
    journalEntryId = entry?.id ?? null;
  } catch (e) {
    logger.warn('[ap] createSupplierPaymentEntry failed (non-fatal)', { err: e });
  }

  // Movimiento bancario vinculado (cierra la brecha tesorería-vs-AP: antes solo Invoice
  // type=PURCHASE generaba BankTransaction, nunca SriDocument).
  let bankTransaction = null;
  if (input.bankAccountId) {
    const account = await prisma.bankAccount.findFirst({ where: { id: input.bankAccountId, companyId, isActive: true } });
    if (account) {
      bankTransaction = await prisma.bankTransaction.create({
        data: {
          companyId,
          bankAccountId: account.id,
          type: 'EGRESO',
          method: input.method ?? 'BANK_TRANSFER',
          amount: new Prisma.Decimal(amount),
          currency: account.currency,
          date: new Date(),
          reference: input.reference?.trim() || doc.numeroDoc || null,
          beneficiary: doc.razonSocialEmisor ?? doc.supplier?.razonSocial ?? null,
          sourceType: 'AP_INVOICE',
          sourceId: sriDocumentId,
          journalEntryId,
          createdBy: userId,
        },
      });
    }
  }

  return { payment, bankTransaction };
}

export async function getRetentionsBySupplier(companyId: string, supplierId?: string) {
  const docs = await prisma.sriDocument.findMany({
    where: { companyId, status: 'CONFIRMED', ...(supplierId ? { supplierId } : {}) },
    select: {
      id: true, numeroDoc: true, fechaEmision: true, supplierId: true,
      supplier: { select: { razonSocial: true, name: true } },
      retentions: true,
    },
    orderBy: { fechaEmision: 'desc' },
    take: 500,
  });
  return docs
    .filter((d) => d.retentions.length > 0)
    .map((d) => ({
      docId: d.id,
      numeroDoc: d.numeroDoc,
      fechaEmision: d.fechaEmision,
      supplierId: d.supplierId,
      supplierName: d.supplier?.razonSocial ?? d.supplier?.name ?? null,
      retentions: d.retentions.map((r) => ({ tipo: r.tipo, codigo: r.codigo, baseImponible: Number(r.baseImponible), porcentaje: Number(r.porcentaje), valor: Number(r.valor) })),
    }));
}

export async function getSupplierCreditNotes(companyId: string, supplierId?: string) {
  return prisma.sriDocument.findMany({
    where: { companyId, status: 'CONFIRMED', tipoDocumento: { in: ['NOTA_CREDITO', 'NOTA_DEBITO'] }, ...(supplierId ? { supplierId } : {}) },
    include: { supplier: { select: { razonSocial: true, name: true } } },
    orderBy: { fechaEmision: 'desc' },
    take: 200,
  });
}

// ── Aplicación manual de notas de crédito ────────────────────────────────────
// getPayables (sri-document.service) neta automáticamente las NC de compra contra el
// documento que referencian (docModificadoNumero, viene del XML) o, si no vienen enlazadas,
// contra el primer documento del proveedor con saldo (orden de emisión). Ese "primero que
// encuentre" no siempre es lo que el contador quiere: puede llegar una NC sin XML enlazado,
// o el enlace automático apuntar al documento equivocado. Enlazar/desenlazar manualmente
// reutiliza EXACTAMENTE la misma lógica de netopen ya probada — solo cambia a qué factura
// apunta docModificadoNumero, sin nuevas tablas ni cálculos duplicados.

/** Notas de crédito de compra confirmadas SIN enlazar a un documento específico. */
export async function getUnlinkedCreditNotes(companyId: string, supplierId: string) {
  return prisma.sriDocument.findMany({
    where: { companyId, supplierId, status: 'CONFIRMED', tipoDocumento: 'NOTA_CREDITO', docModificadoNumero: null },
    select: { id: true, numeroDoc: true, fechaEmision: true, total: true },
    orderBy: { fechaEmision: 'desc' },
  });
}

export async function linkCreditNoteToDocument(companyId: string, creditNoteId: string, sriDocumentId: string) {
  const [nc, target] = await Promise.all([
    prisma.sriDocument.findFirst({ where: { id: creditNoteId, companyId, tipoDocumento: 'NOTA_CREDITO', status: 'CONFIRMED' } }),
    prisma.sriDocument.findFirst({ where: { id: sriDocumentId, companyId, status: 'CONFIRMED' } }),
  ]);
  if (!nc) throw new Error('CREDIT_NOTE_NOT_FOUND');
  if (!target) throw new Error('SRI_DOCUMENT_NOT_FOUND');
  if (nc.supplierId !== target.supplierId) throw new Error('VALIDATION: la nota de crédito y el documento deben ser del mismo proveedor');
  if (!target.numeroDoc) throw new Error('VALIDATION: el documento destino no tiene número — no se puede enlazar');

  return prisma.sriDocument.update({
    where: { id: creditNoteId },
    data: { docModificadoTipo: target.tipoDocumento, docModificadoNumero: target.numeroDoc, docModificadoFecha: target.fechaEmision },
  });
}

export async function unlinkCreditNote(companyId: string, creditNoteId: string) {
  const nc = await prisma.sriDocument.findFirst({ where: { id: creditNoteId, companyId, tipoDocumento: 'NOTA_CREDITO' } });
  if (!nc) throw new Error('CREDIT_NOTE_NOT_FOUND');
  return prisma.sriDocument.update({
    where: { id: creditNoteId },
    data: { docModificadoTipo: null, docModificadoNumero: null, docModificadoFecha: null },
  });
}

// ── Ajuste de saldo (write-off) ──────────────────────────────────────────────
// Cierra un residual pequeño (redondeo, descuento negociado de último momento) que el
// proveedor condona, sin dejarlo perpetuamente "pendiente" en el aging. A diferencia de
// payPayable, NO mueve caja/bancos: solo cancela el pasivo contra una ganancia — por eso
// es una función separada, no un `bankAccountId` opcional de payPayable.
export interface WriteOffInput { amount: number; reason: string }

export async function writeOffPayable(companyId: string, sriDocumentId: string, input: WriteOffInput, userId?: string) {
  const doc = await prisma.sriDocument.findFirst({ where: { id: sriDocumentId, companyId }, include: { supplier: true } });
  if (!doc) throw new Error('SRI_DOCUMENT_NOT_FOUND');
  if (doc.status !== 'CONFIRMED') throw new Error('Solo se pueden ajustar documentos confirmados');
  if (!input.reason?.trim()) throw new Error('VALIDATION: el motivo del ajuste es obligatorio');

  const balance = await getComputedBalance(companyId, sriDocumentId, Number(doc.total) - Number(doc.paidAmount));
  const amount = Number(input.amount);
  if (!(amount > 0) || amount > balance + 0.005) throw new Error('VALIDATION: el monto del ajuste debe ser mayor a cero y no exceder el saldo pendiente');

  const cfgWriteOff = await getErpConfig(companyId);
  assertCanExecutePayment(amount, await getActorRole(companyId, userId), cfgWriteOff.finance);

  const entry = await createPaymentAdjustmentEntry(companyId, {
    amount, sriDocumentId, supplierName: doc.razonSocialEmisor ?? doc.supplier?.razonSocial ?? undefined, reason: input.reason, userId,
  });

  const newPaid = Number(doc.paidAmount) + amount;
  const fullyCovered = newPaid >= Number(doc.total) - 0.005;
  await prisma.sriDocument.update({
    where: { id: sriDocumentId },
    data: { paidAmount: new Prisma.Decimal(newPaid), paymentStatus: fullyCovered ? 'PAID' : 'PARTIAL', paidAt: fullyCovered ? new Date() : null },
  });

  return { journalEntry: entry };
}

export interface StatementEntry {
  date: Date;
  type: 'CARGO' | 'PAGO' | 'NOTA_CREDITO';
  description: string;
  reference: string | null;
  debit: number;
  credit: number;
  balance: number;
  sourceId: string;
}

/**
 * Estado de cuenta del proveedor: cronología de cargos (facturas), notas de crédito y pagos
 * con saldo acumulado — lo que el contador envía/coteja contra el estado de cuenta que manda
 * el proveedor para conciliar. No existía: solo había aging agregado por buckets.
 */
export async function getSupplierStatement(companyId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, companyId } });
  if (!supplier) throw new Error('SUPPLIER_NOT_FOUND');

  const docs = await prisma.sriDocument.findMany({
    where: { companyId, supplierId, status: 'CONFIRMED' },
    select: { id: true, numeroDoc: true, tipoDocumento: true, fechaEmision: true, total: true },
    orderBy: { fechaEmision: 'asc' },
  });

  const payments = await prisma.payment.findMany({
    where: { companyId, entityType: 'SUPPLIER', entityId: supplierId },
    select: { id: true, paymentNumber: true, totalAmount: true, createdAt: true, reference: true },
    orderBy: { createdAt: 'asc' },
  });

  type Row = { date: Date; type: StatementEntry['type']; description: string; reference: string | null; debit: number; credit: number; sourceId: string };
  const rows: Row[] = [];

  for (const d of docs) {
    const isCredit = d.tipoDocumento === 'NOTA_CREDITO';
    rows.push({
      date: d.fechaEmision ?? new Date(),
      type: isCredit ? 'NOTA_CREDITO' : 'CARGO',
      description: isCredit ? `Nota de crédito ${d.numeroDoc ?? ''}` : `Factura ${d.numeroDoc ?? d.id}`,
      reference: d.numeroDoc,
      debit: isCredit ? 0 : Number(d.total),
      credit: isCredit ? Number(d.total) : 0,
      sourceId: d.id,
    });
  }
  for (const p of payments) {
    rows.push({
      date: p.createdAt,
      type: 'PAGO',
      description: `Pago ${p.paymentNumber}`,
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
    supplier: { id: supplier.id, name: supplier.razonSocial || supplier.name, ruc: supplier.ruc },
    entries,
    finalBalance: balance,
  };
}

// ── Fase 3: Programación y priorización de pagos ────────────────────────────
// Ver payment-priority.engine.ts para el motor puro. Aquí se ensamblan sus insumos reales:
// aging (días vencido), SupplierScore (importancia), y getCashFlowForecast (semanas con
// caja proyectada negativa) — sin inventar ningún dato nuevo.

const FORECAST_WEEKS = 8;

export interface PayableWithPriority {
  id: string;
  numeroDoc: string | null;
  supplierId: string | null;
  supplierName: string | null;
  dueDate: Date;
  daysOverdue: number;
  balance: number;
  priority: PriorityResult;
}

export async function getPaymentPriority(companyId: string): Promise<{ items: PayableWithPriority[]; weights: typeof DEFAULT_PRIORITY_WEIGHTS; tightCashWeeks: number[] }> {
  const payables = (await getPayables(companyId)).filter((p) => p.balance > 0.01);
  if (payables.length === 0) return { items: [], weights: DEFAULT_PRIORITY_WEIGHTS, tightCashWeeks: [] };

  const supplierIds = [...new Set(payables.map((p) => p.supplierId).filter((id): id is string => !!id))];
  const [scores, forecast] = await Promise.all([
    supplierIds.length > 0
      ? prisma.supplierScore.findMany({ where: { supplierId: { in: supplierIds } }, select: { supplierId: true, totalScore: true } })
      : Promise.resolve([]),
    getCashFlowForecast(companyId, FORECAST_WEEKS),
  ]);
  const scoreMap = new Map(scores.map((s) => [s.supplierId, Number(s.totalScore)]));
  const tightCashWeeks = new Set(forecast.weeks.filter((w) => w.projectedCash < 0).map((w) => w.week));

  const now = new Date();
  const maxBalance = Math.max(...payables.map((p) => p.balance));

  const inputs: PriorityInput[] = payables.map((p) => ({
    id: p.id,
    daysOverdue: Math.floor((now.getTime() - new Date(p.dueDate).getTime()) / 86_400_000),
    balance: p.balance,
    supplierScore: p.supplierId ? scoreMap.get(p.supplierId) ?? null : null,
    cashFlowWeek: weekIndexOf(p.dueDate, FORECAST_WEEKS, now) + 1, // +1: alinea con forecast.weeks[].week (1-based)
  }));

  const scored = scorePayablesPriority(inputs, maxBalance, tightCashWeeks);

  const items: PayableWithPriority[] = payables
    .map((p) => ({
      id: p.id,
      numeroDoc: p.numeroDoc,
      supplierId: p.supplierId,
      supplierName: p.supplierName,
      dueDate: p.dueDate,
      daysOverdue: Math.max(0, Math.floor((now.getTime() - new Date(p.dueDate).getTime()) / 86_400_000)),
      balance: p.balance,
      priority: scored.get(p.id)!,
    }))
    .sort((a, b) => b.priority.score - a.priority.score);

  return { items, weights: DEFAULT_PRIORITY_WEIGHTS, tightCashWeeks: [...tightCashWeeks].sort((a, b) => a - b) };
}

export interface SchedulePaymentInput {
  scheduledDate: Date;
  amount: number;
  bankAccountId?: string;
  notes?: string;
}

export async function schedulePayment(companyId: string, sriDocumentId: string, input: SchedulePaymentInput, userId?: string) {
  const doc = await prisma.sriDocument.findFirst({ where: { id: sriDocumentId, companyId } });
  if (!doc) throw new Error('SRI_DOCUMENT_NOT_FOUND');
  if (doc.status !== 'CONFIRMED') throw new Error('Solo se pueden programar pagos de documentos confirmados');

  const balance = Number(doc.total) - Number(doc.paidAmount);
  if (!(input.amount > 0) || input.amount > balance + 0.005) throw new Error('VALIDATION: monto inválido (excede el saldo)');

  const existing = await prisma.paymentSchedule.aggregate({
    where: { sriDocumentId, status: 'SCHEDULED' },
    _sum: { amount: true },
  });
  const alreadyScheduled = Number(existing._sum.amount ?? 0);
  if (alreadyScheduled + input.amount > balance + 0.005) {
    throw new Error(`VALIDATION: ya hay ${alreadyScheduled.toFixed(2)} programado para este documento; excedería el saldo`);
  }

  if (input.bankAccountId) {
    const account = await prisma.bankAccount.findFirst({ where: { id: input.bankAccountId, companyId, isActive: true } });
    if (!account) throw new Error('VALIDATION: cuenta bancaria no encontrada');
  }

  // La prioridad se calcula sobre TODO el lote actual y se congela al programar — el
  // usuario ve por qué se sugirió al momento de decidir, aunque el lote cambie después.
  const { items } = await getPaymentPriority(companyId);
  const current = items.find((i) => i.id === sriDocumentId);
  const priorityScore = current?.priority.score ?? 0;
  const priorityLevel = current?.priority.level ?? 'BAJA';

  return prisma.paymentSchedule.create({
    data: {
      companyId,
      sriDocumentId,
      scheduledDate: input.scheduledDate,
      amount: new Prisma.Decimal(input.amount),
      bankAccountId: input.bankAccountId,
      priorityScore,
      priorityLevel,
      notes: input.notes,
      createdBy: userId,
    },
  });
}

export interface ScheduledFilters {
  status?: string;
}

export async function listScheduledPayments(companyId: string, filters: ScheduledFilters = {}) {
  const rows = await prisma.paymentSchedule.findMany({
    where: { companyId, status: filters.status ?? 'SCHEDULED' },
    include: {
      sriDocument: { select: { numeroDoc: true, total: true, fechaEmision: true, supplier: { select: { razonSocial: true, name: true, paymentTerms: true } } } },
      bankAccount: { select: { alias: true, bankCode: true, accountNumber: true } },
    },
    orderBy: [{ priorityScore: 'desc' }, { scheduledDate: 'asc' }],
  });
  // dueDate no vive en SriDocument, se calcula igual que en getPayables (fecha emisión + plazo del proveedor).
  return rows.map((r) => ({
    ...r,
    sriDocument: { ...r.sriDocument, dueDate: computeDueDate(r.sriDocument.fechaEmision, r.sriDocument.supplier?.paymentTerms) },
  }));
}

export async function cancelScheduledPayment(companyId: string, id: string) {
  const row = await prisma.paymentSchedule.findFirst({ where: { id, companyId } });
  if (!row) throw new Error('PAYMENT_SCHEDULE_NOT_FOUND');
  if (row.status !== 'SCHEDULED') throw new Error('Solo se pueden cancelar pagos aún no procesados');
  return prisma.paymentSchedule.update({ where: { id }, data: { status: 'CANCELLED' } });
}

export interface ProcessResult {
  processed: { scheduleId: string; sriDocumentId: string; paymentId: string }[];
  failed: { scheduleId: string; sriDocumentId: string; error: string }[];
}

/**
 * Procesa uno o varios pagos programados: ejecuta el pago real (payPayable, con su asiento
 * contable) y marca la fila como PROCESSED. Si `ids` se omite, procesa TODOS los programados
 * con fecha vencida o de hoy — no toca los programados a futuro ("Procesar todo" respeta el
 * plan, no lo adelanta). Cada documento se procesa independiente: si uno falla, los demás
 * continúan (se reporta en `failed`, no se aborta el lote completo).
 */
export async function processScheduledPayments(companyId: string, ids: string[] | undefined, userId?: string): Promise<ProcessResult> {
  const where = ids && ids.length > 0
    ? { id: { in: ids }, companyId, status: 'SCHEDULED' }
    : { companyId, status: 'SCHEDULED', scheduledDate: { lte: new Date() } };

  const rows = await prisma.paymentSchedule.findMany({ where });

  const result: ProcessResult = { processed: [], failed: [] };
  for (const row of rows) {
    try {
      const { payment } = await payPayable(companyId, row.sriDocumentId, {
        amount: Number(row.amount),
        bankAccountId: row.bankAccountId ?? undefined,
        reference: `Pago programado ${row.id}`,
      }, userId);
      if (!payment) throw new Error('No se pudo crear el pago');
      await prisma.paymentSchedule.update({
        where: { id: row.id },
        data: { status: 'PROCESSED', processedPaymentId: payment.id, processedAt: new Date() },
      });
      result.processed.push({ scheduleId: row.id, sriDocumentId: row.sriDocumentId, paymentId: payment.id });
    } catch (e: any) {
      logger.warn('[ap] processScheduledPayments failed for one row', { scheduleId: row.id, err: e });
      result.failed.push({ scheduleId: row.id, sriDocumentId: row.sriDocumentId, error: e?.message ?? 'Error desconocido' });
    }
  }
  return result;
}
