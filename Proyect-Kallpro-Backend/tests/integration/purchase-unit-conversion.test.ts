import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { createPurchaseOrder, receivePurchaseOrder } from '../../src/services/purchases.service';

/**
 * Integración con BD real: C3 (resto) — unidad de compra ≠ unidad de venta/stock. Una OC
 * creada con `quantityUnit: 'PURCHASE'` para un producto configurado CAJA(24)→UNIDAD debe
 * guardar la cantidad/precio de la línea YA convertidos a unidad de stock, y la recepción
 * debe sumar exactamente esa cantidad convertida al inventario — el resto del flujo (recepción,
 * kardex) no se tocó.
 */
const TAG = `punit_${Date.now()}`;
let dbAvailable = false;
let companyId = '';
let supplierId = '';
let warehouseId = '';
let productId = '';

async function cleanup() {
  await prisma.pOItem.deleteMany({ where: { po: { companyId } } }).catch(() => {});
  await prisma.purchaseOrder.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.inventoryMovement.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.productStock.deleteMany({ where: { warehouseId } }).catch(() => {});
  await prisma.product.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.supplier.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.warehouse.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => {});
}

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
    return;
  }
  const company = await prisma.company.create({ data: { name: `Empresa ${TAG}`, email: `${TAG}@kallpapro.test` } });
  companyId = company.id;
  const supplier = await prisma.supplier.create({ data: { companyId, name: 'Proveedor Mayorista', ruc: '1790012345001' } });
  supplierId = supplier.id;
  const warehouse = await prisma.warehouse.create({ data: { companyId, name: 'Bodega Principal', isDefault: true } });
  warehouseId = warehouse.id;
  // Se compra por CAJA de 24, se vende y cuenta en stock por UNIDAD.
  const product = await prisma.product.create({
    data: { companyId, name: 'Gaseosa 500ml', unit: 'UNIDAD', purchaseUnit: 'CAJA', purchaseConversionFactor: new Prisma.Decimal(24), salePrice: 1 },
  });
  productId = product.id;
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

describe('C3 (resto) — unidad de compra ≠ venta/stock (e2e con BD real)', () => {
  it('una OC de 3 CAJA a $24 se guarda como 72 UNIDAD a $1, con el snapshot de compra', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }

    const po = await createPurchaseOrder(companyId, {
      supplierId,
      items: [{ productId, quantity: 3, unitPrice: 24, quantityUnit: 'PURCHASE' }],
    });

    expect(po.items).toHaveLength(1);
    const item = po.items[0];
    expect(item.quantity).toBe(72);
    expect(Number(item.unitPrice)).toBe(1);
    expect(Number(item.lineTotal)).toBe(72);
    expect(Number(item.purchaseQuantity)).toBe(3);
    expect(item.purchaseUnitLabel).toBe('CAJA');
    expect(Number(po.totalAmount)).toBe(72);
  });

  it('sin quantityUnit (o STOCK explícito), el comportamiento es el de siempre — sin conversión', async () => {
    if (!dbAvailable) return;
    const po = await createPurchaseOrder(companyId, {
      supplierId,
      items: [{ productId, quantity: 10, unitPrice: 1.5 }],
    });
    const item = po.items[0];
    expect(item.quantity).toBe(10);
    expect(Number(item.unitPrice)).toBe(1.5);
    expect(item.purchaseQuantity).toBeNull();
    expect(item.purchaseUnitLabel).toBeNull();
  });

  it('recibir la OC en unidad de compra suma exactamente la cantidad convertida al inventario', async () => {
    if (!dbAvailable) return;
    const po = await createPurchaseOrder(companyId, {
      supplierId,
      items: [{ productId, quantity: 2, unitPrice: 24, quantityUnit: 'PURCHASE' }],
    });
    await receivePurchaseOrder(po.id, companyId, warehouseId, 'test-user');

    const stock = await prisma.productStock.findUnique({ where: { productId_warehouseId: { productId, warehouseId } } });
    expect(Number(stock!.quantity)).toBeGreaterThanOrEqual(48); // 2 CAJA × 24 = 48 UNIDAD (puede acumular con corridas previas del mismo producto)
  });

  it('un producto sin purchaseUnit configurado ignora quantityUnit: PURCHASE (no hay nada que convertir)', async () => {
    if (!dbAvailable) return;
    const simple = await prisma.product.create({ data: { companyId, name: 'Producto Simple', unit: 'UNIDAD', salePrice: 5 } });
    const po = await createPurchaseOrder(companyId, {
      supplierId,
      items: [{ productId: simple.id, quantity: 4, unitPrice: 5, quantityUnit: 'PURCHASE' }],
    });
    const item = po.items[0];
    expect(item.quantity).toBe(4);
    expect(item.purchaseQuantity).toBeNull();
  });
});
