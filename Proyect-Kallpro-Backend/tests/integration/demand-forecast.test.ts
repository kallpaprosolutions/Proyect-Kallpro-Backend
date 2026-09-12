import { prisma } from '../../src/lib/prisma';
import { registerMovement, getDemandForecast, getRotationTrend } from '../../src/services/inventory.service';
import { createSalesOrder, confirmOrder, dispatchOrder } from '../../src/services/sales.service';

/**
 * Integración con BD real: valida que el pronóstico de demanda y la tendencia de rotación
 * (nuevo, motor puro `demand-forecast.engine.ts`) reflejan ventas reales — se generan pedidos
 * reales (confirmar → despachar) en vez de escribir filas de historial a mano, para probar la
 * agregación tal como corre en producción.
 */
const TAG = `dmf_${Date.now()}`;
let dbAvailable = false;
let companyId = '';
let warehouseId = '';
let customerId = '';
let productId = '';

async function cleanup() {
  await prisma.shipment.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.salesOrder.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.inventoryMovement.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.productStock.deleteMany({ where: { warehouseId } }).catch(() => {});
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
  const wh = await prisma.warehouse.create({ data: { companyId, name: 'Bodega Principal', isDefault: true } });
  warehouseId = wh.id;
  const customer = await prisma.customer.create({ data: { companyId, name: 'Cliente de Prueba' } });
  customerId = customer.id;
  const product = await prisma.product.create({
    data: { companyId, name: 'Producto Estrella', unit: 'UNIDAD', salePrice: 20, type: 'PRODUCT' },
  });
  productId = product.id;
  await registerMovement(companyId, { productId, warehouseId, type: 'IN', quantity: 100, unitCost: 10 });

  // Vender y despachar 5 unidades HOY (único punto de dato en la ventana — suficiente para
  // validar que el pronóstico/rotación reflejan la venta real).
  const order = await createSalesOrder(companyId, { customerId, items: [{ productId, quantity: 5, taxRate: 15 }] });
  await confirmOrder(order.id, companyId);
  await dispatchOrder(order.id, companyId);
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

describe('inventory.service — pronóstico de demanda y tendencia de rotación', () => {
  it('getDemandForecast incluye el producto vendido con el total correcto y pronóstico > 0', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const result = await getDemandForecast(companyId, 3, 10);
    const row = result.products.find((p) => p.productId === productId);
    expect(row).toBeDefined();
    expect(row!.totalUnits).toBe(5);
    expect(row!.forecastNextPeriod).toBeGreaterThan(0);
    expect(result.periods).toHaveLength(3);
  });

  it('getRotationTrend calcula el índice de rotación anualizado a partir del COGS real', async () => {
    if (!dbAvailable) return;
    const result = await getRotationTrend(companyId, 3);
    const row = result.products.find((p) => p.productId === productId);
    expect(row).toBeDefined();
    // Vendió 5 a costo 10 este mes → COGS anualizado 5*10*12=600; stock restante 95*10=950.
    expect(row!.stockValue).toBeCloseTo(950, 0);
    expect(row!.annualizedTurnover).toBeCloseTo(600 / 950, 2);
    expect(['ALTA', 'MEDIA', 'BAJA']).toContain(row!.rotationLevel);
  });

  it('getRotationTrend excluye productos tipo SERVICE (no tienen stock que rotar)', async () => {
    if (!dbAvailable) return;
    const service = await prisma.product.create({
      data: { companyId, name: 'Servicio de prueba', unit: 'HORA', salePrice: 50, type: 'SERVICE' },
    });
    const order = await createSalesOrder(companyId, { customerId, items: [{ productId: service.id, quantity: 1, taxRate: 15 }] });
    await confirmOrder(order.id, companyId);
    await dispatchOrder(order.id, companyId);

    const forecast = await getDemandForecast(companyId, 3, 10);
    expect(forecast.products.some((p) => p.productId === service.id)).toBe(true); // sí aparece en demanda

    const rotation = await getRotationTrend(companyId, 3);
    expect(rotation.products.some((p) => p.productId === service.id)).toBe(false); // no en rotación
  });
});
