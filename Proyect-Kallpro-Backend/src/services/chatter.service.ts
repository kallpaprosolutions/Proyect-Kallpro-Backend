import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';

// ============================================================
// CHATTER LIGERO (mejora A2 — patrón Odoo; A2.2 amplía con log y notas)
// ============================================================
// Hilo de mensajes por documento (OC, factura, pedido, requisición).
// Multi-tenant: todo filtra por companyId (regla 1).

export const CHATTER_ENTITY_TYPES = ['PURCHASE_ORDER', 'SALES_ORDER', 'INVOICE', 'REQUISITION', 'SALES_QUOTATION', 'CREDIT_NOTE', 'DEBIT_NOTE', 'DELIVERY_GUIDE'] as const;
export type ChatterEntityType = (typeof CHATTER_ENTITY_TYPES)[number];

export const MESSAGE_KINDS = ['MESSAGE', 'NOTE'] as const; // kinds que un usuario puede publicar (LOG es solo automático)
export type MessageKind = (typeof MESSAGE_KINDS)[number] | 'LOG';

export interface ChatterMessage {
  id: string;
  body: string;
  kind: MessageKind;
  logField: string | null;
  logFrom: string | null;
  logTo: string | null;
  createdAt: Date;
  userId: string;
  userName: string; // nombre listo para mostrar (regla 7: la UI no arma strings)
}

const MAX_BODY_LENGTH = 2000;

/** Motor PURO: valida y normaliza el cuerpo de un mensaje. Lanza AppError si es inválido. */
export function normalizeMessageBody(body: unknown): string {
  if (typeof body !== 'string' || body.trim().length === 0) {
    throw AppError.badRequest('El mensaje no puede estar vacío', 'EMPTY_MESSAGE');
  }
  const trimmed = body.trim();
  if (trimmed.length > MAX_BODY_LENGTH) {
    throw AppError.badRequest(`El mensaje supera los ${MAX_BODY_LENGTH} caracteres`, 'MESSAGE_TOO_LONG');
  }
  return trimmed;
}

/** Motor PURO: valida el tipo de publicación manual (mensaje o nota interna). */
export function normalizeMessageKind(kind: unknown): 'MESSAGE' | 'NOTE' {
  if (kind == null) return 'MESSAGE';
  if (!MESSAGE_KINDS.includes(kind as any)) {
    throw AppError.badRequest('Tipo de publicación inválido', 'INVALID_MESSAGE_KIND');
  }
  return kind as 'MESSAGE' | 'NOTE';
}

/** Motor PURO: nombre a mostrar de un usuario (fallback al email). */
export function displayName(user: { firstName: string | null; lastName: string | null; email: string }): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email;
}

export function assertChatterEntityType(entityType: string): asserts entityType is ChatterEntityType {
  if (!CHATTER_ENTITY_TYPES.includes(entityType as ChatterEntityType)) {
    throw AppError.badRequest(`entityType no soportado: ${entityType}`, 'UNSUPPORTED_ENTITY_TYPE');
  }
}

const toMessage = (m: {
  id: string; body: string; kind: string; logField: string | null; logFrom: string | null; logTo: string | null;
  createdAt: Date; userId: string;
  user: { firstName: string | null; lastName: string | null; email: string };
}): ChatterMessage => ({
  id: m.id, body: m.body, kind: m.kind as MessageKind,
  logField: m.logField, logFrom: m.logFrom, logTo: m.logTo,
  createdAt: m.createdAt, userId: m.userId,
  userName: displayName(m.user),
});

/** Lista el hilo de mensajes de un documento (ascendente, como un chat). */
export async function listMessages(
  companyId: string,
  entityType: string,
  entityId: string,
): Promise<ChatterMessage[]> {
  assertChatterEntityType(entityType);
  const rows = await prisma.documentMessage.findMany({
    where: { companyId, entityType, entityId },
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  return rows.map(toMessage);
}

/** Publica un mensaje (o nota interna) en el hilo de un documento. */
export async function postMessage(
  companyId: string,
  userId: string,
  entityType: string,
  entityId: string,
  body: unknown,
  kind?: unknown,
): Promise<ChatterMessage> {
  assertChatterEntityType(entityType);
  const normalized = normalizeMessageBody(body);
  const normalizedKind = normalizeMessageKind(kind);
  const row = await prisma.documentMessage.create({
    data: { companyId, userId, entityType, entityId, body: normalized, kind: normalizedKind },
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  });
  return toMessage(row);
}

/**
 * Registra automáticamente en el hilo el cambio de un campo clave (mejora A2.2 — patrón
 * Odoo: "SdP → Orden de compra (Estado)"). Se llama explícitamente desde el punto exacto del
 * servicio donde ocurre la transición (no un trigger genérico de BD) — así el log solo
 * registra cambios que de verdad importan, con el actor correcto.
 * No lanza si `from === to` (evita ruido cuando una función "cambia" el campo a su mismo valor).
 */
export async function logFieldChange(
  companyId: string,
  userId: string,
  entityType: ChatterEntityType,
  entityId: string,
  field: string,
  from: string | null,
  to: string,
): Promise<void> {
  if (from === to) return;
  await prisma.documentMessage.create({
    data: { companyId, userId, entityType, entityId, body: '', kind: 'LOG', logField: field, logFrom: from, logTo: to },
  });
}

// ============================================================
// SEGUIDORES (mejora A2.2)
// ============================================================
// Sin canal de notificación push/email todavía: hoy es visibilidad (quién sigue el
// documento), no una bandeja de avisos. Seguir/dejar de seguir es autogestionado.

export interface Follower { userId: string; userName: string }

const toFollower = (f: { userId: string; user: { firstName: string | null; lastName: string | null; email: string } }): Follower =>
  ({ userId: f.userId, userName: displayName(f.user) });

/** Lista quién sigue el documento. */
export async function listFollowers(companyId: string, entityType: string, entityId: string): Promise<Follower[]> {
  assertChatterEntityType(entityType);
  const rows = await prisma.documentFollower.findMany({
    where: { companyId, entityType, entityId },
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toFollower);
}

/** Sigue el documento (idempotente: seguir dos veces no falla ni duplica). */
export async function followEntity(companyId: string, userId: string, entityType: string, entityId: string): Promise<void> {
  assertChatterEntityType(entityType);
  await prisma.documentFollower.upsert({
    where: { entityType_entityId_userId: { entityType, entityId, userId } },
    create: { companyId, userId, entityType, entityId },
    update: {},
  });
}

/** Deja de seguir el documento (idempotente). */
export async function unfollowEntity(companyId: string, userId: string, entityType: string, entityId: string): Promise<void> {
  assertChatterEntityType(entityType);
  await prisma.documentFollower.deleteMany({ where: { companyId, userId, entityType, entityId } });
}
