import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { createDeal, updateDealStage } from '../../src/services/crm/deal.service';
import { setDealItems } from '../../src/services/crm/deal-conversion.service';
import { runDunning } from '../../src/services/finance/dunning.service';
import { createShipment, addShipmentEvent } from '../../src/services/logistics.service';
import { rotateWebhookToken, handleCarrierWebhook } from '../../src/services/logistics-webhook.service';
import { invalidateErpConfig } from '../../src/services/erp-config.service';

/**
 * Integración con BD real de las tres integraciones cruzadas del documento LOGIFI:
 * Deal WON → cotización de venta, dunning → gestión automática en el radar, webhook de
 * courier → evento de tracking (y envío FAILED → actividad de revisión).
 */
const TAG = `logifi_${Date.now()}`;
let dbAvailable = false;
let companyId = '';
let userId = '';
let productId = '';
let customerId = '';

async function cleanup() {
  for (const del of [
    () => prisma.activity.deleteMany({ where: { companyId } }),
    () => prisma.shipmentEvent.deleteMany({ where: { shipment: { companyId } } }),
    () => prisma.shipment.deleteMany({ where: { companyId } }),
    () => prisma.collectionActivity.deleteMany({ where: { companyId } }),
    () => prisma.invoice.deleteMany({ where: { companyId } }),
    () => prisma.crmDealStageHistory.deleteMany({ where: { deal: { companyId } } }),
    () => prisma.crmDealItem.deleteMany({ where: { deal: { companyId } } }),
    () => prisma.crmDeal.deleteMany({ where: { companyId } }),
    () => prisma.crmContact.deleteMany({ where: { companyId } }),
    () => prisma.crmCompany.deleteMany({ where: { companyId } }),
    () => prisma.salesQuotationItem.deleteMany({ where: { quotation: { companyId } } }),
    () => prisma.salesOrderItem.deleteMany({ where: { order: { companyId } } }),
    () => prisma.salesOrder.deleteMany({ where: { companyId } }),
    () => prisma.salesQuotation.deleteMany({ where: { companyId } }),
    () => prisma.product.deleteMany({ where: { companyId } }),
    () => prisma.customer.deleteMany({ where: { companyId } }),
    () => prisma.documentSequence.deleteMany({ where: { companyId } }),
    () => prisma.user.deleteMany({ where: { companyId } }),
    () => prisma.company.deleteMany({ where: { id: companyId } }),
  ]) { await del().catch(() => {}); }
}

beforeAll(async () => {
  try { await prisma.$queryRaw`SELECT 1`; dbAvailable = true; } catch { dbAvailable = false; return; }
  const company = await prisma.company.create({ data: { name: `Empresa ${TAG}`, email: `${TAG}@kallpapro.test` } });
  companyId = company.id;
  const user = await prisma.user.create({ data: { companyId, email: `${TAG}@kallpapro.test`, passwordHash: 'x', firstName: 'Test', lastName: 'User', role: 'ADMIN' } as any });
  userId = user.id;
  productId = (await prisma.product.create({ data: { companyId, name: 'Servicio consultoría', sku: 'SRV-1', type: 'SERVICE', salePrice: new Prisma.Decimal(100) } })).id;
  customerId = (await prisma.customer.create({ data: { companyId, name: 'Cliente Moroso', email: 'moroso@test.ec' } })).id;
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

describe('CRM → Ventas: deal WON genera cotización', () => {
  it('crea el cliente desde la empresa CRM y la cotización con los productos del deal', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible'); return; }
    const crmCompany = await prisma.crmCompany.create({ data: { companyId, ruc: '1799999999001', legalName: 'NUEVA EMPRESA CRM S.A.', city: 'Cuenca' } });
    const contact = await prisma.crmContact.create({ data: { companyId, crmCompanyId: crmCompany.id, firstName: 'Ana', lastName: 'Lopez', email: 'ana@nueva.ec' } });
    const deal = await createDeal(companyId, { title: 'Implementación ERP', contactId: contact.id, crmCompanyId: crmCompany.id, value: 0 });

    await setDealItems(companyId, deal.id, [{ productId, description: 'Consultoría 10 h', quantity: 10, unitPrice: 100 }]);
    const withItems = await prisma.crmDeal.findUnique({ where: { id: deal.id } });
    expect(Number(withItems?.amountUsd)).toBe(1000); // el valor del deal sigue a los productos

    await updateDealStage(companyId, deal.id, 'WON', userId);

    const converted = await prisma.crmDeal.findUnique({ where: { id: deal.id }, include: { salesQuotation: { include: { items: true, customer: true } } } });
    expect(converted?.salesQuotationId).toBeTruthy();
    expect(converted?.salesQuotation?.quoteNumber).toMatch(/^COT-/);
    expect(converted?.salesQuotation?.items).toHaveLength(1);
    expect(Number(converted?.salesQuotation?.total)).toBeGreaterThanOrEqual(1000);
    expect(converted?.salesQuotation?.customer.ruc).toBe('1799999999001'); // cliente creado desde el CRM
    expect(converted?.customerId).toBe(converted?.salesQuotation?.customerId);
  });

  it('un deal ganado sin productos queda WON sin cotización (no revienta)', async () => {
    if (!dbAvailable) return;
    const contact = await prisma.crmContact.create({ data: { companyId, firstName: 'Sin', lastName: 'Productos' } });
    const deal = await createDeal(companyId, { title: 'Vacío', contactId: contact.id });
    const updated = await updateDealStage(companyId, deal.id, 'WON', userId);
    expect(updated.stage).toBe('WON');
    expect((await prisma.crmDeal.findUnique({ where: { id: deal.id } }))?.salesQuotationId).toBeNull();
  });

  it('reutiliza un cliente existente por RUC en vez de duplicarlo', async () => {
    if (!dbAvailable) return;
    const existing = await prisma.customer.create({ data: { companyId, name: 'ACME', ruc: '1788888888001' } });
    const crmCompany = await prisma.crmCompany.create({ data: { companyId, ruc: '1788888888001', legalName: 'ACME SOCIEDAD ANONIMA' } });
    const contact = await prisma.crmContact.create({ data: { companyId, crmCompanyId: crmCompany.id, firstName: 'Bob' } });
    const deal = await createDeal(companyId, { title: 'Repetido', contactId: contact.id, crmCompanyId: crmCompany.id });
    await setDealItems(companyId, deal.id, [{ productId, quantity: 1, unitPrice: 50 }]);
    await updateDealStage(companyId, deal.id, 'WON', userId);
    const converted = await prisma.crmDeal.findUnique({ where: { id: deal.id } });
    expect(converted?.customerId).toBe(existing.id);
    expect(await prisma.customer.count({ where: { companyId, ruc: '1788888888001' } })).toBe(1);
  });
});

describe('Cobranza automática (dunning)', () => {
  it('genera UNA gestión automática por factura vencida y no la repite', async () => {
    if (!dbAvailable) return;
    const order = await prisma.salesOrder.create({ data: { companyId, orderNumber: `PV-${TAG}`, customerId, status: 'INVOICED', subtotal: new Prisma.Decimal(100), taxAmount: new Prisma.Decimal(0), total: new Prisma.Decimal(100) } });
    const dueDate = new Date(Date.now() - 10 * 86_400_000); // 10 días de mora → escalón 0 (3 días)
    const invoice = await prisma.invoice.create({ data: { companyId, number: `FAC-V-${TAG}`, type: 'SALES', status: 'SENT', totalAmount: new Prisma.Decimal(100), dueDate, salesOrderId: order.id } });

    const r1 = await runDunning(companyId, { force: true });
    expect(r1.created).toBe(1);
    expect(r1.details[0]).toMatchObject({ invoiceNumber: invoice.number, step: 1, type: 'EMAIL', delivery: 'PENDIENTE_MANUAL' }); // sin SendGrid → pendiente manual
    const act = await prisma.collectionActivity.findFirst({ where: { companyId, invoiceId: invoice.id } });
    expect(act?.automated).toBe(true);
    expect(act?.dunningStep).toBe(0);
    expect(act?.notes).toContain('Cliente Moroso');

    const r2 = await runDunning(companyId, { force: true });
    expect(r2.created).toBe(0); // idempotente
  });

  it('con dunning deshabilitado (default) no hace nada salvo force', async () => {
    if (!dbAvailable) return;
    const r = await runDunning(companyId);
    expect(r.enabled).toBe(false);
    expect(r.created).toBe(0);
  });
});

describe('Webhooks de couriers + alerta de envío fallido', () => {
  it('rechaza sin token, acepta con token, ignora duplicados y crea la actividad al fallar', async () => {
    if (!dbAvailable) return;
    const order = await prisma.salesOrder.create({ data: { companyId, orderNumber: `PV2-${TAG}`, customerId, status: 'DISPATCHED', createdBy: userId, subtotal: new Prisma.Decimal(1), taxAmount: new Prisma.Decimal(0), total: new Prisma.Decimal(1) } });
    const shipment = await createShipment(companyId, { orderType: 'SALES', orderId: order.id, carrier: 'SERVIENTREGA', carrierGuide: `SRV-${TAG}`, freightCost: 4.5, createdBy: userId });
    expect(Number(shipment.freightCost)).toBe(4.5);
    await addShipmentEvent(companyId, shipment.id, { status: 'DISPATCHED', createdBy: userId });

    await expect(handleCarrierWebhook(companyId, 'servientrega', 'nope', { guia: `SRV-${TAG}`, estado: 'EN TRANSITO' })).rejects.toThrow(/deshabilitados/);
    const { webhookToken } = await rotateWebhookToken(companyId);
    invalidateErpConfig(companyId);
    await expect(handleCarrierWebhook(companyId, 'servientrega', 'nope', { guia: `SRV-${TAG}`, estado: 'EN TRANSITO' })).rejects.toThrow(/inválido/);

    const ok = await handleCarrierWebhook(companyId, 'servientrega', webhookToken, { guia: `SRV-${TAG}`, estado: 'EN TRANSITO', ciudad: 'Guayaquil' });
    expect(ok).toMatchObject({ accepted: true, status: 'IN_TRANSIT' });

    const failed = await handleCarrierWebhook(companyId, 'servientrega', webhookToken, { data: { guia: `SRV-${TAG}`, estado: 'NO ENTREGADO - destinatario ausente' } });
    expect(failed).toMatchObject({ accepted: true, status: 'FAILED' });
    const dup = await handleCarrierWebhook(companyId, 'servientrega', webhookToken, { guia: `SRV-${TAG}`, estado: 'FAILED' });
    expect(dup.reason).toMatch(/repetido/);

    const activity = await prisma.activity.findFirst({ where: { companyId, entityType: 'SALES_ORDER', entityId: order.id } });
    expect(activity?.type).toBe('REVISAR');
    expect(activity?.assignedToId).toBe(userId);
    expect(activity?.note).toContain('FALLIDO');

    const events = await prisma.shipmentEvent.findMany({ where: { shipmentId: shipment.id }, orderBy: { createdAt: 'asc' } });
    expect(events.map((e) => e.status)).toEqual(['PENDING', 'DISPATCHED', 'IN_TRANSIT', 'FAILED']);
    expect(events[2].createdBy).toBe('webhook:servientrega');
  });
});
