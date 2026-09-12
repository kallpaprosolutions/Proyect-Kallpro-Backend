import { prisma } from '../../lib/prisma';
import { cuentasSupercias } from '../../data/planCuentasSupercias';
import { buildEquityCategories, buildEquityStatement, EquityStatement } from './engines/equity-statement.engine';
// ============================================================
// PLAN DE CUENTAS NIIF-PYMES (Ecuador) — base mínima operativa
// Alineado a los códigos usados en journal.service.ts
// ============================================================

export interface SeedAccount {
  code: string;
  name: string;
  accountType: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'COSTO' | 'GASTO';
  niifRef?: string;
}

// Tipo de saldo natural por categoría
const DEBIT_NATURE = new Set(['ACTIVO', 'COSTO', 'GASTO']);

type AccType = SeedAccount['accountType'];

// accountType derivado del código oficial Supercías (Formulario 101)
export function accountTypeFromCode(code: string): AccType {
  if (code.startsWith('1')) return 'ACTIVO';
  if (code.startsWith('2')) return 'PASIVO';
  if (code.startsWith('3')) return 'PATRIMONIO';
  if (code.startsWith('4')) return 'INGRESO';
  if (code.startsWith('51')) return 'COSTO';
  if (code.startsWith('5')) return 'GASTO';
  return 'GASTO';
}

// Cuenta padre = el código más largo del catálogo que es prefijo estricto de este.
function findParentCode(code: string, codeSet: Set<string>): string | null {
  for (let len = code.length - 1; len >= 1; len--) {
    const prefix = code.slice(0, len);
    if (codeSet.has(prefix)) return prefix;
  }
  return null;
}

// ============================================================
// SEED del plan de cuentas Superintendencia de Compañías (NIIF) — idempotente
// Deriva tipo, jerarquía (parentId) y nivel a partir del código.
// ============================================================
export async function seedChartOfAccounts(companyId: string) {
  const codeSet = new Set(cuentasSupercias.map((c) => c.codigo));
  const parentOf = new Map<string, string | null>();
  const levelOf = new Map<string, number>();
  for (const c of cuentasSupercias) parentOf.set(c.codigo, findParentCode(c.codigo, codeSet));
  // nivel = profundidad en la cadena de padres
  const computeLevel = (code: string): number => {
    let lvl = 1; let p = parentOf.get(code) ?? null;
    while (p) { lvl++; p = parentOf.get(p) ?? null; }
    return lvl;
  };
  for (const c of cuentasSupercias) levelOf.set(c.codigo, computeLevel(c.codigo));

  // Paso 1: upsert de todas las cuentas (sin parentId)
  for (const c of cuentasSupercias) {
    const accountType = accountTypeFromCode(c.codigo);
    const isMovement = c.tipoCuenta === 'D';
    await prisma.financeChartOfAccounts.upsert({
      where: { companyId_code: { companyId, code: c.codigo } },
      update: { name: c.nombre, accountType, level: levelOf.get(c.codigo) ?? 1, isMovement, isActive: true },
      create: { companyId, code: c.codigo, name: c.nombre, accountType, level: levelOf.get(c.codigo) ?? 1, isMovement },
    });
  }
  // Paso 2: resolver parentId
  const all = await prisma.financeChartOfAccounts.findMany({ where: { companyId } });
  const idByCode = new Map(all.map((a) => [a.code, a.id]));
  for (const c of cuentasSupercias) {
    const parentCode = parentOf.get(c.codigo);
    const self = idByCode.get(c.codigo);
    if (parentCode && self) {
      const parentId = idByCode.get(parentCode);
      if (parentId) await prisma.financeChartOfAccounts.update({ where: { id: self }, data: { parentId } });
    }
  }
  return prisma.financeChartOfAccounts.findMany({ where: { companyId }, orderBy: { code: 'asc' } });
}

// ============================================================
// CONFIGURACIÓN DE CUENTAS (posting setup) — mapeo evento → cuenta
// ============================================================
// Códigos oficiales Supercías (Formulario 101). Editables desde la UI.
export const DEFAULT_MAPPINGS: { key: string; accountCode: string; accountName: string }[] = [
  { key: 'CASH',                    accountCode: '10101',     accountName: 'EFECTIVO Y EQUIVALENTES AL EFECTIVO' },
  { key: 'INVENTORY',               accountCode: '1010306',   accountName: 'INVENTARIOS DE PROD. TERM. Y MERCADERÍA EN ALMACÉN - COMPRADO DE TERCEROS' },
  { key: 'AR',                      accountCode: '101020502', accountName: 'DE ACTIVIDADES ORDINARIAS QUE NO GENEREN INTERESES' },
  { key: 'AP',                      accountCode: '2010301',   accountName: 'LOCALES' },
  { key: 'SUPPLIER_ADVANCE',        accountCode: '1010403',   accountName: 'ANTICIPOS A PROVEEDORES' },
  { key: 'IVA_CREDIT',              accountCode: '1010501',   accountName: 'CRÉDITO TRIBUTARIO A FAVOR DE LA EMPRESA (IVA)' },
  { key: 'IVA_DEBIT',               accountCode: '2010701',   accountName: 'CON LA ADMINISTRACIÓN TRIBUTARIA' },
  { key: 'RETENTION_PAYABLE_RENTA', accountCode: '2010701',   accountName: 'CON LA ADMINISTRACIÓN TRIBUTARIA' },
  { key: 'RETENTION_PAYABLE_IVA',   accountCode: '2010701',   accountName: 'CON LA ADMINISTRACIÓN TRIBUTARIA' },
  { key: 'RETENTION_ASSET',         accountCode: '1010502',   accountName: 'CRÉDITO TRIBUTARIO A FAVOR DE LA EMPRESA (I. R.)' },
  { key: 'SALES',                   accountCode: '4101',      accountName: 'VENTA DE BIENES' },
  { key: 'COGS',                    accountCode: '5101',      accountName: 'MATERIALES UTILIZADOS O PRODUCTOS VENDIDOS' },
  { key: 'PURCHASE_EXPENSE',        accountCode: '520228',    accountName: 'OTROS GASTOS' },
  { key: 'INV_ADJUST_GAIN',         accountCode: '4305',      accountName: 'OTRAS RENTAS' },
  { key: 'DEBIT_NOTE_INCOME',       accountCode: '4305',      accountName: 'OTRAS RENTAS' },
  { key: 'IVA_LIQUIDACION_POR_PAGAR', accountCode: '2010701', accountName: 'CON LA ADMINISTRACIÓN TRIBUTARIA' },
  { key: 'INV_WRITEOFF',            accountCode: '510404',    accountName: 'EFECTO VALOR NETO DE REALIZACIÓN DE INVENTARIOS' },
  // ── Ajustes de pago (CxP): diferencias pequeñas condonadas por el proveedor al cerrar un saldo ──
  { key: 'PAYMENT_ADJUSTMENT_GAIN', accountCode: '4305',      accountName: 'OTRAS RENTAS' },
  // ── Ajustes de cobro (CxC): saldo residual castigado como incobrable/condonado al cliente ──
  { key: 'RECEIVABLE_ADJUSTMENT_LOSS', accountCode: '52022305', accountName: 'CUENTAS POR COBRAR' },
  // ── Producción (transformación de materia prima en producto terminado) ──
  { key: 'INVENTORY_RAW',           accountCode: '1010301',   accountName: 'INVENTARIOS DE MATERIA PRIMA' },
  { key: 'INVENTORY_WIP',           accountCode: '1010302',   accountName: 'INVENTARIOS DE PRODUCTOS EN PROCESO' },
  { key: 'INVENTORY_FINISHED',      accountCode: '1010305',   accountName: 'INVENTARIOS DE PROD. TERM. Y MERCADERÍA EN ALMACÉN - PRODUCIDO POR LA COMPAÑÍA' },
  // ── Nómina (RRHH) ──
  { key: 'PAYROLL_SALARY_EXPENSE',   accountCode: '520201', accountName: 'SUELDOS, SALARIOS Y DEMÁS REMUNERACIONES' },
  { key: 'PAYROLL_IESS_EXPENSE',     accountCode: '520202', accountName: 'APORTES A LA SEGURIDAD SOCIAL (incluido fondo de reserva)' },
  { key: 'PAYROLL_BENEFITS_EXPENSE', accountCode: '520203', accountName: 'BENEFICIOS SOCIALES E INDEMNIZACIONES' },
  { key: 'PAYROLL_IESS_PAYABLE',     accountCode: '2010703', accountName: 'CON EL IESS' },
  { key: 'PAYROLL_BENEFITS_PAYABLE', accountCode: '2010704', accountName: 'POR BENEFICIOS DE LEY A EMPLEADOS' },
  { key: 'PAYROLL_IR_PAYABLE',       accountCode: '2010701', accountName: 'CON LA ADMINISTRACIÓN TRIBUTARIA' },
  // ── Activos fijos y depreciación (B4) ──
  // 52022101 (Gastos Administrativos → Depreciaciones → PPE), no 510401 (ese es costo de
  // fabricación — correcto solo para maquinaria de planta, no para el caso general de una
  // PYME depreciando muebles/cómputo/vehículos administrativos). Editable en Ajustes si
  // corresponde llevarlo a costo de producción.
  { key: 'FIXED_ASSET_DEPRECIATION_EXPENSE', accountCode: '52022101', accountName: 'PROPIEDADES, PLANTA Y EQUIPO' },
  { key: 'FIXED_ASSET_ACCUM_DEPRECIATION',   accountCode: '1020112',  accountName: '(-) DEPRECIACIÓN ACUMULADA PROPIEDADES, PLANTA Y EQUIPO' },
];

export async function seedAccountMappings(companyId: string) {
  for (const m of DEFAULT_MAPPINGS) {
    await prisma.accountMapping.upsert({
      where: { companyId_key: { companyId, key: m.key } },
      update: {}, // no sobreescribir configuración existente del usuario
      create: { companyId, key: m.key, accountCode: m.accountCode, accountName: m.accountName },
    });
  }
  return prisma.accountMapping.findMany({ where: { companyId }, orderBy: { key: 'asc' } });
}

export async function getAccountMappings(companyId: string) {
  return prisma.accountMapping.findMany({ where: { companyId }, orderBy: { key: 'asc' } });
}

export async function updateAccountMapping(companyId: string, key: string, accountCode: string) {
  const acc = await prisma.financeChartOfAccounts.findFirst({ where: { companyId, code: accountCode } });
  if (!acc) throw new Error('Cuenta no encontrada en el plan de cuentas');
  return prisma.accountMapping.upsert({
    where: { companyId_key: { companyId, key } },
    update: { accountCode, accountName: acc.name },
    create: { companyId, key, accountCode, accountName: acc.name },
  });
}

export async function getChartOfAccounts(companyId: string) {
  return prisma.financeChartOfAccounts.findMany({ where: { companyId }, orderBy: { code: 'asc' } });
}

// ============================================================
// BALANZA DE COMPROBACIÓN
// ============================================================
export interface TrialBalanceRow {
  code: string;
  name: string;
  accountType: SeedAccount['accountType'];
  debit: number;
  credit: number;
  balance: number; // saldo según naturaleza (positivo = saldo normal)
}

export async function getTrialBalance(
  companyId: string,
  opts?: { from?: Date; to?: Date },
): Promise<TrialBalanceRow[]> {
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      entry: {
        companyId,
        status: { not: 'REVERSED' },
        ...(opts?.from || opts?.to
          ? { entryDate: { ...(opts?.from && { gte: opts.from }), ...(opts?.to && { lte: opts.to }) } }
          : {}),
      },
    },
    select: { accountCode: true, accountName: true, debit: true, credit: true },
  });

  const chart = await prisma.financeChartOfAccounts.findMany({ where: { companyId } });
  const typeByCode = new Map(chart.map((c) => [c.code, c.accountType as SeedAccount['accountType']]));

  const map = new Map<string, TrialBalanceRow>();
  for (const l of lines) {
    const type = typeByCode.get(l.accountCode) ?? accountTypeFromCode(l.accountCode);
    const row = map.get(l.accountCode) ?? {
      code: l.accountCode, name: l.accountName, accountType: type, debit: 0, credit: 0, balance: 0,
    };
    row.debit += Number(l.debit);
    row.credit += Number(l.credit);
    map.set(l.accountCode, row);
  }

  const rows = Array.from(map.values());
  for (const r of rows) {
    r.balance = DEBIT_NATURE.has(r.accountType) ? r.debit - r.credit : r.credit - r.debit;
  }
  return rows.sort((a, b) => a.code.localeCompare(b.code));
}

// ============================================================
// BALANZA DE COMPROBACIÓN v2 — saldo inicial + movimientos + saldo final,
// con agrupación opcional por nivel del plan de cuentas (Sprint 6).
// Formato estándar de auditoría (Odoo/Contífico): 6 columnas.
// ============================================================
export interface TrialBalance2Row {
  code: string;
  name: string;
  accountType: SeedAccount['accountType'];
  level: number;
  opening: number; // saldo inicial según naturaleza (antes de `from`)
  debit: number;   // movimientos del período
  credit: number;
  closing: number; // opening + movimientos (según naturaleza)
}

export async function getTrialBalance2(
  companyId: string,
  opts: { from?: Date; to?: Date; level?: number } = {},
): Promise<{ rows: TrialBalance2Row[]; totals: { opening: number; debit: number; credit: number; closing: number } }> {
  const chart = await prisma.financeChartOfAccounts.findMany({ where: { companyId } });
  const byCode = new Map(chart.map((c) => [c.code, c]));
  const codeSet = new Set(chart.map((c) => c.code));

  // Ancestro al nivel pedido (o la propia cuenta si su nivel ≤ nivel pedido).
  const groupCode = (code: string): string => {
    if (!opts.level) return code;
    let current: string | null = code;
    let best = code;
    while (current) {
      const acc = byCode.get(current);
      if (acc && acc.level <= opts.level) { best = current; break; }
      current = findParentCode(current, codeSet);
      if (current) best = current;
    }
    return best;
  };

  const aggregate = async (where: any) => {
    const lines = await prisma.journalEntryLine.findMany({
      where,
      select: { accountCode: true, accountName: true, debit: true, credit: true },
    });
    const map = new Map<string, { debit: number; credit: number }>();
    for (const l of lines) {
      const key = groupCode(l.accountCode);
      const agg = map.get(key) ?? { debit: 0, credit: 0 };
      agg.debit += Number(l.debit);
      agg.credit += Number(l.credit);
      map.set(key, agg);
    }
    return map;
  };

  const baseEntry = { companyId, status: { not: 'REVERSED' } };
  // Saldo inicial: todo lo anterior a `from` (si no hay from, apertura = 0)
  const openingMap = opts.from
    ? await aggregate({ entry: { ...baseEntry, entryDate: { lt: opts.from } } })
    : new Map<string, { debit: number; credit: number }>();
  const periodMap = await aggregate({
    entry: {
      ...baseEntry,
      ...(opts.from || opts.to
        ? { entryDate: { ...(opts.from && { gte: opts.from }), ...(opts.to && { lte: opts.to }) } }
        : {}),
    },
  });

  const round = (n: number) => Math.round(n * 100) / 100;
  const codes = new Set([...openingMap.keys(), ...periodMap.keys()]);
  const rows: TrialBalance2Row[] = [];
  for (const code of codes) {
    const acc = byCode.get(code);
    const type = (acc?.accountType as SeedAccount['accountType']) ?? accountTypeFromCode(code);
    const sign = DEBIT_NATURE.has(type) ? 1 : -1;
    const o = openingMap.get(code) ?? { debit: 0, credit: 0 };
    const p = periodMap.get(code) ?? { debit: 0, credit: 0 };
    const opening = sign * (o.debit - o.credit);
    const closing = opening + sign * (p.debit - p.credit);
    rows.push({
      code,
      name: acc?.name ?? code,
      accountType: type,
      level: acc?.level ?? 1,
      opening: round(opening),
      debit: round(p.debit),
      credit: round(p.credit),
      closing: round(closing),
    });
  }
  rows.sort((a, b) => a.code.localeCompare(b.code));

  const totals = rows.reduce(
    (t, r) => ({
      // los saldos por naturaleza no se suman entre tipos; los totales útiles son debe/haber
      opening: round(t.opening + r.opening),
      debit: round(t.debit + r.debit),
      credit: round(t.credit + r.credit),
      closing: round(t.closing + r.closing),
    }),
    { opening: 0, debit: 0, credit: 0, closing: 0 },
  );
  return { rows, totals };
}

// ============================================================
// BALANCE GENERAL (acumulado hasta asOf)
// ============================================================
export async function getBalanceSheet(companyId: string, asOf?: Date) {
  const cutoff = asOf ?? new Date();
  const tb = await getTrialBalance(companyId, { to: cutoff });

  const pick = (t: string) => tb.filter((r) => r.accountType === t);
  const sum = (rows: TrialBalanceRow[]) => rows.reduce((s, r) => s + r.balance, 0);

  const activos = pick('ACTIVO');
  const pasivos = pick('PASIVO');
  const patrimonio = pick('PATRIMONIO');

  const totalActivos = sum(activos);
  const totalPasivos = sum(pasivos);
  // Resultado del ejercicio = ingresos - costos - gastos (se lleva a patrimonio)
  const utilidadEjercicio =
    sum(pick('INGRESO')) - sum(pick('COSTO')) - sum(pick('GASTO'));
  const totalPatrimonio = sum(patrimonio) + utilidadEjercicio;

  return {
    asOf: cutoff,
    activos,
    pasivos,
    patrimonio,
    utilidadEjercicio,
    totalActivos,
    totalPasivos,
    totalPatrimonio,
    cuadre: Number((totalActivos - (totalPasivos + totalPatrimonio)).toFixed(2)), // ≈ 0 si balancea
  };
}

// ============================================================
// ESTADO DE RESULTADOS (período)
// ============================================================
export async function getIncomeStatement(companyId: string, opts?: { from?: Date; to?: Date }) {
  const tb = await getTrialBalance(companyId, opts);
  const pick = (t: string) => tb.filter((r) => r.accountType === t);
  const sum = (rows: TrialBalanceRow[]) => rows.reduce((s, r) => s + r.balance, 0);

  const ingresos = pick('INGRESO');
  const costos = pick('COSTO');
  const gastos = pick('GASTO');

  const totalIngresos = sum(ingresos);
  const totalCostos = sum(costos);
  const totalGastos = sum(gastos);
  const utilidadBruta = totalIngresos - totalCostos;
  const utilidadOperativa = utilidadBruta - totalGastos;
  const utilidadNeta = utilidadOperativa; // sin impuestos por ahora

  return {
    from: opts?.from ?? null,
    to: opts?.to ?? null,
    ingresos,
    costos,
    gastos,
    totalIngresos,
    totalCostos,
    totalGastos,
    utilidadBruta,
    utilidadOperativa,
    utilidadNeta,
  };
}

// ============================================================
// ESTADO DE CAMBIOS EN EL PATRIMONIO (NIC 1, Etapa 8 del plan SRI/NIIF)
// ============================================================
export async function getEquityStatement(
  companyId: string,
  opts: { from: Date; to: Date },
): Promise<EquityStatement> {
  const dayBeforeFrom = new Date(opts.from.getTime() - 1);

  const [{ rows }, incomeThisPeriod, incomeBeforePeriod] = await Promise.all([
    getTrialBalance2(companyId, { from: opts.from, to: opts.to }),
    getIncomeStatement(companyId, { from: opts.from, to: opts.to }),
    getIncomeStatement(companyId, { to: dayBeforeFrom }),
  ]);

  const patrimonioRows = rows.filter((r) => r.accountType === 'PATRIMONIO');
  const categories = buildEquityCategories(
    patrimonioRows.map((r) => ({ code: r.code, opening: r.opening, debit: r.debit, credit: r.credit })),
  );

  return buildEquityStatement({
    from: opts.from.toISOString().slice(0, 10),
    to: opts.to.toISOString().slice(0, 10),
    categories,
    // utilidad de todos los ejercicios anteriores, no posteada a 306/307 en el mayor (mismo
    // criterio "en vivo" que getBalanceSheet.utilidadEjercicio) — se pliega al saldo inicial
    // de RESULTADOS_ACUMULADOS para que el total cuadre con el Balance General real.
    utilidadAcumuladaNoDistribuida: incomeBeforePeriod.utilidadNeta,
    utilidadEjercicio: incomeThisPeriod.utilidadNeta,
  });
}

// ============================================================
// SNAPSHOT DE CIERRE (persistencia opcional)
// ============================================================
export async function saveStatementSnapshot(
  companyId: string,
  type: 'BALANCE' | 'INCOME' | 'EQUITY',
  period: string,
  asOf: Date,
  data: any,
  createdBy?: string,
) {
  return prisma.financialStatement.upsert({
    where: { companyId_type_period: { companyId, type, period } },
    update: { data, asOf, generatedAt: new Date(), createdBy },
    create: { companyId, type, period, asOf, data, createdBy },
  });
}

// ============================================================
// MAYOR POR CUENTA (libro mayor con saldo corrido y drill-down al origen)
// ============================================================
export async function getAccountLedger(
  companyId: string,
  accountCode: string,
  opts: { from?: Date; to?: Date } = {},
) {
  const account = await prisma.financeChartOfAccounts.findFirst({ where: { companyId, code: accountCode } });
  const accType = accountTypeFromCode(accountCode);
  // Activo/Costo/Gasto aumentan al DEBE; Pasivo/Patrimonio/Ingreso al HABER
  const sign = ['ACTIVO', 'COSTO', 'GASTO'].includes(accType) ? 1 : -1;

  const baseWhere = {
    accountCode,
    entry: { companyId, status: { not: 'REVERSED' } },
  } as const;

  // Saldo de apertura: todo lo anterior a `from`
  let openingBalance = 0;
  if (opts.from) {
    const agg = await prisma.journalEntryLine.aggregate({
      where: { ...baseWhere, entry: { ...baseWhere.entry, entryDate: { lt: opts.from } } },
      _sum: { debit: true, credit: true },
    });
    openingBalance = sign * (Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0));
  }

  const lines = await prisma.journalEntryLine.findMany({
    where: {
      ...baseWhere,
      entry: {
        ...baseWhere.entry,
        ...(opts.from || opts.to ? { entryDate: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {}),
      },
    },
    include: { entry: { select: { entryNumber: true, entryDate: true, description: true, entityType: true, entityId: true } } },
    orderBy: { entry: { entryDate: 'asc' } },
  });

  let running = openingBalance;
  const entries = lines.map((l) => {
    const debit = Number(l.debit);
    const credit = Number(l.credit);
    running += sign * (debit - credit);
    return {
      date: l.entry.entryDate,
      journalNumber: l.entry.entryNumber,
      description: l.description || l.entry.description,
      debit,
      credit,
      runningBalance: Math.round(running * 100) / 100,
      sourceType: l.entry.entityType,
      sourceId: l.entry.entityId,
    };
  });

  return {
    account: { code: accountCode, name: account?.name ?? accountCode, type: accType },
    openingBalance: Math.round(openingBalance * 100) / 100,
    entries,
    closingBalance: Math.round(running * 100) / 100,
  };
}

// ============================================================
// ESTADO DE FLUJO DE EFECTIVO (método directo, NIIF — NIC 7)
// Clasifica los movimientos de caja según la CONTRAPARTIDA del asiento.
// Mapa de prefijos ajustable (constante documentada).
// ============================================================

/** Prefijo de cuenta de contrapartida → actividad. El primero que matchee gana. */
const CASH_FLOW_CLASSIFICATION: { prefix: string; activity: 'operating' | 'investing' | 'financing' }[] = [
  { prefix: '12', activity: 'investing' },   // propiedad, planta y equipo / activos no corrientes
  { prefix: '13', activity: 'investing' },   // inversiones largo plazo
  { prefix: '20102', activity: 'financing' },// obligaciones financieras corto plazo
  { prefix: '21', activity: 'financing' },   // pasivo no corriente (deuda)
  { prefix: '30', activity: 'financing' },   // capital
  { prefix: '3', activity: 'financing' },    // patrimonio en general
  // default: operativo (ventas, compras, CxC, CxP, anticipos, impuestos, nómina)
];

function classifyCounterpart(code: string): 'operating' | 'investing' | 'financing' {
  for (const rule of CASH_FLOW_CLASSIFICATION) {
    if (code.startsWith(rule.prefix)) return rule.activity;
  }
  return 'operating';
}

export async function getCashFlowStatement(
  companyId: string,
  opts: { from?: Date; to?: Date; method?: 'direct' | 'indirect' } = {},
) {
  // Cuenta(s) de caja: mapping CASH (default 10101). Todo código que empiece con él cuenta como efectivo.
  const mapping = await prisma.accountMapping.findUnique({ where: { companyId_key: { companyId, key: 'CASH' } } });
  const cashPrefix = mapping?.accountCode ?? '10101';

  const dateFilter = (cmp: 'lt' | 'range') =>
    cmp === 'lt'
      ? (opts.from ? { entryDate: { lt: opts.from } } : { entryDate: { lt: new Date(0) } })
      : { entryDate: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } };

  // Caja de apertura
  const openAgg = await prisma.journalEntryLine.aggregate({
    where: { accountCode: { startsWith: cashPrefix }, entry: { companyId, status: { not: 'REVERSED' }, ...dateFilter('lt') } },
    _sum: { debit: true, credit: true },
  });
  const openingCash = Number(openAgg._sum.debit ?? 0) - Number(openAgg._sum.credit ?? 0);

  // Asientos del período que tocan caja, con TODAS sus líneas (para hallar contrapartidas)
  const entries = await prisma.journalEntry.findMany({
    where: {
      companyId,
      status: { not: 'REVERSED' },
      ...dateFilter('range'),
      lines: { some: { accountCode: { startsWith: cashPrefix } } },
    },
    include: { lines: true },
    orderBy: { entryDate: 'asc' },
  });

  type Bucket = { inflows: { description: string; amount: number }[]; outflows: { description: string; amount: number }[]; net: number };
  const mk = (): Bucket => ({ inflows: [], outflows: [], net: 0 });
  const buckets: Record<'operating' | 'investing' | 'financing', Bucket> = {
    operating: mk(), investing: mk(), financing: mk(),
  };

  for (const e of entries) {
    const cashLines = e.lines.filter((l) => l.accountCode.startsWith(cashPrefix));
    const cashDelta = cashLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
    if (Math.abs(cashDelta) < 0.005) continue;
    // contrapartida dominante: la línea no-caja de mayor importe
    const counter = e.lines
      .filter((l) => !l.accountCode.startsWith(cashPrefix))
      .sort((a, b) => (Number(b.debit) + Number(b.credit)) - (Number(a.debit) + Number(a.credit)))[0];
    const activity = classifyCounterpart(counter?.accountCode ?? '');
    const item = { description: `${e.entryNumber} · ${e.description}`, amount: Math.round(Math.abs(cashDelta) * 100) / 100 };
    if (cashDelta > 0) buckets[activity].inflows.push(item);
    else buckets[activity].outflows.push(item);
    buckets[activity].net = Math.round((buckets[activity].net + cashDelta) * 100) / 100;
  }

  const netChange = Math.round((buckets.operating.net + buckets.investing.net + buckets.financing.net) * 100) / 100;
  const openingCashRounded = Math.round(openingCash * 100) / 100;
  const closingCash = Math.round((openingCash + netChange) * 100) / 100;

  if (opts.method !== 'indirect') {
    return {
      method: 'direct' as const,
      cashAccountPrefix: cashPrefix,
      operating: buckets.operating,
      investing: buckets.investing,
      financing: buckets.financing,
      netChange,
      openingCash: openingCashRounded,
      closingCash,
    };
  }

  // Método indirecto (NIC 7): la sección operativa se reconcilia desde la utilidad neta en vez
  // de listar cobros/pagos — Inversión y Financiamiento NO cambian de un método a otro (la norma
  // solo afecta la presentación de Operación). El total operativo SIEMPRE es el mismo que el
  // método directo (ambos representan el mismo efectivo real, solo cambia la presentación) —
  // se garantiza por construcción: depreciación es el único ajuste identificado explícitamente
  // (reusa `FIXED_ASSET_ACCUM_DEPRECIATION` del posting setup, la misma cuenta que credita
  // `createDepreciationEntry`) y el resto de la variación de capital de trabajo se muestra en un
  // solo renglón neto (residual = operativo directo − utilidad neta − depreciación), en vez de
  // arriesgar una descomposición cuenta-por-cuenta que podría no cuadrar con el efectivo real.
  const income = await getIncomeStatement(companyId, { from: opts.from, to: opts.to });
  const depMapping = await prisma.accountMapping.findUnique({
    where: { companyId_key: { companyId, key: 'FIXED_ASSET_ACCUM_DEPRECIATION' } },
  });
  let depreciation = 0;
  if (depMapping) {
    const depAgg = await prisma.journalEntryLine.aggregate({
      where: { accountCode: depMapping.accountCode, entry: { companyId, status: { not: 'REVERSED' }, ...dateFilter('range') } },
      _sum: { credit: true },
    });
    depreciation = Math.round(Number(depAgg._sum.credit ?? 0) * 100) / 100;
  }
  const netIncome = Math.round(income.utilidadNeta * 100) / 100;
  const operatingNet = buckets.operating.net;
  const workingCapitalChange = Math.round((operatingNet - netIncome - depreciation) * 100) / 100;

  return {
    method: 'indirect' as const,
    cashAccountPrefix: cashPrefix,
    operating: { netIncome, depreciation, workingCapitalChange, net: operatingNet },
    investing: buckets.investing,
    financing: buckets.financing,
    netChange,
    openingCash: openingCashRounded,
    closingCash,
  };
}
