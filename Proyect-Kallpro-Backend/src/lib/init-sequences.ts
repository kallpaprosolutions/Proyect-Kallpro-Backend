import { prisma } from './prisma';
import { getErpConfig } from '../services/erp-config.service';
import { logger } from './logger';

/**
 * Inicialización / backfill de DocumentSequence.
 *
 * Calcula el último correlativo real por (companyId, docType) a partir de las tablas
 * existentes, para que getNextDocumentNumber no colisione con documentos previos.
 * Idempotente (usa upsert y recalcula el máximo cada vez).
 *
 * Cubre TODOS los tipos numerados del ERP. Ojo con las facturas: en la tabla `invoice`
 * conviven 3 prefijos → se separan por prefijo para no mezclar contadores:
 *   - FAC-V-  → ventas (auto desde pedido)     → SALES_INVOICE
 *   - FAC-    → ventas manual (financiero)      → FINANCIAL_INVOICE_SALES
 *   - OCP-    → compras manual (financiero)     → FINANCIAL_INVOICE_PURCHASE
 */

function lastSegmentNumber(code: string | null | undefined): number {
  if (!code) return 0;
  const parts = code.split('-');
  const n = parseInt(parts[parts.length - 1] || '0', 10);
  return Number.isFinite(n) ? n : 0;
}

function maxOf(codes: (string | null)[]): number {
  return codes.reduce<number>((max, c) => Math.max(max, lastSegmentNumber(c)), 0);
}

export async function backfillDocumentSequences(): Promise<void> {
  const companies = await prisma.company.findMany({ select: { id: true } });

  for (const { id: companyId } of companies) {
    const cfg = await getErpConfig(companyId);

    const [reqs, pos, adjs, quotes, orders, invoices, prods, entries, cns] = await Promise.all([
      prisma.requisition.findMany({ where: { companyId }, select: { reqNumber: true } }),
      prisma.purchaseOrder.findMany({ where: { companyId }, select: { poNumber: true } }),
      prisma.inventoryAdjustment.findMany({ where: { companyId }, select: { adjNumber: true } }),
      prisma.salesQuotation.findMany({ where: { companyId }, select: { quoteNumber: true } }),
      prisma.salesOrder.findMany({ where: { companyId }, select: { orderNumber: true } }),
      prisma.invoice.findMany({ where: { companyId }, select: { number: true } }),
      prisma.productionOrder.findMany({ where: { companyId }, select: { poNumber: true } }),
      prisma.journalEntry.findMany({ where: { companyId }, select: { entryNumber: true } }),
      prisma.creditNote.findMany({ where: { companyId }, select: { number: true } }),
    ]);

    const invNums = invoices.map((i) => i.number);
    const facV = invNums.filter((n) => n?.startsWith('FAC-V-'));
    const facManual = invNums.filter((n) => n?.startsWith('FAC-') && !n.startsWith('FAC-V-'));
    const ocp = invNums.filter((n) => n?.startsWith('OCP-'));

    const targets = [
      { docType: 'REQUISITION',                prefix: cfg.documents.reqPrefix, padding: 4, last: maxOf(reqs.map((r) => r.reqNumber)) },
      { docType: 'PURCHASE_ORDER',             prefix: cfg.documents.poPrefix,  padding: 4, last: maxOf(pos.map((p) => p.poNumber)) },
      { docType: 'INVENTORY_ADJUSTMENT',       prefix: cfg.documents.adjPrefix, padding: 4, last: maxOf(adjs.map((a) => a.adjNumber)) },
      { docType: 'SALES_QUOTATION',            prefix: 'COT-',                  padding: 4, last: maxOf(quotes.map((q) => q.quoteNumber)) },
      { docType: 'SALES_ORDER',                prefix: 'PV-',                   padding: 4, last: maxOf(orders.map((o) => o.orderNumber)) },
      { docType: 'SALES_INVOICE',              prefix: 'FAC-V-',                padding: 4, last: maxOf(facV) },
      { docType: 'FINANCIAL_INVOICE_SALES',    prefix: 'FAC-',                  padding: 4, last: maxOf(facManual) },
      { docType: 'FINANCIAL_INVOICE_PURCHASE', prefix: 'OCP-',                  padding: 4, last: maxOf(ocp) },
      { docType: 'PRODUCTION_ORDER',           prefix: 'PROD-',                 padding: 4, last: maxOf(prods.map((p) => p.poNumber)) },
      { docType: 'JOURNAL_ENTRY',              prefix: 'AST-',                  padding: 4, last: maxOf(entries.map((e) => e.entryNumber)) },
      { docType: 'PAYMENT',                    prefix: 'PAG-',                  padding: 4, last: 0 },
      { docType: 'SHIPMENT',                   prefix: 'KP-',                   padding: 8, last: 0 },
      { docType: 'CREDIT_NOTE',                prefix: 'NC-',                   padding: 4, last: maxOf(cns.map((c) => c.number)) },
    ];

    for (const t of targets) {
      await prisma.documentSequence.upsert({
        where: { companyId_docType: { companyId, docType: t.docType } },
        update: { lastNumber: t.last, prefix: t.prefix, padding: t.padding },
        create: { companyId, docType: t.docType, prefix: t.prefix, padding: t.padding, lastNumber: t.last },
      });
    }
  }
}

/**
 * Auto-seed para el arranque: si la tabla document_sequences está vacía, ejecuta el
 * backfill una sola vez. No hace nada si ya hay secuencias (evita trabajo en cada boot).
 */
export async function initDocumentSequences(): Promise<void> {
  const existing = await prisma.documentSequence.count();
  if (existing > 0) return;
  logger.info('🔢 document_sequences vacío → backfill automático de correlativos…');
  await backfillDocumentSequences();
  logger.info('🔢 Correlativos inicializados.');
}
