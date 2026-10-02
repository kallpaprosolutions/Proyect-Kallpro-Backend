import { prisma } from '../../src/lib/prisma';
import { createFixedAsset, generateDueDepreciation, disposeFixedAsset } from '../../src/services/finance/fixed-asset.service';

/**
 * Integración con BD real: B4 — activos fijos y depreciación en línea recta. Valida que
 * genera el asiento correcto, no lo duplica en el mismo período, respeta el tope al llegar
 * al costo depreciable, y que dar de baja detiene la depreciación futura.
 */
const TAG = `asset_${Date.now()}`;
let dbAvailable = false;
let companyId = '';

async function cleanup() {
  await prisma.journalEntryLine.deleteMany({ where: { entry: { companyId } } }).catch(() => {});
  await prisma.journalEntry.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.fixedAsset.deleteMany({ where: { companyId } }).catch(() => {});
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
});

afterAll(async () => {
  if (dbAvailable) await cleanup();
  await prisma.$disconnect();
});

describe('fixed-asset.service — e2e con BD real', () => {
  it('nunca se corrió antes → recupera TODOS los meses transcurridos de una vez (catch-up, NIC 16)', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }

    // Equipo de cómputo $3,600, sin residual, 3 años → $100/mes. Se da de alta en enero y se
    // genera la depreciación recién en septiembre (nunca se corrió en medio) — debe recuperar
    // los 9 meses completos (ene-sep), no solo el mes de la fecha de corte.
    const asset = await createFixedAsset(companyId, {
      name: 'Laptop de gerencia', category: 'EQUIPO_COMPUTO',
      acquisitionDate: new Date('2026-01-01T00:00:00Z'),
      acquisitionCost: 3600, residualValue: 0, usefulLifeYears: 3,
    });

    const asOf = new Date('2026-09-05T00:00:00Z');
    const result = await generateDueDepreciation(companyId, undefined, asOf);
    expect(result.generated).toHaveLength(1);
    expect(result.generated[0].amount).toBe(900); // 9 meses (ene-sep) × $100, no solo $100

    const entry = await prisma.journalEntry.findFirst({ where: { id: result.generated[0].entryId }, include: { lines: true } });
    expect(entry).not.toBeNull();
    expect(entry!.status).toBe('POSTED');
    expect(Number(entry!.totalDebit)).toBe(900);
    expect(Number(entry!.totalCredit)).toBe(900);
    expect(entry!.description).toContain('recupera 2026-01→2026-09');
    expect(entry!.lines.find((l) => l.accountCode === '52022101' && Number(l.debit) === 900)).toBeDefined();
    expect(entry!.lines.find((l) => l.accountCode === '1020112' && Number(l.credit) === 900)).toBeDefined();

    const updated = await prisma.fixedAsset.findFirst({ where: { id: asset.id } });
    expect(Number(updated!.accumulatedDepreciation)).toBe(900);
    expect(updated!.lastDepreciatedPeriod).toBe('2026-09');
    expect(updated!.status).toBe('ACTIVE');
  });

  it('no genera dos veces en el mismo período (idempotente)', async () => {
    if (!dbAvailable) return;
    const result = await generateDueDepreciation(companyId, undefined, new Date('2026-09-25T00:00:00Z'));
    expect(result.generated).toHaveLength(0);
  });

  it('corrida el mes siguiente solo recupera ese único mes (sin volver a repetir el catch-up)', async () => {
    if (!dbAvailable) return;
    const result = await generateDueDepreciation(companyId, undefined, new Date('2026-10-05T00:00:00Z'));
    expect(result.generated).toHaveLength(1);
    expect(result.generated[0].amount).toBe(100); // un solo mes, octubre
    const entry = await prisma.journalEntry.findFirst({ where: { id: result.generated[0].entryId } });
    expect(entry!.description).not.toContain('recupera'); // sin catch-up, nota de rango ausente
  });

  it('al llegar al costo depreciable, capa el último período y marca FULLY_DEPRECIATED', async () => {
    if (!dbAvailable) return;
    // Vehículo $1,200, sin residual, vida útil de 1 mes (caso extremo para forzar el borde en el test).
    const asset = await createFixedAsset(companyId, {
      name: 'Carrito de prueba', category: 'VEHICULO',
      acquisitionDate: new Date('2026-01-01T00:00:00Z'),
      acquisitionCost: 1200, residualValue: 0, usefulLifeYears: 5,
    });
    // Simula que ya casi está depreciado (accumulatedDepreciation manual para el borde del test).
    await prisma.fixedAsset.update({ where: { id: asset.id }, data: { accumulatedDepreciation: 1180 } });

    const result = await generateDueDepreciation(companyId, undefined, new Date('2026-10-05T00:00:00Z'));
    const gen = result.generated.find((g) => g.assetId === asset.id);
    expect(gen).toBeDefined();
    expect(gen!.amount).toBe(20); // capado: quedaban 20 de los 1200, no la cuota normal de 20 (coincide) — ver siguiente aserción

    const updated = await prisma.fixedAsset.findFirst({ where: { id: asset.id } });
    expect(Number(updated!.accumulatedDepreciation)).toBe(1200);
    expect(updated!.status).toBe('FULLY_DEPRECIATED');

    // Ya no debe generar nada más para este activo en períodos futuros.
    const next = await generateDueDepreciation(companyId, undefined, new Date('2026-11-05T00:00:00Z'));
    expect(next.generated.some((g) => g.assetId === asset.id)).toBe(false);
  });

  it('dar de baja un activo detiene la depreciación futura', async () => {
    if (!dbAvailable) return;
    const asset = await createFixedAsset(companyId, {
      name: 'Impresora obsoleta', category: 'EQUIPO_COMPUTO',
      acquisitionDate: new Date('2026-01-01T00:00:00Z'),
      acquisitionCost: 900, residualValue: 0, usefulLifeYears: 3,
    });
    await disposeFixedAsset(asset.id, companyId, 'Vendida por obsolescencia');

    const result = await generateDueDepreciation(companyId, undefined, new Date('2026-09-05T00:00:00Z'));
    expect(result.generated.some((g) => g.assetId === asset.id)).toBe(false);

    const updated = await prisma.fixedAsset.findFirst({ where: { id: asset.id } });
    expect(updated!.status).toBe('DISPOSED');
  });

  it('rechaza crear un activo con valor residual mayor o igual al costo', async () => {
    if (!dbAvailable) return;
    await expect(createFixedAsset(companyId, {
      name: 'Activo inválido', category: 'MUEBLES_ENSERES',
      acquisitionDate: new Date('2026-01-01T00:00:00Z'),
      acquisitionCost: 1000, residualValue: 1000, usefulLifeYears: 10,
    })).rejects.toThrow(/valor residual debe ser menor/);
  });
});
