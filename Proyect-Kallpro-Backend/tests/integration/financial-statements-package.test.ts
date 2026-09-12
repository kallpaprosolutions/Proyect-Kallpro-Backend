import { prisma } from '../../src/lib/prisma';
import * as acc from '../../src/services/finance/accounting.service';
import { exportSuperciasPackagePdf } from '../../src/services/reports.service';
import { PassThrough } from 'stream';

/**
 * Integración con BD real: el paquete NIIF/Supercías (Etapa 8) — Balance, Resultados, Cambios
 * en el Patrimonio y Flujo de Efectivo juntos en un PDF — se genera sin reventar sobre una
 * empresa real con plan de cuentas sembrado (no valida el contenido visual, solo que las 4
 * llamadas a `accounting.service` se combinan en un PDF bien formado).
 */
const TAG = `pdfpkg_${Date.now()}`;
let dbAvailable = false;
let companyId = '';

async function cleanup() {
  await prisma.financeChartOfAccounts.deleteMany({ where: { companyId } }).catch(() => {});
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
  await acc.seedChartOfAccounts(companyId);
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

describe('reports.service.exportSuperciasPackagePdf — e2e con BD real', () => {
  it('genera un PDF bien formado con las 4 secciones (mensual)', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const stream: any = new PassThrough();
    stream.setHeader = () => {};
    const bufs: Buffer[] = [];
    stream.on('data', (d: Buffer) => bufs.push(d));
    const done = new Promise((resolve) => stream.on('end', resolve));

    await exportSuperciasPackagePdf(companyId, '2026-02', stream);
    await done;

    const pdf = Buffer.concat(bufs);
    expect(pdf.slice(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(500);
  }, 20000);

  it('acepta período anual (AAAA)', async () => {
    if (!dbAvailable) return;
    const stream: any = new PassThrough();
    stream.setHeader = () => {};
    const bufs: Buffer[] = [];
    stream.on('data', (d: Buffer) => bufs.push(d));
    const done = new Promise((resolve) => stream.on('end', resolve));

    await exportSuperciasPackagePdf(companyId, '2026', stream);
    await done;
    expect(Buffer.concat(bufs).slice(0, 4).toString()).toBe('%PDF');
  }, 20000);
});
