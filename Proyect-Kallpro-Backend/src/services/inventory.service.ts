import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { recordAudit, diffRecords } from '../utils/audit';
import { computeReplenishmentPlan, WarehouseStockRow } from './inventory/engines/replenishment.engine';
import { createRequisition } from './requisition.service';
import { classifyShipmentBucket, isShipmentDelayed } from './inventory/engines/operations-panel.engine';
import {
  forecastNextPeriod, classifyTrend, computeTurnoverRatio, classifyRotation, DemandTrend,
} from './inventory/engines/demand-forecast.engine';
// ============================================================
// CATEGORÍAS
// ============================================================

export async function getCategories(companyId: string) {
  return prisma.category.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
  });
}

export async function createCategory(companyId: string, data: { name: string; description?: string }) {
  return prisma.category.create({ data: { ...data, companyId } });
}

// ============================================================
// BODEGAS
// ============================================================

export async function getWarehouses(companyId: string) {
  return prisma.warehouse.findMany({
    where: { companyId, isActive: true },
    include: { children: true, parentWarehouse: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
}

/** Devuelve árbol jerárquico: bodegas padre con sus hijas anidadas */
export async function getWarehouseTree(companyId: string) {
  const all = await prisma.warehouse.findMany({
    where: { companyId },
    include: { stocks: { include: { product: { select: { id: true, name: true } } } } },
    orderBy: { name: 'asc' },
  });

  const rootWarehouses = all.filter((w) => !w.parentWarehouseId);
  const childMap: Record<string, typeof all> = {};
  all.filter((w) => w.parentWarehouseId).forEach((w) => {
    const pid = w.parentWarehouseId!;
    if (!childMap[pid]) childMap[pid] = [];
    childMap[pid].push(w);
  });

  return rootWarehouses.map((w) => ({
    ...w,
    children: childMap[w.id] || [],
  }));
}

export async function createWarehouse(companyId: string, data: { name: string; code?: string; address?: string; parentWarehouseId?: string }) {
  const count = await prisma.warehouse.count({ where: { companyId } });
  return prisma.warehouse.create({
    data: { ...data, companyId, isDefault: count === 0 },
  });
}

export async function updateWarehouse(id: string, companyId: string, data: { name?: string; code?: string; address?: string; isDefault?: boolean; parentWarehouseId?: string | null }) {
  const existing = await prisma.warehouse.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error('Bodega no encontrada');
  if (data.isDefault) {
    await prisma.warehouse.updateMany({ where: { companyId, id: { not: id } }, data: { isDefault: false } });
  }
  return prisma.warehouse.update({ where: { id }, data });
}

export async function toggleWarehouse(id: string, companyId: string) {
  const existing = await prisma.warehouse.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error('Bodega no encontrada');
  if (existing.isDefault) throw new Error('No se puede desactivar la bodega por defecto');
  return prisma.warehouse.update({ where: { id }, data: { isActive: !existing.isActive } });
}

export async function updateCategory(id: string, companyId: string, data: { name?: string; description?: string }) {
  const existing = await prisma.category.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error('Categoría no encontrada');
  return prisma.category.update({ where: { id }, data });
}

export async function reclassifyProduct(id: string, companyId: string, categoryId: string) {
  const product = await prisma.product.findFirst({ where: { id, companyId } });
  if (!product) throw new Error('Producto no encontrado');
  const category = await prisma.category.findFirst({ where: { id: categoryId, companyId } });
  if (!category) throw new Error('Categoría no encontrada');
  return prisma.product.update({ where: { id }, data: { categoryId } });
}

// ============================================================
// PRODUCTOS
// ============================================================

export async function getProducts(companyId: string) {
  return prisma.product.findMany({
    where: { companyId, isActive: true },
    include: {
      category: true,
      stocks: { include: { warehouse: true } },
    },
    orderBy: { name: 'asc' },
  });
}

// Búsqueda ligera y paginada para comboboxes (DeepSeek #8): solo campos necesarios,
// filtra por nombre/SKU y limita resultados → escala con catálogos grandes.
export async function searchProducts(companyId: string, query: string, limit = 20) {
  const q = (query || '').trim();
  return prisma.product.findMany({
    where: {
      companyId,
      isActive: true,
      ...(q ? { OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ] } : {}),
    },
    select: { id: true, name: true, sku: true, salePrice: true, unit: true, type: true },
    orderBy: { name: 'asc' },
    take: Math.min(Math.max(limit, 1), 50),
  });
}

export async function getProductByBarcode(companyId: string, barcode: string) {
  return prisma.product.findFirst({
    where: { companyId, barcode, isActive: true },
    include: { category: true, stocks: { include: { warehouse: true } } },
  });
}

export async function getProductBySku(companyId: string, sku: string) {
  return prisma.product.findFirst({
    where: { companyId, sku, isActive: true },
    include: { category: true, stocks: { include: { warehouse: true } } },
  });
}

export async function getProductById(id: string, companyId: string) {
  return prisma.product.findFirst({
    where: { id, companyId },
    include: {
      category: true,
      stocks: { include: { warehouse: true } },
      movements: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { warehouse: true },
      },
    },
  });
}

export async function createProduct(companyId: string, data: {
  sku?: string;
  name: string;
  description?: string;
  categoryId?: string;
  unit?: string;
  purchaseUnit?: string;
  purchaseConversionFactor?: number;
  salePrice: number;
  minStock?: number;
}) {
  return prisma.product.create({
    data: {
      ...data,
      companyId,
      salePrice: new Prisma.Decimal(data.salePrice),
      minStock: new Prisma.Decimal(data.minStock ?? 0),
      purchaseConversionFactor: data.purchaseConversionFactor != null ? new Prisma.Decimal(data.purchaseConversionFactor) : undefined,
    },
  });
}

export async function updateProduct(id: string, companyId: string, data: any, actorId?: string) {
  const before = await prisma.product.findFirst({ where: { id, companyId } });
  const updated = await prisma.product.update({
    where: { id },
    data: {
      ...data,
      salePrice: data.salePrice !== undefined ? new Prisma.Decimal(data.salePrice) : undefined,
      minStock: data.minStock !== undefined ? new Prisma.Decimal(data.minStock) : undefined,
      purchaseConversionFactor: data.purchaseConversionFactor !== undefined ? new Prisma.Decimal(data.purchaseConversionFactor) : undefined,
      // Cadena vacía desde el formulario = volver a "sin unidad de compra distinta".
      purchaseUnit: data.purchaseUnit !== undefined ? (data.purchaseUnit || null) : undefined,
      // El formulario envía la fecha del registro sanitario como 'YYYY-MM-DD' (Sprint 12);
      // Prisma exige DateTime completo. Cadena vacía = limpiar el dato.
      sanitaryRegistryExpiry: data.sanitaryRegistryExpiry !== undefined
        ? (data.sanitaryRegistryExpiry ? new Date(data.sanitaryRegistryExpiry) : null)
        : undefined,
      shelfLifeDays: data.shelfLifeDays !== undefined
        ? (data.shelfLifeDays === null || data.shelfLifeDays === '' ? null : Number(data.shelfLifeDays))
        : undefined,
    },
  });
  await recordAudit({ companyId, userId: actorId, action: 'UPDATE', entityType: 'Product', entityId: id, changes: diffRecords(before, updated) });
  return updated;
}

// ============================================================
// MOVIMIENTOS (KARDEX) - Motor de costeo (AVG / FIFO / LIFO / STANDARD_COST)
// ============================================================

/**
 * Planifica el consumo de capas de costo (lotes) para una salida FIFO/LIFO.
 * Pura (testeable): recibe los lotes YA ordenados según el método (FIFO: más antiguo
 * primero; LIFO: más reciente primero) y devuelve qué tomar de cada uno y el costo real.
 * Si los lotes no cubren la cantidad (datos previos al fix, o producto que cambió de
 * método a mitad de vida), el remanente se costea con `fallbackUnitCost` (avgCost).
 */
export function planBatchConsumption(
  batches: Array<{ remainingQty: unknown; unitCost: unknown }>,
  qty: number,
  fallbackUnitCost: number,
): { totalCost: number; takes: Array<{ index: number; qty: number }>; uncovered: number } {
  let remaining = qty;
  let totalCost = 0;
  const takes: Array<{ index: number; qty: number }> = [];
  for (let i = 0; i < batches.length && remaining > 1e-9; i++) {
    const avail = Number(batches[i].remainingQty);
    if (avail <= 0) continue;
    const take = Math.min(avail, remaining);
    takes.push({ index: i, qty: take });
    totalCost += take * Number(batches[i].unitCost);
    remaining -= take;
  }
  const uncovered = Math.max(0, remaining);
  if (uncovered > 1e-9) totalCost += uncovered * fallbackUnitCost;
  return { totalCost, takes, uncovered };
}

/**
 * Costo ponderado de las capas restantes de un producto (todas las bodegas).
 * Para FIFO/LIFO este valor se guarda en `product.avgCost` tras cada movimiento:
 * representa el costo de acarreo del inventario restante, y es lo que consumen la
 * valorización, las notas de crédito y cualquier COGS que no tenga el costo exacto
 * de la capa (el despacho de ventas SÍ lo tiene, vía ShipmentItem.unitCost).
 * Devuelve null si no quedan capas (se conserva el avgCost anterior).
 */
async function remainingBatchesAvgCost(
  tx: Prisma.TransactionClient,
  companyId: string,
  productId: string,
): Promise<number | null> {
  const batches = await tx.inventoryBatch.findMany({
    where: { companyId, productId, isExhausted: false },
    select: { remainingQty: true, unitCost: true },
  });
  const totalQty = batches.reduce((s, b) => s + Number(b.remainingQty), 0);
  if (totalQty <= 1e-9) return null;
  const totalValue = batches.reduce((s, b) => s + Number(b.remainingQty) * Number(b.unitCost), 0);
  return totalValue / totalQty;
}

export async function registerMovement(companyId: string, data: {
  productId: string;
  warehouseId: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  quantity: number;
  unitCost?: number;
  reference?: string;
  notes?: string;
  createdBy?: string;
}) {
  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: data.productId, companyId },
    });
    if (!product) throw new Error('PRODUCT_NOT_FOUND');

    // Obtener stock actual en esta bodega
    let stock = await tx.productStock.findUnique({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.warehouseId } },
    });

    const currentQty = stock ? Number(stock.quantity) : 0;
    const currentAvgCost = Number(product.avgCost);
    const qty = Number(data.quantity);
    const unitCostIn = Number(data.unitCost ?? 0);
    const isIn = data.type === 'IN' || data.type === 'ADJUSTMENT_IN';
    const isLayered = product.valuationMethod === 'FIFO' || product.valuationMethod === 'LIFO';

    let newQty: number;
    let newAvgCost: number;
    let movementUnitCost: number;
    let totalCost: number;

    if (isIn) {
      newQty = currentQty + qty;
      movementUnitCost = unitCostIn;
      totalCost = qty * unitCostIn;
      if (isLayered) {
        // FIFO/LIFO: la entrada crea una capa de costo; avgCost pasa a ser el costo
        // ponderado de las capas restantes (costo de acarreo del inventario).
        await tx.inventoryBatch.create({
          data: {
            companyId,
            productId: data.productId,
            warehouseId: data.warehouseId,
            initialQty: new Prisma.Decimal(qty),
            remainingQty: new Prisma.Decimal(qty),
            unitCost: new Prisma.Decimal(unitCostIn),
            reference: data.reference,
          },
        });
        newAvgCost = (await remainingBatchesAvgCost(tx, companyId, data.productId)) ?? unitCostIn;
      } else {
        // Promedio ponderado: (stock_actual * costo_actual + cantidad * costo_nuevo) / (stock + cantidad)
        const totalValue = currentQty * currentAvgCost + qty * unitCostIn;
        newAvgCost = newQty > 0 ? totalValue / newQty : unitCostIn;
      }
    } else {
      // Salida: verificar stock suficiente, salvo que el producto permita stock negativo (C3).
      if (!product.allowNegativeStock && currentQty < qty) throw new Error('INSUFFICIENT_STOCK');
      newQty = currentQty - qty;
      if (isLayered) {
        // FIFO/LIFO: consumir capas en el orden del método y costear la salida con el
        // costo REAL de las capas consumidas (fix doc 23 — antes FIFO no consumía nada
        // y LIFO consumía pero costeaba con avgCost congelado).
        const batches = await tx.inventoryBatch.findMany({
          where: { companyId, productId: data.productId, warehouseId: data.warehouseId, isExhausted: false },
          orderBy: { receivedAt: product.valuationMethod === 'FIFO' ? 'asc' : 'desc' },
        });
        const plan = planBatchConsumption(batches, qty, currentAvgCost);
        for (const t of plan.takes) {
          const b = batches[t.index];
          const newRem = Number(b.remainingQty) - t.qty;
          await tx.inventoryBatch.update({
            where: { id: b.id },
            data: { remainingQty: new Prisma.Decimal(newRem), isExhausted: newRem <= 1e-9 },
          });
        }
        totalCost = plan.totalCost;
        movementUnitCost = qty > 0 ? totalCost / qty : currentAvgCost;
        newAvgCost = (await remainingBatchesAvgCost(tx, companyId, data.productId)) ?? currentAvgCost;
      } else {
        movementUnitCost = currentAvgCost;
        totalCost = qty * currentAvgCost;
        newAvgCost = currentAvgCost; // AVG no cambia en salidas
      }
    }

    // Crear movimiento con el costo real del método
    const movement = await tx.inventoryMovement.create({
      data: {
        companyId,
        productId: data.productId,
        warehouseId: data.warehouseId,
        type: data.type,
        quantity: new Prisma.Decimal(qty),
        unitCost: new Prisma.Decimal(movementUnitCost),
        totalCost: new Prisma.Decimal(totalCost),
        avgCostAfter: new Prisma.Decimal(newAvgCost),
        stockAfter: new Prisma.Decimal(newQty),
        reference: data.reference,
        notes: data.notes,
        createdBy: data.createdBy,
      },
    });

    // Actualizar stock en bodega
    await tx.productStock.upsert({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.warehouseId } },
      update: { quantity: new Prisma.Decimal(newQty) },
      create: {
        productId: data.productId,
        warehouseId: data.warehouseId,
        quantity: new Prisma.Decimal(newQty),
      },
    });

    // Actualizar el costo del producto. Para AVG/STANDARD_COST es el promedio ponderado
    // clásico; para FIFO/LIFO es el ponderado de las capas RESTANTES (mantenerlo al día
    // es lo que corrige el COGS de journal.service y la valorización — antes quedaba
    // congelado, ver doc 23).
    await tx.product.update({
      where: { id: data.productId },
      data: { avgCost: new Prisma.Decimal(newAvgCost), lastMovementAt: new Date() },
    });

    return movement;
  });

  // Asiento contable SOLO para ajustes/merma (las IN/OUT las contabilizan
  // recepción de OC y COGS de venta — evita doble conteo). Non-blocking.
  // journalEntryId se adjunta al retorno para que el llamador (p.ej.
  // inventory-adjustment.service.ts) pueda enlazar el ajuste al asiento generado
  // (trazabilidad — patrón de referencia visto en Odoo).
  let journalEntryId: string | null = null;
  if (result && (data.type === 'ADJUSTMENT_IN' || data.type === 'ADJUSTMENT_OUT')) {
    try {
      const { createInventoryAdjustmentEntry } = await import('./journal.service');
      const entry = await createInventoryAdjustmentEntry(companyId, {
        amount: Number(result.totalCost),
        isIncrease: data.type === 'ADJUSTMENT_IN',
        reference: data.reference,
        description: data.notes,
        userId: data.createdBy,
      });
      journalEntryId = entry?.id ?? null;
    } catch (e) {
      logger.warn('[inventory] createInventoryAdjustmentEntry failed (non-fatal)', { err: e });
    }
  }

  return { ...result, journalEntryId } as typeof result & { journalEntryId: string | null };
}

// ============================================================
// KARDEX (historial de movimientos de un producto)
// ============================================================

/** Un movimiento individual (trazabilidad — link "Ver movimiento" desde Ajustes de Inventario). */
export async function getMovementById(id: string, companyId: string) {
  const movement = await prisma.inventoryMovement.findFirst({
    where: { id, companyId },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      warehouse: { select: { id: true, name: true } },
      fromWarehouse: { select: { id: true, name: true } },
      toWarehouse: { select: { id: true, name: true } },
    },
  });
  if (!movement) throw new Error('MOVEMENT_NOT_FOUND');
  return movement;
}

export async function getKardex(productId: string, companyId: string, warehouseId?: string) {
  const movements = await prisma.inventoryMovement.findMany({
    where: {
      productId,
      companyId,
      ...(warehouseId ? { warehouseId } : {}),
    },
    include: {
      warehouse: true,
      fromWarehouse: { select: { id: true, name: true } },
      toWarehouse: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Enrich with batch/lot info using the batchId field
  const enriched = await Promise.all(
    movements.map(async (m) => {
      if (m.batchId) {
        const batch = await prisma.inventoryBatch.findUnique({
          where: { id: m.batchId },
          select: { lotNumber: true, expiryDate: true, supplierBatch: true },
        });
        return { ...m, batch };
      }
      return { ...m, batch: null };
    }),
  );

  // Kardex valorado: el movimiento ya persiste totalCost/avgCostAfter/stockAfter
  // (calculados al registrarse). Se agrega el saldo valorado corrido para auditoría.
  return enriched.map((m) => ({
    ...m,
    runningValue: Math.round(Number(m.stockAfter) * Number(m.avgCostAfter) * 100) / 100,
  }));
}

// ============================================================
// VALORIZACIÓN DE INVENTARIO (contable + conciliación con el mayor)
// ============================================================

/** IDs de una bodega y todas sus descendientes (jerarquía multibodega) */
async function warehouseTreeIds(companyId: string, rootId: string): Promise<string[]> {
  const all = await prisma.warehouse.findMany({ where: { companyId }, select: { id: true, parentWarehouseId: true } });
  const childrenOf = new Map<string | null, string[]>();
  for (const w of all) {
    const k = w.parentWarehouseId ?? null;
    childrenOf.set(k, [...(childrenOf.get(k) ?? []), w.id]);
  }
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    stack.push(...(childrenOf.get(id) ?? []));
  }
  return out;
}

export async function getInventoryValuation(
  companyId: string,
  filters: { warehouseId?: string; categoryId?: string } = {},
) {
  const warehouseIds = filters.warehouseId
    ? await warehouseTreeIds(companyId, filters.warehouseId)
    : undefined;

  const stocks = await prisma.productStock.findMany({
    where: {
      product: { companyId, ...(filters.categoryId ? { categoryId: filters.categoryId } : {}) },
      ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
      quantity: { not: 0 },
    },
    include: {
      product: { select: { id: true, sku: true, name: true, avgCost: true, valuationMethod: true, categoryId: true, category: { select: { name: true } } } },
      warehouse: { select: { id: true, name: true } },
    },
  });

  const lines = stocks.map((s) => {
    const qty = Number(s.quantity);
    const cost = Number(s.product.avgCost ?? 0);
    return {
      productId: s.product.id,
      sku: s.product.sku,
      name: s.product.name,
      warehouseId: s.warehouse.id,
      warehouseName: s.warehouse.name,
      category: s.product.category?.name ?? 'Sin categoría',
      method: s.product.valuationMethod ?? 'AVG',
      qty,
      avgCost: cost,
      value: Math.round(qty * cost * 100) / 100,
    };
  });

  const totalValue = Math.round(lines.reduce((s, l) => s + l.value, 0) * 100) / 100;

  const groupBy = <K extends string>(key: (l: typeof lines[number]) => K) => {
    const map = new Map<K, { label: K; value: number; qty: number }>();
    for (const l of lines) {
      const k = key(l);
      const e = map.get(k) ?? { label: k, value: 0, qty: 0 };
      e.value = Math.round((e.value + l.value) * 100) / 100;
      e.qty += l.qty;
      map.set(k, e);
    }
    return [...map.values()].sort((a, b) => b.value - a.value);
  };

  // Saldo según el mayor de la cuenta de inventario (mapping INVENTORY, default 1010306)
  const mapping = await prisma.accountMapping.findUnique({
    where: { companyId_key: { companyId, key: 'INVENTORY' } },
  });
  const inventoryAccount = mapping?.accountCode ?? '1010306';
  const glAgg = await prisma.journalEntryLine.aggregate({
    where: { entry: { companyId, status: { not: 'REVERSED' } }, accountCode: inventoryAccount },
    _sum: { debit: true, credit: true },
  });
  const glBalance = Math.round((Number(glAgg._sum.debit ?? 0) - Number(glAgg._sum.credit ?? 0)) * 100) / 100;

  return {
    totals: { totalValue, totalQty: lines.reduce((s, l) => s + l.qty, 0), skuCount: new Set(lines.map((l) => l.productId)).size },
    byWarehouse: groupBy((l) => l.warehouseName as string),
    byCategory: groupBy((l) => l.category as string),
    lines: lines.sort((a, b) => b.value - a.value),
    inventoryAccount,
    glBalance,
    difference: Math.round((totalValue - glBalance) * 100) / 100,
  };
}

// ============================================================
// FIFO — Gestión de lotes de costo
// ============================================================

export async function registerFifoBatch(
  companyId: string,
  data: { productId: string; warehouseId: string; quantity: number; unitCost: number; reference?: string },
) {
  return prisma.inventoryBatch.create({
    data: {
      companyId,
      productId: data.productId,
      warehouseId: data.warehouseId,
      initialQty: new Prisma.Decimal(data.quantity),
      remainingQty: new Prisma.Decimal(data.quantity),
      unitCost: new Prisma.Decimal(data.unitCost),
      reference: data.reference,
    },
  });
}

// NOTA: la antigua `registerFifoOut` (consumo FIFO en función separada) se eliminó:
// era código muerto (nadie la llamaba) y su lógica ahora vive integrada en
// `registerMovement` para AMBOS métodos (FIFO y LIFO) — ver fix doc 23.

export async function getFifoBatches(productId: string, companyId: string, warehouseId?: string) {
  return prisma.inventoryBatch.findMany({
    where: {
      companyId,
      productId,
      ...(warehouseId ? { warehouseId } : {}),
    },
    include: { warehouse: true },
    orderBy: [{ isExhausted: 'asc' }, { receivedAt: 'asc' }],
  });
}

// Comparativo de valoración: devuelve el costo bajo los 4 métodos para un producto
export async function getValuationComparison(productId: string, companyId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, companyId },
    include: { stocks: true },
  });
  if (!product) throw new Error('PRODUCT_NOT_FOUND');

  const totalStock = product.stocks.reduce((s, st) => s + Number(st.quantity), 0);
  const avgCost = Number(product.avgCost);
  const standardCost = Number(product.standardCost);

  // FIFO: lote más antiguo activo
  const fifoBatch = await prisma.inventoryBatch.findFirst({
    where: { companyId, productId, isExhausted: false },
    orderBy: { receivedAt: 'asc' },
  });
  const fifoCost = fifoBatch ? Number(fifoBatch.unitCost) : avgCost;

  // LIFO: lote más reciente activo
  const lifoBatch = await prisma.inventoryBatch.findFirst({
    where: { companyId, productId, isExhausted: false },
    orderBy: { receivedAt: 'desc' },
  });
  const lifoCost = lifoBatch ? Number(lifoBatch.unitCost) : avgCost;

  const methods = {
    AVG:           { label: 'Promedio Ponderado', cost: avgCost,       totalValue: totalStock * avgCost },
    FIFO:          { label: 'FIFO',               cost: fifoCost,      totalValue: totalStock * fifoCost },
    LIFO:          { label: 'LIFO',               cost: lifoCost,      totalValue: totalStock * lifoCost },
    STANDARD_COST: { label: 'Costo Estándar',     cost: standardCost,  totalValue: totalStock * standardCost },
  };

  return {
    productId,
    productName: product.name,
    sku: product.sku,
    unit: product.unit,
    totalStock,
    currentMethod: product.valuationMethod,
    methods,
  };
}

// Actualizar método de valoración y costo estándar de un producto
export async function updateValuationMethod(
  id: string,
  companyId: string,
  data: { valuationMethod: 'AVG' | 'FIFO' | 'LIFO' | 'STANDARD_COST'; standardCost?: number },
) {
  return prisma.product.update({
    where: { id },
    data: {
      valuationMethod: data.valuationMethod,
      ...(data.standardCost !== undefined ? { standardCost: new Prisma.Decimal(data.standardCost) } : {}),
    },
  });
}

// ============================================================
// TRANSFERENCIAS ENTRE BODEGAS
// ============================================================

export async function transferStock(
  companyId: string,
  data: {
    fromWarehouseId: string;
    toWarehouseId: string;
    productId: string;
    quantity: number;
    notes?: string;
    createdBy?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: data.productId, companyId } });
    if (!product) throw new Error('PRODUCT_NOT_FOUND');

    const fromStock = await tx.productStock.findUnique({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.fromWarehouseId } },
    });
    const fromQty = fromStock ? Number(fromStock.quantity) : 0;
    const fromReserved = fromStock ? Number(fromStock.reserved) : 0;
    const available = fromQty - fromReserved;
    if (!product.allowNegativeStock && available < data.quantity) throw new Error('INSUFFICIENT_STOCK');

    const newFromQty = fromQty - data.quantity;
    const transferRef = `TRANSFER-${Date.now()}`;

    // FIFO/LIFO: las capas de costo VIAJAN con el stock (fix doc 23 — antes las capas se
    // quedaban en la bodega origen y el destino quedaba sin capas que consumir). Se
    // consumen en la bodega origen según el método y se recrean en destino preservando
    // unitCost y receivedAt (la antigüedad de la capa se conserva para el orden FIFO).
    let unitCost = Number(product.avgCost);
    if (product.valuationMethod === 'FIFO' || product.valuationMethod === 'LIFO') {
      const batches = await tx.inventoryBatch.findMany({
        where: { companyId, productId: data.productId, warehouseId: data.fromWarehouseId, isExhausted: false },
        orderBy: { receivedAt: product.valuationMethod === 'FIFO' ? 'asc' : 'desc' },
      });
      const plan = planBatchConsumption(batches, data.quantity, Number(product.avgCost));
      for (const t of plan.takes) {
        const b = batches[t.index];
        const newRem = Number(b.remainingQty) - t.qty;
        await tx.inventoryBatch.update({
          where: { id: b.id },
          data: { remainingQty: new Prisma.Decimal(newRem), isExhausted: newRem <= 1e-9 },
        });
        await tx.inventoryBatch.create({
          data: {
            companyId,
            productId: data.productId,
            warehouseId: data.toWarehouseId,
            initialQty: new Prisma.Decimal(t.qty),
            remainingQty: new Prisma.Decimal(t.qty),
            unitCost: b.unitCost,
            receivedAt: b.receivedAt, // preservar antigüedad de la capa
            reference: transferRef,
          },
        });
      }
      unitCost = data.quantity > 0 ? plan.totalCost / data.quantity : unitCost;
    }

    // Obtener stock actual en bodega destino
    const toStock = await tx.productStock.findUnique({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.toWarehouseId } },
    });
    const toQty = toStock ? Number(toStock.quantity) : 0;
    const newToQty = toQty + data.quantity;

    // Movimiento SALIDA en bodega origen (con trazabilidad de destino)
    await tx.inventoryMovement.create({
      data: {
        companyId,
        productId: data.productId,
        warehouseId: data.fromWarehouseId,
        type: 'TRANSFER_OUT',
        quantity: new Prisma.Decimal(data.quantity),
        unitCost: new Prisma.Decimal(unitCost),
        totalCost: new Prisma.Decimal(data.quantity * unitCost),
        avgCostAfter: new Prisma.Decimal(unitCost),
        stockAfter: new Prisma.Decimal(newFromQty),
        reference: transferRef,
        notes: data.notes,
        createdBy: data.createdBy,
        fromWarehouseId: data.fromWarehouseId,
        toWarehouseId: data.toWarehouseId,
      },
    });

    // Movimiento ENTRADA en bodega destino (con trazabilidad de origen)
    await tx.inventoryMovement.create({
      data: {
        companyId,
        productId: data.productId,
        warehouseId: data.toWarehouseId,
        type: 'TRANSFER_IN',
        quantity: new Prisma.Decimal(data.quantity),
        unitCost: new Prisma.Decimal(unitCost),
        totalCost: new Prisma.Decimal(data.quantity * unitCost),
        avgCostAfter: new Prisma.Decimal(unitCost),
        stockAfter: new Prisma.Decimal(newToQty),
        reference: transferRef,
        notes: data.notes,
        createdBy: data.createdBy,
        fromWarehouseId: data.fromWarehouseId,
        toWarehouseId: data.toWarehouseId,
      },
    });

    // Actualizar stock bodega origen
    await tx.productStock.upsert({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.fromWarehouseId } },
      update: { quantity: new Prisma.Decimal(newFromQty) },
      create: { productId: data.productId, warehouseId: data.fromWarehouseId, quantity: new Prisma.Decimal(newFromQty) },
    });

    // Actualizar stock bodega destino
    await tx.productStock.upsert({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.toWarehouseId } },
      update: { quantity: new Prisma.Decimal(newToQty) },
      create: { productId: data.productId, warehouseId: data.toWarehouseId, quantity: new Prisma.Decimal(newToQty) },
    });

    // Actualizar fecha último movimiento
    await tx.product.update({ where: { id: data.productId }, data: { lastMovementAt: new Date() } });

    return { transferRef, fromQtyAfter: newFromQty, toQtyAfter: newToQty };
  });
}

// ============================================================
// RESERVAS DE STOCK (para órdenes de venta)
// ============================================================

export async function reserveStock(
  companyId: string,
  data: { productId: string; warehouseId: string; quantity: number; reference: string },
) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: data.productId, companyId }, select: { allowNegativeStock: true } });
    const stock = await tx.productStock.findUnique({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.warehouseId } },
    });
    const available = stock ? Number(stock.quantity) - Number(stock.reserved) : 0;
    // Reservar es "prometer" stock a un pedido — si el producto permite stock negativo (C3),
    // se puede prometer más de lo físico (venta contra pedido a proveedor); si no, se topa
    // como siempre a lo disponible.
    if (!product?.allowNegativeStock && available < data.quantity) throw new Error('INSUFFICIENT_STOCK');

    const newReserved = (stock ? Number(stock.reserved) : 0) + data.quantity;
    return tx.productStock.upsert({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.warehouseId } },
      update: { reserved: new Prisma.Decimal(newReserved) },
      create: { productId: data.productId, warehouseId: data.warehouseId, quantity: 0, reserved: new Prisma.Decimal(data.quantity) },
    });
  });
}

export async function releaseReservation(
  companyId: string,
  data: { productId: string; warehouseId: string; quantity: number; reference: string },
) {
  const stock = await prisma.productStock.findUnique({
    where: { productId_warehouseId: { productId: data.productId, warehouseId: data.warehouseId } },
  });
  if (!stock) throw new Error('STOCK_NOT_FOUND');
  const newReserved = Math.max(0, Number(stock.reserved) - data.quantity);
  return prisma.productStock.update({
    where: { productId_warehouseId: { productId: data.productId, warehouseId: data.warehouseId } },
    data: { reserved: new Prisma.Decimal(newReserved) },
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface StockCheckLine {
  productId: string;
  productName: string | null;
  warehouseId: string | null;
  requested: number;
  onHand: number;     // físico total
  reserved: number;   // ya comprometido por otros pedidos confirmados
  available: number;  // onHand - reserved
  sufficient: boolean;
  shortage: number;   // requested - available (0 si alcanza)
  found: boolean;     // false si el producto no existe en la empresa
}

/**
 * Chequeo BLANDO de disponibilidad de stock (Sprint 3).
 *
 * Para cada línea calcula disponible = stock físico − reservado (por bodega si se indica
 * warehouseId, o sumando todas las bodegas). NO lanza ni bloquea: devuelve advertencias
 * para que cotización/pedido DRAFT muestren si se está comprometiendo más de lo disponible.
 * La validación dura (reserva real) sigue ocurriendo al CONFIRMAR el pedido.
 */
export async function checkStockAvailability(
  companyId: string,
  items: Array<{ productId: string; warehouseId?: string | null; quantity: number }>,
): Promise<{ items: StockCheckLine[]; hasWarnings: boolean }> {
  const lines = await Promise.all(items.map(async (it): Promise<StockCheckLine> => {
    const requested = Number(it.quantity);
    const product = await prisma.product.findFirst({
      where: { id: it.productId, companyId },
      select: { name: true },
    });
    if (!product) {
      return {
        productId: it.productId, productName: null, warehouseId: it.warehouseId ?? null,
        requested, onHand: 0, reserved: 0, available: 0, sufficient: false, shortage: requested, found: false,
      };
    }
    const stocks = await prisma.productStock.findMany({
      where: { productId: it.productId, ...(it.warehouseId ? { warehouseId: it.warehouseId } : {}) },
      select: { quantity: true, reserved: true },
    });
    const onHand = stocks.reduce((s, st) => s + Number(st.quantity), 0);
    const reserved = stocks.reduce((s, st) => s + Number(st.reserved), 0);
    const available = onHand - reserved;
    const sufficient = available >= requested;
    return {
      productId: it.productId,
      productName: product.name,
      warehouseId: it.warehouseId ?? null,
      requested: round2(requested),
      onHand: round2(onHand),
      reserved: round2(reserved),
      available: round2(available),
      sufficient,
      shortage: sufficient ? 0 : round2(requested - available),
      found: true,
    };
  }));

  return { items: lines, hasWarnings: lines.some((l) => !l.sufficient) };
}

export async function fulfillReservation(
  companyId: string,
  data: { productId: string; warehouseId: string; quantity: number; reference: string; notes?: string; createdBy?: string },
) {
  // Registrar movimiento OUT y liberar la reserva
  const movement = await registerMovement(companyId, {
    productId: data.productId,
    warehouseId: data.warehouseId,
    type: 'OUT',
    quantity: data.quantity,
    reference: data.reference,
    notes: data.notes,
    createdBy: data.createdBy,
  });

  const stock = await prisma.productStock.findUnique({
    where: { productId_warehouseId: { productId: data.productId, warehouseId: data.warehouseId } },
  });
  if (stock) {
    const newReserved = Math.max(0, Number(stock.reserved) - data.quantity);
    await prisma.productStock.update({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.warehouseId } },
      data: { reserved: new Prisma.Decimal(newReserved) },
    });
  }
  return movement;
}

// ============================================================
// MOTOR DE REORDEN INTELIGENTE (EOQ + Punto de Reorden)
// ============================================================

export async function getReorderSuggestions(companyId: string) {
  const products = await prisma.product.findMany({
    where: { companyId, isActive: true },
    include: { stocks: true },
  });

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const suggestions = await Promise.all(
    products.map(async (product) => {
      const totalQty = product.stocks.reduce((s, st) => s + Number(st.quantity), 0);
      const totalReserved = product.stocks.reduce((s, st) => s + Number(st.reserved), 0);
      const availableQty = totalQty - totalReserved;

      // Consumo de los últimos 90 días
      const outMovements = await prisma.inventoryMovement.findMany({
        where: {
          companyId,
          productId: product.id,
          type: { in: ['OUT', 'TRANSFER_OUT'] },
          createdAt: { gte: ninetyDaysAgo },
        },
      });
      const consumed90 = outMovements.reduce((s, m) => s + Number(m.quantity), 0);
      const avgDailyConsumption = consumed90 / 90;

      // Punto de reorden: consumo diario × 14 días de lead time + stock seguridad (7 días)
      const leadTimeDays = 14;
      const safetyStockDays = 7;
      const reorderPoint = avgDailyConsumption * (leadTimeDays + safetyStockDays);

      // EOQ simplificado (asume costo de orden = 10 USD, holding cost = 20% del costo)
      const annualDemand = avgDailyConsumption * 365;
      const orderCost = 10;
      const holdingCostRate = 0.20;
      const unitCost = Number(product.avgCost);
      const holdingCost = unitCost * holdingCostRate;
      const eoq = holdingCost > 0 ? Math.sqrt((2 * annualDemand * orderCost) / holdingCost) : 0;

      const needsReorder = availableQty <= reorderPoint && annualDemand > 0;
      let urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | null = null;
      if (needsReorder) {
        const daysLeft = avgDailyConsumption > 0 ? availableQty / avgDailyConsumption : 999;
        if (daysLeft <= 7)  urgency = 'CRITICAL';
        else if (daysLeft <= 14) urgency = 'HIGH';
        else urgency = 'MEDIUM';
      }

      const reorderPointRounded = Math.round(reorderPoint * 100) / 100;

      // Persistir el punto de reorden calculado en el producto
      if (avgDailyConsumption > 0) {
        await prisma.product.update({
          where: { id: product.id },
          data: { reorderPoint: new Prisma.Decimal(reorderPointRounded) },
        }).catch(() => {}); // silenciar errores no críticos
      }

      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unit: product.unit,
        availableQty: Math.round(availableQty * 100) / 100,
        reservedQty: Math.round(totalReserved * 100) / 100,
        avgDailyConsumption: Math.round(avgDailyConsumption * 100) / 100,
        reorderPoint: reorderPointRounded,
        suggestedQty: Math.round(eoq * 10) / 10,
        urgency,
        needsReorder,
        daysOfStock: avgDailyConsumption > 0 ? Math.round(availableQty / avgDailyConsumption) : 9999,
        unitCost,
        estOrderValue: Math.round(eoq * unitCost * 100) / 100,
        minStock: Number(product.minStock),
        maxStock: product.maxStock ? Number(product.maxStock) : null,
      };
    }),
  );

  return suggestions
    .filter((s) => s.needsReorder)
    .sort((a, b) => {
      const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
      return (order[a.urgency!] ?? 3) - (order[b.urgency!] ?? 3);
    });
}

// ============================================================
// C1 — REABASTECIMIENTO ENTRE BODEGAS (push/pull simplificado)
// ============================================================

/**
 * Sugerencias de reabastecimiento por producto-bodega (a diferencia de `getReorderSuggestions`,
 * que agrega todas las bodegas en un solo total y siempre sugiere comprar). Aquí cada bodega
 * se evalúa contra SU PROPIO mín/máx (override en `ProductStock` o el del producto por
 * defecto) y el motor puro decide si conviene un traslado interno o una requisición de compra.
 */
export async function getReplenishmentSuggestions(companyId: string) {
  const products = await prisma.product.findMany({
    where: { companyId, isActive: true },
    include: { stocks: { include: { warehouse: { select: { id: true, name: true } } } } },
  });

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const activeSnoozes = await prisma.replenishmentSnooze.findMany({
    where: { companyId, snoozedUntil: { gt: new Date() } },
  });
  const isSnoozed = (productId: string, warehouseId: string) =>
    activeSnoozes.some((s) => s.productId === productId && s.warehouseId === warehouseId);

  const results: Array<ReturnType<typeof computeReplenishmentPlan>[number] & {
    productId: string; productName: string; sku: string | null; unit: string;
  }> = [];

  for (const product of products) {
    if (product.stocks.length === 0) continue;

    const rows: WarehouseStockRow[] = await Promise.all(
      product.stocks.map(async (stock) => {
        const consumed90 = await prisma.inventoryMovement.aggregate({
          _sum: { quantity: true },
          where: {
            companyId,
            productId: product.id,
            warehouseId: stock.warehouseId,
            type: { in: ['OUT', 'TRANSFER_OUT'] },
            createdAt: { gte: ninetyDaysAgo },
          },
        });
        return {
          warehouseId: stock.warehouseId,
          warehouseName: stock.warehouse.name,
          available: Number(stock.quantity) - Number(stock.reserved),
          min: stock.minStock != null ? Number(stock.minStock) : Number(product.minStock),
          max: stock.maxStock != null ? Number(stock.maxStock) : (product.maxStock != null ? Number(product.maxStock) : null),
          avgDailyConsumption: Number(consumed90._sum.quantity ?? 0) / 90,
        };
      }),
    );

    const plan = computeReplenishmentPlan(rows).filter((s) => !isSnoozed(product.id, s.warehouseId));
    for (const suggestion of plan) {
      results.push({ ...suggestion, productId: product.id, productName: product.name, sku: product.sku, unit: product.unit });
    }
  }

  const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
  return results.sort((a, b) => (order[a.urgency] ?? 3) - (order[b.urgency] ?? 3));
}

/** Ejecuta la sugerencia vigente de un producto-bodega: crea el traslado real desde la bodega donante. */
export async function applySuggestedTransfer(
  companyId: string,
  productId: string,
  warehouseId: string,
  createdBy: string,
) {
  const suggestions = await getReplenishmentSuggestions(companyId);
  const s = suggestions.find((x) => x.productId === productId && x.warehouseId === warehouseId);
  if (!s) throw new Error('SUGGESTION_NOT_FOUND'); // ya no aplica (el stock cambió desde que se listó)
  if (s.route !== 'TRANSFER' || !s.transferFromWarehouseId) throw new Error('NOT_A_TRANSFER_ROUTE');

  return transferStock(companyId, {
    fromWarehouseId: s.transferFromWarehouseId,
    toWarehouseId: warehouseId,
    productId,
    quantity: s.needed,
    notes: `Traslado sugerido por reabastecimiento (C1): reponer ${s.warehouseName} hasta ${s.target}`,
    createdBy,
  });
}

/** Ejecuta la sugerencia vigente de un producto-bodega: crea una requisición de compra por el faltante. */
export async function applySuggestedRequisition(
  companyId: string,
  productId: string,
  warehouseId: string,
  requestedBy: string,
) {
  const suggestions = await getReplenishmentSuggestions(companyId);
  const s = suggestions.find((x) => x.productId === productId && x.warehouseId === warehouseId);
  if (!s) throw new Error('SUGGESTION_NOT_FOUND');

  const product = await prisma.product.findFirst({ where: { id: productId, companyId } });
  if (!product) throw new Error('PRODUCT_NOT_FOUND');

  return createRequisition(companyId, {
    title: `Reabastecimiento sugerido: ${product.name} — ${s.warehouseName}`,
    notes: `Generado desde el panel de reabastecimiento (C1). Bodega ${s.warehouseName} bajo su mínimo (${s.min}).`,
    requestedBy,
    items: [{
      description: product.name,
      productId,
      quantity: s.needed,
      unit: product.unit,
      estimatedCost: Number(product.avgCost),
    }],
  });
}

/** Override de mín/máx de UNA bodega para un producto (null = volver a usar el default del producto). */
export async function updateStockThresholds(
  companyId: string,
  productId: string,
  warehouseId: string,
  data: { minStock?: number | null; maxStock?: number | null },
) {
  const stock = await prisma.productStock.findFirst({
    where: { productId, warehouseId, product: { companyId } },
  });
  if (!stock) throw new Error('STOCK_NOT_FOUND');

  return prisma.productStock.update({
    where: { productId_warehouseId: { productId, warehouseId } },
    data: {
      minStock: data.minStock == null ? null : new Prisma.Decimal(data.minStock),
      maxStock: data.maxStock == null ? null : new Prisma.Decimal(data.maxStock),
    },
  });
}

/** Pospone una sugerencia de reabastecimiento para que no reaparezca hasta `days` días. */
export async function snoozeReplenishmentSuggestion(
  companyId: string,
  productId: string,
  warehouseId: string,
  snoozedBy: string,
  days = 7,
) {
  const snoozedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return prisma.replenishmentSnooze.upsert({
    where: { companyId_productId_warehouseId: { companyId, productId, warehouseId } },
    update: { snoozedUntil, snoozedBy },
    create: { companyId, productId, warehouseId, snoozedUntil, snoozedBy },
  });
}

// ============================================================
// C2 — PANEL DE OPERACIONES DE INVENTARIO
// ============================================================

/**
 * Tarjeta por bodega × tipo de operación (patrón Odoo confirmado en la exploración QA):
 * recepciones de compra pendientes, expediciones de venta por estado, y traslados del día.
 * Una OC/expedición sin bodega resuelta (ej. OC sin `deliveryLocationId`) se atribuye a la
 * bodega marcada `isDefault` de la empresa — si tampoco existe, se descarta de este panel
 * (no hay bodega razonable a la que asignarla).
 */
export async function getInventoryOperationsPanel(companyId: string) {
  const warehouses = await prisma.warehouse.findMany({ where: { companyId, isActive: true } });
  const defaultWarehouse = warehouses.find((w) => w.isDefault) ?? null;

  const panel = new Map<string, {
    warehouseId: string; warehouseName: string;
    recepcionesPendientes: number;
    expediciones: { enEspera: number; porEntregar: number; conDemora: number; parciales: number };
    traslados: { entrantesHoy: number; salientesHoy: number };
  }>();
  for (const w of warehouses) {
    panel.set(w.id, {
      warehouseId: w.id, warehouseName: w.name,
      recepcionesPendientes: 0,
      expediciones: { enEspera: 0, porEntregar: 0, conDemora: 0, parciales: 0 },
      traslados: { entrantesHoy: 0, salientesHoy: 0 },
    });
  }

  // ── Recepciones pendientes (compras aprobadas o parcialmente recibidas) ──
  const pendingPOs = await prisma.purchaseOrder.findMany({
    where: { companyId, status: { in: ['APPROVED', 'PARTIAL'] } },
    include: { deliveryLocation: { select: { warehouseId: true } } },
  });
  for (const po of pendingPOs) {
    const warehouseId = po.deliveryLocation?.warehouseId ?? defaultWarehouse?.id;
    if (warehouseId && panel.has(warehouseId)) panel.get(warehouseId)!.recepcionesPendientes += 1;
  }

  // ── Expediciones (envíos de venta activos) ──
  const now = new Date();
  const activeShipments = await prisma.shipment.findMany({
    where: { companyId, orderType: 'SALES', status: { notIn: ['DELIVERED', 'FAILED'] } },
    include: {
      items: {
        take: 1,
        include: { salesOrderItem: { include: { warehouse: { select: { id: true } }, order: { select: { status: true } } } } },
      },
    },
  });
  for (const shipment of activeShipments) {
    const item = shipment.items[0]?.salesOrderItem;
    const warehouseId = item?.warehouse?.id ?? defaultWarehouse?.id;
    if (!warehouseId || !panel.has(warehouseId)) continue;

    const entry = panel.get(warehouseId)!.expediciones;
    const bucket = classifyShipmentBucket(shipment.status);
    if (bucket === 'EN_ESPERA') entry.enEspera += 1;
    if (bucket === 'POR_ENTREGAR') entry.porEntregar += 1;
    if (isShipmentDelayed(shipment.status, shipment.estimatedDelivery, now)) entry.conDemora += 1;
    if (item?.order?.status === 'PARTIALLY_SHIPPED') entry.parciales += 1;
  }

  // ── Traslados de hoy ──
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todaysTransfers = await prisma.inventoryMovement.findMany({
    where: { companyId, type: { in: ['TRANSFER_IN', 'TRANSFER_OUT'] }, createdAt: { gte: startOfToday } },
    select: { warehouseId: true, type: true },
  });
  for (const mv of todaysTransfers) {
    if (!panel.has(mv.warehouseId)) continue;
    const entry = panel.get(mv.warehouseId)!.traslados;
    if (mv.type === 'TRANSFER_IN') entry.entrantesHoy += 1;
    else entry.salientesHoy += 1;
  }

  return Array.from(panel.values());
}

/** Devuelve todos los lotes activos próximos a vencer (expiryDate en los próximos N días) */
export async function getBatchesNearExpiry(companyId: string, daysAhead = 30) {
  const cutoff = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return prisma.inventoryBatch.findMany({
    where: {
      companyId,
      isExhausted: false,
      expiryDate: { not: null, lte: cutoff },
    },
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
      warehouse: { select: { id: true, name: true } },
    },
    orderBy: { expiryDate: 'asc' },
  });
}

// ============================================================
// CONTEO FÍSICO
// ============================================================

export async function startPhysicalCount(
  companyId: string,
  data: { warehouseId: string; countedBy?: string; notes?: string },
) {
  return prisma.physicalCount.create({
    data: {
      companyId,
      warehouseId: data.warehouseId,
      countedBy: data.countedBy,
      notes: data.notes,
      status: 'IN_PROGRESS',
    },
  });
}

export async function addPhysicalCountItems(
  countId: string,
  companyId: string,
  items: Array<{ productId: string; physicalQty: number }>,
) {
  const count = await prisma.physicalCount.findFirst({
    where: { id: countId, companyId, status: 'IN_PROGRESS' },
  });
  if (!count) throw new Error('COUNT_NOT_FOUND_OR_CLOSED');

  const operations = await Promise.all(
    items.map(async (item) => {
      const stock = await prisma.productStock.findUnique({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: count.warehouseId } },
      });
      const product = await prisma.product.findFirst({ where: { id: item.productId, companyId } });
      const systemQty = stock ? Number(stock.quantity) : 0;
      const physicalQty = item.physicalQty;
      const variance = physicalQty - systemQty;
      const unitCost = product ? Number(product.avgCost) : 0;
      const varianceValue = variance * unitCost;

      return prisma.physicalCountItem.upsert({
        where: { countId_productId: { countId, productId: item.productId } } as any,
        update: { physicalQty: new Prisma.Decimal(physicalQty), variance: new Prisma.Decimal(variance), varianceValue: new Prisma.Decimal(varianceValue) },
        create: {
          countId,
          productId: item.productId,
          systemQty: new Prisma.Decimal(systemQty),
          physicalQty: new Prisma.Decimal(physicalQty),
          variance: new Prisma.Decimal(variance),
          unitCost: new Prisma.Decimal(unitCost),
          varianceValue: new Prisma.Decimal(varianceValue),
        },
      });
    }),
  );
  return operations;
}

export async function finalizePhysicalCount(countId: string, companyId: string, createdBy?: string) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.physicalCount.findFirst({
      where: { id: countId, companyId, status: 'IN_PROGRESS' },
      include: { items: { include: { product: true } } },
    });
    if (!count) throw new Error('COUNT_NOT_FOUND_OR_CLOSED');

    const adjustments = [];
    for (const item of count.items) {
      const variance = Number(item.variance);
      if (variance === 0) continue;

      const movType = variance > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
      const absVariance = Math.abs(variance);

      const stock = await tx.productStock.findUnique({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: count.warehouseId } },
      });
      const currentQty = stock ? Number(stock.quantity) : 0;
      const newQty = currentQty + variance;

      await tx.inventoryMovement.create({
        data: {
          companyId,
          productId: item.productId,
          warehouseId: count.warehouseId,
          type: movType,
          quantity: new Prisma.Decimal(absVariance),
          unitCost: item.unitCost,
          totalCost: new Prisma.Decimal(absVariance * Number(item.unitCost)),
          avgCostAfter: item.unitCost,
          stockAfter: new Prisma.Decimal(Math.max(0, newQty)),
          reference: `CONTEO-${countId}`,
          notes: `Ajuste por conteo físico ${count.countDate.toISOString().split('T')[0]}`,
          createdBy,
        },
      });

      await tx.productStock.upsert({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: count.warehouseId } },
        update: { quantity: new Prisma.Decimal(Math.max(0, newQty)) },
        create: { productId: item.productId, warehouseId: count.warehouseId, quantity: new Prisma.Decimal(Math.max(0, newQty)) },
      });

      adjustments.push({ productId: item.productId, variance, movType });
    }

    await tx.physicalCount.update({
      where: { id: countId },
      data: { status: 'COMPLETED', updatedAt: new Date() },
    });

    return { countId, adjustmentsCreated: adjustments.length, adjustments };
  });
}

export async function getPhysicalCounts(companyId: string, warehouseId?: string) {
  return prisma.physicalCount.findMany({
    where: { companyId, ...(warehouseId ? { warehouseId } : {}) },
    include: { warehouse: true, items: true },
    orderBy: { countDate: 'desc' },
  });
}

// ============================================================
// KPIs
// ============================================================

export async function getInventoryKPIs(companyId: string) {
  const products = await prisma.product.findMany({
    where: { companyId, isActive: true },
    include: { stocks: true },
  });

  let totalValue = 0;
  let lowStockCount = 0;
  let zeroStockCount = 0;

  for (const p of products) {
    const totalQty = p.stocks.reduce((sum, s) => sum + Number(s.quantity), 0);
    totalValue += totalQty * Number(p.avgCost);
    if (totalQty === 0) zeroStockCount++;
    else if (totalQty <= Number(p.minStock)) lowStockCount++;
  }

  return {
    totalProducts: products.length,
    totalValue: Math.round(totalValue * 100) / 100,
    lowStockCount,
    zeroStockCount,
  };
}

// ============================================================
// ANALYTICS AVANZADOS DE INVENTARIO
// ============================================================

export async function getInventoryAnalytics(companyId: string, periodDays = 90) {
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const days30ago  = new Date(now.getTime() - 30  * 24 * 60 * 60 * 1000);
  const days180ago = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  const OUT_TYPES = ['OUT', 'ADJUSTMENT_OUT', 'TRANSFER_OUT'];
  const IN_TYPES  = ['IN',  'ADJUSTMENT_IN',  'TRANSFER_IN'];

  // ── 1. Productos activos con stocks y categoría ──────────────
  const products = await prisma.product.findMany({
    where: { companyId, isActive: true },
    include: {
      stocks: true,
      category: { select: { id: true, name: true } },
    },
  });

  // ── 2. Movimientos del período ───────────────────────────────
  const movements = await prisma.inventoryMovement.findMany({
    where: { companyId, createdAt: { gte: periodStart } },
    select: {
      productId: true,
      type: true,
      quantity: true,
      unitCost: true,
      totalCost: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // ── 3. Lotes con fecha de vencimiento ────────────────────────
  const batches = await prisma.inventoryBatch.findMany({
    where: { companyId, isExhausted: false, expiryDate: { not: null } },
    include: {
      product:   { select: { id: true, name: true, sku: true } },
      warehouse: { select: { name: true } },
    },
    orderBy: { expiryDate: 'asc' },
  });

  // ── Cálculos de inventario ───────────────────────────────────
  let totalInventoryValue = 0;
  let totalUnits = 0;
  let outOfStockCount = 0;
  let lowStockCount = 0;
  const productValueMap: Record<string, number> = {};

  for (const p of products) {
    const qty   = p.stocks.reduce((s, st) => s + Number(st.quantity), 0);
    const value = qty * Number(p.avgCost);
    totalInventoryValue += value;
    totalUnits          += qty;
    productValueMap[p.id] = value;
    if (qty <= 0)                                                       outOfStockCount++;
    else if (Number(p.minStock) > 0 && qty <= Number(p.minStock))      lowStockCount++;
  }

  // ── COGS y consumo por producto ──────────────────────────────
  let cogsPeriod = 0;
  let totalOutUnits = 0;
  let totalInUnits  = 0;
  const consumptionMap: Record<string, number> = {};
  const movCountMap:    Record<string, number> = {};

  for (const m of movements) {
    const qty  = Number(m.quantity);
    const cost = Number(m.totalCost ?? 0) || qty * Number(m.unitCost ?? 0);
    movCountMap[m.productId] = (movCountMap[m.productId] ?? 0) + 1;

    if (OUT_TYPES.includes(m.type)) {
      cogsPeriod   += cost;
      totalOutUnits += qty;
      consumptionMap[m.productId] = (consumptionMap[m.productId] ?? 0) + cost;
    } else if (IN_TYPES.includes(m.type)) {
      totalInUnits += qty;
    }
  }

  // ── Índice de Rotación & DOH ─────────────────────────────────
  const dailyCogs = cogsPeriod / periodDays;
  const rotationIndex = totalInventoryValue > 0
    ? (cogsPeriod / periodDays * 365) / totalInventoryValue
    : 0;
  const doh = dailyCogs > 0 ? totalInventoryValue / dailyCogs : 999;

  // ── Velocidad (últimos 30 días) ──────────────────────────────
  const mov30 = movements.filter(m => new Date(m.createdAt) >= days30ago);
  const out30 = mov30.filter(m => OUT_TYPES.includes(m.type)).reduce((s, m) => s + Number(m.quantity), 0);
  const in30  = mov30.filter(m => IN_TYPES.includes(m.type)).reduce((s, m)  => s + Number(m.quantity), 0);

  // ── Costo de mantenimiento (holding cost) ────────────────────
  // Estándar industria: 25% anual del valor del inventario
  const holdingCostAnnual  = totalInventoryValue * 0.25;
  const holdingCostMonthly = holdingCostAnnual / 12;

  // ── Análisis ABC por valor de consumo ────────────────────────
  const abcRaw = products.map(p => ({
    productId:        p.id,
    name:             p.name,
    sku:              p.sku ?? '',
    consumptionValue: consumptionMap[p.id] ?? 0,
    stockValue:       productValueMap[p.id] ?? 0,
    totalQty:         p.stocks.reduce((s, st) => s + Number(st.quantity), 0),
    categoryName:     p.category?.name ?? 'Sin categoría',
    movementCount:    movCountMap[p.id] ?? 0,
  })).sort((a, b) => b.consumptionValue - a.consumptionValue);

  const totalConsumption = abcRaw.reduce((s, p) => s + p.consumptionValue, 0);
  let cumulative = 0;
  const abcItems = abcRaw.map(p => {
    cumulative += p.consumptionValue;
    const pct      = totalConsumption > 0 ? cumulative / totalConsumption : 0;
    const category = pct <= 0.80 ? 'A' : pct <= 0.95 ? 'B' : 'C';
    return { ...p, abcCategory: category, cumulativePct: Math.round(pct * 100) };
  });

  const aItems = abcItems.filter(p => p.abcCategory === 'A');
  const bItems = abcItems.filter(p => p.abcCategory === 'B');
  const cItems = abcItems.filter(p => p.abcCategory === 'C');

  // ── Stock muerto (sin movimientos en 180 días con stock > 0) ─
  const deadStock = products
    .filter(p => {
      const qty     = p.stocks.reduce((s, st) => s + Number(st.quantity), 0);
      const lastMov = p.lastMovementAt ? new Date(p.lastMovementAt) : null;
      return qty > 0 && (!lastMov || lastMov < days180ago);
    })
    .map(p => {
      const qty     = p.stocks.reduce((s, st) => s + Number(st.quantity), 0);
      const lastMov = p.lastMovementAt ? new Date(p.lastMovementAt) : null;
      return {
        productId:            p.id,
        name:                 p.name,
        sku:                  p.sku ?? '',
        totalQty:             qty,
        stockValue:           productValueMap[p.id] ?? 0,
        daysSinceLastMovement: lastMov
          ? Math.floor((now.getTime() - lastMov.getTime()) / 86400000)
          : null,
        categoryName: p.category?.name ?? 'Sin categoría',
      };
    })
    .sort((a, b) => (b.daysSinceLastMovement ?? 9999) - (a.daysSinceLastMovement ?? 9999))
    .slice(0, 20);

  // ── Stock de lento movimiento (<3 mvtos en período, qty > 0) ─
  const slowMoving = products
    .filter(p => {
      const qty   = p.stocks.reduce((s, st) => s + Number(st.quantity), 0);
      const count = movCountMap[p.id] ?? 0;
      return qty > 0 && count < 3;
    })
    .map(p => ({
      productId:     p.id,
      name:          p.name,
      sku:           p.sku ?? '',
      totalQty:      p.stocks.reduce((s, st) => s + Number(st.quantity), 0),
      stockValue:    productValueMap[p.id] ?? 0,
      movementCount: movCountMap[p.id] ?? 0,
      categoryName:  p.category?.name ?? 'Sin categoría',
    }))
    .sort((a, b) => a.movementCount - b.movementCount)
    .slice(0, 20);

  // ── Tendencia semanal (últimas 12 semanas) ───────────────────
  const WEEKS = 12;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weeklyTrend = Array.from({ length: WEEKS }, (_, i) => {
    const wStart = new Date(now.getTime() - (WEEKS - i) * weekMs);
    const wEnd   = new Date(now.getTime() - (WEEKS - i - 1) * weekMs);
    const wMovs  = movements.filter(m => {
      const d = new Date(m.createdAt);
      return d >= wStart && d < wEnd;
    });
    const inVal  = wMovs.filter(m => IN_TYPES.includes(m.type)).reduce((s, m)  => s + Number(m.quantity), 0);
    const outVal = wMovs.filter(m => OUT_TYPES.includes(m.type)).reduce((s, m) => s + Number(m.quantity), 0);
    return {
      label: wStart.toLocaleDateString('es', { month: 'short', day: 'numeric' }),
      in:    Math.round(inVal * 10) / 10,
      out:   Math.round(outVal * 10) / 10,
    };
  });

  // ── Top 10 productos por valor de inventario ─────────────────
  const topByValue = products
    .map(p => ({
      productId: p.id,
      name:      p.name,
      sku:       p.sku ?? '',
      stockValue: productValueMap[p.id] ?? 0,
      totalQty:   p.stocks.reduce((s, st) => s + Number(st.quantity), 0),
    }))
    .sort((a, b) => b.stockValue - a.stockValue)
    .slice(0, 10)
    .map(p => ({
      ...p,
      percentage: totalInventoryValue > 0
        ? Math.round((p.stockValue / totalInventoryValue) * 1000) / 10
        : 0,
    }));

  // ── Breakdown por categoría ───────────────────────────────────
  const catMap: Record<string, { name: string; value: number; count: number }> = {};
  for (const p of products) {
    const key  = p.categoryId ?? 'none';
    const name = p.category?.name ?? 'Sin categoría';
    if (!catMap[key]) catMap[key] = { name, value: 0, count: 0 };
    catMap[key].value += productValueMap[p.id] ?? 0;
    catMap[key].count++;
  }
  const categoryBreakdown = Object.values(catMap)
    .sort((a, b) => b.value - a.value)
    .map(c => ({ ...c, value: Math.round(c.value * 100) / 100 }));

  // ── Riesgo de vencimiento (próximos 30 días) ─────────────────
  const expiryCutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiryRisk = batches
    .filter(b => b.expiryDate && b.expiryDate <= expiryCutoff)
    .map(b => ({
      productName:    b.product.name,
      sku:            b.product.sku ?? '',
      warehouseName:  b.warehouse.name,
      lotNumber:      b.lotNumber ?? '',
      expiryDate:     b.expiryDate,
      remainingQty:   Number(b.remainingQty),
      daysUntilExpiry: Math.ceil((b.expiryDate!.getTime() - now.getTime()) / 86400000),
    }))
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  // ── Tasa de quiebre de stock ──────────────────────────────────
  const outOfStockRate = products.length > 0
    ? Math.round((outOfStockCount / products.length) * 1000) / 10
    : 0;

  return {
    period: { days: periodDays, start: periodStart.toISOString(), end: now.toISOString() },
    overview: {
      totalProducts:       products.length,
      totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
      totalUnits:          Math.round(totalUnits * 100) / 100,
      outOfStockCount,
      lowStockCount,
      outOfStockRate,
    },
    rotation: {
      rotationIndex:  Math.round(rotationIndex * 100) / 100,
      doh:            Math.round(doh * 10) / 10,
      cogsPeriod:     Math.round(cogsPeriod * 100) / 100,
      totalInUnits:   Math.round(totalInUnits * 100) / 100,
      totalOutUnits:  Math.round(totalOutUnits * 100) / 100,
    },
    velocity: {
      avgDailyIn:  Math.round((in30  / 30) * 100) / 100,
      avgDailyOut: Math.round((out30 / 30) * 100) / 100,
      inUnits30d:  Math.round(in30  * 100) / 100,
      outUnits30d: Math.round(out30 * 100) / 100,
    },
    holding: {
      holdingCostMonthly: Math.round(holdingCostMonthly * 100) / 100,
      holdingCostAnnual:  Math.round(holdingCostAnnual  * 100) / 100,
      holdingRate:        25,
    },
    abc: {
      items: abcItems.slice(0, 60),
      summary: {
        aCount: aItems.length,
        bCount: bItems.length,
        cCount: cItems.length,
        aValuePct: totalConsumption > 0 ? Math.round((aItems.reduce((s, p) => s + p.consumptionValue, 0) / totalConsumption) * 1000) / 10 : 0,
        bValuePct: totalConsumption > 0 ? Math.round((bItems.reduce((s, p) => s + p.consumptionValue, 0) / totalConsumption) * 1000) / 10 : 0,
        cValuePct: totalConsumption > 0 ? Math.round((cItems.reduce((s, p) => s + p.consumptionValue, 0) / totalConsumption) * 1000) / 10 : 0,
      },
    },
    deadStock,
    slowMoving,
    weeklyTrend,
    topByValue,
    categoryBreakdown,
    expiryRisk,
  };
}

// ============================================================
// PRONÓSTICO DE DEMANDA Y TENDENCIA DE ROTACIÓN (productos más vendidos)
// ============================================================
// Motor puro (`demand-forecast.engine.ts`, regla 6) + este orquestador con BD que arma la
// serie mensual de unidades vendidas por producto a partir de SalesOrderItem.shippedQty
// (cantidad REALMENTE despachada, no solo pedida). Se agrupa por el mes de CREACIÓN del
// pedido — aproximación razonable (un despacho parcial puede caer en el mes siguiente),
// documentada aquí en vez de perseguir precisión al día, igual que otras simplificaciones ya
// aceptadas en el proyecto (ver Sprint 11 sobre la base de IVA).

function periodKeyUTC(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function lastNPeriods(n: number, from: Date): string[] {
  const periods: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    periods.push(periodKeyUTC(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - i, 1))));
  }
  return periods;
}

interface ProductDemandSeries {
  productId: string;
  name: string;
  sku: string;
  type: string;
  avgCost: number;
  history: number[]; // unidades vendidas por período, mismo orden que `periods`
  totalUnits: number;
  forecastNextPeriod: number;
  trend: DemandTrend;
}

async function getProductDemandSeries(companyId: string, months: number): Promise<{ periods: string[]; products: ProductDemandSeries[] }> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const periods = lastNPeriods(months, now);

  const items = await prisma.salesOrderItem.findMany({
    where: { shippedQty: { gt: 0 }, order: { companyId, createdAt: { gte: start } } },
    select: {
      productId: true,
      shippedQty: true,
      order: { select: { createdAt: true } },
      product: { select: { name: true, sku: true, type: true, avgCost: true } },
    },
  });

  const byProduct = new Map<string, { name: string; sku: string; type: string; avgCost: number; monthly: Map<string, number> }>();
  for (const it of items) {
    let entry = byProduct.get(it.productId);
    if (!entry) {
      entry = { name: it.product.name, sku: it.product.sku ?? '', type: it.product.type, avgCost: Number(it.product.avgCost), monthly: new Map() };
      byProduct.set(it.productId, entry);
    }
    const period = periodKeyUTC(it.order.createdAt);
    entry.monthly.set(period, (entry.monthly.get(period) ?? 0) + Number(it.shippedQty));
  }

  const products: ProductDemandSeries[] = Array.from(byProduct.entries()).map(([productId, data]) => {
    const history = periods.map((p) => Math.round((data.monthly.get(p) ?? 0) * 100) / 100);
    return {
      productId, name: data.name, sku: data.sku, type: data.type, avgCost: data.avgCost,
      history,
      totalUnits: Math.round(history.reduce((s, n) => s + n, 0) * 100) / 100,
      forecastNextPeriod: forecastNextPeriod(history),
      trend: classifyTrend(history),
    };
  });

  return { periods, products };
}

/** Top N productos (y servicios) más vendidos con pronóstico de demanda del siguiente período
 * (suavizado exponencial) y tendencia creciente/estable/decreciente. Incluye SERVICIOS — no
 * tienen stock que rotar, pero sí conviene planear su capacidad. */
export async function getDemandForecast(companyId: string, months = 6, topN = 10) {
  const { periods, products } = await getProductDemandSeries(companyId, months);
  const ranked = products.filter((p) => p.totalUnits > 0).sort((a, b) => b.totalUnits - a.totalUnits).slice(0, topN);
  return { periods, products: ranked };
}

/** Tendencia de rotación por producto (solo tipo PRODUCT — un servicio no tiene stock que
 * rotar): unidades vendidas por mes + índice de rotación anualizado del último mes vs. el
 * valor de inventario ACTUAL, clasificado ALTA/MEDIA/BAJA (mismos umbrales del sector que
 * `rotationIndex` agregado de `getInventoryAnalytics`, pero aquí desglosado por producto). */
export async function getRotationTrend(companyId: string, months = 6) {
  const { periods, products } = await getProductDemandSeries(companyId, months);
  const productRows = await prisma.product.findMany({
    where: { companyId, isActive: true, type: 'PRODUCT' },
    select: { id: true, avgCost: true, stocks: { select: { quantity: true } } },
  });
  const stockValueOf = new Map(productRows.map((p) => [p.id, p.stocks.reduce((s, st) => s + Number(st.quantity), 0) * Number(p.avgCost)]));

  const withRotation = products
    .filter((p) => p.type === 'PRODUCT' && stockValueOf.has(p.productId))
    .map((p) => {
      const stockValue = stockValueOf.get(p.productId) ?? 0;
      const lastMonthUnits = p.history[p.history.length - 1] ?? 0;
      const annualizedCogs = lastMonthUnits * p.avgCost * 12;
      const annualizedTurnover = computeTurnoverRatio(annualizedCogs, stockValue);
      return {
        productId: p.productId, name: p.name, sku: p.sku,
        history: p.history, totalUnits: p.totalUnits,
        forecastNextPeriod: p.forecastNextPeriod, trend: p.trend,
        stockValue: Math.round(stockValue * 100) / 100,
        annualizedTurnover,
        rotationLevel: classifyRotation(annualizedTurnover),
      };
    })
    .sort((a, b) => b.annualizedTurnover - a.annualizedTurnover);

  return { periods, products: withRotation };
}
