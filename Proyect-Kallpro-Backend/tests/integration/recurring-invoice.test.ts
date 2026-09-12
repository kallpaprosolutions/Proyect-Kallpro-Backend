import { prisma } from '../../src/lib/prisma';
import {
  createRecurringTemplate,
  generateDueRecurringInvoices,
} from '../../src/services/finance/recurring-invoice.service';

/**
 * Integración con BD real (mismo patrón que db-flow.test.ts): valida que B3 (facturas
 * recurrentes) genera el SriDocument correcto al vencer, no lo duplica dentro del mismo
 * período, y sí lo vuelve a generar al mes siguiente.
 */
const TAG = `recurring_${Date.now()}`;
let dbAvailable = false;
let companyId = '';
let supplierId = '';
let supplierNoRucId = '';

async function cleanup() {
  await prisma.sriDocument.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.recurringInvoiceTemplate.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.supplier.deleteMany({ where: { companyId } }).catch(() => {});
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
  const supplier = await prisma.supplier.create({
    data: { companyId, name: 'Arrendador de Prueba', ruc: '1790012345001', isActive: true },
  });
  supplierId = supplier.id;
  const supplierNoRuc = await prisma.supplier.create({ data: { companyId, name: 'Proveedor Sin RUC', isActive: true } });
  supplierNoRucId = supplierNoRuc.id;
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

describe('recurring-invoice.service — e2e con BD real', () => {
  it('genera el SriDocument PENDING_REVIEW de una plantilla vencida, enlazado por recurringTemplateId', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }

    const template = await createRecurringTemplate(companyId, {
      supplierId,
      description: 'Arriendo local de prueba',
      amount: 500,
      taxCode: '15',
      taxRate: 15,
      dayOfMonth: 1,
      startDate: new Date('2026-01-01T00:00:00Z'),
    });

    const asOf = new Date('2026-09-05T00:00:00Z'); // día 5 ≥ dayOfMonth 1 → vencida
    const result = await generateDueRecurringInvoices(companyId, undefined, asOf);

    expect(result.generated).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);

    const doc = await prisma.sriDocument.findFirst({ where: { id: result.generated[0].documentId } });
    expect(doc).not.toBeNull();
    expect(doc!.status).toBe('PENDING_REVIEW');
    expect(doc!.recurringTemplateId).toBe(template.id);
    expect(Number(doc!.subtotal15)).toBe(500);
    expect(Number(doc!.iva)).toBe(75);
    expect(Number(doc!.total)).toBe(575);

    const updated = await prisma.recurringInvoiceTemplate.findFirst({ where: { id: template.id } });
    expect(updated!.lastGeneratedPeriod).toBe('2026-09');
  });

  it('no genera dos veces en el mismo período (idempotente)', async () => {
    if (!dbAvailable) return;
    const asOf = new Date('2026-09-20T00:00:00Z'); // mismo mes, ya se generó arriba
    const result = await generateDueRecurringInvoices(companyId, undefined, asOf);
    expect(result.generated).toHaveLength(0);
  });

  it('sí genera de nuevo al mes siguiente', async () => {
    if (!dbAvailable) return;
    const asOf = new Date('2026-10-01T00:00:00Z');
    const result = await generateDueRecurringInvoices(companyId, undefined, asOf);
    expect(result.generated).toHaveLength(1);
  });

  it('rechaza una plantilla con código de tarifa IVA inválido', async () => {
    if (!dbAvailable) return;
    await expect(createRecurringTemplate(companyId, {
      supplierId,
      description: 'Plantilla inválida',
      amount: 100,
      taxCode: 'NO_EXISTE',
      taxRate: 15,
      dayOfMonth: 1,
      startDate: new Date('2026-01-01T00:00:00Z'),
    })).rejects.toThrow(/tarifa IVA no reconocido/);
  });

  it('rechaza crear una plantilla para un proveedor sin RUC (bug real: fallaba recién al generar, ahora falla al crear)', async () => {
    if (!dbAvailable) return;
    await expect(createRecurringTemplate(companyId, {
      supplierId: supplierNoRucId,
      description: 'Servicio sin RUC',
      amount: 100,
      taxCode: '15',
      taxRate: 15,
      dayOfMonth: 1,
      startDate: new Date('2026-01-01T00:00:00Z'),
    })).rejects.toThrow(/no tiene RUC configurado/);
  });
});
