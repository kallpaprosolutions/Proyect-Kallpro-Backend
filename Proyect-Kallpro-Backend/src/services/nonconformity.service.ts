import { prisma } from '../lib/prisma';
import { getNextDocumentNumber } from '../utils/sequence.helper';
import { AppError } from '../utils/errors';

// ============================================================
// NO CONFORMIDADES Y ACCIONES CORRECTIVAS — CAPA (Sprint 12)
// ============================================================
// ISO 9001:2015 §8.7 (control de salidas no conformes) + §10.2 (no conformidad
// y acción correctiva). El ciclo obligatorio de la norma es:
//   detectar → CORREGIR el producto (disposición) → analizar CAUSA RAÍZ →
//   acción correctiva → VERIFICAR EFICACIA → cerrar.
// El motor puro `assertTransition` impide saltarse pasos, que es exactamente
// el hallazgo típico de una auditoría ("se cerró sin verificar la eficacia").

export const NC_SOURCES = ['PRODUCTION', 'INSPECTION', 'CUSTOMER_COMPLAINT', 'AUDIT', 'SUPPLIER'] as const;
export const NC_SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const;
export const NC_DISPOSITIONS = ['REWORK', 'SCRAP', 'CONCESSION', 'RETURN'] as const;
export const NC_STATUSES = ['OPEN', 'IN_PROGRESS', 'VERIFICATION', 'CLOSED'] as const;

export type NcStatus = (typeof NC_STATUSES)[number];

/** Etiquetas en español (regla 7: la UI nunca muestra el enum crudo). */
export const NC_LABELS = {
  source: {
    PRODUCTION: 'Producción', INSPECTION: 'Inspección de calidad',
    CUSTOMER_COMPLAINT: 'Reclamo de cliente', AUDIT: 'Auditoría', SUPPLIER: 'Proveedor',
  } as Record<string, string>,
  severity: { MINOR: 'Menor', MAJOR: 'Mayor', CRITICAL: 'Crítica' } as Record<string, string>,
  disposition: {
    REWORK: 'Reproceso', SCRAP: 'Desecho', CONCESSION: 'Concesión (uso bajo autorización)', RETURN: 'Devolución',
  } as Record<string, string>,
  status: {
    OPEN: 'Abierta', IN_PROGRESS: 'En tratamiento', VERIFICATION: 'Verificando eficacia', CLOSED: 'Cerrada',
  } as Record<string, string>,
};

export interface NcTransitionInput {
  status: NcStatus;
  disposition?: string | null;
  rootCause?: string | null;
  correctiveAction?: string | null;
  effectivenessCheck?: string | null;
}

/**
 * Motor PURO: valida que el avance de estado cumpla los requisitos de la norma.
 * Devuelve el motivo del rechazo (string) o null si la transición es válida.
 */
export function checkTransition(current: NcStatus, next: NcTransitionInput): string | null {
  const order: Record<NcStatus, number> = { OPEN: 0, IN_PROGRESS: 1, VERIFICATION: 2, CLOSED: 3 };
  if (current === 'CLOSED' && next.status !== 'CLOSED') {
    return 'Una no conformidad cerrada no se reabre: registra una nueva si el problema reaparece.';
  }
  if (order[next.status] > order[current] + 1) {
    return 'No se puede saltar etapas del tratamiento: avanza paso a paso (ISO 9001 §10.2).';
  }
  // §8.7: para tratar el producto no conforme hay que decidir su disposición.
  if (next.status === 'IN_PROGRESS' && !next.disposition) {
    return 'Indica la disposición del producto no conforme (reproceso, desecho, concesión o devolución) — ISO 9001 §8.7.';
  }
  // §10.2: no se verifica nada sin causa raíz y acción correctiva.
  if (next.status === 'VERIFICATION') {
    if (!next.rootCause?.trim()) return 'Registra la causa raíz antes de pasar a verificación (ISO 9001 §10.2).';
    if (!next.correctiveAction?.trim()) return 'Registra la acción correctiva antes de pasar a verificación (ISO 9001 §10.2).';
  }
  // §10.2: el cierre exige constancia de que la acción FUE EFICAZ.
  if (next.status === 'CLOSED' && !next.effectivenessCheck?.trim()) {
    return 'Para cerrar debes registrar la verificación de eficacia de la acción correctiva (ISO 9001 §10.2).';
  }
  return null;
}

// ─── Consultas ────────────────────────────────────────────────

export async function listNonConformities(companyId: string, filters?: {
  status?: string; severity?: string; productionOrderId?: string;
}) {
  return prisma.nonConformity.findMany({
    where: {
      companyId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.severity ? { severity: filters.severity } : {}),
      ...(filters?.productionOrderId ? { productionOrderId: filters.productionOrderId } : {}),
    },
    include: {
      productionOrder: { select: { id: true, poNumber: true, lotNumber: true } },
      inspection: { select: { id: true, inspectionNumber: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });
}

export async function getNonConformity(id: string, companyId: string) {
  const nc = await prisma.nonConformity.findFirst({
    where: { id, companyId },
    include: {
      productionOrder: { select: { id: true, poNumber: true, lotNumber: true } },
      inspection: { select: { id: true, inspectionNumber: true, status: true } },
    },
  });
  if (!nc) throw AppError.notFound('No conformidad no encontrada', 'NC_NOT_FOUND');
  return nc;
}

// ─── Alta ─────────────────────────────────────────────────────

export async function createNonConformity(companyId: string, userId: string, data: {
  source: string; severity?: string; description: string;
  productionOrderId?: string; inspectionId?: string; productId?: string; lotNumber?: string;
  responsibleUserId?: string; dueDate?: string;
}) {
  if (!data.description?.trim()) {
    throw AppError.badRequest('Describe la no conformidad detectada', 'NC_DESCRIPTION_REQUIRED');
  }
  const source = (data.source ?? 'PRODUCTION').toUpperCase();
  if (!NC_SOURCES.includes(source as (typeof NC_SOURCES)[number])) {
    throw AppError.badRequest(`Origen no válido: ${source}`, 'NC_INVALID_SOURCE');
  }
  const severity = (data.severity ?? 'MINOR').toUpperCase();
  if (!NC_SEVERITIES.includes(severity as (typeof NC_SEVERITIES)[number])) {
    throw AppError.badRequest(`Severidad no válida: ${severity}`, 'NC_INVALID_SEVERITY');
  }

  const ncNumber = await prisma.$transaction((tx) =>
    getNextDocumentNumber(tx, companyId, 'NON_CONFORMITY', 'RNC-'));

  return prisma.nonConformity.create({
    data: {
      companyId,
      ncNumber,
      source,
      severity,
      description: data.description.trim(),
      productionOrderId: data.productionOrderId,
      inspectionId: data.inspectionId,
      productId: data.productId,
      lotNumber: data.lotNumber,
      responsibleUserId: data.responsibleUserId,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      createdBy: userId,
    },
  });
}

// ─── Avance del tratamiento (CAPA) ────────────────────────────

export async function updateNonConformity(id: string, companyId: string, userId: string, data: {
  status?: string; disposition?: string; rootCause?: string; correctiveAction?: string;
  effectivenessCheck?: string; responsibleUserId?: string; dueDate?: string; severity?: string;
}) {
  const nc = await prisma.nonConformity.findFirst({ where: { id, companyId } });
  if (!nc) throw AppError.notFound('No conformidad no encontrada', 'NC_NOT_FOUND');

  const nextStatus = (data.status ?? nc.status).toUpperCase() as NcStatus;
  if (!NC_STATUSES.includes(nextStatus)) {
    throw AppError.badRequest(`Estado no válido: ${nextStatus}`, 'NC_INVALID_STATUS');
  }

  // El motor puro valida contra los datos RESULTANTES (los ya guardados + los nuevos).
  const error = checkTransition(nc.status as NcStatus, {
    status: nextStatus,
    disposition: data.disposition ?? nc.disposition,
    rootCause: data.rootCause ?? nc.rootCause,
    correctiveAction: data.correctiveAction ?? nc.correctiveAction,
    effectivenessCheck: data.effectivenessCheck ?? nc.effectivenessCheck,
  });
  if (error) throw AppError.badRequest(error, 'NC_INVALID_TRANSITION');

  const closing = nextStatus === 'CLOSED' && nc.status !== 'CLOSED';

  return prisma.nonConformity.update({
    where: { id },
    data: {
      status: nextStatus,
      ...(data.disposition !== undefined ? { disposition: data.disposition } : {}),
      ...(data.rootCause !== undefined ? { rootCause: data.rootCause } : {}),
      ...(data.correctiveAction !== undefined ? { correctiveAction: data.correctiveAction } : {}),
      ...(data.effectivenessCheck !== undefined ? { effectivenessCheck: data.effectivenessCheck } : {}),
      ...(data.responsibleUserId !== undefined ? { responsibleUserId: data.responsibleUserId } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
      ...(data.severity ? { severity: data.severity.toUpperCase() } : {}),
      ...(closing ? { closedAt: new Date(), closedBy: userId } : {}),
    },
  });
}

// ─── Indicadores de calidad (ISO 9001 §9.1 seguimiento y medición) ───

export interface QualityKPIs {
  ncAbiertas: number;
  ncCriticas: number;
  ncVencidas: number; // fuera del plazo comprometido
  lotesEnCuarentena: number;
  lotesRechazados: number;
  inspeccionesMes: number;
  tasaAprobacion: number | null; // % de inspecciones aprobadas del mes
}

export async function getQualityKPIs(companyId: string): Promise<QualityKPIs> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [ncAbiertas, ncCriticas, ncVencidas, lotesEnCuarentena, lotesRechazados, inspecciones] = await Promise.all([
    prisma.nonConformity.count({ where: { companyId, status: { not: 'CLOSED' } } }),
    prisma.nonConformity.count({ where: { companyId, status: { not: 'CLOSED' }, severity: 'CRITICAL' } }),
    prisma.nonConformity.count({ where: { companyId, status: { not: 'CLOSED' }, dueDate: { lt: now } } }),
    prisma.productionOrder.count({ where: { companyId, qualityStatus: 'QUARANTINE' } }),
    prisma.productionOrder.count({ where: { companyId, qualityStatus: 'REJECTED' } }),
    prisma.qualityInspection.findMany({
      where: { companyId, createdAt: { gte: startOfMonth } },
      select: { status: true },
    }),
  ]);

  const aprobadas = inspecciones.filter((i) => i.status === 'PASSED').length;
  return {
    ncAbiertas, ncCriticas, ncVencidas, lotesEnCuarentena, lotesRechazados,
    inspeccionesMes: inspecciones.length,
    tasaAprobacion: inspecciones.length ? Math.round((aprobadas / inspecciones.length) * 1000) / 10 : null,
  };
}
