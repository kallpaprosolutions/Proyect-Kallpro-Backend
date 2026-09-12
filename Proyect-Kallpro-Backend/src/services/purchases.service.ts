import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { registerMovement } from './inventory.service';
import { recordPerformance } from './supplier-scoring.service';
import { createPOReceiptEntry, createAdvancePaymentEntry, createBalancePaymentEntry } from './journal.service';
import { getRequiredLevels } from './approval-matrix.service';
import { recordAudit, diffRecords } from '../utils/audit';
import { getErpConfig } from './erp-config.service';
import { getNextDocumentNumber } from '../utils/sequence.helper';
import { logFieldChange } from './chatter.service';
import { hasUnitConversion, purchaseToStockQuantity, purchaseToStockUnitPrice } from './purchases/engines/purchase-unit.engine';
// ============================================================
// PROVEEDORES
// ============================================================

export async function getSuppliers(companyId: string) {
  return prisma.supplier.findMany({
    where: { companyId, isActive: true },
    orderBy: { name: 'asc' },
  });
}

export async function getSupplierById(id: string, companyId: string) {
  return prisma.supplier.findFirst({ where: { id, companyId } });
}

export async function createSupplier(companyId: string, data: any) {
  return prisma.supplier.create({ data: { ...data, companyId } });
}

export async function updateSupplier(id: string, companyId: string, data: any, actorId?: string) {
  const before = await prisma.supplier.findFirst({ where: { id, companyId } });
  const updated = await prisma.supplier.update({ where: { id }, data });
  await recordAudit({ companyId, userId: actorId, action: 'UPDATE', entityType: 'Supplier', entityId: id, changes: diffRecords(before, updated) });
  return updated;
}

// ============================================================
// ÓRDENES DE COMPRA
// ============================================================

export async function getPurchaseOrders(companyId: string) {
  return prisma.purchaseOrder.findMany({
    where: { companyId },
    include: { supplier: true, items: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPurchaseOrderById(id: string, companyId: string) {
  return prisma.purchaseOrder.findFirst({
    where: { id, companyId },
    include: {
      supplier: true,
      deliveryLocation: { select: { id: true, code: true, zone: true, rack: true, level: true, warehouse: { select: { name: true } } } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true, avgCost: true } },
        },
      },
    },
  });
}

export async function createPurchaseOrder(companyId: string, data: {
  supplierId: string;
  deliveryDate?: Date;
  notes?: string;
  advancePercent?: number;
  deliveryLocationId?: string;
  // `quantityUnit: 'PURCHASE'` → `quantity`/`unitPrice` vienen en la unidad de COMPRA del
  // producto (CAJA, PAQUETE...) y se convierten a unidad de stock antes de guardar (C3, resto
  // pendiente: unidad compra≠venta). Sin el flag (o producto sin `purchaseUnit` configurado)
  // el comportamiento es exactamente el de siempre.
  items: { productId: string; quantity: number; unitPrice: number; quantityUnit?: 'PURCHASE' | 'STOCK' }[];
}) {
  const cfg = await getErpConfig(companyId);

  const productIds = data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, companyId },
    select: { id: true, unit: true, purchaseUnit: true, purchaseConversionFactor: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const itemsData = data.items.map((item) => {
    const product = productMap.get(item.productId);
    const factor = Number(product?.purchaseConversionFactor ?? 1);
    const useConversion = item.quantityUnit === 'PURCHASE' && product
      && hasUnitConversion({ purchaseUnit: product.purchaseUnit, purchaseConversionFactor: factor, stockUnit: product.unit });

    if (!useConversion) {
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice),
        lineTotal: new Prisma.Decimal(item.quantity * item.unitPrice),
        purchaseQuantity: null as Prisma.Decimal | null,
        purchaseUnitLabel: null as string | null,
      };
    }

    const stockQty = purchaseToStockQuantity(item.quantity, factor);
    const stockUnitPrice = purchaseToStockUnitPrice(item.unitPrice, factor);
    return {
      productId: item.productId,
      quantity: stockQty,
      unitPrice: new Prisma.Decimal(stockUnitPrice),
      lineTotal: new Prisma.Decimal(stockQty * stockUnitPrice),
      purchaseQuantity: new Prisma.Decimal(item.quantity),
      purchaseUnitLabel: product!.purchaseUnit,
    };
  });

  const totalAmount = itemsData.reduce((sum, item) => sum + Number(item.lineTotal), 0);
  const advancePercent = Math.max(0, Math.min(100, data.advancePercent ?? 0));
  const advanceAmount = (totalAmount * advancePercent) / 100;

  return prisma.$transaction(async (tx) => {
    const poNumber = await getNextDocumentNumber(tx, companyId, 'PURCHASE_ORDER', cfg.documents.poPrefix);
    return tx.purchaseOrder.create({
      data: {
        companyId,
        supplierId: data.supplierId,
        poNumber,
        totalAmount: new Prisma.Decimal(totalAmount),
        deliveryDate: data.deliveryDate,
        notes: data.notes,
        advancePercent,
        advanceAmount: new Prisma.Decimal(advanceAmount),
        advanceStatus: advancePercent > 0 ? 'PENDING' : 'NONE',
        deliveryLocationId: data.deliveryLocationId || null,
        items: { create: itemsData },
      },
      include: { supplier: true, items: true },
    });
  });
}

// ── Pago de anticipo ──
export async function payAdvance(id: string, companyId: string) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, companyId } });
  if (!po) throw new Error('PO_NOT_FOUND');
  if (po.advanceStatus !== 'PENDING') throw new Error('ADVANCE_NOT_PENDING');

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: { advanceStatus: 'PAID', advancePaidAt: new Date() },
  });
  try { await createAdvancePaymentEntry(companyId, id); }
  catch (e) { logger.warn('[purchases] createAdvancePaymentEntry failed (non-fatal)', { err: e }); }
  return updated;
}

// ── Pago de saldo (solo tras conformidad de recepción) ──
export async function payBalance(id: string, companyId: string) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, companyId } });
  if (!po) throw new Error('PO_NOT_FOUND');
  if (po.balanceStatus === 'PAID') throw new Error('BALANCE_ALREADY_PAID');
  if (!po.qualityConformity) throw new Error('NOT_CONFORM'); // requiere recepción conforme

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: { balanceStatus: 'PAID', balancePaidAt: new Date() },
  });
  try { await createBalancePaymentEntry(companyId, id); }
  catch (e) { logger.warn('[purchases] createBalancePaymentEntry failed (non-fatal)', { err: e }); }
  return updated;
}

export async function updatePOStatus(id: string, companyId: string, status: string, userId?: string) {
  const current = await prisma.purchaseOrder.findFirst({ where: { id, companyId }, select: { status: true } });
  const data: any = { status };
  if (status === 'SUBMITTED') data.submittedAt = new Date();
  if (status === 'APPROVED') { data.approvedAt = new Date(); data.approvedById = userId; }
  const updated = await prisma.purchaseOrder.update({ where: { id }, data });
  if (userId && current) await logFieldChange(companyId, userId, 'PURCHASE_ORDER', id, 'STATUS', current.status, status);
  return updated;
}

export async function submitPurchaseOrder(id: string, companyId: string, userId: string) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, companyId } });
  if (!po) throw new Error('PO_NOT_FOUND');
  if (po.status !== 'DRAFT') throw new Error('PO_NOT_DRAFT');

  const required = await getRequiredLevels(companyId, Number(po.totalAmount));
  const nextStatus = required >= 1 ? 'PENDING_L1' : 'APPROVED';

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: nextStatus,
      requiredLevels: required,
      currentLevel: 0,
      submittedAt: new Date(),
    },
  });
  await logFieldChange(companyId, userId, 'PURCHASE_ORDER', id, 'STATUS', po.status, nextStatus);
  return updated;
}

export async function approvePurchaseOrder(
  id: string,
  companyId: string,
  level: number,
  approverId: string,
  notes?: string,
) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, companyId } });
  if (!po) throw new Error('PO_NOT_FOUND');

  const expectedStatus = `PENDING_L${level}`;
  if (po.status !== expectedStatus) throw new Error(`PO_WRONG_STATUS:${po.status}`);

  const levelKey = `l${level}` as 'l1' | 'l2' | 'l3' | 'l4' | 'l5';
  const data: any = {
    [`${levelKey}ApproverId`]: approverId,
    [`${levelKey}ApprovedAt`]: new Date(),
    [`${levelKey}Notes`]:     notes ?? null,
    currentLevel: level,
  };

  const isLast = level >= po.requiredLevels;
  if (isLast) {
    data.status       = 'APPROVED';
    data.approvedAt   = new Date();
    data.approvedById = approverId;
  } else {
    data.status = `PENDING_L${level + 1}`;
  }

  const updated = await prisma.purchaseOrder.update({ where: { id }, data });
  await logFieldChange(companyId, approverId, 'PURCHASE_ORDER', id, 'STATUS', po.status, data.status);
  return updated;
}

export async function rejectPurchaseOrder(
  id: string,
  companyId: string,
  rejectedBy: string,
  reason: string,
) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, companyId } });
  if (!po) throw new Error('PO_NOT_FOUND');
  if (!po.status.startsWith('PENDING_L') && po.status !== 'SUBMITTED') {
    throw new Error('PO_NOT_PENDING');
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status:         'REJECTED',
      rejectedBy,
      rejectedAt:     new Date(),
      rejectionReason: reason,
    },
  });
  await logFieldChange(companyId, rejectedBy, 'PURCHASE_ORDER', id, 'STATUS', po.status, 'REJECTED');
  return updated;
}

// Recibir OC → genera entradas automáticas al inventario.
// Soporta recepción parcial: `lines` indica cuánto recibir de cada ítem.
// Si `lines` se omite, se recibe todo lo pendiente (recepción total).
export async function receivePurchaseOrder(
  id: string,
  companyId: string,
  warehouseId: string,
  userId: string,
  lines?: { itemId: string; quantity: number }[],
  conformity?: { qualityOk?: boolean; notes?: string },
) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, companyId },
    include: { items: true },
  });

  if (!po) throw new Error('PO_NOT_FOUND');
  if (po.status === 'RECEIVED') throw new Error('PO_ALREADY_RECEIVED');
  if (po.status === 'CANCELLED') throw new Error('PO_CANCELLED');

  const lineMap = new Map<string, number>();
  if (lines) for (const l of lines) lineMap.set(l.itemId, l.quantity);

  let anyReceived = false;

  // Registrar entrada de inventario por cada item (solo la cantidad nueva)
  for (const item of po.items) {
    const pending = item.quantity - item.receivedQuantity;
    if (pending <= 0) continue;

    // Cantidad a recibir ahora: la indicada en `lines`, o todo lo pendiente
    let qty = lines ? (lineMap.get(item.id) ?? 0) : pending;
    if (qty <= 0) continue;
    if (qty > pending) throw new Error('RECEIVE_EXCEEDS_PENDING');

    if (item.productId) {
      await registerMovement(companyId, {
        productId: item.productId,
        warehouseId,
        type: 'IN',
        quantity: qty,
        unitCost: Number(item.unitPrice),
        reference: po.poNumber,
        notes: `Recepción OC ${po.poNumber}`,
        createdBy: userId,
      });
    }

    await prisma.pOItem.update({
      where: { id: item.id },
      data: { receivedQuantity: item.receivedQuantity + qty },
    });
    anyReceived = true;
  }

  if (!anyReceived) throw new Error('NOTHING_TO_RECEIVE');

  // Recalcular estado: RECEIVED si todo está recibido, si no PARTIAL
  const refreshed = await prisma.pOItem.findMany({ where: { poId: po.id } });
  const allReceived = refreshed.every((i) => i.receivedQuantity >= i.quantity);
  const newStatus = allReceived ? 'RECEIVED' : 'PARTIAL';

  // Conformidad (buen estado / a tiempo) — solo se registra en recepción final
  const conformityData: any = { status: newStatus };
  if (allReceived) {
    const now = new Date();
    const onTime = po.deliveryDate ? now.getTime() <= new Date(po.deliveryDate).getTime() : true;
    conformityData.receivedOnTime    = onTime;
    conformityData.qualityConformity = conformity?.qualityOk ?? true;
    conformityData.conformityBy      = userId;
    conformityData.conformityAt      = now;
    conformityData.conformityNotes   = conformity?.notes ?? null;
  }

  const updatedPO = await prisma.purchaseOrder.update({
    where: { id },
    data: conformityData,
  });

  // Performance y asiento contable solo en la recepción final (non-blocking)
  if (allReceived) {
    try {
      const now = new Date();
      await recordPerformance(companyId, {
        supplierId:      po.supplierId,
        poId:            po.id,
        deliveredDate:   now,
        promisedDate:    po.deliveryDate ?? undefined,
        poTotal:         Number(po.totalAmount),
        defectQty:       conformity?.qualityOk === false ? 1 : 0,
      });
    } catch (perfErr) {
      logger.warn('[purchases] recordPerformance failed (non-fatal)', { err: perfErr });
    }

    try {
      await createPOReceiptEntry(companyId, po.id);
    } catch (jrnErr) {
      logger.warn('[purchases] createPOReceiptEntry failed (non-fatal)', { err: jrnErr });
    }
  }

  return updatedPO;
}
