// Motor PURO (sin BD) — Estado de Cambios en el Patrimonio (NIC 1), Etapa 8 del plan
// `plan-contabilidad-tributaria-sri.md`. Clasifica las cuentas de patrimonio del plan Supercías
// (`301` Capital, `304` Reservas, `306`/`307` Resultados) y arma las 4 filas del estado a
// partir de los movimientos reales del período (saldo inicial/debe/haber/saldo final, mismo
// formato que `getTrialBalance2`) — sin tocar Prisma, sin fechas "ahora".
//
// El patrimonio es de naturaleza ACREEDORA: el HABER lo aumenta, el DEBE lo disminuye (regla
// contraria a Activo/Costo/Gasto) — mismo criterio de `DEBIT_NATURE` en `accounting.service.ts`.

export type EquityCategory = 'CAPITAL' | 'RESERVAS' | 'RESULTADOS_ACUMULADOS' | 'OTROS_PATRIMONIO';

/** Clasifica una cuenta de patrimonio del plan Supercías por su código. */
export function classifyEquityAccount(code: string): EquityCategory {
  if (code.startsWith('301')) return 'CAPITAL';
  if (code.startsWith('304')) return 'RESERVAS';
  if (code.startsWith('306') || code.startsWith('307')) return 'RESULTADOS_ACUMULADOS';
  return 'OTROS_PATRIMONIO';
}

export interface EquityAccountMovement {
  code: string;
  opening: number; // saldo inicial (según naturaleza acreedora, positivo = saldo normal)
  debit: number;   // movimientos del período (disminuyen patrimonio)
  credit: number;  // movimientos del período (aumentan patrimonio)
}

export interface EquityCategoryRow {
  category: EquityCategory;
  opening: number;
  increases: number;
  decreases: number;
  closing: number;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function sum(arr: number[]): number {
  return round(arr.reduce((s, n) => s + n, 0));
}

const CATEGORIES: EquityCategory[] = ['CAPITAL', 'RESERVAS', 'RESULTADOS_ACUMULADOS', 'OTROS_PATRIMONIO'];

/** Agrupa los movimientos por cuenta en las 4 categorías del estado. */
export function buildEquityCategories(movements: EquityAccountMovement[]): EquityCategoryRow[] {
  return CATEGORIES.map((category) => {
    const rows = movements.filter((m) => classifyEquityAccount(m.code) === category);
    const opening = sum(rows.map((r) => r.opening));
    const increases = sum(rows.map((r) => r.credit));
    const decreases = sum(rows.map((r) => r.debit));
    return { category, opening, increases, decreases, closing: round(opening + increases - decreases) };
  });
}

export interface EquityStatement {
  from: string; // AAAA-MM-DD
  to: string;
  categories: EquityCategoryRow[];
  /** Utilidad acumulada de ejercicios anteriores aún no cerrada a patrimonio en el libro mayor
   * (KallpaPro no postea un asiento de cierre anual automático — se calcula en vivo, mismo
   * criterio que `getBalanceSheet.utilidadEjercicio`). Se suma a RESULTADOS_ACUMULADOS del
   * saldo inicial para que el total cuadre con el Balance General real de esa fecha. */
  utilidadAcumuladaNoDistribuida: number;
  /** Resultado NIIF del período mostrado (ingresos - costos - gastos de `getIncomeStatement`). */
  utilidadEjercicio: number;
  totalInicial: number;
  totalAumentos: number;
  totalDisminuciones: number;
  totalFinal: number; // debe cuadrar con getBalanceSheet(to).totalPatrimonio
}

export function buildEquityStatement(args: {
  from: string;
  to: string;
  categories: EquityCategoryRow[];
  utilidadAcumuladaNoDistribuida: number;
  utilidadEjercicio: number;
}): EquityStatement {
  const { from, to, categories, utilidadAcumuladaNoDistribuida, utilidadEjercicio } = args;
  const totalInicialCuentas = sum(categories.map((c) => c.opening));
  const totalAumentosCuentas = sum(categories.map((c) => c.increases));
  const totalDisminucionesCuentas = sum(categories.map((c) => c.decreases));
  const totalInicial = round(totalInicialCuentas + utilidadAcumuladaNoDistribuida);
  const totalFinal = round(totalInicial + totalAumentosCuentas - totalDisminucionesCuentas + utilidadEjercicio);
  return {
    from, to, categories,
    utilidadAcumuladaNoDistribuida,
    utilidadEjercicio,
    totalInicial,
    totalAumentos: totalAumentosCuentas,
    totalDisminuciones: totalDisminucionesCuentas,
    totalFinal,
  };
}
