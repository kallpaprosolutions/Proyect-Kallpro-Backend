import { prisma } from '../../src/lib/prisma';
import * as acc from '../../src/services/finance/accounting.service';
import { createManualEntry } from '../../src/services/journal.service';

/**
 * Integración con BD real: el método indirecto (NIC 7) del flujo de efectivo debe cuadrar
 * EXACTAMENTE con el método directo — la norma solo cambia la presentación de la sección
 * operativa, nunca el efectivo real. Escenario: una venta al contado (única línea que SÍ toca
 * caja), una depreciación (gasto no monetario) y una compra a crédito (gasto que aumenta CxP
 * sin tocar caja) — ninguna de las dos últimas aparece en el método directo (no tocan caja),
 * pero SÍ reducen la utilidad neta, así que el residual de conciliación (workingCapitalChange)
 * debe absorber exactamente la CxP no pagada.
 */
const TAG = `cfindirect_${Date.now()}`;
let dbAvailable = false;
let companyId = '';

async function cleanup() {
  await prisma.journalEntry.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.financeChartOfAccounts.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.accountMapping.deleteMany({ where: { companyId } }).catch(() => {});
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
  await acc.seedAccountMappings(companyId);
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

describe('accounting.service.getCashFlowStatement — método indirecto', () => {
  it('cuadra exacto con el método directo y absorbe el gasto acumulado (CxP) en la variación de capital de trabajo', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }

    // 1. Venta al contado: única línea que toca caja → efectivo operativo directo = +500.
    await createManualEntry(companyId, {
      date: '2026-03-05',
      description: 'Venta al contado',
      lines: [
        { accountCode: '10101', debit: 500, credit: 0 },
        { accountCode: '4101', debit: 0, credit: 500 },
      ],
    });
    // 2. Depreciación (gasto no monetario, no toca caja).
    await createManualEntry(companyId, {
      date: '2026-03-10',
      description: 'Depreciación de marzo',
      lines: [
        { accountCode: '52022101', debit: 100, credit: 0 },
        { accountCode: '1020112', debit: 0, credit: 100 },
      ],
    });
    // 3. Gasto a crédito (aumenta CxP, no toca caja) — utilidad baja pero el efectivo no sale.
    await createManualEntry(companyId, {
      date: '2026-03-15',
      description: 'Servicio a crédito',
      lines: [
        { accountCode: '520228', debit: 50, credit: 0 },
        { accountCode: '2010301', debit: 0, credit: 50 },
      ],
    });

    const range = { from: new Date('2026-03-01T00:00:00Z'), to: new Date('2026-03-31T23:59:59Z') };
    const [direct, indirect] = await Promise.all([
      acc.getCashFlowStatement(companyId, { ...range, method: 'direct' }),
      acc.getCashFlowStatement(companyId, { ...range, method: 'indirect' }),
    ]);

    expect(direct.method).toBe('direct');
    expect(indirect.method).toBe('indirect');

    // Invariante clave: el total operativo (y por lo tanto caja final) es IDÉNTICO en ambos métodos.
    expect(indirect.operating.net).toBe(direct.operating.net);
    expect(indirect.closingCash).toBe(direct.closingCash);
    expect(direct.operating.net).toBe(500); // solo la venta al contado tocó caja

    const op = indirect.operating as { netIncome: number; depreciation: number; workingCapitalChange: number; net: number };
    expect(op.netIncome).toBe(350); // 500 - 100 (depreciación) - 50 (servicio a crédito)
    expect(op.depreciation).toBe(100);
    expect(op.workingCapitalChange).toBe(50); // exactamente la CxP no pagada
    // Identidad aritmética de la conciliación: utilidad + ajustes = efectivo operativo real.
    expect(Math.round((op.netIncome + op.depreciation + op.workingCapitalChange) * 100) / 100).toBe(op.net);

    // Inversión/financiamiento no cambian entre métodos (la norma solo afecta la sección operativa).
    expect(indirect.investing).toEqual(direct.investing);
    expect(indirect.financing).toEqual(direct.financing);
  });

  it('sin parámetro method, devuelve el método directo por default', async () => {
    if (!dbAvailable) return;
    const result = await acc.getCashFlowStatement(companyId, {});
    expect(result.method).toBe('direct');
  });
});
