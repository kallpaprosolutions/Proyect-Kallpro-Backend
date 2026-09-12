import { prisma } from '../../src/lib/prisma';
import * as acc from '../../src/services/finance/accounting.service';
import { createManualEntry } from '../../src/services/journal.service';

/**
 * Integración con BD real: el Estado de Cambios en el Patrimonio (Etapa 8) debe CUADRAR con el
 * Balance General real de la misma fecha de corte — es el invariante que prueba que la
 * "utilidad acumulada no distribuida" calculada en vivo no duplica ni pierde nada frente al
 * cálculo que ya usa `getBalanceSheet` (misma fórmula, otra forma de mostrarla).
 */
const TAG = `equity_${Date.now()}`;
let dbAvailable = false;
let companyId = '';

async function cleanup() {
  await prisma.journalEntry.deleteMany({ where: { companyId } }).catch(() => {});
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

describe('accounting.service.getEquityStatement — e2e con BD real', () => {
  it('el total final cuadra exactamente con getBalanceSheet.totalPatrimonio de la misma fecha', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }

    // Aporte de capital inicial (antes del período que se va a reportar).
    await createManualEntry(companyId, {
      date: '2026-01-10',
      description: 'Aporte de capital inicial',
      lines: [
        { accountCode: '10101', debit: 5000, credit: 0 },
        { accountCode: '301', debit: 0, credit: 5000 },
      ],
    });
    // Una venta con utilidad en el mismo mes anterior (genera utilidad acumulada no distribuida).
    await createManualEntry(companyId, {
      date: '2026-01-15',
      description: 'Venta de prueba (utilidad de ejercicio anterior)',
      lines: [
        { accountCode: '10101', debit: 300, credit: 0 },
        { accountCode: '4101', debit: 0, credit: 300 },
      ],
    });

    // Dentro del período a reportar (febrero): aporte adicional + dividendo + una venta con utilidad.
    await createManualEntry(companyId, {
      date: '2026-02-05',
      description: 'Aporte de capital adicional',
      lines: [
        { accountCode: '10101', debit: 1000, credit: 0 },
        { accountCode: '301', debit: 0, credit: 1000 },
      ],
    });
    await createManualEntry(companyId, {
      date: '2026-02-10',
      description: 'Dividendo declarado',
      lines: [
        { accountCode: '306', debit: 200, credit: 0 },
        { accountCode: '10101', debit: 0, credit: 200 },
      ],
    });
    await createManualEntry(companyId, {
      date: '2026-02-20',
      description: 'Venta de prueba (utilidad del ejercicio actual)',
      lines: [
        { accountCode: '10101', debit: 150, credit: 0 },
        { accountCode: '4101', debit: 0, credit: 150 },
      ],
    });

    const to = new Date('2026-02-28T23:59:59Z');
    const [equity, balance] = await Promise.all([
      acc.getEquityStatement(companyId, { from: new Date('2026-02-01T00:00:00Z'), to }),
      acc.getBalanceSheet(companyId, to),
    ]);

    expect(equity.totalFinal).toBeCloseTo(balance.totalPatrimonio, 2);
    expect(equity.utilidadEjercicio).toBe(150); // solo la venta de febrero
    expect(equity.utilidadAcumuladaNoDistribuida).toBe(300); // solo la venta de enero, no cerrada a 306

    const capital = equity.categories.find((c) => c.category === 'CAPITAL')!;
    expect(capital.opening).toBe(5000);
    expect(capital.increases).toBe(1000);
    expect(capital.closing).toBe(6000);

    const resultados = equity.categories.find((c) => c.category === 'RESULTADOS_ACUMULADOS')!;
    expect(resultados.decreases).toBe(200); // dividendo declarado en febrero
  });
});
