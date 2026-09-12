/**
 * Etapa 5 del plan SRI (contingencia): cola de reintentos perezosa — mismo patrón que B3/B4
 * (sin cron, botón manual) para los comprobantes que quedaron "en el aire" (ENVIADA/RECIBIDA)
 * porque el SRI no respondió a tiempo, la red cayó entre recepción y autorización, o el
 * servicio del SRI estuvo caído. Nada se pierde: el XML firmado ya está persistido desde que
 * se envió, así que reintentar solo vuelve a consultar la autorización con la misma clave.
 */
import { prisma } from '../../lib/prisma';
import { checkAuthorization } from './electronic-invoice.service';
import { checkCreditNoteAuthorization } from './electronic-creditnote.service';
import { checkDebitNoteAuthorization } from './electronic-debitnote.service';
import { checkDeliveryGuideAuthorization } from './electronic-deliveryguide.service';

const PENDIENTES = ['ENVIADA', 'RECIBIDA'];

export interface PendingSriDoc {
  kind: 'invoice' | 'creditNote' | 'debitNote' | 'deliveryGuide';
  id: string;
  number: string;
  sriEstado: string;
  claveAcceso: string | null;
  sriUltimoIntento: Date | null;
}

/** Lista los comprobantes pendientes sin tocar el SRI — alimenta el contador de la UI. */
export async function listPendingSriDocuments(companyId: string): Promise<PendingSriDoc[]> {
  const [invoices, creditNotes, debitNotes, deliveryGuides] = await Promise.all([
    prisma.invoice.findMany({ where: { companyId, sriEstado: { in: PENDIENTES } }, select: { id: true, number: true, sriEstado: true, claveAcceso: true, sriUltimoIntento: true } }),
    prisma.creditNote.findMany({ where: { companyId, sriEstado: { in: PENDIENTES } }, select: { id: true, number: true, sriEstado: true, claveAcceso: true, sriUltimoIntento: true } }),
    prisma.debitNote.findMany({ where: { companyId, sriEstado: { in: PENDIENTES } }, select: { id: true, number: true, sriEstado: true, claveAcceso: true, sriUltimoIntento: true } }),
    prisma.deliveryGuide.findMany({ where: { companyId, sriEstado: { in: PENDIENTES } }, select: { id: true, number: true, sriEstado: true, claveAcceso: true, sriUltimoIntento: true } }),
  ]);
  return [
    ...invoices.map((d) => ({ kind: 'invoice' as const, ...d })),
    ...creditNotes.map((d) => ({ kind: 'creditNote' as const, ...d })),
    ...debitNotes.map((d) => ({ kind: 'debitNote' as const, ...d })),
    ...deliveryGuides.map((d) => ({ kind: 'deliveryGuide' as const, ...d })),
  ];
}

export interface RetryResult {
  kind: PendingSriDoc['kind'];
  id: string;
  number: string;
  before: string;
  after: string;
  error?: string;
}

/** Reintenta consultar la autorización de TODOS los comprobantes pendientes de la empresa. */
export async function retryPendingSriDocuments(companyId: string, userId?: string): Promise<RetryResult[]> {
  const pending = await listPendingSriDocuments(companyId);
  const results: RetryResult[] = [];
  for (const doc of pending) {
    try {
      const checker = {
        invoice: checkAuthorization,
        creditNote: checkCreditNoteAuthorization,
        debitNote: checkDebitNoteAuthorization,
        deliveryGuide: checkDeliveryGuideAuthorization,
      }[doc.kind];
      const r = await checker(companyId, doc.id, userId);
      results.push({ kind: doc.kind, id: doc.id, number: doc.number, before: doc.sriEstado, after: r.sriEstado });
    } catch (e: any) {
      results.push({ kind: doc.kind, id: doc.id, number: doc.number, before: doc.sriEstado, after: doc.sriEstado, error: e?.message ?? 'Error desconocido' });
    }
  }
  return results;
}
