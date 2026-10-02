/**
 * Réplica llenable del Formulario 101 oficial del SRI (2026-10-01) — mismo patrón exacto que
 * `sri-form104-replica.service.ts`/`sri-form103-replica.service.ts` (ver esos archivos para el
 * razonamiento completo), reutilizando los modelos genéricos `SriCasillaMapping`/
 * `SriCasillaOverride` con `formType: '101'`. Única diferencia estructural: el 101 es ANUAL
 * (período = año fiscal "AAAA"), no mensual, así que el rango del Mayor cubre el año completo.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { FORM101_CASILLAS, computeForm101Values, CasillaDef, Form101Rates, FORM101_DEFAULT_RATES } from './engines/sri-form101-official.engine';

const FORM_TYPE = '101';

export interface MappedAccount { code: string; name: string; sign: 1 | -1 }

export async function getCasillaMappings(companyId: string): Promise<Record<string, MappedAccount[]>> {
  const rows = await prisma.sriCasillaMapping.findMany({ where: { companyId, formType: FORM_TYPE } });
  const out: Record<string, MappedAccount[]> = {};
  for (const r of rows) out[r.casillaCode] = r.accounts as unknown as MappedAccount[];
  return out;
}

export async function upsertCasillaMapping(companyId: string, casillaCode: string, accounts: MappedAccount[]) {
  const def = FORM101_CASILLAS.find((c) => c.code === casillaCode);
  if (!def) throw new Error('VALIDATION: casilla no reconocida');
  if (def.kind !== 'leaf') throw new Error('VALIDATION: solo las casillas hoja aceptan cuentas asignadas — el resto se calcula de otras casillas');
  return prisma.sriCasillaMapping.upsert({
    where: { companyId_formType_casillaCode: { companyId, formType: FORM_TYPE, casillaCode } },
    create: { companyId, formType: FORM_TYPE, casillaCode, accounts: accounts as unknown as Prisma.InputJsonValue },
    update: { accounts: accounts as unknown as Prisma.InputJsonValue },
  });
}

export async function clearCasillaMapping(companyId: string, casillaCode: string) {
  await prisma.sriCasillaMapping.deleteMany({ where: { companyId, formType: FORM_TYPE, casillaCode } });
}

async function leafSuggestedValue(companyId: string, accounts: MappedAccount[], start: Date, end: Date): Promise<number> {
  if (!accounts?.length) return 0;
  let total = 0;
  for (const acc of accounts) {
    const lines = await prisma.journalEntryLine.findMany({
      where: { accountCode: acc.code, entry: { companyId, status: { not: 'REVERSED' }, entryDate: { gte: start, lte: end } } },
      select: { debit: true, credit: true },
    });
    const net = lines.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0);
    total += acc.sign * net;
  }
  return Math.round(total * 100) / 100;
}

export interface CasillaResult extends CasillaDef {
  suggested: number;
  override: number | null;
  value: number;
  accounts: MappedAccount[];
}

export interface Form101Replica {
  period: string;
  rates: Form101Rates;
  casillas: CasillaResult[];
  bySection: { section: string; casillas: CasillaResult[] }[];
  resultado: { casilla: string; label: string; value: number };
}

export async function computeForm101Replica(companyId: string, period: string, rates: Form101Rates = FORM101_DEFAULT_RATES): Promise<Form101Replica> {
  const year = Number(period);
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

  const [mappings, overridesRows] = await Promise.all([
    getCasillaMappings(companyId),
    prisma.sriCasillaOverride.findMany({ where: { companyId, formType: FORM_TYPE, period } }),
  ]);
  const overrides = new Map(overridesRows.map((o) => [o.casillaCode, Number(o.value)]));

  const leafSuggested: Record<string, number> = {};
  const leafValues: Record<string, number> = {};
  for (const c of FORM101_CASILLAS) {
    if (c.kind !== 'leaf') continue;
    leafSuggested[c.code] = await leafSuggestedValue(companyId, mappings[c.code] ?? [], start, end);
    leafValues[c.code] = overrides.has(c.code) ? overrides.get(c.code)! : leafSuggested[c.code];
  }
  const computed = computeForm101Values(leafValues, rates);

  const casillas: CasillaResult[] = FORM101_CASILLAS.map((c) => ({
    ...c,
    suggested: c.kind === 'leaf' ? leafSuggested[c.code] : computed[c.code],
    override: overrides.has(c.code) ? overrides.get(c.code)! : null,
    value: computed[c.code],
    accounts: mappings[c.code] ?? [],
  }));

  const bySection = Array.from(new Set(FORM101_CASILLAS.map((c) => c.section))).map((section) => ({
    section, casillas: casillas.filter((c) => c.section === section),
  }));

  return {
    period, rates, casillas, bySection,
    resultado: { casilla: '999', label: 'Total pagado', value: computed['999'] },
  };
}

export async function setCasillaOverride(companyId: string, period: string, casillaCode: string, value: number, userId?: string) {
  const def = FORM101_CASILLAS.find((c) => c.code === casillaCode);
  if (!def) throw new Error('VALIDATION: casilla no reconocida');
  if (def.kind !== 'leaf') throw new Error('VALIDATION: solo las casillas hoja se pueden editar a mano — el resto se recalcula de otras casillas');
  return prisma.sriCasillaOverride.upsert({
    where: { companyId_formType_period_casillaCode: { companyId, formType: FORM_TYPE, period, casillaCode } },
    create: { companyId, formType: FORM_TYPE, period, casillaCode, value: new Prisma.Decimal(value), updatedBy: userId },
    update: { value: new Prisma.Decimal(value), updatedBy: userId },
  });
}

export async function clearCasillaOverride(companyId: string, period: string, casillaCode: string) {
  await prisma.sriCasillaOverride.deleteMany({ where: { companyId, formType: FORM_TYPE, period, casillaCode } });
}
