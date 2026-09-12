import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { getTrialBalance } from './finance/accounting.service';
import { createInvoicePaymentEntry } from './journal.service';
import { getNextDocumentNumber } from '../utils/sequence.helper';
import { logFieldChange } from './chatter.service';
// ============================================================
// FACTURAS
// ============================================================

export async function getInvoices(companyId: string, type?: string) {
  return prisma.invoice.findMany({
    where: { companyId, ...(type ? { type } : {}) },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getInvoiceById(id: string, companyId: string) {
  return prisma.invoice.findFirst({
    where: { id, companyId },
    include: { items: true, withholdings: true },
  });
}

export async function createInvoice(companyId: string, data: {
  type: 'SALES' | 'PURCHASE';
  dueDate?: Date;
  notes?: string;
  items: { description: string; quantity: number; unitPrice: number }[];
}) {
  const totalAmount = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  // Prefijo y contador propios por tipo: FAC- (venta manual) / OCP- (compra manual).
  // Distinto de SALES_INVOICE (FAC-V-), que numera la factura auto del pedido de venta.
  const prefix = data.type === 'SALES' ? 'FAC-' : 'OCP-';
  const docType = `FINANCIAL_INVOICE_${data.type}`;

  return prisma.$transaction(async (tx) => {
    const number = await getNextDocumentNumber(tx, companyId, docType, prefix);
    return tx.invoice.create({
      data: {
        companyId,
        number,
        type: data.type,
        totalAmount: new Prisma.Decimal(totalAmount),
        dueDate: data.dueDate,
        notes: data.notes,
        items: {
          create: data.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: new Prisma.Decimal(i.unitPrice),
            lineTotal: new Prisma.Decimal(i.quantity * i.unitPrice),
          })),
        },
      },
      include: { items: true },
    });
  });
}

export async function updateInvoiceStatus(id: string, companyId: string, status: string, paidAmount?: number, userId?: string) {
  // findFirst por companyId antes del update: acota el `id` al tenant correcto (regla 1 —
  // el update por solo `id` no filtraba por empresa) y de paso da el estado "antes" para el log.
  const current = await prisma.invoice.findFirst({ where: { id, companyId }, select: { status: true } });
  if (!current) throw new Error('INVOICE_NOT_FOUND');
  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status,
      ...(paidAmount !== undefined ? { paidAmount: new Prisma.Decimal(paidAmount) } : {}),
    },
  });
  // Asiento de cobro (venta) / pago (compra) al marcar PAID (non-blocking)
  if (status === 'PAID') {
    try { await createInvoicePaymentEntry(companyId, id); }
    catch (e) { logger.warn('[financial] createInvoicePaymentEntry failed (non-fatal)', { err: e }); }
  }
  if (userId) await logFieldChange(companyId, userId, 'INVOICE', id, 'STATUS', current.status, status);
  return updated;
}

// ============================================================
// KPIs FINANCIEROS
// ============================================================

export async function getFinancialKPIs(companyId: string) {
  const [salesInvoices, purchaseInvoices] = await Promise.all([
    prisma.invoice.findMany({ where: { companyId, type: 'SALES' } }),
    prisma.invoice.findMany({ where: { companyId, type: 'PURCHASE' } }),
  ]);

  const totalSales = salesInvoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalCollected = salesInvoices.reduce((s, i) => s + Number(i.paidAmount), 0);
  const accountsReceivable = totalSales - totalCollected;

  const totalPurchases = purchaseInvoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid = purchaseInvoices.reduce((s, i) => s + Number(i.paidAmount), 0);
  const accountsPayable = totalPurchases - totalPaid;

  const overdueReceivable = salesInvoices
    .filter((i) => i.status !== 'PAID' && i.dueDate && new Date(i.dueDate) < new Date())
    .reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0);

  const overduePayable = purchaseInvoices
    .filter((i) => i.status !== 'PAID' && i.dueDate && new Date(i.dueDate) < new Date())
    .reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0);

  // ── Datos del mayor contable (si existen asientos) ──
  // Sustituyen a las cifras estimadas por facturas cuando la contabilidad
  // está sincronizada; si no hay asientos, se mantiene el cálculo anterior.
  let source: 'ledger' | 'invoices' = 'invoices';
  let finalSales = totalSales;
  let finalAR = accountsReceivable;
  let finalPurchases = totalPurchases;
  let finalAP = accountsPayable;
  let ledgerCash = 0, ledgerCOGS = 0, ledgerInventory = 0;
  try {
    const tb = await getTrialBalance(companyId);
    const bal = (code: string) => tb.find((r) => r.code === code)?.balance ?? 0;
    const hasLedger = tb.length > 0 && tb.some((r) => r.debit + r.credit > 0);
    if (hasLedger) {
      source = 'ledger';
      finalSales = bal('4100');           // Ingresos por ventas (acumulado)
      finalAR = bal('1130');              // Cuentas por cobrar
      finalAP = bal('2110');              // Cuentas por pagar
      ledgerCash = bal('1100');
      ledgerCOGS = bal('5100');
      ledgerInventory = bal('1110');
      // Compras netas ≈ inventario + COGS reconocido en el periodo
      finalPurchases = ledgerInventory + ledgerCOGS || totalPurchases;
    }
  } catch { /* sin contabilidad: usar fallback por facturas */ }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    source,
    totalSales: r2(finalSales),
    totalCollected: r2(totalCollected),
    accountsReceivable: r2(finalAR),
    totalPurchases: r2(finalPurchases),
    totalPaid: r2(totalPaid),
    accountsPayable: r2(finalAP),
    overdueReceivable: r2(overdueReceivable),
    overduePayable: r2(overduePayable),
    netCashFlow: r2(totalCollected - totalPaid),
    // extras del mayor (informativos)
    ledgerCash: r2(ledgerCash),
    ledgerCOGS: r2(ledgerCOGS),
    ledgerInventory: r2(ledgerInventory),
  };
}
