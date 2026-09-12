import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { getAtsReport, buildAtsXml } from '../../src/services/finance/ats.service';
import { createSalesOrder, confirmOrder, dispatchOrder, invoiceSalesOrder } from '../../src/services/sales.service';

/**
 * Integración con BD real: ATS agrega correctamente compras (SriDocument confirmado) y
 * ventas (Invoice real nacida de un pedido → desglose EXACTO por línea, Etapa 7) del período,
 * con los códigos de clasificación correctos.
 */
const TAG = `ats_${Date.now()}`;
let dbAvailable = false;
let companyId = '';

async function cleanup() {
  await prisma.invoice.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.shipment.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.salesOrder.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.sriDocument.deleteMany({ where: { companyId } }).catch(() => {});
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
  const company = await prisma.company.create({
    data: { name: `Empresa ${TAG}`, email: `${TAG}@kallpapro.test`, settings: { company: { ruc: '1790012345001' } } },
  });
  companyId = company.id;

  // Compra confirmada dentro del período (ATS solo mira CONFIRMED).
  await prisma.sriDocument.create({
    data: {
      companyId, status: 'CONFIRMED', tipoDocumento: 'FACTURA',
      claveAcceso: `${TAG}-clave1`, rucEmisor: '0990012345001', razonSocialEmisor: 'Proveedor ATS S.A.',
      estab: '001', ptoEmi: '002', secuencial: '000000123', numeroAutorizacion: `${TAG}-auth1`,
      fechaEmision: new Date('2026-09-05T00:00:00Z'),
      subtotal0: new Prisma.Decimal(20), subtotal15: new Prisma.Decimal(100), iva: new Prisma.Decimal(15),
      total: new Prisma.Decimal(135),
    },
  });
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

describe('ats.service — e2e con BD real', () => {
  it('getAtsReport incluye la compra confirmada del período con los códigos correctos', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const report = await getAtsReport(companyId, '2026-09');
    expect(report.compras.rows).toHaveLength(1);
    const row = report.compras.rows[0];
    expect(row.tipoIdProveedor).toBe('04'); // RUC (13 dígitos, termina en 001)
    expect(row.tipoComprobante).toBe('01'); // factura
    expect(row.baseImponible).toBe(100);
    expect(row.baseImpGrav0).toBe(20);
    expect(row.montoIva).toBe(15);
    expect(report.compras.totalBaseImponible).toBe(100);
  });

  it('no incluye compras de otros períodos', async () => {
    if (!dbAvailable) return;
    const report = await getAtsReport(companyId, '2026-08');
    expect(report.compras.rows).toHaveLength(0);
  });

  it('getAtsReport incluye una venta real del período con el desglose exacto por línea', async () => {
    if (!dbAvailable) return;
    const warehouse = await prisma.warehouse.create({ data: { companyId, name: 'Bodega Principal', isDefault: true } });
    const customer = await prisma.customer.create({ data: { companyId, name: 'Cliente ATS', ruc: '1202582580' } });
    // salePrice es la base ANTES de impuesto (el taxRate del ítem se aplica encima) → total = 100*1.15 = 115.
    const product = await prisma.product.create({ data: { companyId, name: 'Producto ATS', salePrice: 100, type: 'PRODUCT' } });
    const { registerMovement } = await import('../../src/services/inventory.service');
    await registerMovement(companyId, { productId: product.id, warehouseId: warehouse.id, type: 'IN', quantity: 10, unitCost: 50 });

    const order = await createSalesOrder(companyId, { customerId: customer.id, items: [{ productId: product.id, quantity: 1, taxRate: 15 }] });
    await confirmOrder(order.id, companyId);
    const dispatched = await dispatchOrder(order.id, companyId);
    const shipment = await prisma.shipment.findFirst({ where: { companyId, orderId: order.id } });
    const invoice = await invoiceSalesOrder(companyId, shipment!.id);
    // Forzar la fecha de emisión al período de prueba (2026-09) para no depender de "hoy".
    await prisma.invoice.update({ where: { id: invoice!.id }, data: { issueDate: new Date('2026-09-15T00:00:00Z') } });

    const report = await getAtsReport(companyId, '2026-09');
    const row = report.ventas.rows.find((r) => r.numeroComprobante === invoice!.number);
    expect(row).toBeDefined();
    expect(row!.tipoIdComprador).toBe('05'); // cédula
    expect(row!.razonSocialComprador).toBe('Cliente ATS');
    expect(row!.baseImponible).toBe(100); // exacto: 1 x $100 neto por línea, no aproximado desde el total
    expect(row!.montoIva).toBe(15);
    expect(row!.baseImpGrav0).toBe(0);
    void dispatched;
  });

  it('factura con tarifas mixtas (0% y 15%) reparte cada base en su casilla — antes la aproximación uniforme lo hubiera mezclado', async () => {
    if (!dbAvailable) return;
    const warehouse = await prisma.warehouse.create({ data: { companyId, name: `Bodega Mixta ${TAG}`, isDefault: false } });
    const customer = await prisma.customer.create({ data: { companyId, name: 'Cliente Mixto ATS', ruc: '1202582580' } });
    const productGravado = await prisma.product.create({ data: { companyId, name: 'Producto Gravado', salePrice: 200, type: 'PRODUCT' } });
    const productTasa0 = await prisma.product.create({ data: { companyId, name: 'Producto Tasa 0', salePrice: 50, type: 'PRODUCT' } });
    const { registerMovement } = await import('../../src/services/inventory.service');
    await registerMovement(companyId, { productId: productGravado.id, warehouseId: warehouse.id, type: 'IN', quantity: 5, unitCost: 100 });
    await registerMovement(companyId, { productId: productTasa0.id, warehouseId: warehouse.id, type: 'IN', quantity: 5, unitCost: 25 });

    const order = await createSalesOrder(companyId, {
      customerId: customer.id,
      items: [
        { productId: productGravado.id, quantity: 1, taxRate: 15, warehouseId: warehouse.id },
        { productId: productTasa0.id, quantity: 1, taxRate: 0, warehouseId: warehouse.id },
      ],
    });
    await confirmOrder(order.id, companyId);
    const dispatched = await dispatchOrder(order.id, companyId);
    const shipment = await prisma.shipment.findFirst({ where: { companyId, orderId: order.id } });
    const invoice = await invoiceSalesOrder(companyId, shipment!.id);
    await prisma.invoice.update({ where: { id: invoice!.id }, data: { issueDate: new Date('2026-09-16T00:00:00Z') } });

    const report = await getAtsReport(companyId, '2026-09');
    const row = report.ventas.rows.find((r) => r.numeroComprobante === invoice!.number);
    expect(row).toBeDefined();
    expect(row!.baseImponible).toBe(200);
    expect(row!.baseImpGrav0).toBe(50);
    expect(row!.montoIva).toBe(30);
    void dispatched;
  });

  it('buildAtsXml produce un XML bien formado con las secciones de compras y ventas', async () => {
    if (!dbAvailable) return;
    const xml = await buildAtsXml(companyId, '2026-09');
    expect(xml).toContain('<iva>');
    expect(xml).toContain('<IdInformante>1790012345001</IdInformante>');
    expect(xml).toContain('<detalleCompra>');
    expect(xml).toContain('<Anio>2026</Anio>');
    expect(xml).toContain('<Mes>09</Mes>');
  });
});
