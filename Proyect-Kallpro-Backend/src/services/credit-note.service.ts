import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getNextDocumentNumber } from '../utils/sequence.helper';
import { registerMovement } from './inventory.service';
import {
  createCreditNoteSalesReversal,
  createCreditNoteCogsReversal,
  createCreditNoteWithholdingReversal,
} from './journal.service';
import { logger } from '../lib/logger';

/**
 * Notas de Crédito de venta (Sprint 4).
 *
 * Anula total o parcialmente una factura de venta: revierte ingresos, IVA, COGS (si la
 * mercancía vuelve a stock), reservas y retenciones (proporcional), y deja un documento NC-.
 * El stock y los asientos se procesan como en `invoiceSalesOrder` (efectos posteriores
 * no-fatales); el documento + cap de cantidades se asienta en una `$transaction`.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CreditNoteLineInput {
  salesOrderItemId: string;
  quantity: number;
}

export async function createCreditNote(
  companyId: string,
  invoiceId: string,
  data: { reason: string; restock?: boolean; lines: CreditNoteLineInput[] },
  createdBy?: string,
) {
  const restock = data.restock !== false; // default: devuelve a stock

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId, type: 'SALES' },
    include: {
      withholdings: true,
      salesOrder: { include: { items: { include: { product: true } } } },
    },
  });
  if (!invoice) throw new Error('INVOICE_NOT_FOUND');
  if (invoice.status === 'CANCELLED') throw new Error('INVOICE_CANCELLED');
  if (!invoice.salesOrder) throw new Error('INVOICE_NO_ORDER'); // facturas manuales sin pedido: NC no soportada aquí

  const orderItems = invoice.salesOrder.items;

  // Construir/validar líneas contra el tope (invoicedQty − creditedQty)
  let subtotal = 0, taxAmount = 0, cogsTotal = 0;
  const cnItems = data.lines.map((l) => {
    const oi = orderItems.find((x) => x.id === l.salesOrderItemId);
    if (!oi) throw new Error('ORDER_ITEM_NOT_FOUND');
    const qty = Number(l.quantity);
    if (qty <= 0) throw new Error('INVALID_QTY');
    const creditable = Number(oi.invoicedQty) - Number(oi.creditedQty);
    if (qty > creditable + 1e-6) throw new Error('NC_EXCEEDS_INVOICED');
    const sub = qty * Number(oi.unitPrice) * (1 - Number(oi.discount) / 100);
    const tax = sub * (Number(oi.taxRate) / 100);
    const cogsUnit = Number(oi.product?.avgCost ?? 0);
    subtotal += sub; taxAmount += tax; cogsTotal += qty * cogsUnit;
    return { oi, qty, cogsUnit };
  });
  if (cnItems.length === 0) throw new Error('NO_LINES');
  const total = subtotal + taxAmount;

  // Reverso de retención: proporcional al total acreditado vs. total de la factura
  const invoiceTotal = Number(invoice.totalAmount);
  const ratio = invoiceTotal > 0 ? Math.min(1, total / invoiceTotal) : 0;
  const retRenta = round2(invoice.withholdings.filter((w) => w.tipo === 'RENTA').reduce((s, w) => s + Number(w.valor), 0) * ratio);
  const retIva = round2(invoice.withholdings.filter((w) => w.tipo === 'IVA').reduce((s, w) => s + Number(w.valor), 0) * ratio);
  const withheldReversed = round2(retRenta + retIva);

  const creditNote = await prisma.$transaction(async (tx) => {
    const number = await getNextDocumentNumber(tx, companyId, 'CREDIT_NOTE', 'NC-');
    const cn = await tx.creditNote.create({
      data: {
        companyId, number, invoiceId, reason: data.reason, restock,
        subtotal: new Prisma.Decimal(round2(subtotal)),
        taxAmount: new Prisma.Decimal(round2(taxAmount)),
        total: new Prisma.Decimal(round2(total)),
        withheldReversed: new Prisma.Decimal(withheldReversed),
        createdBy,
        items: {
          create: cnItems.map(({ oi, qty, cogsUnit }) => ({
            salesOrderItemId: oi.id,
            productId: oi.productId,
            warehouseId: oi.warehouseId,
            description: oi.description || '',
            quantity: new Prisma.Decimal(qty),
            unitPrice: oi.unitPrice,
            discount: oi.discount,
            taxRate: oi.taxRate,
            cogsUnit: new Prisma.Decimal(cogsUnit),
          })),
        },
      },
    });

    for (const { oi, qty } of cnItems) {
      await tx.salesOrderItem.update({ where: { id: oi.id }, data: { creditedQty: { increment: qty } } });
    }

    // Reduce el saldo cobrable de la factura (paidAmount sube por el neto acreditado).
    const newPaid = Number(invoice.paidAmount) + (round2(total) - withheldReversed);
    const creditedSoFar = (await tx.creditNote.aggregate({ where: { invoiceId }, _sum: { total: true } }))._sum.total;
    const fullyCredited = Number(creditedSoFar ?? 0) >= invoiceTotal - 1e-6;
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: new Prisma.Decimal(round2(newPaid)),
        ...(fullyCredited ? { status: 'CANCELLED' } : {}),
      },
    });

    return cn;
  });

  // ── Efectos posteriores (no-fatales, mismo patrón que invoiceSalesOrder) ──
  const ref = `${creditNote.number} · Factura ${invoice.number}`;

  if (restock) {
    for (const { oi, qty, cogsUnit } of cnItems) {
      if (!oi.warehouseId) continue;
      try {
        await registerMovement(companyId, {
          productId: oi.productId, warehouseId: oi.warehouseId, type: 'IN',
          quantity: qty, unitCost: cogsUnit, reference: creditNote.number,
          notes: `Devolución NC ${creditNote.number}`, createdBy,
        });
      } catch (e) { logger.warn('[credit-note] reingreso de stock falló (no-fatal)', { err: e }); }
    }
    try { await createCreditNoteCogsReversal(companyId, { description: ref, entityId: creditNote.id, cogs: cogsTotal }); }
    catch (e) { logger.warn('[credit-note] reverso COGS falló (no-fatal)', { err: e }); }
  }

  try { await createCreditNoteSalesReversal(companyId, { description: ref, entityId: creditNote.id, subtotal, tax: taxAmount, total }); }
  catch (e) { logger.warn('[credit-note] reverso venta falló (no-fatal)', { err: e }); }

  if (withheldReversed > 0) {
    try { await createCreditNoteWithholdingReversal(companyId, { description: ref, entityId: creditNote.id, retRenta, retIva }); }
    catch (e) { logger.warn('[credit-note] reverso retención falló (no-fatal)', { err: e }); }
  }

  return getCreditNoteById(companyId, creditNote.id);
}

export async function getCreditNoteById(companyId: string, id: string) {
  return prisma.creditNote.findFirst({
    where: { id, companyId },
    // issueDate del documento sustento: exigido por el SRI en el XML de NC electrónica
    // (tipo + número + fecha de emisión del documento modificado); ver reports.service.ts.
    include: { items: true, invoice: { select: { number: true, salesOrderId: true, issueDate: true } } },
  });
}

export async function getCreditNotesForInvoice(companyId: string, invoiceId: string) {
  return prisma.creditNote.findMany({
    where: { companyId, invoiceId },
    include: { items: true, invoice: { select: { number: true, issueDate: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Líneas de la factura elegibles para nota de crédito: cantidad facturada por línea del
 * pedido menos lo ya acreditado. Alimenta el modal de NC en el frontend.
 */
export async function getCreditableLines(companyId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId, type: 'SALES' },
    include: { salesOrder: { include: { items: { include: { product: true } } } } },
  });
  if (!invoice) throw new Error('INVOICE_NOT_FOUND');
  if (!invoice.salesOrder) return { invoiceId, lines: [] };

  const lines = invoice.salesOrder.items
    .map((oi) => {
      const creditable = round2(Number(oi.invoicedQty) - Number(oi.creditedQty));
      return {
        salesOrderItemId: oi.id,
        productId: oi.productId,
        productName: oi.product?.name ?? oi.description ?? oi.productId,
        unitPrice: Number(oi.unitPrice),
        discount: Number(oi.discount),
        taxRate: Number(oi.taxRate),
        invoicedQty: round2(Number(oi.invoicedQty)),
        creditedQty: round2(Number(oi.creditedQty)),
        creditableQty: Math.max(0, creditable),
      };
    })
    .filter((l) => l.creditableQty > 1e-6);

  return { invoiceId, lines };
}
