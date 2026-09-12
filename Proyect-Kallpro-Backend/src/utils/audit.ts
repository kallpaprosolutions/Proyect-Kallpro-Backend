import { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Auditoría de datos maestros.
 *
 * Enfoque EXPLÍCITO (no un `$extends` global) por dos razones del código real:
 *   1. Cada servicio instancia su propio PrismaClient → una extensión sobre un cliente
 *      no interceptaría las operaciones hechas por los otros 50+ clientes.
 *   2. `product.update` se llama en cada movimiento de stock (recálculo de avgCost /
 *      lastMovementAt). Un interceptor global inundaría AuditLog con ruido en vez de
 *      registrar cambios de datos maestros (precio, límite de crédito, etc.).
 *
 * Por eso se invoca puntualmente desde las funciones de edición de datos maestros
 * (updateProduct, updateCustomer, updateSupplier), comparando ANTES vs DESPUÉS.
 */

const IGNORED_KEYS = new Set(['updatedAt', 'createdAt']);

/** Normaliza valores Prisma (Decimal, Date) a algo comparable/serializable. */
function normalize(v: any): any {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if (typeof v.toNumber === 'function') return v.toNumber();   // Prisma.Decimal
    if (v instanceof Date) return v.toISOString();
    if (typeof v.toString === 'function' && v.constructor?.name === 'Decimal') return v.toString();
  }
  return v;
}

/** Devuelve { campo: { from, to } } solo de los campos que cambiaron. */
export function diffRecords(before: any, after: any): Record<string, { from: any; to: any }> | null {
  if (!before || !after) return null;
  const changes: Record<string, { from: any; to: any }> = {};
  const keys = new Set([...Object.keys(after)]);
  for (const k of keys) {
    if (IGNORED_KEYS.has(k)) continue;
    const a = normalize(before[k]);
    const b = normalize(after[k]);
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[k] = { from: a, to: b };
  }
  return Object.keys(changes).length ? changes : null;
}

export async function recordAudit(params: {
  companyId: string;
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
}): Promise<void> {
  // Nunca debe romper la operación de negocio si la auditoría falla.
  try {
    await prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        changes: params.changes ? JSON.stringify(params.changes) : null,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (e) {
    logger.warn('[audit] no se pudo registrar (no-fatal)', { err: e });
  }
}
