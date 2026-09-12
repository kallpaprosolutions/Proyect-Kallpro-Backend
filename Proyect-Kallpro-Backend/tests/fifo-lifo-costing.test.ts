import { prisma } from '../src/lib/prisma';
import { planBatchConsumption, registerMovement, transferStock } from '../src/services/inventory.service';

/**
 * Fix del costeo FIFO/LIFO (doc 23, 2026-07-05).
 *
 * Antes: FIFO nunca consumía capas en salidas (la función correcta era código muerto) y
 * LIFO consumía capas pero costeaba con avgCost congelado. Este suite cubre:
 *  - la planificación pura de consumo de capas (sin BD), y
 *  - el flujo real contra BD (si está disponible): entradas crean capas, salidas las
 *    consumen en el orden del método con el costo REAL, avgCost refleja las capas
 *    restantes, y las transferencias mueven capas a la bodega destino.
 */

// ─── Lógica pura (sin BD) ─────────────────────────────────────────────────────

describe('planBatchConsumption — consumo de capas (puro)', () => {
  it('FIFO cruzando capas: 15 de [10@$5, 10@$8] → $90', () => {
    const plan = planBatchConsumption(
      [{ remainingQty: 10, unitCost: 5 }, { remainingQty: 10, unitCost: 8 }],
      15, 999,
    );
    expect(plan.totalCost).toBe(10 * 5 + 5 * 8); // 90
    expect(plan.takes).toEqual([{ index: 0, qty: 10 }, { index: 1, qty: 5 }]);
    expect(plan.uncovered).toBe(0);
  });

  it('consume exactamente una capa completa sin tocar la siguiente', () => {
    const plan = planBatchConsumption(
      [{ remainingQty: 10, unitCost: 5 }, { remainingQty: 10, unitCost: 8 }],
      10, 999,
    );
    expect(plan.totalCost).toBe(50);
    expect(plan.takes).toEqual([{ index: 0, qty: 10 }]);
  });

  it('remanente sin capas se costea con el fallback (datos legados)', () => {
    const plan = planBatchConsumption([{ remainingQty: 5, unitCost: 5 }], 8, 10);
    expect(plan.totalCost).toBe(5 * 5 + 3 * 10); // 55
    expect(plan.uncovered).toBe(3);
  });

  it('ignora capas vacías (remainingQty 0)', () => {
    const plan = planBatchConsumption(
      [{ remainingQty: 0, unitCost: 1 }, { remainingQty: 10, unitCost: 7 }],
      4, 999,
    );
    expect(plan.totalCost).toBe(28);
    expect(plan.takes).toEqual([{ index: 1, qty: 4 }]);
  });
});

// ─── E2E contra BD real (se omite con gracia si la BD no está) ────────────────

let dbAvailable = false;
let companyId = '';
let whA = '';
let whB = '';

async function cleanup() {
  if (!companyId) return;
  await prisma.inventoryMovement.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.inventoryBatch.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.productStock.deleteMany({ where: { product: { companyId } } }).catch(() => {});
  await prisma.product.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.warehouse.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => {});
}

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch { return; }
  const company = await prisma.company.create({ data: { name: `FIFO Test Co ${Date.now()}` } });
  companyId = company.id;
  const a = await prisma.warehouse.create({ data: { companyId, name: 'Bodega A', code: 'FA' } });
  const b = await prisma.warehouse.create({ data: { companyId, name: 'Bodega B', code: 'FB' } });
  whA = a.id;
  whB = b.id;
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

async function createProduct(method: 'FIFO' | 'LIFO') {
  return prisma.product.create({
    data: { companyId, name: `Prod ${method}`, sku: `${method}-${Date.now()}`, valuationMethod: method },
  });
}

describe('registerMovement — costeo por capas contra BD real', () => {
  it('FIFO: la salida consume las capas más ANTIGUAS y costea con su costo real', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e FIFO'); return; }
    const p = await createProduct('FIFO');

    await registerMovement(companyId, { productId: p.id, warehouseId: whA, type: 'IN', quantity: 10, unitCost: 5 });
    await registerMovement(companyId, { productId: p.id, warehouseId: whA, type: 'IN', quantity: 10, unitCost: 8 });

    // avgCost tras entradas = ponderado de capas restantes: (10*5+10*8)/20 = 6.5
    const afterIn = await prisma.product.findUnique({ where: { id: p.id } });
    expect(Number(afterIn!.avgCost)).toBeCloseTo(6.5, 4);

    const out = await registerMovement(companyId, { productId: p.id, warehouseId: whA, type: 'OUT', quantity: 15 });
    expect(Number(out.totalCost)).toBeCloseTo(10 * 5 + 5 * 8, 2); // 90 — capa vieja completa + 5 de la nueva
    expect(Number(out.unitCost)).toBeCloseTo(6, 4);

    const batches = await prisma.inventoryBatch.findMany({
      where: { companyId, productId: p.id }, orderBy: { receivedAt: 'asc' },
    });
    expect(batches[0].isExhausted).toBe(true);            // capa @$5 agotada
    expect(Number(batches[1].remainingQty)).toBe(5);      // quedan 5 @$8

    // avgCost tras la salida = costo de lo que QUEDA: $8
    const afterOut = await prisma.product.findUnique({ where: { id: p.id } });
    expect(Number(afterOut!.avgCost)).toBeCloseTo(8, 4);
  });

  it('LIFO: la salida consume las capas más RECIENTES y costea con su costo real', async () => {
    if (!dbAvailable) return;
    const p = await createProduct('LIFO');

    await registerMovement(companyId, { productId: p.id, warehouseId: whA, type: 'IN', quantity: 10, unitCost: 5 });
    // separar timestamps para un orden receivedAt determinista
    await new Promise((r) => setTimeout(r, 20));
    await registerMovement(companyId, { productId: p.id, warehouseId: whA, type: 'IN', quantity: 10, unitCost: 8 });

    const out = await registerMovement(companyId, { productId: p.id, warehouseId: whA, type: 'OUT', quantity: 15 });
    expect(Number(out.totalCost)).toBeCloseTo(10 * 8 + 5 * 5, 2); // 105 — capa nueva completa + 5 de la vieja

    // avgCost tras la salida = costo de lo que queda (5 @$5)
    const afterOut = await prisma.product.findUnique({ where: { id: p.id } });
    expect(Number(afterOut!.avgCost)).toBeCloseTo(5, 4);
  });

  it('transferencia FIFO: las capas viajan a la bodega destino preservando costo y antigüedad', async () => {
    if (!dbAvailable) return;
    const p = await createProduct('FIFO');

    await registerMovement(companyId, { productId: p.id, warehouseId: whA, type: 'IN', quantity: 10, unitCost: 5 });
    await new Promise((r) => setTimeout(r, 20));
    await registerMovement(companyId, { productId: p.id, warehouseId: whA, type: 'IN', quantity: 10, unitCost: 8 });

    await transferStock(companyId, { fromWarehouseId: whA, toWarehouseId: whB, productId: p.id, quantity: 12 });

    // destino recibió 2 capas: 10@$5 (la más antigua, entera) + 2@$8
    const destBatches = await prisma.inventoryBatch.findMany({
      where: { companyId, productId: p.id, warehouseId: whB }, orderBy: { receivedAt: 'asc' },
    });
    expect(destBatches).toHaveLength(2);
    expect(Number(destBatches[0].remainingQty)).toBe(10);
    expect(Number(destBatches[0].unitCost)).toBe(5);
    expect(Number(destBatches[1].remainingQty)).toBe(2);
    expect(Number(destBatches[1].unitCost)).toBe(8);

    // origen quedó con 8 @$8 activos
    const srcActive = await prisma.inventoryBatch.findMany({
      where: { companyId, productId: p.id, warehouseId: whA, isExhausted: false },
    });
    expect(srcActive).toHaveLength(1);
    expect(Number(srcActive[0].remainingQty)).toBe(8);

    // una salida en DESTINO ahora sí tiene capas que consumir (antes del fix: imposible)
    const out = await registerMovement(companyId, { productId: p.id, warehouseId: whB, type: 'OUT', quantity: 11 });
    expect(Number(out.totalCost)).toBeCloseTo(10 * 5 + 1 * 8, 2); // 58
  });
});
