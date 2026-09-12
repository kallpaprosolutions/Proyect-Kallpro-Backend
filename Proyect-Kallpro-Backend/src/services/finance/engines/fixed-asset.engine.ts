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

/** true si al activo le toca generar su asiento de depreciación del período de `asOf`. */
export function isDepreciationDue(asset: FixedAssetDueRef, asOf: Date): boolean {
  if (asset.status !== 'ACTIVE') return false;
  if (asOf < asset.acquisitionDate) return false;
  if (asset.lastDepreciatedPeriod === periodKey(asOf)) return false;
  return true;
}

export interface DepreciationResult {
  amount: number; // depreciación de ESTE período (capada al saldo depreciable restante)
  newAccumulated: number;
  fullyDepreciated: boolean;
}

/**
 * Depreciación en línea recta de un período (mensual): (costo − valor residual) / (vida útil
 * en meses). Si `usefulLifeYears` es 0 (terreno, o activo que no deprecia), siempre es 0. El
 * último período capa el monto al saldo depreciable restante para no pasarse del costo.
 */
export function computeMonthlyDepreciation(
  acquisitionCost: number,
  residualValue: number,
  usefulLifeYears: number,
  accumulatedDepreciation: number,
): DepreciationResult {
  const depreciableBase = Math.max(0, acquisitionCost - residualValue);
  const remaining = Math.max(0, depreciableBase - accumulatedDepreciation);
  if (usefulLifeYears <= 0 || remaining <= 1e-9) {
    return { amount: 0, newAccumulated: accumulatedDepreciation, fullyDepreciated: remaining <= 1e-9 && depreciableBase > 0 };
  }
  const monthly = depreciableBase / (usefulLifeYears * 12);
  const amount = Math.round(Math.min(monthly, remaining) * 100) / 100;
  const newAccumulated = Math.round((accumulatedDepreciation + amount) * 100) / 100;
  return { amount, newAccumulated, fullyDepreciated: newAccumulated >= depreciableBase - 1e-9 };
}
