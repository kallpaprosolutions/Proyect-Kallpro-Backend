/**
 * Pipeline del flujo de compras — alimenta el Hub de Compras Guiado.
 *
 * Clasifica cada documento vivo (requisición u OC) en una etapa del flujo
 * y deriva la SIGUIENTE ACCIÓN concreta para el usuario. La lógica de
 * "qué acción es válida" espeja el statechart del frontend
 * (src/machines/purchaseOrder.machine.ts) — mantener ambos en sincronía.
 *
 * Etapas: REQUISITION → QUOTATION → COMPARISON → APPROVAL → PAYMENT_RECEIPT → CLOSED
 */
import { prisma } from '../lib/prisma';
import { getErpConfig } from './erp-config.service';
export type PipelineStageKey =
  | 'REQUISITION'
  | 'QUOTATION'
  | 'COMPARISON'
  | 'APPROVAL'
  | 'PAYMENT_RECEIPT'
  | 'CLOSED';

export interface PipelineItem {
  id: string;
  type: 'REQ' | 'PO';
  number: string;
  title: string | null;
  supplier: string | null;
  amount: number;
  status: string;
  nextAction: string | null;
  nextActionUrl: string | null;
  daysInStage: number;
}

const STAGE_LABELS: Record<PipelineStageKey, string> = {
  REQUISITION: 'Requisición',
  QUOTATION: 'Cotizaciones',
  COMPARISON: 'Comparativo',
  APPROVAL: 'Aprobación OC',
  PAYMENT_RECEIPT: 'Pago y recepción',
  CLOSED: 'Finalizadas',
};

function daysSince(date: Date): number {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));
}

/** Clasifica una requisición en etapa + siguiente acción */
function classifyRequisition(req: {
  id: string; reqNumber: string; title: string; status: string;
  totalEstimated: any; updatedAt: Date; quotationCount: number; hasWinner: boolean;
}, minQuotations: number): { stage: PipelineStageKey; item: PipelineItem } {
  const base: PipelineItem = {
    id: req.id, type: 'REQ', number: req.reqNumber, title: req.title, supplier: null,
    amount: Number(req.totalEstimated), status: req.status,
    nextAction: null, nextActionUrl: null, daysInStage: daysSince(req.updatedAt),
  };
  const detailUrl = `/purchases/requisitions/${req.id}`;

  if (req.status.startsWith('PENDING_L')) {
    const level = req.status.slice(-1);
    return { stage: 'REQUISITION', item: { ...base, nextAction: `Aprobar requisición (Nivel ${level})`, nextActionUrl: detailUrl } };
  }
  if (req.status === 'APPROVED' || req.status === 'QUOTED') {
    if (req.hasWinner) return { stage: 'CLOSED', item: base };
    if (req.quotationCount >= minQuotations) {
      return { stage: 'COMPARISON', item: { ...base, nextAction: 'Comparar y elegir ganador', nextActionUrl: `${detailUrl}/compare` } };
    }
    return { stage: 'QUOTATION', item: { ...base, nextAction: `Cargar cotización (${req.quotationCount}/${minQuotations})`, nextActionUrl: detailUrl } };
  }
  // PO_CREATED, REJECTED, DRAFT u otros → cerrada para el pipeline de requisición
  return { stage: 'CLOSED', item: base };
}

/** Clasifica una OC en etapa + siguiente acción (espejo de purchaseOrder.machine) */
function classifyPurchaseOrder(po: {
  id: string; poNumber: string; status: string; totalAmount: any; updatedAt: Date;
  advanceStatus: string; balanceStatus: string; qualityConformity: boolean | null;
  supplierName: string | null;
}): { stage: PipelineStageKey; item: PipelineItem } {
  const base: PipelineItem = {
    id: po.id, type: 'PO', number: po.poNumber, title: null, supplier: po.supplierName,
    amount: Number(po.totalAmount), status: po.status,
    nextAction: null, nextActionUrl: null, daysInStage: daysSince(po.updatedAt),
  };
  const url = `/purchases/${po.id}`;

  if (po.status === 'DRAFT') {
    return { stage: 'APPROVAL', item: { ...base, nextAction: 'Enviar a aprobación', nextActionUrl: url } };
  }
  if (po.status === 'SUBMITTED' || po.status.startsWith('PENDING_L')) {
    const level = po.status.startsWith('PENDING_L') ? po.status.slice(-1) : '1';
    return { stage: 'APPROVAL', item: { ...base, nextAction: `Aprobar OC (Nivel ${level})`, nextActionUrl: url } };
  }
  if (po.status === 'APPROVED' || po.status === 'PARTIAL') {
    if (po.advanceStatus === 'PENDING') {
      return { stage: 'PAYMENT_RECEIPT', item: { ...base, nextAction: 'Pagar anticipo', nextActionUrl: url } };
    }
    const action = po.status === 'PARTIAL' ? 'Recibir restante' : 'Recibir mercadería';
    return { stage: 'PAYMENT_RECEIPT', item: { ...base, nextAction: action, nextActionUrl: url } };
  }
  if (po.status === 'RECEIVED' && po.balanceStatus !== 'PAID') {
    if (po.qualityConformity) {
      return { stage: 'PAYMENT_RECEIPT', item: { ...base, nextAction: 'Pagar saldo', nextActionUrl: url } };
    }
    return { stage: 'PAYMENT_RECEIPT', item: { ...base, nextAction: 'Recepción no conforme — gestionar con proveedor', nextActionUrl: url } };
  }
  // RECEIVED+pagada, REJECTED, CANCELLED
  return { stage: 'CLOSED', item: base };
}

export async function getProcurementPipeline(companyId: string) {
  const minQuotations = (await getErpConfig(companyId)).purchases.minQuotations;
  const [reqs, pos] = await Promise.all([
    prisma.requisition.findMany({
      where: { companyId },
      select: {
        id: true, reqNumber: true, title: true, status: true, totalEstimated: true, updatedAt: true,
        quotations: { select: { id: true, isWinner: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    }),
    prisma.purchaseOrder.findMany({
      where: { companyId },
      select: {
        id: true, poNumber: true, status: true, totalAmount: true, updatedAt: true,
        advanceStatus: true, balanceStatus: true, qualityConformity: true,
        supplier: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    }),
  ]);

  const stageMap = new Map<PipelineStageKey, PipelineItem[]>();
  (Object.keys(STAGE_LABELS) as PipelineStageKey[]).forEach((k) => stageMap.set(k, []));

  for (const r of reqs) {
    const { stage, item } = classifyRequisition({
      ...r, quotationCount: r.quotations.length, hasWinner: r.quotations.some((q) => q.isWinner),
    }, minQuotations);
    stageMap.get(stage)!.push(item);
  }
  for (const p of pos) {
    const { stage, item } = classifyPurchaseOrder({ ...p, supplierName: p.supplier?.name ?? null });
    stageMap.get(stage)!.push(item);
  }

  const stages = (Object.keys(STAGE_LABELS) as PipelineStageKey[]).map((key) => ({
    key,
    label: STAGE_LABELS[key],
    count: stageMap.get(key)!.length,
    items: stageMap.get(key)!,
  }));

  // Bandeja de acción: todo lo que tiene un siguiente paso, lo más antiguo primero
  const myPending = stages
    .filter((s) => s.key !== 'CLOSED')
    .flatMap((s) => s.items)
    .filter((i) => i.nextAction && i.nextActionUrl)
    .sort((a, b) => b.daysInStage - a.daysInStage)
    .slice(0, 20)
    .map((i) => ({
      kind: i.type,
      entityId: i.id,
      label: `${i.nextAction} — ${i.number}${i.supplier ? ` (${i.supplier})` : ''}`,
      url: i.nextActionUrl!,
      daysWaiting: i.daysInStage,
    }));

  return { stages, myPending };
}
