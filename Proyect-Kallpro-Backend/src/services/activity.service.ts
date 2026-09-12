import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';
import { CHATTER_ENTITY_TYPES, ChatterEntityType, displayName } from './chatter.service';

// ============================================================
// ACTIVIDADES PROGRAMADAS (mejora A3 — patrón Odoo)
// ============================================================
// To-do agendado sobre un documento (llamar, revisar, pagar…): mismo entityType que el
// Chatter (OC, factura, pedido, requisición), para que ambos convivan en el mismo detalle.

export const ACTIVITY_TYPES = ['LLAMAR', 'REUNION', 'REVISAR', 'PAGAR', 'EMAIL', 'OTRO'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type ActivityStatus = 'DONE' | 'OVERDUE' | 'TODAY' | 'UPCOMING';

export interface Activity {
  id: string;
  entityType: string;
  entityId: string;
  type: ActivityType;
  note: string | null;
  dueDate: Date;
  assignedToId: string;
  assignedToName: string;
  createdById: string;
  createdByName: string;
  doneAt: Date | null;
  createdAt: Date;
  status: ActivityStatus;
}

const MAX_NOTE_LENGTH = 500;

// ── Motor PURO (sin BD) ─────────────────────────────────────────────────────

/** Medianoche local del día de `d` — para comparar fechas sin la hora. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Clasifica una actividad según su vencimiento, sin tocar BD — testeable en aislamiento.
 * Una actividad completada siempre es DONE, sin importar si venció antes o después de
 * completarse (regla de negocio: lo hecho no se re-clasifica por fecha).
 */
export function computeActivityStatus(dueDate: Date, doneAt: Date | null, now: Date = new Date()): ActivityStatus {
  if (doneAt) return 'DONE';
  const due = startOfDay(dueDate);
  const today = startOfDay(now);
  if (due < today) return 'OVERDUE';
  if (due === today) return 'TODAY';
  return 'UPCOMING';
}

export function assertActivityEntityType(entityType: string): asserts entityType is ChatterEntityType {
  if (!CHATTER_ENTITY_TYPES.includes(entityType as ChatterEntityType)) {
    throw AppError.badRequest(`entityType no soportado: ${entityType}`, 'UNSUPPORTED_ENTITY_TYPE');
  }
}

/** Motor PURO: valida tipo, nota y fecha límite de una actividad nueva. */
export function normalizeActivityInput(input: { type: unknown; note?: unknown; dueDate: unknown }): {
  type: ActivityType; note: string | null; dueDate: Date;
} {
  if (!ACTIVITY_TYPES.includes(input.type as ActivityType)) {
    throw AppError.badRequest('Tipo de actividad inválido', 'INVALID_ACTIVITY_TYPE');
  }
  const dueDate = new Date(input.dueDate as string);
  if (isNaN(dueDate.getTime())) {
    throw AppError.badRequest('Fecha límite inválida', 'INVALID_DUE_DATE');
  }
  let note: string | null = null;
  if (input.note != null) {
    const trimmed = String(input.note).trim();
    if (trimmed.length > MAX_NOTE_LENGTH) {
      throw AppError.badRequest(`La nota supera los ${MAX_NOTE_LENGTH} caracteres`, 'NOTE_TOO_LONG');
    }
    note = trimmed || null;
  }
  return { type: input.type as ActivityType, note, dueDate };
}

// ── Servicio (con BD) ────────────────────────────────────────────────────────

type ActivityRow = {
  id: string; entityType: string; entityId: string; type: string; note: string | null;
  dueDate: Date; assignedToId: string; createdById: string; doneAt: Date | null; createdAt: Date;
  assignedTo: { firstName: string | null; lastName: string | null; email: string };
  createdBy: { firstName: string | null; lastName: string | null; email: string };
};

const toActivity = (row: ActivityRow, now: Date = new Date()): Activity => ({
  id: row.id,
  entityType: row.entityType,
  entityId: row.entityId,
  type: row.type as ActivityType,
  note: row.note,
  dueDate: row.dueDate,
  assignedToId: row.assignedToId,
  assignedToName: displayName(row.assignedTo),
  createdById: row.createdById,
  createdByName: displayName(row.createdBy),
  doneAt: row.doneAt,
  createdAt: row.createdAt,
  status: computeActivityStatus(row.dueDate, row.doneAt, now),
});

const INCLUDE_USERS = {
  assignedTo: { select: { firstName: true, lastName: true, email: true } },
  createdBy: { select: { firstName: true, lastName: true, email: true } },
} as const;

/** Actividades agendadas sobre un documento (mostradas junto al Chatter en el detalle). */
export async function listActivitiesForEntity(
  companyId: string, entityType: string, entityId: string,
): Promise<Activity[]> {
  assertActivityEntityType(entityType);
  const rows = await prisma.activity.findMany({
    where: { companyId, entityType, entityId },
    include: INCLUDE_USERS,
    orderBy: [{ doneAt: 'asc' }, { dueDate: 'asc' }],
  });
  return rows.map((r) => toActivity(r));
}

/** "Mis actividades": pendientes asignadas al usuario actual, vencidas primero. */
export async function listMyActivities(
  companyId: string, userId: string, opts?: { includeDone?: boolean },
): Promise<Activity[]> {
  const rows = await prisma.activity.findMany({
    where: { companyId, assignedToId: userId, ...(opts?.includeDone ? {} : { doneAt: null }) },
    include: INCLUDE_USERS,
    orderBy: [{ dueDate: 'asc' }],
    take: 100,
  });
  const now = new Date();
  return rows.map((r) => toActivity(r, now)).sort((a, b) => {
    // Vencidas primero, luego hoy, luego próximas — dentro de cada grupo, por fecha.
    const order: Record<ActivityStatus, number> = { OVERDUE: 0, TODAY: 1, UPCOMING: 2, DONE: 3 };
    return order[a.status] - order[b.status] || a.dueDate.getTime() - b.dueDate.getTime();
  });
}

/** Crea una actividad sobre un documento, asignada a `assignedToId` (por defecto, quien la crea). */
export async function createActivity(
  companyId: string,
  createdById: string,
  input: { entityType: string; entityId: string; type: unknown; note?: unknown; dueDate: unknown; assignedToId?: string },
): Promise<Activity> {
  assertActivityEntityType(input.entityType);
  const { type, note, dueDate } = normalizeActivityInput(input);
  const assignedToId = input.assignedToId || createdById;

  const assignee = await prisma.user.findFirst({ where: { id: assignedToId, companyId } });
  if (!assignee) throw AppError.badRequest('El usuario asignado no existe en esta empresa', 'ASSIGNEE_NOT_FOUND');

  const row = await prisma.activity.create({
    data: { companyId, entityType: input.entityType, entityId: input.entityId, type, note, dueDate, assignedToId, createdById },
    include: INCLUDE_USERS,
  });
  return toActivity(row);
}

async function findOwnedActivity(id: string, companyId: string, userId: string) {
  const row = await prisma.activity.findFirst({ where: { id, companyId } });
  if (!row) throw AppError.notFound('Actividad no encontrada', 'ACTIVITY_NOT_FOUND');
  if (row.assignedToId !== userId && row.createdById !== userId) {
    throw AppError.forbidden('Solo el responsable o quien la creó puede modificar esta actividad', 'NOT_ACTIVITY_OWNER');
  }
  return row;
}

/** Marca una actividad como hecha. Solo el responsable o quien la creó puede hacerlo. */
export async function completeActivity(id: string, companyId: string, userId: string): Promise<Activity> {
  await findOwnedActivity(id, companyId, userId);
  const row = await prisma.activity.update({ where: { id }, data: { doneAt: new Date() }, include: INCLUDE_USERS });
  return toActivity(row);
}

/** Reabre una actividad completada por error. */
export async function reopenActivity(id: string, companyId: string, userId: string): Promise<Activity> {
  await findOwnedActivity(id, companyId, userId);
  const row = await prisma.activity.update({ where: { id }, data: { doneAt: null }, include: INCLUDE_USERS });
  return toActivity(row);
}

/** Cancela (borra) una actividad agendada por error. */
export async function deleteActivity(id: string, companyId: string, userId: string): Promise<void> {
  await findOwnedActivity(id, companyId, userId);
  await prisma.activity.delete({ where: { id } });
}
