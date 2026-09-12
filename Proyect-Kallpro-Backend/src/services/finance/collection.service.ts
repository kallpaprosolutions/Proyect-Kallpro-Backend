/**
 * Gestión de cobranza (CxC) — historial de contactos (llamada, email, WhatsApp, reunión) y
 * compromisos de pago sobre la cartera vencida. Complementa el dunning por antigüedad de
 * ar.service.ts (que solo clasifica) con el radar accionable: a quién contactar hoy y qué se
 * prometió, para que la gestión de cobro deje de depender de la memoria del contador.
 */
import { prisma } from '../../lib/prisma';
import { getDunningStatus } from './ar.service';

export const COLLECTION_TYPES = ['CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'PAYMENT_PROMISE', 'NOTE'] as const;
export type CollectionType = (typeof COLLECTION_TYPES)[number];

export interface LogCollectionInput {
  customerId: string;
  invoiceId?: string;
  type: CollectionType;
  result?: string;
  promisedAmount?: number;
  promisedDate?: string | Date;
  nextActionAt?: string | Date;
  notes?: string;
}

export async function logCollectionActivity(companyId: string, input: LogCollectionInput, userId?: string) {
  if (!COLLECTION_TYPES.includes(input.type)) throw new Error('VALIDATION: tipo de gestión inválido');
  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, companyId } });
  if (!customer) throw new Error('CUSTOMER_NOT_FOUND');
  if (input.invoiceId) {
    const invoice = await prisma.invoice.findFirst({ where: { id: input.invoiceId, companyId } });
    if (!invoice) throw new Error('INVOICE_NOT_FOUND');
  }

  return prisma.collectionActivity.create({
    data: {
      companyId,
      customerId: input.customerId,
      invoiceId: input.invoiceId ?? null,
      type: input.type,
      result: input.result,
      promisedAmount: input.promisedAmount != null ? input.promisedAmount : null,
      promisedDate: input.promisedDate ? new Date(input.promisedDate) : null,
      nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null,
      notes: input.notes,
      createdBy: userId,
    },
  });
}

export async function getCollectionHistory(companyId: string, customerId: string) {
  return prisma.collectionActivity.findMany({
    where: { companyId, customerId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Radar de cobranza: cartera vencida priorizada, con el estado de gestión más reciente por
 * cliente (última actividad, próxima acción, promesa vigente) para decidir a quién contactar
 * hoy. Reutiliza listReceivables (ar.service) — no duplica el cálculo de saldos/vencimiento.
 */
export async function getCollectionRadar(companyId: string) {
  const { listReceivables } = await import('./ar.service');
  const receivables = await listReceivables(companyId, { overdue: true });

  const byCustomer = new Map<string, { customerId: string; customerName: string; balance: number; maxDaysOverdue: number; invoiceCount: number }>();
  for (const inv of receivables) {
    if (!inv.customerId) continue;
    const acc = byCustomer.get(inv.customerId) ?? { customerId: inv.customerId, customerName: inv.customerName, balance: 0, maxDaysOverdue: 0, invoiceCount: 0 };
    acc.balance += inv.balance;
    acc.maxDaysOverdue = Math.max(acc.maxDaysOverdue, inv.daysOverdue);
    acc.invoiceCount += 1;
    byCustomer.set(inv.customerId, acc);
  }

  const customerIds = [...byCustomer.keys()];
  const lastActivities = await prisma.collectionActivity.findMany({
    where: { companyId, customerId: { in: customerIds } },
    orderBy: { createdAt: 'desc' },
  });
  const lastByCustomer = new Map<string, (typeof lastActivities)[number]>();
  for (const a of lastActivities) {
    if (!lastByCustomer.has(a.customerId)) lastByCustomer.set(a.customerId, a);
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const radar = [...byCustomer.values()].map((c) => {
    const last = lastByCustomer.get(c.customerId) ?? null;
    const dunning = getDunningStatus(c.maxDaysOverdue);
    const risk = dunning === 'COBRANZA' ? 'ALTO' : dunning === 'URGENTE' ? 'MEDIO' : 'BAJO';
    return {
      customerId: c.customerId,
      customerName: c.customerName,
      balance: round2(c.balance),
      daysOverdue: c.maxDaysOverdue,
      invoiceCount: c.invoiceCount,
      dunning,
      risk,
      lastActivity: last ? { type: last.type, result: last.result, createdAt: last.createdAt } : null,
      nextActionAt: last?.nextActionAt ?? null,
      promisedAmount: last?.promisedAmount != null ? Number(last.promisedAmount) : null,
      promisedDate: last?.promisedDate ?? null,
    };
  });

  radar.sort((a, b) => b.daysOverdue - a.daysOverdue || b.balance - a.balance);
  return radar;
}
