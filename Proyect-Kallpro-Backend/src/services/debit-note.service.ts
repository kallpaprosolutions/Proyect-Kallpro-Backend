import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getNextDocumentNumber } from '../utils/sequence.helper';
import { createDebitNoteEntry } from './journal.service';
import { logger } from '../lib/logger';

/**
 * Notas de Débito de venta (Etapa 4 del plan SRI, resto): carga adicional sobre una factura ya
 * emitida (interés por mora, gasto no facturado, servicio complementario). A diferencia de la
 * NC (Sprint 4), no toca stock ni COGS — no hay mercadería que devolver — y no tiene líneas con
 * cantidad/producto sino `concepts` (razón + valor), tal como exige el esquema de la ND del SRI.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface DebitNoteConceptInput {
  description: string;
  amount: number;
}

export async function createDebitNote(
  companyId: string,
  invoiceId: string,
  data: { reason: string; taxRate: number; concepts: DebitNoteConceptInput[] },
  createdBy?: string,
) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId, type: 'SALES' } });
  if (!invoice) throw new Error('INVOICE_NOT_FOUND');
  if (invoice.status === 'CANCELLED') throw new Error('INVOICE_CANCELLED');
  if (!data.reason?.trim()) throw new Error('VALIDATION: el motivo de la nota de débito es obligatorio');
  if (!data.concepts?.length) throw new Error('NO_CONCEPTS');
  if (data.concepts.some((c) => !c.description?.trim())) throw new Error('VALIDATION: todo concepto debe tener una descripción');
  if (data.concepts.some((c) => !(Number(c.amount) > 0))) throw new Error('VALIDATION: el valor de cada concepto debe ser mayor a cero');

  const taxRate = Number(data.taxRate) || 0;
  const subtotal = round2(data.concepts.reduce((s, c) => s + Number(c.amount), 0));
  const taxAmount = round2(subtotal * (taxRate / 100));
  const total = round2(subtotal + taxAmount);

  const debitNote = await prisma.$transaction(async (tx) => {
    const number = await getNextDocumentNumber(tx, companyId, 'DEBIT_NOTE', 'ND-');
    return tx.debitNote.create({
      data: {
        companyId, number, invoiceId, reason: data.reason, taxRate: new Prisma.Decimal(taxRate),
        subtotal: new Prisma.Decimal(subtotal), taxAmount: new Prisma.Decimal(taxAmount), total: new Prisma.Decimal(total),
        createdBy,
        concepts: { create: data.concepts.map((c) => ({ description: c.description, amount: new Prisma.Decimal(round2(Number(c.amount))) })) },
      },
      include: { concepts: true },
    });
  });

  try {
    await createDebitNoteEntry(companyId, { description: `${debitNote.number} · Factura ${invoice.number}`, entityId: debitNote.id, subtotal, tax: taxAmount, total });
  } catch (e) {
    logger.warn('[debit-note] asiento contable falló (no-fatal)', { err: e });
  }

  return getDebitNoteById(companyId, debitNote.id);
}

export async function getDebitNoteById(companyId: string, id: string) {
  return prisma.debitNote.findFirst({
    where: { id, companyId },
    include: { concepts: true, invoice: { select: { number: true, salesOrderId: true, issueDate: true } } },
  });
}

export async function getDebitNotesForInvoice(companyId: string, invoiceId: string) {
  return prisma.debitNote.findMany({
    where: { companyId, invoiceId },
    include: { concepts: true, invoice: { select: { number: true, issueDate: true } } },
    orderBy: { createdAt: 'desc' },
  });
}
