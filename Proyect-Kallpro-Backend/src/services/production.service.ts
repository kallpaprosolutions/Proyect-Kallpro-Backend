import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { getNextDocumentNumber } from '../utils/sequence.helper';
import { AppError } from '../utils/errors';
import { planBatchConsumption } from './inventory.service';
import { assertPeriodOpen } from './finance/fiscal-period.service';
import { createProductionEntry } from './journal.service';
import { buildLotNumber, computeExpiryDate, checkSanitaryRegistry } from './quality.service';
// ─── Auto-numbering ───────────────────────────────────────────────────────────

async function nextProductionNumber(companyId: string): Promise<string> {
  // Numeración atómica en su propia transacción (el correlativo es independiente
  // de la creación de la orden; un fallo posterior solo deja un hueco, nunca un duplicado).
  return prisma.$transaction((tx) => getNextDocumentNumber(tx, companyId, 'PRODUCTION_ORDER', 'PROD-'));
}

// ─── BOM ──────────────────────────────────────────────────────────────────────

export async function listBOMs(companyId: string) {
  return prisma.billOfMaterials.findMany({
    where: { companyId },
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
      items: {
        include: {
          component: { select: { id: true, name: true, sku: true, unit: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getBOM(id: string, companyId: string) {
  const bom = await prisma.billOfMaterials.findFirst({
    where: { id, companyId },
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
      items: {
        include: {
          component: { select: { id: true, name: true, sku: true, unit: true, avgCost: true } },
        },
      },
    },
  });
  if (!bom) throw new Error('BOM_NOT_FOUND');
  return bom;
}

export async function createBOM(companyId: string, data: {
  productId: string;
  version?: string;
  notes?: string;
  items: Array<{ componentId: string; quantity: number; unit?: string; wastePercent?: number; notes?: string }>;
}) {
  // Deactivate previous versions
  await prisma.billOfMaterials.updateMany({
    where: { companyId, productId: data.productId, isActive: true },
    data: { isActive: false },
  });

  return prisma.billOfMaterials.create({
    data: {
      companyId,
      productId: data.productId,
      version: data.version || '1.0',
      notes: data.notes,
      isActive: true,
      items: {
        create: data.items.map((i) => ({
          componentId: i.componentId,
          quantity: i.quantity,
          unit: i.unit,
          wastePercent: i.wastePercent || 0,
          notes: i.notes,
        })),
      },
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      items: {
        include: { component: { select: { id: true, name: true, sku: true, unit: true } } },
      },
    },
  });
}

export async function updateBOM(id: string, companyId: string, data: {
  version?: string;
  notes?: string;
  isActive?: boolean;
  items?: Array<{ componentId: string; quantity: number; unit?: string; wastePercent?: number; notes?: string }>;
}) {
  const bom = await prisma.billOfMaterials.findFirst({ where: { id, companyId } });
  if (!bom) throw new Error('BOM_NOT_FOUND');

  if (data.items) {
    await prisma.bOMItem.deleteMany({ where: { bomId: id } });
  }

  return prisma.billOfMaterials.update({
    where: { id },
    data: {
      version: data.version,
      notes: data.notes,
      isActive: data.isActive,
      ...(data.items ? {
        items: {
          create: data.items.map((i) => ({
            componentId: i.componentId,
            quantity: i.quantity,
            unit: i.unit,
            wastePercent: i.wastePercent || 0,
            notes: i.notes,
          })),
        },
      } : {}),
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      items: {
        include: { component: { select: { id: true, name: true, sku: true, unit: true } } },
      },
    },
  });
}

// ─── Production Orders ────────────────────────────────────────────────────────

export async function listProductionOrders(companyId: string, status?: string) {
  return prisma.productionOrder.findMany({
    where: { companyId, ...(status ? { status } : {}) },
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
      warehouse: { select: { id: true, name: true } },
      bom: { select: { id: true, version: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getProductionOrder(id: string, companyId: string) {
  const order = await prisma.productionOrder.findFirst({
    where: { id, companyId },
    include: {
      product: {
        select: {
          id: true, name: true, sku: true, unit: true,
          // Datos regulatorios/calidad para el panel de lote (Sprint 12)
          sanitaryRegistry: true, sanitaryRegistryExpiry: true,
          shelfLifeDays: true, requiresQualityControl: true,
        },
      },
      warehouse: { select: { id: true, name: true } },
      bom: {
        include: {
          items: {
            include: { component: { select: { id: true, name: true, sku: true, unit: true } } },
          },
        },
      },
      items: {
        include: { component: { select: { id: true, name: true, sku: true, unit: true } } },
      },
      consumptions: { include: { component: { select: { id: true, name: true, sku: true } } } },
      inspections: {
        select: { id: true, inspectionNumber: true, type: true, status: true, inspectedAt: true },
        orderBy: { createdAt: 'desc' },
      },
      nonConformities: {
        select: { id: true, ncNumber: true, severity: true, status: true, description: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!order) throw AppError.notFound('Orden de producción no encontrada', 'ORDER_NOT_FOUND');

  // Aviso de vigencia del registro sanitario ARCSA (no bloquea, deja constancia).
  const sanitary = checkSanitaryRegistry(
    order.product.sanitaryRegistry,
    order.product.sanitaryRegistryExpiry,
  );
  return { ...order, sanitary };
}

export async function createProductionOrder(companyId: string, data: {
  productId: string;
  warehouseId: string;
  bomId?: string;
  quantity: number;
  plannedStart?: string;
  plannedEnd?: string;
  notes?: string;
  createdBy?: string;
}) {
  const poNumber = await nextProductionNumber(companyId);

  // If BOM provided, auto-create items
  let orderItems: Array<{ componentId: string; requiredQty: number }> = [];
  if (data.bomId) {
    const bom = await prisma.billOfMaterials.findFirst({
      where: { id: data.bomId, companyId },
      include: { items: true },
    });
    if (bom) {
      orderItems = bom.items.map((item) => ({
        componentId: item.componentId,
        requiredQty: Number(item.quantity) * data.quantity * (1 + Number(item.wastePercent) / 100),
      }));
    }
  }

  return prisma.productionOrder.create({
    data: {
      companyId,
      poNumber,
      productId: data.productId,
      warehouseId: data.warehouseId,
      bomId: data.bomId,
      quantity: data.quantity,
      plannedStart: data.plannedStart ? new Date(data.plannedStart) : undefined,
      plannedEnd: data.plannedEnd ? new Date(data.plannedEnd) : undefined,
      notes: data.notes,
      createdBy: data.createdBy,
      items: {
        create: orderItems,
      },
    },
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
      warehouse: { select: { id: true, name: true } },
      items: {
        include: { component: { select: { id: true, name: true, sku: true, unit: true } } },
      },
    },
  });
}

export async function startProduction(id: string, companyId: string) {
  const order = await prisma.productionOrder.findFirst({ where: { id, companyId } });
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (order.status !== 'PLANNED') throw new Error('ORDER_NOT_PLANNED');

  // Check component stock
  const items = await prisma.productionOrderItem.findMany({
    where: { orderId: id },
    include: {
      component: {
        include: { stocks: { where: { warehouseId: order.warehouseId } } },
      },
    },
  });

  const shortages: string[] = [];
  for (const item of items) {
    const available = item.component.stocks.reduce((s, st) => s + Number(st.quantity), 0);
    if (available < Number(item.requiredQty)) {
      shortages.push(`${item.component.name}: necesita ${Number(item.requiredQty)} disponible ${available}`);
    }
  }

  if (shortages.length > 0) {
    throw new Error(`INSUFFICIENT_STOCK:${shortages.join(';')}`);
  }

  return prisma.productionOrder.update({
    where: { id },
    data: { status: 'IN_PROGRESS', actualStart: new Date() },
    include: {
      product: { select: { id: true, name: true, unit: true } },
      warehouse: { select: { id: true, name: true } },
      items: { include: { component: { select: { id: true, name: true, sku: true, unit: true } } } },
    },
  });
}

/**
 * Cierra la orden de producción (Sprint 12 — ISO 9001 · ARCSA).
 * A diferencia de la versión inicial, ahora:
 *  1. consume las capas de costo reales (FIFO) y deja registro de QUÉ lote de
 *     materia prima entró en el lote producido → trazabilidad hacia atrás;
 *  2. costea el producto terminado con el costo REAL de los consumos (antes usaba
 *     el avgCost estimado del terminado, que no reflejaba la producción);
 *  3. crea el lote (`InventoryBatch`) con nº de lote y fecha de vencimiento —
 *     obligatorio en el rotulado ARCSA — y lo deja en CUARENTENA si el producto
 *     exige control de calidad (ISO 9001 §8.6);
 *  4. genera el asiento de transformación (regla 2 del proyecto).
 */
export async function completeProduction(id: string, companyId: string, userId: string) {
  const order = await prisma.productionOrder.findFirst({
    where: { id, companyId },
    include: {
      items: { include: { component: true } },
      product: true,
    },
  });
  if (!order) throw AppError.notFound('Orden de producción no encontrada', 'ORDER_NOT_FOUND');
  if (order.status !== 'IN_PROGRESS') {
    throw AppError.badRequest('La orden debe estar en proceso para cerrarla', 'ORDER_NOT_IN_PROGRESS');
  }

  const manufacturingDate = new Date();
  // Falla temprano si el período contable está cerrado: mejor no mover stock
  // que dejar producción hecha sin asiento (regla 2 + Sprint 6).
  await assertPeriodOpen(companyId, manufacturingDate);

  const lotNumber = order.lotNumber ?? buildLotNumber(order.poNumber, manufacturingDate);
  const expiryDate = computeExpiryDate(manufacturingDate, order.product.shelfLifeDays);
  const qty = Number(order.quantity);

  const { updatedOrder, actualCost } = await prisma.$transaction(async (tx) => {
    let actualCost = 0;

    // ── 1. Consumo de materias primas con trazabilidad de lote ──
    for (const item of order.items) {
      const pendingQty = Number(item.requiredQty) - Number(item.consumedQty);
      if (pendingQty <= 0) continue;

      const stock = await tx.productStock.findFirst({
        where: { productId: item.componentId, warehouseId: order.warehouseId },
      });
      if (!stock || Number(stock.quantity) < pendingQty) {
        throw AppError.badRequest(
          `Stock insuficiente de ${item.component.name} para cerrar la producción`,
          'INSUFFICIENT_STOCK',
        );
      }

      // Capas FIFO del componente (las más antiguas primero)
      const batches = await tx.inventoryBatch.findMany({
        where: { companyId, productId: item.componentId, warehouseId: order.warehouseId, isExhausted: false },
        orderBy: { receivedAt: 'asc' },
      });
      const plan = planBatchConsumption(batches, pendingQty, Number(item.component.avgCost));

      for (const take of plan.takes) {
        const batch = batches[take.index];
        const newRemaining = Number(batch.remainingQty) - take.qty;
        await tx.inventoryBatch.update({
          where: { id: batch.id },
          data: { remainingQty: new Prisma.Decimal(newRemaining), isExhausted: newRemaining <= 1e-9 },
        });
        await tx.productionConsumption.create({
          data: {
            orderId: id,
            componentId: item.componentId,
            batchId: batch.id,
            lotNumber: batch.lotNumber,
            quantity: new Prisma.Decimal(take.qty),
            unitCost: batch.unitCost,
            totalCost: new Prisma.Decimal(take.qty * Number(batch.unitCost)),
          },
        });
      }
      // Remanente sin capas (productos que no llevan control de lote): costo promedio.
      if (plan.uncovered > 1e-9) {
        const unit = Number(item.component.avgCost);
        await tx.productionConsumption.create({
          data: {
            orderId: id,
            componentId: item.componentId,
            quantity: new Prisma.Decimal(plan.uncovered),
            unitCost: new Prisma.Decimal(unit),
            totalCost: new Prisma.Decimal(plan.uncovered * unit),
          },
        });
      }

      actualCost += plan.totalCost;
      const unitCostAvg = pendingQty > 0 ? plan.totalCost / pendingQty : 0;

      await tx.inventoryMovement.create({
        data: {
          companyId,
          productId: item.componentId,
          warehouseId: order.warehouseId,
          type: 'OUT',
          quantity: new Prisma.Decimal(pendingQty),
          unitCost: new Prisma.Decimal(unitCostAvg),
          totalCost: new Prisma.Decimal(plan.totalCost),
          avgCostAfter: item.component.avgCost,
          stockAfter: new Prisma.Decimal(Number(stock.quantity) - pendingQty),
          reference: order.poNumber,
          notes: `Consumo producción ${order.poNumber} · lote ${lotNumber}`,
          createdBy: userId,
        },
      });
      await tx.productStock.update({ where: { id: stock.id }, data: { quantity: { decrement: pendingQty } } });
      await tx.productionOrderItem.update({ where: { id: item.id }, data: { consumedQty: pendingQty } });
    }

    // ── 2. Alta del producto terminado como LOTE ──
    const unitCost = qty > 0 ? actualCost / qty : 0;
    // Producto con control de calidad → nace en cuarentena y no se puede vender
    // hasta que una inspección aprobada lo libere (ISO 9001 §8.6).
    const lotQualityStatus = order.product.requiresQualityControl ? 'QUARANTINE' : 'RELEASED';

    const batch = await tx.inventoryBatch.create({
      data: {
        companyId,
        productId: order.productId,
        warehouseId: order.warehouseId,
        initialQty: new Prisma.Decimal(qty),
        remainingQty: new Prisma.Decimal(qty),
        unitCost: new Prisma.Decimal(unitCost),
        receivedAt: manufacturingDate,
        reference: order.poNumber,
        lotNumber,
        expiryDate,
        daysLife: order.product.shelfLifeDays ?? undefined,
        qualityStatus: lotQualityStatus,
        productionOrderId: id,
      },
    });

    const existingStock = await tx.productStock.findFirst({
      where: { productId: order.productId, warehouseId: order.warehouseId },
    });
    const previousQty = existingStock ? Number(existingStock.quantity) : 0;
    // Costo promedio ponderado del terminado con el costo REAL de esta producción.
    const previousAvg = Number(order.product.avgCost);
    const newAvg = previousQty + qty > 0
      ? (previousQty * previousAvg + qty * unitCost) / (previousQty + qty)
      : unitCost;

    await tx.inventoryMovement.create({
      data: {
        companyId,
        productId: order.productId,
        warehouseId: order.warehouseId,
        type: 'IN',
        quantity: new Prisma.Decimal(qty),
        unitCost: new Prisma.Decimal(unitCost),
        totalCost: new Prisma.Decimal(actualCost),
        avgCostAfter: new Prisma.Decimal(newAvg),
        stockAfter: new Prisma.Decimal(previousQty + qty),
        reference: order.poNumber,
        notes: `Producción terminada ${order.poNumber} · lote ${lotNumber}`,
        batchId: batch.id,
        createdBy: userId,
      },
    });

    if (existingStock) {
      await tx.productStock.update({ where: { id: existingStock.id }, data: { quantity: { increment: qty } } });
    } else {
      await tx.productStock.create({
        data: { productId: order.productId, warehouseId: order.warehouseId, quantity: new Prisma.Decimal(qty) },
      });
    }
    await tx.product.update({
      where: { id: order.productId },
      data: { avgCost: new Prisma.Decimal(newAvg), lastMovementAt: manufacturingDate },
    });

    const updatedOrder = await tx.productionOrder.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        actualEnd: manufacturingDate,
        quantityDone: order.quantity,
        lotNumber,
        manufacturingDate,
        expiryDate,
        qualityStatus: lotQualityStatus,
        batchId: batch.id,
        actualCost: new Prisma.Decimal(actualCost),
      },
    });

    return { updatedOrder, actualCost };
  });

  // ── 3. Asiento de transformación (fuera de la transacción: la numeración AST
  //       corre en su propia transacción atómica) ──
  const entry = await createProductionEntry(companyId, {
    amount: actualCost,
    reference: order.poNumber,
    productName: order.product.name,
    lotNumber,
    userId,
  });
  if (entry) {
    await prisma.productionOrder.update({ where: { id }, data: { journalEntryId: entry.id } });
  }

  return prisma.productionOrder.findFirst({
    where: { id },
    include: {
      product: { select: { id: true, name: true, unit: true, requiresQualityControl: true } },
      warehouse: { select: { id: true, name: true } },
      items: { include: { component: { select: { id: true, name: true, sku: true, unit: true } } } },
      consumptions: { include: { component: { select: { id: true, name: true, sku: true } } } },
    },
  });
}

export async function cancelProductionOrder(id: string, companyId: string) {
  const order = await prisma.productionOrder.findFirst({ where: { id, companyId } });
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (order.status === 'COMPLETED') throw new Error('CANNOT_CANCEL_COMPLETED');

  return prisma.productionOrder.update({
    where: { id },
    data: { status: 'CANCELLED' },
    select: { id: true, poNumber: true, status: true },
  });
}

// ─── MRP Requirements ─────────────────────────────────────────────────────────

export async function getMRPRequirements(companyId: string, productId: string, quantity: number, warehouseId?: string) {
  // Get active BOM
  const bom = await prisma.billOfMaterials.findFirst({
    where: { companyId, productId, isActive: true },
    include: {
      items: {
        include: {
          component: {
            include: { stocks: warehouseId ? { where: { warehouseId } } : true },
          },
        },
      },
    },
  });

  if (!bom) throw new Error('BOM_NOT_FOUND');

  return bom.items.map((item) => {
    const required = Number(item.quantity) * quantity * (1 + Number(item.wastePercent) / 100);
    const available = item.component.stocks.reduce((s, st) => s + Number(st.quantity), 0);
    const shortage = Math.max(0, required - available);

    return {
      componentId: item.componentId,
      componentName: item.component.name,
      componentSku: item.component.sku,
      unit: item.unit || item.component.unit,
      required,
      available,
      shortage,
      ok: shortage === 0,
    };
  });
}
