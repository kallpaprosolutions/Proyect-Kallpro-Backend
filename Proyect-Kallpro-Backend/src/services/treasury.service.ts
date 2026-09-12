import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { BANCOS_ECUADOR, sriDueDay, IESS_DUE_DAY } from '../data/bancosEcuador';
import { getErpConfig } from './erp-config.service';
import { createCustomerCollectionEntry, createTaxPaymentEntry, createSupplierPaymentEntry } from './journal.service';
import { payPeriod } from './payroll.service';
import { createPayment } from './payment.service';

const r2 = (n: number) => Math.round(n * 100) / 100;

export const TRANSACTION_METHODS = ['TRANSFERENCIA', 'CHEQUE', 'EFECTIVO', 'SWIFT', 'TARJETA'] as const;
export const SOURCE_TYPES = ['PAYROLL', 'AP_INVOICE', 'AR_INVOICE', 'TAX_SRI', 'TAX_IESS', 'MANUAL'] as const;

// ═══════════════════════════════════════════════════════════════
// CATÁLOGO Y CUENTAS BANCARIAS
// ═══════════════════════════════════════════════════════════════

export function getBankCatalog() {
  return BANCOS_ECUADOR;
}

export async function listBankAccounts(companyId: string) {
  const accounts = await prisma.bankAccount.findMany({
    where: { companyId },
    orderBy: [{ isActive: 'desc' }, { bankName: 'asc' }],
  });
  // Saldo = apertura + ingresos − egresos (movimientos no anulados)
  const sums = await prisma.bankTransaction.groupBy({
    by: ['bankAccountId', 'type'],
    where: { companyId, status: { not: 'ANULADO' } },
    _sum: { amount: true },
  });
  return accounts.map((a) => {
    const inflow = Number(sums.find((s) => s.bankAccountId === a.id && s.type === 'INGRESO')?._sum.amount ?? 0);
    const outflow = Number(sums.find((s) => s.bankAccountId === a.id && s.type === 'EGRESO')?._sum.amount ?? 0);
    return { ...a, balance: r2(Number(a.openingBalance) + inflow - outflow) };
  });
}

export interface BankAccountInput {
  bankCode: string; accountNumber: string; accountType?: string; currency?: string;
  swiftCode?: string; iban?: string; isForeign?: boolean; alias?: string; openingBalance?: number;
}

export async function createBankAccount(companyId: string, data: BankAccountInput) {
  const bank = BANCOS_ECUADOR.find((b) => b.code === data.bankCode);
  if (!bank) throw new Error('VALIDATION: banco no encontrado en el catálogo');
  if (!data.accountNumber?.trim()) throw new Error('VALIDATION: número de cuenta requerido');
  const isForeign = data.bankCode === 'EXTRANJERO' || !!data.isForeign;
  if (isForeign && !data.swiftCode?.trim()) throw new Error('VALIDATION: las cuentas en el exterior requieren código SWIFT/BIC');
  return prisma.bankAccount.create({
    data: {
      companyId,
      bankCode: bank.code,
      bankName: bank.name,
      accountNumber: data.accountNumber.trim(),
      accountType: data.accountType ?? 'CORRIENTE',
      currency: data.currency ?? 'USD',
      swiftCode: data.swiftCode?.trim() || bank.swift,
      iban: data.iban?.trim() || null,
      isForeign,
      alias: data.alias?.trim() || null,
      openingBalance: new Prisma.Decimal(data.openingBalance ?? 0),
    },
  });
}

export async function updateBankAccount(id: string, companyId: string, data: Partial<BankAccountInput> & { isActive?: boolean }) {
  const acc = await prisma.bankAccount.findFirst({ where: { id, companyId } });
  if (!acc) throw new Error('ACCOUNT_NOT_FOUND');
  return prisma.bankAccount.update({
    where: { id },
    data: {
      ...(data.alias !== undefined && { alias: data.alias?.trim() || null }),
      ...(data.swiftCode !== undefined && { swiftCode: data.swiftCode?.trim() || null }),
      ...(data.iban !== undefined && { iban: data.iban?.trim() || null }),
      ...(data.accountType != null && { accountType: data.accountType }),
      ...(data.openingBalance != null && { openingBalance: new Prisma.Decimal(data.openingBalance) }),
      ...(data.isActive !== undefined && { isActive: !!data.isActive }),
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// OBLIGACIONES (flujo de pagos) E INGRESOS ESPERADOS (flujo de cobros)
// ═══════════════════════════════════════════════════════════════

export interface Obligation {
  kind: 'AP_INVOICE' | 'PAYROLL' | 'TAX_SRI' | 'TAX_IESS';
  id: string;          // id de la entidad origen
  label: string;
  beneficiary: string;
  amount: number;
  dueDate: string;     // ISO
  overdue: boolean;
}

/** Saldo pendiente (haber − debe) de un pasivo por prefijo de cuenta. */
async function liabilityBalance(companyId: string, accountPrefix: string): Promise<number> {
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      accountCode: { startsWith: accountPrefix },
      entry: { companyId, status: { not: 'REVERSED' } },
    },
    select: { debit: true, credit: true },
  });
  return r2(lines.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0));
}

function nextMonthDue(day: number, from = new Date()): Date {
  // Obligaciones mensuales del período en curso: vencen el `day` del mes SIGUIENTE.
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, day));
}

export async function getObligations(companyId: string): Promise<Obligation[]> {
  const now = new Date();
  const obligations: Obligation[] = [];

  // 1) Cuentas por pagar: facturas de compra con saldo pendiente
  const apInvoices = await prisma.invoice.findMany({
    where: { companyId, type: 'PURCHASE', status: { notIn: ['PAID', 'CANCELLED'] } },
    orderBy: { dueDate: 'asc' },
  });
  for (const inv of apInvoices) {
    const outstanding = r2(Number(inv.totalAmount) - Number(inv.paidAmount));
    if (outstanding <= 0) continue;
    const due = inv.dueDate ?? inv.issueDate;
    obligations.push({
      kind: 'AP_INVOICE', id: inv.id,
      label: `Factura ${inv.number}`, beneficiary: inv.notes?.slice(0, 60) || 'Proveedor',
      amount: outstanding, dueDate: due.toISOString(), overdue: due < now,
    });
  }

  // 2) Nómina: períodos contabilizados y aún no pagados (neto pendiente)
  const payrollPeriods = await prisma.payrollPeriod.findMany({
    where: { companyId, status: 'POSTED' },
    include: { payslips: { select: { netPay: true } } },
  });
  for (const p of payrollPeriods) {
    const net = r2(p.payslips.reduce((s, x) => s + Number(x.netPay), 0));
    if (net <= 0) continue;
    const due = new Date(Date.UTC(p.year, p.month, 0)); // fin del mes del período
    obligations.push({
      kind: 'PAYROLL', id: p.id,
      label: `Nómina ${p.month}/${p.year}`, beneficiary: `${p.payslips.length} empleados`,
      amount: net, dueDate: due.toISOString(), overdue: due < now,
    });
  }

  // 3) Impuestos mensuales por pagar (saldos contables) con vencimiento normativo
  const cfg = await getErpConfig(companyId);
  const ruc: string | undefined = (cfg as any)?.company?.ruc;
  const [sriBalance, iessBalance] = await Promise.all([
    liabilityBalance(companyId, '2010701'),
    liabilityBalance(companyId, '2010703'),
  ]);
  if (sriBalance > 0) {
    const due = nextMonthDue(sriDueDay(ruc));
    obligations.push({
      kind: 'TAX_SRI', id: 'SRI',
      label: 'Impuestos SRI (IVA/retenciones por pagar)', beneficiary: 'Servicio de Rentas Internas',
      amount: sriBalance, dueDate: due.toISOString(), overdue: due < now,
    });
  }
  if (iessBalance > 0) {
    const due = nextMonthDue(IESS_DUE_DAY);
    obligations.push({
      kind: 'TAX_IESS', id: 'IESS',
      label: 'Planilla IESS (aportes, fondos, préstamos)', beneficiary: 'IESS',
      amount: iessBalance, dueDate: due.toISOString(), overdue: due < now,
    });
  }

  return obligations.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export interface Receivable {
  id: string; label: string; customer: string; amount: number; dueDate: string; overdue: boolean;
}

export async function getReceivables(companyId: string): Promise<Receivable[]> {
  const now = new Date();
  const invoices = await prisma.invoice.findMany({
    where: { companyId, type: 'SALES', status: { notIn: ['PAID', 'CANCELLED'] } },
    include: { salesOrder: { select: { customer: { select: { name: true } } } } },
    orderBy: { dueDate: 'asc' },
  });
  return invoices
    .map((inv) => ({
      id: inv.id,
      label: `Factura ${inv.number}`,
      customer: inv.salesOrder?.customer?.name ?? 'Cliente',
      amount: r2(Number(inv.totalAmount) - Number(inv.paidAmount)),
      dueDate: (inv.dueDate ?? inv.issueDate).toISOString(),
      overdue: (inv.dueDate ?? inv.issueDate) < now,
    }))
    .filter((x) => x.amount > 0);
}

/** Proyección semanal de caja: saldo bancario + cobros − pagos por fecha de vencimiento. */
export function buildCashflow(
  startingBalance: number,
  receivables: Array<{ amount: number; dueDate: string }>,
  obligations: Array<{ amount: number; dueDate: string }>,
  weeks = 8,
  from = new Date(),
) {
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const bucketOf = (iso: string) => {
    const d = new Date(iso);
    if (d < start) return 0; // vencido → cae en la primera semana
    const diff = Math.floor((d.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000));
    return Math.min(diff, weeks - 1);
  };
  const rows = Array.from({ length: weeks }, (_, i) => ({
    week: i + 1,
    startDate: new Date(start.getTime() + i * 7 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    inflow: 0, outflow: 0, net: 0, projected: 0,
  }));
  for (const rcv of receivables) rows[bucketOf(rcv.dueDate)].inflow = r2(rows[bucketOf(rcv.dueDate)].inflow + rcv.amount);
  for (const ob of obligations) rows[bucketOf(ob.dueDate)].outflow = r2(rows[bucketOf(ob.dueDate)].outflow + ob.amount);
  let running = startingBalance;
  for (const row of rows) {
    row.net = r2(row.inflow - row.outflow);
    running = r2(running + row.net);
    row.projected = running;
  }
  return rows;
}

export async function getTreasurySummary(companyId: string, weeks = 8) {
  const [accounts, obligations, receivables] = await Promise.all([
    listBankAccounts(companyId), getObligations(companyId), getReceivables(companyId),
  ]);
  const totalBalance = r2(accounts.filter((a) => a.isActive).reduce((s, a) => s + a.balance, 0));
  return {
    totalBalance,
    accounts,
    obligations,
    receivables,
    totalPayable: r2(obligations.reduce((s, o) => s + o.amount, 0)),
    totalReceivable: r2(receivables.reduce((s, x) => s + x.amount, 0)),
    cashflow: buildCashflow(totalBalance, receivables, obligations, weeks),
  };
}

// ═══════════════════════════════════════════════════════════════
// MOVIMIENTOS (registrar pago / cobro) — integrados con Contabilidad
// ═══════════════════════════════════════════════════════════════

export interface TransactionInput {
  bankAccountId: string;
  type: 'INGRESO' | 'EGRESO';
  method: string;
  amount: number;
  date?: string;
  reference?: string;
  beneficiary?: string;
  swiftCode?: string;      // requerido para method=SWIFT
  currency?: string;
  exchangeRate?: number;
  sourceType?: string;     // PAYROLL | AP_INVOICE | AR_INVOICE | TAX_SRI | TAX_IESS | MANUAL
  sourceId?: string;
  notes?: string;
}

export async function listTransactions(companyId: string, filters?: { bankAccountId?: string; type?: string }) {
  return prisma.bankTransaction.findMany({
    where: {
      companyId,
      ...(filters?.bankAccountId && { bankAccountId: filters.bankAccountId }),
      ...(filters?.type && { type: filters.type }),
    },
    include: { bankAccount: { select: { bankName: true, alias: true, accountNumber: true } } },
    orderBy: { date: 'desc' },
    take: 200,
  });
}

export async function registerTransaction(companyId: string, data: TransactionInput, userId?: string) {
  const account = await prisma.bankAccount.findFirst({ where: { id: data.bankAccountId, companyId, isActive: true } });
  if (!account) throw new Error('ACCOUNT_NOT_FOUND');
  const amount = r2(Number(data.amount));
  if (!(amount > 0)) throw new Error('VALIDATION: monto > 0 requerido');
  if (!(TRANSACTION_METHODS as readonly string[]).includes(data.method)) throw new Error('VALIDATION: método inválido');
  if (data.type !== 'INGRESO' && data.type !== 'EGRESO') throw new Error('VALIDATION: tipo inválido');
  const sourceType = data.sourceType ?? 'MANUAL';
  if (!(SOURCE_TYPES as readonly string[]).includes(sourceType)) throw new Error('VALIDATION: origen inválido');
  if (data.method === 'SWIFT' && !(data.swiftCode?.trim() || account.swiftCode)) {
    throw new Error('VALIDATION: pagos SWIFT requieren código BIC del banco destino');
  }

  // 1) Efecto en el módulo origen + asiento contable
  let journalEntryId: string | null = null;
  let beneficiary = data.beneficiary?.trim() || null;

  if (sourceType === 'PAYROLL') {
    if (!data.sourceId) throw new Error('VALIDATION: periodo de nómina requerido');
    const { journalEntry } = await payPeriod(data.sourceId, companyId, userId); // valida POSTED y marca PAID
    journalEntryId = journalEntry.id;
    beneficiary = beneficiary ?? 'Nómina de empleados';
  } else if (sourceType === 'AP_INVOICE') {
    if (!data.sourceId) throw new Error('VALIDATION: factura requerida');
    const inv = await prisma.invoice.findFirst({ where: { id: data.sourceId, companyId, type: 'PURCHASE' } });
    if (!inv) throw new Error('INVOICE_NOT_FOUND');
    await createPayment(companyId, {
      entityType: 'SUPPLIER', entityId: inv.id, paymentMethod: 'BANK_TRANSFER',
      reference: data.reference, totalAmount: amount,
      applications: [{ invoiceId: inv.id, amountApplied: amount }],
    }, userId);
    const entry = await createSupplierPaymentEntry(companyId, { amount, reference: inv.number, supplierName: beneficiary ?? undefined, userId });
    journalEntryId = entry?.id ?? null;
  } else if (sourceType === 'AR_INVOICE') {
    if (!data.sourceId) throw new Error('VALIDATION: factura requerida');
    const inv = await prisma.invoice.findFirst({ where: { id: data.sourceId, companyId, type: 'SALES' } });
    if (!inv) throw new Error('INVOICE_NOT_FOUND');
    await createPayment(companyId, {
      entityType: 'CUSTOMER', entityId: inv.id, paymentMethod: 'BANK_TRANSFER',
      reference: data.reference, totalAmount: amount,
      applications: [{ invoiceId: inv.id, amountApplied: amount }],
    }, userId);
    const entry = await createCustomerCollectionEntry(companyId, { amount, description: `Cobro factura ${inv.number}`, entityId: inv.id, userId });
    journalEntryId = entry?.id ?? null;
  } else if (sourceType === 'TAX_SRI' || sourceType === 'TAX_IESS') {
    const kind = sourceType === 'TAX_SRI' ? 'SRI' : 'IESS';
    const entry = await createTaxPaymentEntry(companyId, {
      kind, amount,
      description: kind === 'SRI' ? 'Pago impuestos SRI (IVA/retenciones)' : 'Pago planilla IESS',
      userId,
    });
    journalEntryId = entry?.id ?? null;
    beneficiary = beneficiary ?? (kind === 'SRI' ? 'Servicio de Rentas Internas' : 'IESS');
  }
  // MANUAL: solo movimiento bancario (conciliación posterior), sin asiento automático.

  // 2) Movimiento bancario vinculado
  return prisma.bankTransaction.create({
    data: {
      companyId,
      bankAccountId: account.id,
      type: data.type,
      method: data.method,
      amount: new Prisma.Decimal(amount),
      currency: data.currency ?? account.currency,
      exchangeRate: data.exchangeRate != null ? new Prisma.Decimal(data.exchangeRate) : null,
      date: data.date ? new Date(data.date) : new Date(),
      reference: data.reference?.trim() || null,
      beneficiary,
      swiftCode: data.swiftCode?.trim() || (data.method === 'SWIFT' ? account.swiftCode : null),
      sourceType,
      sourceId: data.sourceId ?? null,
      journalEntryId,
      notes: data.notes?.trim() || null,
      createdBy: userId,
    },
    include: { bankAccount: { select: { bankName: true, alias: true, accountNumber: true } } },
  });
}

// ═══════════════════════════════════════════════════════════════
// REPORTERÍA GERENCIAL — ingresos vs egresos (base contable)
// ═══════════════════════════════════════════════════════════════

/**
 * Serie mensual de ingresos (cuentas 4x) vs gastos (cuentas 5x) del libro
 * diario, para decisiones gerenciales en el módulo Financiero.
 */
export async function getIncomeExpenseReport(companyId: string, months = 12) {
  const from = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (months - 1), 1));
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      entry: { companyId, status: { not: 'REVERSED' }, entryDate: { gte: from } },
      OR: [{ accountCode: { startsWith: '4' } }, { accountCode: { startsWith: '5' } }],
    },
    select: { accountCode: true, debit: true, credit: true, entry: { select: { entryDate: true } } },
  });

  const byMonth = new Map<string, { income: number; expense: number }>();
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    byMonth.set(d.toISOString().slice(0, 7), { income: 0, expense: 0 });
  }
  for (const l of lines) {
    const key = l.entry.entryDate.toISOString().slice(0, 7);
    const bucket = byMonth.get(key);
    if (!bucket) continue;
    if (l.accountCode.startsWith('4')) bucket.income = r2(bucket.income + Number(l.credit) - Number(l.debit));
    else bucket.expense = r2(bucket.expense + Number(l.debit) - Number(l.credit));
  }
  const series = Array.from(byMonth.entries()).map(([month, v]) => ({
    month, income: v.income, expense: v.expense, net: r2(v.income - v.expense),
  }));
  const totals = series.reduce(
    (acc, s) => ({ income: r2(acc.income + s.income), expense: r2(acc.expense + s.expense) }),
    { income: 0, expense: 0 },
  );
  return { series, totals: { ...totals, net: r2(totals.income - totals.expense) } };
}

export async function voidTransaction(id: string, companyId: string) {
  const tx = await prisma.bankTransaction.findFirst({ where: { id, companyId } });
  if (!tx) throw new Error('TRANSACTION_NOT_FOUND');
  if (tx.status === 'ANULADO') throw new Error('ALREADY_VOIDED');
  if (tx.journalEntryId) throw new Error('HAS_JOURNAL_ENTRY'); // reversar primero el asiento en Contabilidad
  return prisma.bankTransaction.update({ where: { id }, data: { status: 'ANULADO' } });
}
