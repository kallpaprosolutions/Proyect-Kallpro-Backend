import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import {
  upsertCasillaMapping, computeForm101Replica, setCasillaOverride, clearCasillaOverride, getCasillaMappings,
} from '../../src/services/finance/sri-form101-replica.service';

/**
 * Integración con BD real: réplica llenable del Formulario 101 oficial (2026-10-01) — mismo
 * patrón validado en `sri-form104-replica.test.ts`/`sri-form103-replica.test.ts`, ahora sobre
 * `formType: '101'` con período ANUAL (AAAA) en vez de mensual.
 */
const TAG = `f101_${Date.now()}`;
let dbAvailable = false;
let companyId = '';

async function cleanup() {
  await prisma.sriCasillaOverride.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.sriCasillaMapping.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.journalEntryLine.deleteMany({ where: { entry: { companyId } } }).catch(() => {});
  await prisma.journalEntry.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => {});
}

async function makeEntry(entryDate: Date, lines: { accountCode: string; debit: number; credit: number }[]) {
  const total = lines.reduce((s, l) => s + l.debit, 0);
  await prisma.journalEntry.create({
    data: {
      companyId, entryNumber: `AST-${TAG}-${Math.random().toString(36).slice(2, 8)}`, entryDate,
      description: 'Movimiento de prueba', totalDebit: total, totalCredit: total, status: 'POSTED',
      lines: { create: lines.map((l) => ({ accountCode: l.accountCode, accountName: l.accountCode, debit: new Prisma.Decimal(l.debit), credit: new Prisma.Decimal(l.credit) })) },
    },
  });
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

describe('sri-form101-replica.service — mapeo de cuentas + cálculo desde el Mayor + edición (período anual)', () => {
  it('6999/7999 se calculan del movimiento ANUAL de las cuentas mapeadas, y alimentan la conciliación (801/819/839)', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    await upsertCasillaMapping(companyId, '6999', [{ code: '4101', name: 'VENTA DE BIENES', sign: 1 }]);
    await upsertCasillaMapping(companyId, '7999', [{ code: '5101', name: 'COSTO DE VENTAS', sign: -1 }]);
    await makeEntry(new Date('2026-03-10'), [{ accountCode: '4101', debit: 0, credit: 500000 }]);
    await makeEntry(new Date('2026-08-01'), [{ accountCode: '5101', debit: 300000, credit: 0 }]);
    await makeEntry(new Date('2025-12-15'), [{ accountCode: '4101', debit: 0, credit: 999 }]); // otro ejercicio, no debe contar

    // tarifa general 25% (fracción decimal, tal como la envía el controlador tras el fix)
    const replica = await computeForm101Replica(companyId, '2026', { tarifaGeneral: 0.25, tarifaReinversion: 0.25 });
    expect(replica.casillas.find((c) => c.code === '6999')!.suggested).toBe(500000);
    expect(replica.casillas.find((c) => c.code === '7999')!.suggested).toBe(300000);
    expect(replica.casillas.find((c) => c.code === '801')!.value).toBe(200000);
    expect(replica.casillas.find((c) => c.code === '803')!.value).toBe(30000); // 15% de 200000
    expect(replica.casillas.find((c) => c.code === '819')!.value).toBe(170000);
    // Regresión del bug de tarifa dividida x100 dos veces: 170000*25% debe ser 42500, no 425.
    expect(replica.casillas.find((c) => c.code === '839')!.value).toBe(42500);
    expect(replica.casillas.find((c) => c.code === '859')!.value).toBe(42500);
    expect(replica.casillas.find((c) => c.code === '999')!.value).toBe(42500);
  });

  it('sobreescribir 6999 a mano cambia 801/819/839/999 en cascada, y el sugerido queda visible aparte', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    await setCasillaOverride(companyId, '2026', '6999', 1000000, 'user-1');

    const replica = await computeForm101Replica(companyId, '2026', { tarifaGeneral: 0.25, tarifaReinversion: 0.25 });
    const c6999 = replica.casillas.find((c) => c.code === '6999')!;
    expect(c6999.suggested).toBe(500000);
    expect(c6999.override).toBe(1000000);
    expect(c6999.value).toBe(1000000);
    expect(replica.casillas.find((c) => c.code === '801')!.value).toBe(700000); // 1000000-300000

    await clearCasillaOverride(companyId, '2026', '6999');
    const after = await computeForm101Replica(companyId, '2026');
    expect(after.casillas.find((c) => c.code === '6999')!.value).toBe(500000);
  });

  it('no se puede mapear ni editar una casilla de fórmula (819/839/999)', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    await expect(upsertCasillaMapping(companyId, '819', [{ code: '4101', name: 'X', sign: 1 }])).rejects.toThrow('VALIDATION');
    await expect(setCasillaOverride(companyId, '2026', '999', 1, 'user-1')).rejects.toThrow('VALIDATION');
  });

  it('getCasillaMappings refleja lo configurado', async () => {
    if (!dbAvailable) { console.warn('⏭  BD no disponible — omitiendo e2e'); return; }
    const mappings = await getCasillaMappings(companyId);
    expect(mappings['6999']).toEqual([{ code: '4101', name: 'VENTA DE BIENES', sign: 1 }]);
  });
});
