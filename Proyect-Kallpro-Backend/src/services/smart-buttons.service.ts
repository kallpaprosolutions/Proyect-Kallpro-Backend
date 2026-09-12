import { prisma } from '../lib/prisma';

// ============================================================
// SMART BUTTONS (mejora A4 — patrón Odoo)
// ============================================================
// Contadores de documentos vinculados que se muestran arriba del detalle de una
// OC, pedido de venta o factura: asientos contables, pagos, envíos, facturas,
// retenciones y notas de crédito. Los vínculos ya existen en el modelo
// (JournalEntry.entityType/entityId, Shipment.orderType/orderId, Invoice.salesOrderId,
// SriDocument.purchaseOrderId, PaymentApplication.invoiceId) — aquí solo se agregan.

export type SmartButtonEntity = 'PURCHASE_ORDER' | 'SALES_ORDER' | 'INVOICE';

export interface SmartButtonItem {
  id: string;
  title: string;
  subtitle: string;
  route: string | null; // null = informativo (sin página de destino propia)
}

export interface SmartButton {
  key: string;      // JOURNAL | INVOICES | SHIPMENTS | SRI_DOCS | PAYMENTS | WITHHOLDINGS | CREDIT_NOTES
  label: string;    // etiqueta en español
  icon: string;     // emoji (consistente con el design system del proyecto)
  count: number;
  route: string | null; // destino al hacer clic en el botón (lista filtrada), null = solo despliega items
  items: SmartButtonItem[];
}

const money = (v: unknown) => `$${Number(v ?? 0).toFixed(2)}`;
const dateEs = (d: Date | string) => new Date(d).toLocaleDateString('es-EC');

const JOURNAL_STATUS_ES: Record<string, string> = {
  POSTED: 'Contabilizado', DRAFT: 'Borrador', REVERSED: 'Reversado',
};

const SHIPMENT_STATUS_ES: Record<string, string> = {
  PENDING: 'Pendiente', PICKED: 'Preparado', DISPATCHED: 'Despachado',
  IN_TRANSIT: 'En tránsito', OUT_FOR_DELIVERY: 'En reparto', DELIVERED: 'Entregado', FAILED: 'Fallido',
};

const INVOICE_STATUS_ES: Record<string, string> = {
  DRAFT: 'Borrador', SENT: 'Enviada', PAID: 'Pagada', OVERDUE: 'Vencida',
  CANCELLED: 'Anulada', PENDING: 'Pendiente', PARTIALLY_PAID: 'Pago parcial',
};

// Filas crudas mínimas para el motor puro
export interface RawRelatedRows {
  journalEntries?: { id: string; entryNumber: string; description: string; totalDebit: unknown; status: string }[];
  shipments?: { id: string; trackingNumber: string; status: string; carrier: string | null }[];
  invoices?: { id: string; number: string; status: string; totalAmount: unknown }[];
  sriDocuments?: { id: string; numeroDoc: string | null; razonSocialEmisor: string; total: unknown }[];
  payments?: { id: string; paymentNumber: string; amountApplied: unknown; appliedAt: Date | string }[];
  withholdings?: { id: string; tipo: string; codigo: string; porcentaje: unknown; valor: unknown }[];
  creditNotes?: { id: string; number: string; reason: string; total: unknown }[];
  debitNotes?: { id: string; number: string; reason: string; total: unknown }[];
}

/**
 * Motor PURO (regla 6): arma los smart buttons a partir de filas crudas.
 * Los botones sin documentos vinculados se incluyen con count 0 (el frontend
 * decide si atenuarlos), para que el usuario vea qué relaciones existen.
 */
export function buildSmartButtons(
  entityType: SmartButtonEntity,
  entityId: string,
  rows: RawRelatedRows,
): SmartButton[] {
  const buttons: SmartButton[] = [];

  if (rows.journalEntries) {
    buttons.push({
      key: 'JOURNAL', label: 'Asientos', icon: '📑',
      count: rows.journalEntries.length,
      // La factura tiene asientos con dos entityType (INVOICE y SALES_INVOICE):
      // se filtra solo por entityId, que ya es único.
      route: entityType === 'INVOICE'
        ? `/financial/journal-entries?entityId=${entityId}`
        : `/financial/journal-entries?entityType=${entityType}&entityId=${entityId}`,
      items: rows.journalEntries.map(e => ({
        id: e.id, title: e.entryNumber,
        subtitle: `${e.description} · ${money(e.totalDebit)} · ${JOURNAL_STATUS_ES[e.status] ?? e.status}`,
        route: `/financial/journal-entries?entityId=${entityId}`,
      })),
    });
  }

  if (rows.invoices) {
    buttons.push({
      key: 'INVOICES', label: 'Facturas', icon: '🧾',
      count: rows.invoices.length,
      route: null,
      items: rows.invoices.map(i => ({
        id: i.id, title: i.number,
        subtitle: `${INVOICE_STATUS_ES[i.status] ?? i.status} · ${money(i.totalAmount)}`,
        route: `/financial/invoices/${i.id}`,
      })),
    });
  }

  if (rows.shipments) {
    buttons.push({
      key: 'SHIPMENTS', label: 'Envíos', icon: '🚚',
      count: rows.shipments.length,
      route: null,
      items: rows.shipments.map(s => ({
        id: s.id, title: s.trackingNumber,
        subtitle: [SHIPMENT_STATUS_ES[s.status] ?? s.status, s.carrier].filter(Boolean).join(' · '),
        route: `/logistica/${s.id}`,
      })),
    });
  }

  if (rows.sriDocuments) {
    buttons.push({
      key: 'SRI_DOCS', label: 'Docs. SRI', icon: '📥',
      count: rows.sriDocuments.length,
      route: null,
      items: rows.sriDocuments.map(d => ({
        id: d.id, title: d.numeroDoc ?? 'Sin número',
        subtitle: `${d.razonSocialEmisor} · ${money(d.total)}`,
        route: `/sri/${d.id}`,
      })),
    });
  }

  if (rows.payments) {
    buttons.push({
      key: 'PAYMENTS', label: 'Pagos', icon: '💵',
      count: rows.payments.length,
      route: null,
      items: rows.payments.map(p => ({
        id: p.id, title: p.paymentNumber,
        subtitle: `${money(p.amountApplied)} aplicado · ${dateEs(p.appliedAt)}`,
        route: null,
      })),
    });
  }

  if (rows.withholdings) {
    buttons.push({
      key: 'WITHHOLDINGS', label: 'Retenciones', icon: '✂️',
      count: rows.withholdings.length,
      route: null,
      items: rows.withholdings.map(w => ({
        id: w.id, title: `${w.tipo === 'RENTA' ? 'Renta' : 'IVA'} ${w.codigo}`,
        subtitle: `${Number(w.porcentaje)}% · ${money(w.valor)}`,
        route: null,
      })),
    });
  }

  if (rows.creditNotes) {
    buttons.push({
      key: 'CREDIT_NOTES', label: 'Notas de crédito', icon: '↩️',
      count: rows.creditNotes.length,
      route: null,
      items: rows.creditNotes.map(cn => ({
        id: cn.id, title: cn.number,
        subtitle: `${cn.reason} · -${money(cn.total)}`,
        route: null,
      })),
    });
  }

  if (rows.debitNotes) {
    buttons.push({
      key: 'DEBIT_NOTES', label: 'Notas de débito', icon: '➕',
      count: rows.debitNotes.length,
      route: null,
      items: rows.debitNotes.map(dn => ({
        id: dn.id, title: dn.number,
        subtitle: `${dn.reason} · +${money(dn.total)}`,
        route: null,
      })),
    });
  }

  return buttons;
}

const TAKE = 10;

/** Agrega los documentos vinculados a una entidad (multi-tenant por companyId). */
export async function getSmartButtons(
  companyId: string,
  entityType: SmartButtonEntity,
  entityId: string,
): Promise<SmartButton[]> {
  if (entityType === 'PURCHASE_ORDER') {
    const [journalEntries, sriDocuments, shipments] = await Promise.all([
      prisma.journalEntry.findMany({
        where: { companyId, entityType: 'PURCHASE_ORDER', entityId },
        select: { id: true, entryNumber: true, description: true, totalDebit: true, status: true },
        orderBy: { createdAt: 'desc' }, take: TAKE,
      }),
      prisma.sriDocument.findMany({
        where: { companyId, purchaseOrderId: entityId },
        select: { id: true, numeroDoc: true, razonSocialEmisor: true, total: true },
        orderBy: { createdAt: 'desc' }, take: TAKE,
      }),
      prisma.shipment.findMany({
        where: { companyId, orderType: 'PURCHASE', orderId: entityId },
        select: { id: true, trackingNumber: true, status: true, carrier: true },
        orderBy: { createdAt: 'desc' }, take: TAKE,
      }),
    ]);
    return buildSmartButtons(entityType, entityId, { journalEntries, sriDocuments, shipments });
  }

  if (entityType === 'SALES_ORDER') {
    const [journalEntries, invoices, shipments] = await Promise.all([
      prisma.journalEntry.findMany({
        where: { companyId, entityType: 'SALES_ORDER', entityId },
        select: { id: true, entryNumber: true, description: true, totalDebit: true, status: true },
        orderBy: { createdAt: 'desc' }, take: TAKE,
      }),
      prisma.invoice.findMany({
        where: { companyId, salesOrderId: entityId },
        select: { id: true, number: true, status: true, totalAmount: true },
        orderBy: { createdAt: 'desc' }, take: TAKE,
      }),
      prisma.shipment.findMany({
        where: { companyId, orderType: 'SALES', orderId: entityId },
        select: { id: true, trackingNumber: true, status: true, carrier: true },
        orderBy: { createdAt: 'desc' }, take: TAKE,
      }),
    ]);
    return buildSmartButtons(entityType, entityId, { journalEntries, invoices, shipments });
  }

  // INVOICE: asientos (INVOICE y SALES_INVOICE), pagos aplicados, retenciones, NC y ND
  const [journalEntries, applications, withholdings, creditNotes, debitNotes] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { companyId, entityType: { in: ['INVOICE', 'SALES_INVOICE'] }, entityId },
      select: { id: true, entryNumber: true, description: true, totalDebit: true, status: true },
      orderBy: { createdAt: 'desc' }, take: TAKE,
    }),
    prisma.paymentApplication.findMany({
      where: { invoiceId: entityId, payment: { companyId } },
      select: { id: true, amountApplied: true, appliedAt: true, payment: { select: { paymentNumber: true } } },
      orderBy: { appliedAt: 'desc' }, take: TAKE,
    }),
    prisma.invoiceWithholding.findMany({
      where: { invoiceId: entityId, invoice: { companyId } },
      select: { id: true, tipo: true, codigo: true, porcentaje: true, valor: true },
      take: TAKE,
    }),
    prisma.creditNote.findMany({
      where: { companyId, invoiceId: entityId },
      select: { id: true, number: true, reason: true, total: true },
      orderBy: { createdAt: 'desc' }, take: TAKE,
    }),
    prisma.debitNote.findMany({
      where: { companyId, invoiceId: entityId },
      select: { id: true, number: true, reason: true, total: true },
      orderBy: { createdAt: 'desc' }, take: TAKE,
    }),
  ]);
  return buildSmartButtons(entityType, entityId, {
    journalEntries,
    payments: applications.map(a => ({
      id: a.id, paymentNumber: a.payment.paymentNumber,
      amountApplied: a.amountApplied, appliedAt: a.appliedAt,
    })),
    withholdings,
    creditNotes,
    debitNotes,
  });
}
