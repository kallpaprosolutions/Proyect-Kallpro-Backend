import { prisma } from '../../src/lib/prisma';
import { createSalesOrder, confirmOrder, dispatchOrder, invoiceSalesOrder, getSalesOrderById } from '../../src/services/sales.service';

/**
 * Integración con BD real: valida que un ítem de tipo SERVICIO (servicio o producto no
 * cargado a inventario) se puede vender, confirmar, despachar y facturar de punta a punta
 * SIN tocar stock — antes `confirmOrder` intentaba reservar stock para TODO ítem sin excepción,
 * lo que rompía (o inflaba stock falso) para servicios.
 */
const TAG = `svc_${Date.now()}`;
let dbAvailable = false;
let companyId = '';
let customerId = '';
let serviceProductId = '';

async function cleanup() {
  await prisma.invoice.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.shipment.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.salesOrder.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.inventoryMovement.deleteMany({ where: { companyId } }).catch(() => {});
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
  await prisma.warehouse.create({ data: { companyId, name: 'Bodega Principal', isDefault: true } });
  const customer = await prisma.customer.create({ data: { companyId, name: 'Cliente de Prueba' } });
  customerId = customer.id;
  const service = await prisma.product.create({
    data: { companyId, name: 'Consultoría de instalación', unit: 'HORA', salePrice: 80, type: 'SERVICE' },
  });
  serviceProductId = service.id;
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

describe('sales.service — venta de servicios / productos no cargados a inventario', () => {
  it('confirma un pedido con un ítem SERVICIO sin generar ningún movimiento de inventario', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }

    const order = await createSalesOrder(companyId, {
      customerId,
      items: [{ productId: serviceProductId, quantity: 3, taxRate: 15 }],
    });
    expect(Number(order.total)).toBeCloseTo(80 * 3 * 1.15, 2);

    const confirmed = await confirmOrder(order.id, companyId);
    expect(confirmed.status).toBe('CONFIRMED');

    const movements = await prisma.inventoryMovement.findMany({ where: { companyId, productId: serviceProductId } });
    expect(movements).toHaveLength(0);

    const detail = await getSalesOrderById(order.id, companyId);
    expect(detail!.items[0].availableStock).toBeNull();
  });

  it('despacha y factura el servicio sin costo (COGS=0) y sin movimiento de inventario', async () => {
    if (!dbAvailable) return;

    const order = await createSalesOrder(companyId, {
      customerId,
      items: [{ productId: serviceProductId, quantity: 2, taxRate: 15 }],
    });
    await confirmOrder(order.id, companyId);
    const dispatched = await dispatchOrder(order.id, companyId);
    expect(dispatched!.status).not.toBe('DRAFT');

    const shipment = await prisma.shipment.findFirst({ where: { companyId, orderId: order.id }, include: { items: true } });
    expect(shipment).not.toBeNull();
    expect(Number(shipment!.items[0].unitCost)).toBe(0);

    const invoice = await invoiceSalesOrder(companyId, shipment!.id);
    expect(invoice).not.toBeNull();
    expect(Number(invoice!.totalAmount)).toBeCloseTo(80 * 2 * 1.15, 2);

    const movements = await prisma.inventoryMovement.findMany({ where: { companyId, productId: serviceProductId } });
    expect(movements).toHaveLength(0);
  });
});
