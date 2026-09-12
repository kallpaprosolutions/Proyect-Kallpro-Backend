import { prisma } from '../../lib/prisma';
import { getPipelineStages } from './crm-config.service';
// CrmDeal schema fields:
//   name (NOT title), amountUsd (NOT value), probability
//   stage (lowercase: lead|qualified|proposal|negotiation|won|lost)
//   ownerUserId (NOT assignedTo), expectedCloseDate, closedAt
//   No 'currency' or 'source' fields

export const PIPELINE_STAGES = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const;
export type PipelineStage = typeof PIPELINE_STAGES[number];

/**
 * Probabilidades de RESPALDO (Sprint 13).
 *
 * Ya NO son la fuente de verdad: las etapas, sus probabilidades y su categoría de
 * pronóstico viven en `CrmPipelineStage` y el usuario las edita desde la interfaz
 * (ver `crm-config.service.getPipelineStages`). Este mapa solo se usa si una empresa
 * todavía no tiene etapas sembradas, para que nada quede en 0 por accidente.
 */
export const STAGE_PROBABILITY: Record<PipelineStage, number> = {
  LEAD: 10,
  QUALIFIED: 25,
  PROPOSAL: 50,
  NEGOTIATION: 75,
  WON: 100,
  LOST: 0,
};

/** Etapa configurada por la empresa, por código (insensible a mayúsculas). */
async function findStage(companyId: string, code: string) {
  const stages = await getPipelineStages(companyId);
  return stages.find(s => s.code.toLowerCase() === String(code).toLowerCase());
}

export interface CreateDealInput {
  title: string;          // maps to name
  contactId?: string;
  crmCompanyId?: string;
  value?: number;         // maps to amountUsd
  stage?: PipelineStage;
  probability?: number;
  expectedCloseDate?: string;
  assignedTo?: string;    // maps to ownerUserId
  notes?: string;
  tags?: string[];
}

export async function createDeal(companyId: string, data: CreateDealInput) {
  const stages = await getPipelineStages(companyId);
  const firstOpen = stages.find(s => !s.isWon && !s.isLost);
  const stageCode = data.stage ?? firstOpen?.code ?? 'lead';
  const stage = stages.find(s => s.code.toLowerCase() === String(stageCode).toLowerCase());

  const probability = data.probability
    ?? stage?.probability
    ?? STAGE_PROBABILITY[String(stageCode).toUpperCase() as PipelineStage]
    ?? 10;

  return prisma.crmDeal.create({
    data: {
      companyId,
      name: data.title,
      contactId: data.contactId,
      crmCompanyId: data.crmCompanyId,
      amountUsd: data.value ?? 0,
      stage: stageCode,
      probability,
      // La categoría se hereda de la etapa; el vendedor la puede anular después.
      forecastCategory: stage?.forecastCategory ?? 'PIPELINE',
      expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
      ownerUserId: data.assignedTo,
      notes: data.notes,
      tags: data.tags ?? [],
      lastActivityAt: new Date(),
    },
  });
}

export async function getDeal(companyId: string, id: string) {
  return prisma.crmDeal.findFirst({
    where: { id, companyId },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, email: true, phoneE164: true } },
      crmCompany: { select: { id: true, legalName: true, ruc: true } },
      stageHistory: { orderBy: { changedAt: 'desc' } },
    },
  });
}

export async function listDeals(companyId: string, filters?: {
  stage?: string;
  contactId?: string;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}) {
  const where: any = { companyId };
  if (filters?.stage) where.stage = filters.stage;
  if (filters?.contactId) where.contactId = filters.contactId;
  if (filters?.assignedTo) where.ownerUserId = filters.assignedTo;

  const [deals, total] = await Promise.all([
    prisma.crmDeal.findMany({
      where,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        crmCompany: { select: { id: true, legalName: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: filters?.limit ?? 100,
      skip: filters?.offset ?? 0,
    }),
    prisma.crmDeal.count({ where }),
  ]);

  // Normalize for frontend: expose 'value' and 'title' as aliases
  const normalized = deals.map((d: any) => ({
    ...d,
    title: d.name,
    value: d.amountUsd,
    crmCompany: d.crmCompany ? { ...d.crmCompany, name: d.crmCompany.legalName } : null,
  }));

  return { deals: normalized, total };
}

export async function updateDealStage(
  companyId: string,
  dealId: string,
  newStage: string,
  changedBy?: string,
) {
  const deal = await prisma.crmDeal.findFirst({ where: { id: dealId, companyId } });
  if (!deal) throw new Error('Deal no encontrado');

  const oldStage = deal.stage;
  const stage = await findStage(companyId, newStage);
  const probability = stage?.probability
    ?? STAGE_PROBABILITY[newStage.toUpperCase() as PipelineStage]
    ?? deal.probability;
  const isClosing = stage ? (stage.isWon || stage.isLost) : ['won', 'lost'].includes(newStage.toLowerCase());

  const [updated] = await prisma.$transaction([
    prisma.crmDeal.update({
      where: { id: dealId },
      data: {
        stage: newStage,
        probability,
        // Solo se re-hereda la categoría si el vendedor no la fijó a mano: su juicio
        // sobre "esto cierra" no debe perderse al mover la tarjeta de columna.
        ...(!deal.categoryOverride && stage && { forecastCategory: stage.forecastCategory }),
        lastActivityAt: new Date(),
        closedAt: isClosing ? new Date() : undefined,
      },
    }),
    prisma.crmDealStageHistory.create({
      data: {
        dealId,
        fromStage: oldStage,
        toStage: newStage,
        changedBy,
      },
    }),
  ]);

  // Puente CRM → Ventas: al ganar, la cotización se genera sola con los productos del deal.
  // No bloqueante: si el deal no tiene productos, queda WON y el botón "Generar cotización"
  // lo resuelve después (deal-conversion.service).
  const won = stage ? stage.isWon : newStage.toLowerCase() === 'won';
  if (won && oldStage.toLowerCase() !== newStage.toLowerCase()) {
    const { tryAutoConvertOnWon } = await import('./deal-conversion.service');
    const userId = changedBy && changedBy !== 'ai-agent' ? changedBy : undefined;
    await tryAutoConvertOnWon(companyId, dealId, userId);
  }

  return updated;
}

export async function updateDeal(companyId: string, id: string, data: Partial<CreateDealInput>) {
  return prisma.crmDeal.updateMany({
    where: { id, companyId },
    data: {
      ...(data.title && { name: data.title }),
      ...(data.value !== undefined && { amountUsd: data.value }),
      ...(data.probability !== undefined && { probability: data.probability }),
      ...(data.expectedCloseDate && { expectedCloseDate: new Date(data.expectedCloseDate) }),
      ...(data.assignedTo !== undefined && { ownerUserId: data.assignedTo }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.tags && { tags: data.tags }),
    },
  });
}

export async function getFunnelMetrics(companyId: string) {
  const [deals, stages] = await Promise.all([
    prisma.crmDeal.groupBy({
      by: ['stage'],
      where: { companyId },
      _count: { id: true },
      _sum: { amountUsd: true },
    }),
    getPipelineStages(companyId),
  ]);

  // El embudo se dibuja con las etapas configuradas por la empresa, en su orden.
  return stages.map(stage => {
    const data = deals.find(d => d.stage.toLowerCase() === stage.code.toLowerCase());
    const totalValue = Number(data?._sum.amountUsd ?? 0);
    return {
      stage: stage.code.toUpperCase(),
      code: stage.code,
      label: stage.name,
      sequence: stage.sequence,
      forecastCategory: stage.forecastCategory,
      count: data?._count.id ?? 0,
      totalValue,
      probability: stage.probability,
      weightedValue: totalValue * (stage.probability / 100),
    };
  });
}

export async function getDealsAtRisk(companyId: string, staleAfterDays = 7) {
  const cutoff = new Date(Date.now() - staleAfterDays * 86400000);
  const deals = await prisma.crmDeal.findMany({
    where: {
      companyId,
      stage: { notIn: ['WON', 'LOST', 'won', 'lost'] },
      updatedAt: { lt: cutoff },
    },
    include: {
      contact: { select: { firstName: true, lastName: true } },
      crmCompany: { select: { legalName: true } },
    },
    orderBy: { updatedAt: 'asc' },
    take: 20,
  });

  return deals.map((d: any) => ({
    ...d,
    title: d.name,
    value: d.amountUsd,
    crmCompany: d.crmCompany ? { ...d.crmCompany, name: d.crmCompany.legalName } : null,
  }));
}
