import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { closeTaxPeriod, getTaxClosingPreview } from '../../src/services/finance/tax-closing.service';

/**
 * Integración con BD real de la Etapa 6 (cierre de impuestos automático). Reusa el mismo
 * cálculo que ya usa la pestaña Declaraciones (`sri-casillas.service`) — aquí solo se cubre la
 * decisión de postear (o no) el asiento y bloquear el período.
 */

const TAG = `taxclose_${Date.now()}`;
let dbAvailable = false;
let companyId = '';

async function makeCompany(period: string) {
  const suffix = `${Math.random().toString(36).slice(2, 6)}`;
  const company = await prisma.company.create({ data: { name: `Empresa ${TAG}-${suffix}`, email: `${TAG}-${suffix}@kallpapro.test` } });
  return { companyId: company.id, period };
}

async function cleanupCompany(cid: string) {
  await prisma.journalEntryLine.deleteMany({ where: { entry: { companyId: cid } } }).catch(() => {});
  await prisma.journalEntry.deleteMany({ where: { companyId: cid } }).catch(() => {});
  await prisma.fiscalPeriod.deleteMany({ where: { companyId: cid } }).catch(() => {});
  await prisma.sriDocument.deleteMany({ where: { companyId: cid } }).catch(() => {});
  await prisma.invoice.deleteMany({ where: { companyId: cid } }).catch(() => {});
  await prisma.documentSequence.deleteMany({ where: { companyId: cid } }).catch(() => {});
  await prisma.company.deleteMany({ where: { id: cid } }).catch(() => {});
}

beforeAll(async () => {
  try { await prisma.$queryRaw`SELECT 1`; dbAvailable = true; } catch { dbAvailable = false; }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('tax-closing.service — e2e con BD real', () => {
  it('postea el asiento de liquidación cuando hay IVA a pagar y cierra el período', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const { companyId: cid, period } = await makeCompany('2026-03');
    try {
      // Venta $115 (neto $100 + $15 IVA) — sin compras: todo el IVA generado es a pagar.
      await prisma.invoice.create({
        data: { companyId: cid, number: `FAC-V-${TAG}`, type: 'SALES', status: 'SENT', totalAmount: new Prisma.Decimal(115), issueDate: new Date('2026-03-15T00:00:00Z') },
      });

      const preview = await getTaxClosingPreview(cid, period);
      expect(preview.resultado.type).toBe('A_PAGAR');
      expect(preview.resultado.value).toBeCloseTo(15, 2);
      expect(preview.yaCerrado).toBe(false);

      const result = await closeTaxPeriod(cid, period);
      expect(result.totalPagar).toBeCloseTo(15, 2);
      expect(result.entry).not.toBeNull();
      expect(Number(result.entry!.totalDebit)).toBeCloseTo(15, 2);

      const lines = result.entry!.lines;
      const ivaDebit = lines.find((l: any) => l.description.includes('Liquidación IVA débito'));
      expect(Number(ivaDebit!.debit)).toBeCloseTo(15, 2);
      const liq = lines.find((l: any) => l.description.includes('IVA por pagar al SRI'));
      expect(Number(liq!.credit)).toBeCloseTo(15, 2);

      const fp = await prisma.fiscalPeriod.findUnique({ where: { companyId_year_month: { companyId: cid, year: 2026, month: 3 } } });
      expect(fp?.status).toBe('CLOSED');

      await expect(closeTaxPeriod(cid, period)).rejects.toThrow(/ya está cerrado contablemente/);
    } finally { await cleanupCompany(cid); }
  });

  it('no postea asiento cuando el período arroja crédito tributario a favor, pero cierra el período', async () => {
    if (!dbAvailable) return;
    const { companyId: cid, period } = await makeCompany('2026-04');
    try {
      // Sin ventas, con una compra: crédito tributario a favor, nada que pagar.
      await prisma.sriDocument.create({
        data: {
          companyId: cid, tipoDocumento: 'FACTURA', status: 'CONFIRMED', claveAcceso: `${TAG}-clave`,
          rucEmisor: '1790011111001', razonSocialEmisor: 'Proveedor S.A.', fechaEmision: new Date('2026-04-10T00:00:00Z'),
          subtotal15: new Prisma.Decimal(100), iva: new Prisma.Decimal(15), total: new Prisma.Decimal(115),
        },
      });

      const preview = await getTaxClosingPreview(cid, period);
      expect(preview.resultado.type).toBe('CREDITO');

      const result = await closeTaxPeriod(cid, period);
      expect(result.entry).toBeNull();
      expect(result.totalPagar).toBe(0);

      const fp = await prisma.fiscalPeriod.findUnique({ where: { companyId_year_month: { companyId: cid, year: 2026, month: 4 } } });
      expect(fp?.status).toBe('CLOSED');
    } finally { await cleanupCompany(cid); }
  });

  it('bloquea el cierre si hay documentos SRI o facturas en borrador pendientes', async () => {
    if (!dbAvailable) return;
    const { companyId: cid, period } = await makeCompany('2026-05');
    try {
      await prisma.sriDocument.create({
        data: {
          companyId: cid, tipoDocumento: 'FACTURA', status: 'PENDING_REVIEW', claveAcceso: `${TAG}-pend`,
          rucEmisor: '1790011111001', razonSocialEmisor: 'Proveedor S.A.', fechaEmision: new Date('2026-05-05T00:00:00Z'),
          total: new Prisma.Decimal(50),
        },
      });
      await expect(closeTaxPeriod(cid, period)).rejects.toThrow(/documentos pendientes de revisar/);
    } finally { await cleanupCompany(cid); }
  });
});
