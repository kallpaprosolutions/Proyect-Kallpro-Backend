import { prisma } from '../../src/lib/prisma';
import { registerMovement, transferStock, reserveStock } from '../../src/services/inventory.service';
import { createSalesOrder, confirmOrder } from '../../src/services/sales.service';

/**
 * Integración con BD real: C3 — stock negativo configurable por producto.
 * Por defecto (allowNegativeStock=false) el comportamiento NO cambia (sigue bloqueando);
 * con el flag activado, salida/transferencia/reserva pueden dejar el stock en negativo.
 */
const TAG = `negstock_${Date.now()}`;
let dbAvailable = false;
let companyId = '';
let whA = '';
let whB = '';
let customerId = '';

async function cleanup() {
  await prisma.salesOrder.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.inventoryMovement.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.productStock.deleteMany({ where: { warehouse: { companyId } } }).catch(() => {});
  await prisma.product.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.customer.deleteMany({ where: { companyId } }).catch(() => {});
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
  const a = await prisma.warehouse.create({ data: { companyId, name: 'Bodega A', isDefault: true } });
  whA = a.id;
  const b = await prisma.warehouse.create({ data: { companyId, name: 'Bodega B' } });
  whB = b.id;
  const customer = await prisma.customer.create({ data: { companyId, name: 'Cliente de Prueba' } });
  customerId = customer.id;
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

describe('inventory.service — C3 stock negativo configurable', () => {
  it('por defecto (allowNegativeStock=false) sigue bloqueando la salida sin stock suficiente', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const product = await prisma.product.create({ data: { companyId, name: 'Producto Normal', salePrice: 10, allowNegativeStock: false } });
    await expect(registerMovement(companyId, { productId: product.id, warehouseId: whA, type: 'OUT', quantity: 5 }))
      .rejects.toThrow('INSUFFICIENT_STOCK');
  });

  it('con allowNegativeStock=true permite la salida y deja el stock en negativo, valorado al costo promedio', async () => {
    if (!dbAvailable) return;
    const product = await prisma.product.create({ data: { companyId, name: 'Producto Bajo Pedido', salePrice: 10, allowNegativeStock: true } });
    // Sin ningún IN previo: avgCost arranca en 0, currentQty 0 → sale a -3.
    const movement = await registerMovement(companyId, { productId: product.id, warehouseId: whA, type: 'OUT', quantity: 3 });
    expect(movement).not.toBeNull();
    const stock = await prisma.productStock.findUnique({ where: { productId_warehouseId: { productId: product.id, warehouseId: whA } } });
    expect(Number(stock!.quantity)).toBe(-3);
  });

  it('con allowNegativeStock=true permite transferir más de lo disponible entre bodegas', async () => {
    if (!dbAvailable) return;
    const product = await prisma.product.create({ data: { companyId, name: 'Producto Transferible', salePrice: 10, allowNegativeStock: true } });
    await registerMovement(companyId, { productId: product.id, warehouseId: whA, type: 'IN', quantity: 5, unitCost: 4 });
    await transferStock(companyId, { fromWarehouseId: whA, toWarehouseId: whB, productId: product.id, quantity: 8 });
    const fromStock = await prisma.productStock.findUnique({ where: { productId_warehouseId: { productId: product.id, warehouseId: whA } } });
    const toStock = await prisma.productStock.findUnique({ where: { productId_warehouseId: { productId: product.id, warehouseId: whB } } });
    expect(Number(fromStock!.quantity)).toBe(-3);
    expect(Number(toStock!.quantity)).toBe(8);
  });

  it('sin el flag, transferStock sigue bloqueando (comportamiento previo intacto)', async () => {
    if (!dbAvailable) return;
    const product = await prisma.product.create({ data: { companyId, name: 'Producto Transferible Normal', salePrice: 10, allowNegativeStock: false } });
    await registerMovement(companyId, { productId: product.id, warehouseId: whA, type: 'IN', quantity: 2, unitCost: 4 });
    await expect(transferStock(companyId, { fromWarehouseId: whA, toWarehouseId: whB, productId: product.id, quantity: 5 }))
      .rejects.toThrow('INSUFFICIENT_STOCK');
  });

  it('con allowNegativeStock=true, un pedido de venta se puede confirmar (reservar) sin stock físico', async () => {
    if (!dbAvailable) return;
    const product = await prisma.product.create({ data: { companyId, name: 'Producto Venta Sin Stock', salePrice: 20, allowNegativeStock: true, type: 'PRODUCT' } });
    const order = await createSalesOrder(companyId, { customerId, items: [{ productId: product.id, quantity: 4, taxRate: 15 }] });
    const confirmed = await confirmOrder(order.id, companyId);
    expect(confirmed.status).toBe('CONFIRMED');
    const stock = await prisma.productStock.findUnique({ where: { productId_warehouseId: { productId: product.id, warehouseId: whA } } });
    expect(Number(stock!.reserved)).toBe(4);
  });

  it('sin el flag, reserveStock sigue bloqueando (comportamiento previo intacto)', async () => {
    if (!dbAvailable) return;
    const product = await prisma.product.create({ data: { companyId, name: 'Producto Venta Normal', salePrice: 20, allowNegativeStock: false } });
    await expect(reserveStock(companyId, { productId: product.id, warehouseId: whA, quantity: 1, reference: 'TEST' }))
      .rejects.toThrow('INSUFFICIENT_STOCK');
  });
});
