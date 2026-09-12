import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { registerMovement } from './inventory.service';
import { INVENTORY_ADJUSTMENT_APPROVERS } from '../auth/roles';
import { getErpConfig } from './erp-config.service';
import { getNextDocumentNumber } from '../utils/sequence.helper';
/**
 * Ajustes de inventario con DOBLE AUTORIZACIÓN.
 *
 * Flujo:
 *   1. El bodeguero SOLICITA el ajuste → se crea en estado PENDING (no mueve stock).
 *   2. Un responsable de finanzas/gerencia (ver INVENTORY_ADJUSTMENT_APPROVERS) lo
 *      APRUEBA → recién ahí se registra el movimiento de inventario (que recalcula
 *      costo promedio/FIFO y genera el asiento contable de ajuste) y pasa a
 *      APPROVED_APPLIED. El aprobador debe ser distinto del solicitante.
 *   3. O lo RECHAZA → REJECTED, sin tocar stock.
 */

const PRODUCT_SELECT = { id: true, name: true, sku: true, unit: true, avgCost: true } as const;
const WAREHOUSE_SELECT = { id: true, name: true } as const;

export interface CreateAdjustmentInput {
  productId: string;
  warehouseId: string;
  type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  quantity: number;
  unitCost?: number;
  reason: string;
  notes?: string;
}

export async function createAdjustmentRequest(
  companyId: string,
  data: CreateAdjustmentInput,
  requestedBy: string,
) {
  const product = await prisma.product.findFirst({ where: { id: data.productId, companyId } });
  if (!product) throw new Error('PRODUCT_NOT_FOUND');
  const warehouse = await prisma.warehouse.findFirst({ where: { id: data.warehouseId, companyId } });
  if (!warehouse) throw new Error('WAREHOUSE_NOT_FOUND');

  const cfg = await getErpConfig(companyId);

  // Para entradas se usa el costo unitario indicado; si no llega, el costo promedio actual.
  // Para salidas el costo lo determina el motor de inventario al aplicar (no se exige).
  const unitCost = data.unitCost != null ? data.unitCost : Number(product.avgCost);

  const created = await prisma.$transaction(async (tx) => {
    const adjNumber = await getNextDocumentNumber(tx, companyId, 'INVENTORY_ADJUSTMENT', cfg.documents.adjPrefix);
    return tx.inventoryAdjustment.create({
      data: {
        companyId,
        adjNumber,
        productId: data.productId,
        warehouseId: data.warehouseId,
        type: data.type,
        quantity: new Prisma.Decimal(data.quantity),
        unitCost: new Prisma.Decimal(unitCost),
        reason: data.reason,
        notes: data.notes,
        requestedBy,
      },
      include: { product: { select: PRODUCT_SELECT }, warehouse: { select: WAREHOUSE_SELECT } },
    });
  });

  // Si la doble autorización está DESACTIVADA en Configuración, se aplica de inmediato.
  if (!cfg.inventory.requireAdjustmentApproval) {
    const movement = await registerMovement(companyId, {
      productId: created.productId,
      warehouseId: created.warehouseId,
      type: created.type as 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT',
      quantity: Number(created.quantity),
      unitCost: Number(created.unitCost),
      reference: created.adjNumber,
      notes: `Ajuste aplicado (sin doble autorización) · ${created.reason}`,
      createdBy: requestedBy,
    });
    return prisma.inventoryAdjustment.update({
      where: { id: created.id },
      data: {
        status: 'APPROVED_APPLIED', approvedBy: requestedBy, approvedAt: new Date(),
        movementId: (movement as any)?.id ?? null,
        journalEntryId: (movement as any)?.journalEntryId ?? null,
      },
      include: { product: { select: PRODUCT_SELECT }, warehouse: { select: WAREHOUSE_SELECT } },
    });
  }

  return created;
}

/** Enriquecer registros con nombres de solicitante/aprobador (no hay relación directa con User). */
async function attachUserNames<T extends { requestedBy: string; approvedBy: string | null }>(
  companyId: string,
  rows: T[],
) {
  const ids = Array.from(new Set(rows.flatMap((r) => [r.requestedBy, r.approvedBy]).filter(Boolean) as string[]));
  if (ids.length === 0) return rows.map((r) => ({ ...r, requestedByName: null, approvedByName: null }));
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, companyId },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  const nameOf = (id: string | null) => {
    if (!id) return null;
    const u = users.find((x) => x.id === id);
    if (!u) return null;
    const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    return full || u.email;
  };
  return rows.map((r) => ({ ...r, requestedByName: nameOf(r.requestedBy), approvedByName: nameOf(r.approvedBy) }));
}

export async function listAdjustments(companyId: string, status?: string) {
  const rows = await prisma.inventoryAdjustment.findMany({
    where: { companyId, ...(status ? { status } : {}) },
    include: { product: { select: PRODUCT_SELECT }, warehouse: { select: WAREHOUSE_SELECT } },
    orderBy: { requestedAt: 'desc' },
    take: 300,
  });
  return attachUserNames(companyId, rows);
}

export async function approveAdjustment(
  id: string,
  companyId: string,
  approverId: string,
  approverRole: string,
) {
  const adj = await prisma.inventoryAdjustment.findFirst({ where: { id, companyId } });
  if (!adj) throw new Error('ADJUSTMENT_NOT_FOUND');
  if (adj.status !== 'PENDING') throw new Error('NOT_PENDING');
  // El aprobador NO puede ser quien solicitó (doble autorización real).
  if (adj.requestedBy === approverId) throw new Error('SELF_APPROVAL');
  if (!(INVENTORY_ADJUSTMENT_APPROVERS as readonly string[]).includes(approverRole)) {
    throw new Error('NOT_AUTHORIZED');
  }

  // Aplicar el ajuste al stock (registerMovement maneja su propia transacción,
  // recálculo de costo y asiento contable de ajuste). Si lanza (ej. stock
  // insuficiente), el ajuste permanece PENDING.
  const movement = await registerMovement(companyId, {
    productId: adj.productId,
    warehouseId: adj.warehouseId,
    type: adj.type as 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT',
    quantity: Number(adj.quantity),
    unitCost: Number(adj.unitCost),
    reference: adj.adjNumber,
    notes: `Ajuste aprobado · ${adj.reason}${adj.notes ? ` · ${adj.notes}` : ''}`,
    createdBy: approverId,
  });

  return prisma.inventoryAdjustment.update({
    where: { id },
    data: {
      status: 'APPROVED_APPLIED',
      approvedBy: approverId,
      approvedAt: new Date(),
      movementId: (movement as any)?.id ?? null,
      journalEntryId: (movement as any)?.journalEntryId ?? null,
    },
    include: { product: { select: PRODUCT_SELECT }, warehouse: { select: WAREHOUSE_SELECT } },
  });
}

export async function rejectAdjustment(
  id: string,
  companyId: string,
  approverId: string,
  reason: string,
) {
  const adj = await prisma.inventoryAdjustment.findFirst({ where: { id, companyId } });
  if (!adj) throw new Error('ADJUSTMENT_NOT_FOUND');
  if (adj.status !== 'PENDING') throw new Error('NOT_PENDING');
  if (adj.requestedBy === approverId) throw new Error('SELF_APPROVAL');

  return prisma.inventoryAdjustment.update({
    where: { id },
    data: { status: 'REJECTED', approvedBy: approverId, approvedAt: new Date(), rejectionReason: reason },
    include: { product: { select: PRODUCT_SELECT }, warehouse: { select: WAREHOUSE_SELECT } },
  });
}
