import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getNextDocumentNumber } from '../utils/sequence.helper';
import { logFieldChange } from './chatter.service';
import { logger } from '../lib/logger';
/**
 * Tesorería — Pagos y aplicación de pagos.
 *
 * Un Payment es un cobro (CUSTOMER) o pago (SUPPLIER). Puede aplicarse total o
 * parcialmente a una o varias facturas (Invoice, AR) o documentos SRI (SriDocument, AP
 * real — ver flujo-trabajo-erp.md). El saldo se lleva con `paidAmount` en ambos modelos
 * (no existe columna outstandingBalance):
 *   outstanding = total(Amount) - paidAmount
 * Cuando paidAmount alcanza el total, el documento pasa a PAID (si no, PARTIAL).
 * Todo se hace dentro de $transaction para que el saldo no se desfase.
 */

const EPS = 0.005; // tolerancia de centavos

export interface ApplicationInput {
  invoiceId?: string;
  sriDocumentId?: string;
  amountApplied: number;
}

export interface CreatePaymentInput {
  entityType: 'CUSTOMER' | 'SUPPLIER';
  entityId: string;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'CHECK' | 'OTHER';
  reference?: string;
  totalAmount: number;
  notes?: string;
  applications?: ApplicationInput[];
}

function paymentStatus(total: number, applied: number): string {
  if (applied <= EPS) return 'UNAPPLIED';
  if (applied >= total - EPS) return 'APPLIED';
  return 'PARTIAL';
}

/** Aplica un monto a una factura o documento SRI dentro de una transacción y crea la PaymentApplication. */
async function applyToDocumentTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  paymentId: string,
  target: { invoiceId?: string; sriDocumentId?: string },
  amountApplied: number,
  createdBy?: string,
) {
  if (amountApplied <= 0) throw new Error('INVALID_AMOUNT');
  const { invoiceId, sriDocumentId } = target;
  if (!!invoiceId === !!sriDocumentId) throw new Error('APPLICATION_TARGET_INVALID'); // exactamente uno

  if (invoiceId) {
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, companyId } });
    if (!invoice) throw new Error('INVOICE_NOT_FOUND');

    const outstanding = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    if (amountApplied > outstanding + EPS) throw new Error(`OVER_APPLIED_INVOICE:${invoice.number}`);

    const newPaid = Number(invoice.paidAmount) + amountApplied;
    const newStatus = newPaid >= Number(invoice.totalAmount) - EPS ? 'PAID' : 'PARTIAL';
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: new Prisma.Decimal(newPaid),
        status: newStatus,
      },
    });
    await tx.paymentApplication.create({
      data: { paymentId, invoiceId, amountApplied: new Prisma.Decimal(amountApplied), createdBy },
    });
    // Log de cambios (A2.2): fuera de la transacción (no crítico para la integridad del pago).
    if (createdBy && newStatus !== invoice.status) {
      logFieldChange(companyId, createdBy, 'INVOICE', invoiceId, 'STATUS', invoice.status, newStatus)
        .catch((e) => logger.warn('[payment] logFieldChange failed (non-fatal)', { err: e }));
    }
    return;
  }

  const doc = await tx.sriDocument.findFirst({ where: { id: sriDocumentId, companyId } });
  if (!doc) throw new Error('SRI_DOCUMENT_NOT_FOUND');

  const outstanding = Number(doc.total) - Number(doc.paidAmount);
  if (amountApplied > outstanding + EPS) throw new Error(`OVER_APPLIED_SRI_DOCUMENT:${doc.numeroDoc}`);

  const newPaid = Number(doc.paidAmount) + amountApplied;
  await tx.sriDocument.update({
    where: { id: sriDocumentId },
    data: {
      paidAmount: new Prisma.Decimal(newPaid),
      paymentStatus: newPaid >= Number(doc.total) - EPS ? 'PAID' : 'PARTIAL',
      paidAt: newPaid >= Number(doc.total) - EPS ? new Date() : null,
    },
  });
  await tx.paymentApplication.create({
    data: { paymentId, sriDocumentId, amountApplied: new Prisma.Decimal(amountApplied), createdBy },
  });
}

export async function createPayment(companyId: string, data: CreatePaymentInput, createdBy?: string) {
  const apps = data.applications ?? [];
  const sumApps = apps.reduce((s, a) => s + Number(a.amountApplied), 0);
  if (sumApps > Number(data.totalAmount) + EPS) throw new Error('APPLICATIONS_EXCEED_TOTAL');

  return prisma.$transaction(async (tx) => {
    const paymentNumber = await getNextDocumentNumber(tx, companyId, 'PAYMENT', 'PAG-');
    const payment = await tx.payment.create({
      data: {
        companyId,
        paymentNumber,
        entityType: data.entityType,
        entityId: data.entityId,
        paymentMethod: data.paymentMethod,
        reference: data.reference,
        totalAmount: new Prisma.Decimal(data.totalAmount),
        appliedAmount: new Prisma.Decimal(sumApps),
        status: paymentStatus(Number(data.totalAmount), sumApps),
        notes: data.notes,
        createdBy,
      },
    });

    for (const a of apps) {
      await applyToDocumentTx(tx, companyId, payment.id, { invoiceId: a.invoiceId, sriDocumentId: a.sriDocumentId }, Number(a.amountApplied), createdBy);
    }

    return tx.payment.findFirst({ where: { id: payment.id }, include: { applications: true } });
  });
}

export async function applyPayment(
  companyId: string,
  paymentId: string,
  data: ApplicationInput,
  createdBy?: string,
) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id: paymentId, companyId } });
    if (!payment) throw new Error('PAYMENT_NOT_FOUND');

    const remaining = Number(payment.totalAmount) - Number(payment.appliedAmount);
    if (Number(data.amountApplied) > remaining + EPS) throw new Error('OVER_APPLIED_PAYMENT');

    await applyToDocumentTx(tx, companyId, payment.id, { invoiceId: data.invoiceId, sriDocumentId: data.sriDocumentId }, Number(data.amountApplied), createdBy);

    const newApplied = Number(payment.appliedAmount) + Number(data.amountApplied);
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        appliedAmount: new Prisma.Decimal(newApplied),
        status: paymentStatus(Number(payment.totalAmount), newApplied),
      },
    });

    return tx.payment.findFirst({ where: { id: paymentId }, include: { applications: true } });
  });
}

export async function listPayments(companyId: string, filters: { entityType?: string; entityId?: string } = {}) {
  return prisma.payment.findMany({
    where: {
      companyId,
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
    },
    include: { applications: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export async function getPaymentById(companyId: string, id: string) {
  return prisma.payment.findFirst({
    where: { id, companyId },
    include: {
      applications: {
        include: {
          invoice: { select: { number: true, totalAmount: true, paidAmount: true, status: true } },
          sriDocument: { select: { numeroDoc: true, total: true, paidAmount: true, paymentStatus: true } },
        },
      },
    },
  });
}
