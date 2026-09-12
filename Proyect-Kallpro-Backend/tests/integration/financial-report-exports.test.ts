import { prisma } from '../../src/lib/prisma';
import * as acc from '../../src/services/finance/accounting.service';
import {
  exportBalanceSheetPdf, exportBalanceSheetExcel,
  exportIncomeStatementPdf, exportIncomeStatementExcel,
  exportCashFlowPdf, exportCashFlowExcel,
} from '../../src/services/reports.service';
import { PassThrough } from 'stream';

/**
 * Integración con BD real: los 6 exports individuales de la pestaña "Reporte" (Balance,
 * Resultados, Flujo — cada uno en PDF y Excel) se generan sin reventar. El flujo de efectivo se
 * prueba en ambos métodos (directo/indirecto) porque cambian la forma de la sección operativa.
 */
const TAG = `reportexp_${Date.now()}`;
let dbAvailable = false;
let companyId = '';

async function cleanup() {
  await prisma.financeChartOfAccounts.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.accountMapping.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => {});
}

async function collect(fn: (stream: any) => Promise<void>): Promise<Buffer> {
  const stream: any = new PassThrough();
  stream.setHeader = () => {};
  const bufs: Buffer[] = [];
  stream.on('data', (d: Buffer) => bufs.push(d));
  const done = new Promise((resolve) => stream.on('end', resolve));
  await fn(stream);
  await done;
  return Buffer.concat(bufs);
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
  await acc.seedChartOfAccounts(companyId);
  await acc.seedAccountMappings(companyId);
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

describe('reports.service — exports individuales de la pestaña Reporte', () => {
  it('Balance General: PDF y Excel bien formados', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const pdf = await collect((s) => exportBalanceSheetPdf(companyId, undefined, s));
    expect(pdf.slice(0, 4).toString()).toBe('%PDF');
    const xlsx = await collect((s) => exportBalanceSheetExcel(companyId, undefined, s));
    expect(xlsx.slice(0, 2).toString('hex')).toBe('504b'); // firma ZIP de un .xlsx
  });

  it('Estado de Resultados: PDF y Excel bien formados', async () => {
    if (!dbAvailable) return;
    const pdf = await collect((s) => exportIncomeStatementPdf(companyId, '2026-01-01', '2026-12-31', s));
    expect(pdf.slice(0, 4).toString()).toBe('%PDF');
    const xlsx = await collect((s) => exportIncomeStatementExcel(companyId, '2026-01-01', '2026-12-31', s));
    expect(xlsx.slice(0, 2).toString('hex')).toBe('504b');
  });

  it('Flujo de Efectivo (directo e indirecto): PDF y Excel bien formados', async () => {
    if (!dbAvailable) return;
    for (const method of ['direct', 'indirect'] as const) {
      const pdf = await collect((s) => exportCashFlowPdf(companyId, '2026-01-01', '2026-12-31', method, s));
      expect(pdf.slice(0, 4).toString()).toBe('%PDF');
      const xlsx = await collect((s) => exportCashFlowExcel(companyId, '2026-01-01', '2026-12-31', method, s));
      expect(xlsx.slice(0, 2).toString('hex')).toBe('504b');
    }
  });
});
