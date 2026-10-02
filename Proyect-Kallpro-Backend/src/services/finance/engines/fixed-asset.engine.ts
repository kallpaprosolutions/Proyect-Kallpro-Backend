// Motor PURO (sin BD) — B4: depreciación de activos fijos en línea recta, el método legal
// por defecto en Ecuador (art. 28 Reglamento LRTI) y el más usado en NIIF para PYMES.
// Vida útil legal referencial por categoría (mismos porcentajes del reglamento):
//   Edificios 20 años (5%) · Vehículos 5 años (20%) · Muebles/enseres y maquinaria 10 años
//   (10%) · Equipo de cómputo 3 años (33.33%) · Terrenos NO deprecian.

export type FixedAssetCategory =
  | 'TERRENO' | 'EDIFICIO' | 'MUEBLES_ENSERES' | 'MAQUINARIA' | 'EQUIPO_COMPUTO' | 'VEHICULO' | 'OTROS';

export interface FixedAssetCategoryInfo {
  label: string;
  accountCode: string; // cuenta de activo (PPE) Supercías
  defaultUsefulLifeYears: number; // 0 = no deprecia
}

export const FIXED_ASSET_CATEGORIES: Record<FixedAssetCategory, FixedAssetCategoryInfo> = {
  TERRENO:          { label: 'Terrenos',                 accountCode: '1020101', defaultUsefulLifeYears: 0 },
  EDIFICIO:         { label: 'Edificios',                 accountCode: '1020102', defaultUsefulLifeYears: 20 },
  MUEBLES_ENSERES:  { label: 'Muebles y enseres',          accountCode: '1020105', defaultUsefulLifeYears: 10 },
  MAQUINARIA:       { label: 'Maquinaria y equipo',        accountCode: '1020106', defaultUsefulLifeYears: 10 },
  EQUIPO_COMPUTO:   { label: 'Equipo de computación',      accountCode: '1020108', defaultUsefulLifeYears: 3 },
  VEHICULO:         { label: 'Vehículos y equipo de transporte', accountCode: '1020109', defaultUsefulLifeYears: 5 },
  OTROS:            { label: 'Otros (vida útil manual)',   accountCode: '1020110', defaultUsefulLifeYears: 5 },
};

export interface FixedAssetDueRef {
  status: string; // ACTIVE | FULLY_DEPRECIATED | DISPOSED
  acquisitionDate: Date;
  lastDepreciatedPeriod: string | null;
}

export function periodKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function periodIndex(period: string): number {
  const [y, m] = period.split('-').map(Number);
  return y * 12 + (m - 1);
}

function periodFromIndex(idx: number): string {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export interface DepreciationDueInfo {
  periodsElapsed: number; // cuántos meses calendario le faltan por reconocer (≥1)
  fromPeriod: string; // primer período pendiente (siguiente al último contabilizado, o al de alta)
  toPeriod: string; // período de `asOf` — el que queda guardado en `lastDepreciatedPeriod`
}

/**
 * Cuántos períodos (meses) le faltan reconocer a un activo hasta `asOf`, o `null` si no le toca
 * nada todavía. A diferencia de un simple booleano "¿le toca este mes?", esto SÍ recupera meses
 * salteados: el generador se dispara bajo demanda (sin cron, regla documentada en
 * `fixed-asset.service.ts`), así que si nadie lo corre un par de meses, esos meses no deben
 * perderse para siempre (violaría el devengo de NIC 1/NIC 16) — deben reconocerse de una vez la
 * próxima vez que se dispare, no solo el mes en curso.
 */
export function computeDueDepreciationPeriods(asset: FixedAssetDueRef, asOf: Date): DepreciationDueInfo | null {
  if (asset.status !== 'ACTIVE') return null;
  if (asOf < asset.acquisitionDate) return null;
  const toPeriod = periodKey(asOf);
  const startIndex = asset.lastDepreciatedPeriod != null
    ? periodIndex(asset.lastDepreciatedPeriod) + 1
    : periodIndex(periodKey(asset.acquisitionDate));
  const endIndex = periodIndex(toPeriod);
  const periodsElapsed = endIndex - startIndex + 1;
  if (periodsElapsed <= 0) return null;
  return { periodsElapsed, fromPeriod: periodFromIndex(startIndex), toPeriod };
}

/** true si al activo le toca generar su asiento de depreciación hasta el período de `asOf`
 * (uno o más meses pendientes). Atajo booleano de `computeDueDepreciationPeriods` — se mantiene
 * para los contadores de "pendientes" que solo necesitan saber sí/no. */
export function isDepreciationDue(asset: FixedAssetDueRef, asOf: Date): boolean {
  return computeDueDepreciationPeriods(asset, asOf) !== null;
}

export interface DepreciationResult {
  amount: number; // depreciación de el/los período(s) cubiertos (capada al saldo depreciable restante)
  newAccumulated: number;
  fullyDepreciated: boolean;
}

/**
 * Depreciación en línea recta de uno o más períodos (mensual): (costo − valor residual) / (vida
 * útil en meses), multiplicado por `periods` cuando se recupera más de un mes salteado de una
 * sola vez (ver `computeDueDepreciationPeriods`). Si `usefulLifeYears` es 0 (terreno, o activo
 * que no deprecia), siempre es 0. El monto se capa al saldo depreciable restante para no pasarse
 * del costo, sin importar cuántos períodos se estén recuperando.
 */
export function computeMonthlyDepreciation(
  acquisitionCost: number,
  residualValue: number,
  usefulLifeYears: number,
  accumulatedDepreciation: number,
  periods: number = 1,
): DepreciationResult {
  const depreciableBase = Math.max(0, acquisitionCost - residualValue);
  const remaining = Math.max(0, depreciableBase - accumulatedDepreciation);
  if (usefulLifeYears <= 0 || remaining <= 1e-9 || periods <= 0) {
    return { amount: 0, newAccumulated: accumulatedDepreciation, fullyDepreciated: remaining <= 1e-9 && depreciableBase > 0 };
  }
  const monthly = depreciableBase / (usefulLifeYears * 12);
  const amount = Math.round(Math.min(monthly * periods, remaining) * 100) / 100;
  const newAccumulated = Math.round((accumulatedDepreciation + amount) * 100) / 100;
  return { amount, newAccumulated, fullyDepreciated: newAccumulated >= depreciableBase - 1e-9 };
}
