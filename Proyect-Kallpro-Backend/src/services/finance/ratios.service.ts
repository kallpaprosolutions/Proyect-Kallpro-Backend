import { prisma } from '../../lib/prisma';
import { getTrialBalance } from './accounting.service';
// Parámetros financieros Ecuador (Mayo 2026)
const ECUADOR_PARAMS = {
  taxRate: 0.25,        // IR 25% LRTI Art. 37
  laborShare: 0.15,     // PT 15% Código Trabajo Art. 97
  effectiveTaxRate: 0.3625, // TET = 15% + 25%×85% = 36.25%
  riskFreeRate: 0.045,  // Tasa pasiva BCE ~4.5%
  marketRiskPremium: 0.06, // ERP USA 6%
  countryRiskPremium: 0.034, // EMBI Ecuador 3.4%
  beta: 1.0,            // β proxy sectorial PyMES
  debtCostDefault: 0.11, // Costo deuda promedio Ecuador 11%
  ivaRate: 0.15,        // IVA vigente desde abril 2024
};

interface RatioResult {
  code: string;
  name: string;
  value: number | null;
  formula: string;
  numerator?: number;
  denominator?: number;
  benchmark?: number | string;
  benchmarkLabel?: string;
  status: 'green' | 'yellow' | 'red' | 'neutral';
  variationYoY?: number | null;
  unit?: string;
  category: string;
}

function statusByThreshold(
  value: number | null,
  greenMin?: number,
  greenMax?: number,
  yellowMin?: number,
  yellowMax?: number,
  higherIsBetter = true,
): 'green' | 'yellow' | 'red' | 'neutral' {
  if (value === null) return 'neutral';
  if (higherIsBetter) {
    if (greenMin !== undefined && value >= greenMin) return 'green';
    if (yellowMin !== undefined && value >= yellowMin) return 'yellow';
    return 'red';
  } else {
    if (greenMax !== undefined && value <= greenMax) return 'green';
    if (yellowMax !== undefined && value <= yellowMax) return 'yellow';
    return 'red';
  }
}

export async function getRatios(companyId: string, period?: string): Promise<Record<string, RatioResult[]>> {
  // Usar el período actual si no se especifica
  const now = period ? new Date(period + '-01') : new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59);

  // ── Obtener datos base ──────────────────────────────────────────
  const [invoices, purchaseOrders, sriDocuments] = await Promise.all([
    prisma.invoice.findMany({
      where: { companyId, issueDate: { gte: new Date(year, 0, 1), lte: periodEnd } },
    }),
    prisma.purchaseOrder.findMany({
      where: { companyId, createdAt: { gte: new Date(year, 0, 1), lte: periodEnd } },
      include: { items: true },
    }),
    prisma.sriDocument.findMany({
      where: { companyId, fechaEmision: { gte: new Date(year, 0, 1), lte: periodEnd }, status: 'CONFIRMED' },
    }),
  ]);

  // Ingresos = total facturas emitidas pagadas/confirmadas
  let ingresos = invoices
    .filter(i => ['PAID', 'CONFIRMED', 'SENT'].includes(i.status))
    .reduce((s, i) => s + Number(i.totalAmount), 0);

  // Compras = POs recibidas
  const compras = purchaseOrders.reduce((s, po) => s + Number(po.totalAmount), 0);

  // IVA soportado (de documentos SRI tipo FACTURA - compras)
  const ivaSoportado = sriDocuments
    .filter(d => d.tipoDocumento === 'FACTURA')
    .reduce((s, d) => s + Number(d.iva), 0);

  // IVA repercutido (facturas de ventas)
  const ivaRepercutido = ingresos * ECUADOR_PARAMS.ivaRate;

  // COGS estimado (fallback si no hay contabilidad directa)
  let cogs = compras > 0 ? compras * 0.85 : ingresos * 0.7;

  // ── Override con el mayor contable real (si hay asientos) ──
  // Reemplaza ingresos y COGS estimados por los saldos reales del año.
  try {
    const tb = await getTrialBalance(companyId, { from: new Date(year, 0, 1), to: periodEnd });
    const bal = (code: string) => tb.find((r) => r.code === code)?.balance ?? 0;
    const ingLedger = bal('4100');
    const cogsLedger = bal('5100');
    if (ingLedger > 0) ingresos = ingLedger;
    if (cogsLedger > 0) cogs = cogsLedger;
  } catch { /* sin contabilidad: usar estimación */ }

  // EBITDA estimado
  const utilidadBruta = ingresos - cogs;
  const gastosOperativos = ingresos * 0.18; // estimado 18%
  const ebitda = utilidadBruta - gastosOperativos;
  const depreciacion = ingresos * 0.03;
  const utilidadOperativa = ebitda - depreciacion;
  const gastosFinancieros = compras * 0.05;
  const utilidadAntesImp = utilidadOperativa - gastosFinancieros;
  const pt = Math.max(0, utilidadAntesImp * ECUADOR_PARAMS.laborShare);
  const baseIR = Math.max(0, utilidadAntesImp - pt);
  const ir = baseIR * ECUADOR_PARAMS.taxRate;
  const utilidadNeta = utilidadAntesImp - pt - ir;

  // Balance estimado (sin contabilidad completa usa proxies)
  const activoCorriente = ingresos * 0.45;
  const inventario = ingresos * 0.12;
  const caja = ingresos * 0.08;
  const cuentasCobrar = ingresos * 0.25;
  const activoNoCorriente = ingresos * 0.55;
  const activoTotal = activoCorriente + activoNoCorriente;
  const pasivoCorriente = compras * 0.4;
  const cuentasPagar = compras * 0.25;
  const pasivoNoCorriente = activoTotal * 0.25;
  const pasivoTotal = pasivoCorriente + pasivoNoCorriente;
  const patrimonio = activoTotal - pasivoTotal;
  const deudaFinanciera = pasivoTotal * 0.6;

  // WACC
  const E = patrimonio > 0 ? patrimonio : 1;
  const D = deudaFinanciera > 0 ? deudaFinanciera : 1;
  const V = E + D;
  const Re = ECUADOR_PARAMS.riskFreeRate + ECUADOR_PARAMS.beta * ECUADOR_PARAMS.marketRiskPremium + ECUADOR_PARAMS.countryRiskPremium;
  const Rd = ECUADOR_PARAMS.debtCostDefault;
  const wacc = (E / V) * Re + (D / V) * Rd * (1 - ECUADOR_PARAMS.taxRate);

  // NOPAT y Capital invertido
  const nopat = utilidadOperativa * (1 - ECUADOR_PARAMS.taxRate);
  const capitalInvertido = patrimonio + deudaFinanciera;
  const roic = capitalInvertido > 0 ? (nopat / capitalInvertido) * 100 : 0;

  // EVA
  const eva = nopat - wacc * capitalInvertido;

  // FCF
  const capex = activoNoCorriente * 0.08;
  const deltaWC = activoCorriente * 0.05;
  const fcf = nopat + depreciacion - capex - deltaWC;

  // Días de rotación
  const dso = ingresos > 0 ? (cuentasCobrar / ingresos) * 365 : 0;
  const dpo = compras > 0 ? (cuentasPagar / compras) * 365 : 0;
  const di = cogs > 0 ? (inventario / cogs) * 365 : 0;
  const ccc = di + dso - dpo;

  const safe = (n: number, d: number) => (d !== 0 && isFinite(n / d) ? n / d : null);

  // ── LIQUIDEZ ──────────────────────────────────────────────────
  const rc = safe(activoCorriente, pasivoCorriente);
  const pa = safe(activoCorriente - inventario, pasivoCorriente);
  const re = safe(caja, pasivoCorriente);
  const ctn = activoCorriente - pasivoCorriente;

  const liquidez: RatioResult[] = [
    {
      code: 'RC', name: 'Razón corriente', value: rc, formula: 'AC / PC',
      numerator: activoCorriente, denominator: pasivoCorriente,
      benchmark: 1.5, benchmarkLabel: '≥ 1.5x',
      status: statusByThreshold(rc, 1.5, undefined, 1.0),
      category: 'liquidez', unit: 'x',
    },
    {
      code: 'PA', name: 'Prueba ácida', value: pa, formula: '(AC - Inv) / PC',
      numerator: activoCorriente - inventario, denominator: pasivoCorriente,
      benchmark: 1.0, benchmarkLabel: '≥ 1.0x',
      status: statusByThreshold(pa, 1.0, undefined, 0.7),
      category: 'liquidez', unit: 'x',
    },
    {
      code: 'RE', name: 'Razón de efectivo', value: re, formula: 'Caja / PC',
      numerator: caja, denominator: pasivoCorriente,
      benchmark: 0.2, benchmarkLabel: '≥ 0.20x',
      status: statusByThreshold(re, 0.2, undefined, 0.1),
      category: 'liquidez', unit: 'x',
    },
    {
      code: 'CTN', name: 'Capital de trabajo neto', value: ctn, formula: 'AC - PC',
      benchmark: 0, benchmarkLabel: '> 0',
      status: ctn > 0 ? 'green' : ctn > -ingresos * 0.05 ? 'yellow' : 'red',
      category: 'liquidez', unit: 'USD',
    },
  ];

  // ── SOLVENCIA ─────────────────────────────────────────────────
  const end = safe(pasivoTotal, activoTotal);
  const de = safe(pasivoTotal, patrimonio);
  const ci = safe(ebitda, gastosFinancieros);
  const endFin = safe(deudaFinanciera, ebitda);

  const solvencia: RatioResult[] = [
    {
      code: 'END', name: 'Endeudamiento total', value: end !== null ? end * 100 : null,
      formula: 'Pasivo Total / Activo Total × 100',
      benchmark: 60, benchmarkLabel: '≤ 60%',
      status: statusByThreshold(end !== null ? end * 100 : null, undefined, 60, undefined, 75, false),
      category: 'solvencia', unit: '%',
    },
    {
      code: 'DE', name: 'Apalancamiento (D/E)', value: de, formula: 'Pasivo Total / Patrimonio',
      benchmark: 1.5, benchmarkLabel: '≤ 1.5x',
      status: statusByThreshold(de, undefined, 1.5, undefined, 2.5, false),
      category: 'solvencia', unit: 'x',
    },
    {
      code: 'CI', name: 'Cobertura de intereses', value: ci, formula: 'EBITDA / Gastos Financieros',
      benchmark: 3, benchmarkLabel: '≥ 3x',
      status: statusByThreshold(ci, 3, undefined, 2),
      category: 'solvencia', unit: 'x',
    },
    {
      code: 'END_FIN', name: 'Endeudamiento financiero', value: endFin, formula: 'Deuda Financiera / EBITDA',
      benchmark: 3.5, benchmarkLabel: '≤ 3.5x',
      status: statusByThreshold(endFin, undefined, 3.5, undefined, 5, false),
      category: 'solvencia', unit: 'x',
    },
  ];

  // ── RENTABILIDAD ──────────────────────────────────────────────
  const mb = ingresos > 0 ? (utilidadBruta / ingresos) * 100 : null;
  const me = ingresos > 0 ? (ebitda / ingresos) * 100 : null;
  const mn = ingresos > 0 ? (utilidadNeta / ingresos) * 100 : null;
  const roa = activoTotal > 0 ? (utilidadNeta / activoTotal) * 100 : null;
  const roe = patrimonio > 0 ? (utilidadNeta / patrimonio) * 100 : null;
  const roicVal = roic;
  // DuPont
  const dupont = ingresos > 0 && activoTotal > 0 && patrimonio > 0
    ? (utilidadNeta / ingresos) * (ingresos / activoTotal) * (activoTotal / patrimonio) * 100
    : null;

  const rentabilidad: RatioResult[] = [
    {
      code: 'MB', name: 'Margen bruto', value: mb, formula: 'Utilidad Bruta / Ingresos × 100',
      benchmark: 55, benchmarkLabel: '55-65%', unit: '%',
      status: statusByThreshold(mb, 55, undefined, 40),
      category: 'rentabilidad',
    },
    {
      code: 'ME', name: 'Margen EBITDA', value: me, formula: 'EBITDA / Ingresos × 100',
      benchmark: 18, benchmarkLabel: '≥ 18%', unit: '%',
      status: statusByThreshold(me, 18, undefined, 12),
      category: 'rentabilidad',
    },
    {
      code: 'MN', name: 'Margen neto', value: mn, formula: 'Utilidad Neta / Ingresos × 100',
      benchmark: 8, benchmarkLabel: '≥ 8%', unit: '%',
      status: statusByThreshold(mn, 8, undefined, 4),
      category: 'rentabilidad',
    },
    {
      code: 'ROA', name: 'ROA - Retorno sobre activos', value: roa,
      formula: 'Utilidad Neta / Activo Total Promedio × 100',
      benchmark: 8, benchmarkLabel: '8-12%', unit: '%',
      status: statusByThreshold(roa, 8, undefined, 4),
      category: 'rentabilidad',
    },
    {
      code: 'ROE', name: 'ROE - Retorno sobre patrimonio', value: roe,
      formula: 'Utilidad Neta / Patrimonio Promedio × 100',
      benchmark: 15, benchmarkLabel: '≥ 15%', unit: '%',
      status: statusByThreshold(roe, 20, undefined, 15),
      category: 'rentabilidad',
    },
    {
      code: 'ROIC', name: 'ROIC - Retorno s/ capital invertido', value: roicVal,
      formula: 'NOPAT / Capital Invertido × 100',
      benchmark: wacc * 100, benchmarkLabel: `> WACC (${(wacc * 100).toFixed(1)}%)`, unit: '%',
      status: roicVal > wacc * 100 ? 'green' : roicVal > wacc * 100 * 0.8 ? 'yellow' : 'red',
      category: 'rentabilidad',
    },
    {
      code: 'DUPONT', name: 'Análisis DuPont (ROE)', value: dupont,
      formula: '(UN/Ingresos) × (Ingresos/Activo) × (Activo/Patrimonio) × 100', unit: '%',
      status: statusByThreshold(dupont, 15, undefined, 10),
      category: 'rentabilidad',
    },
  ];

  // ── EFICIENCIA ────────────────────────────────────────────────
  const ra = safe(ingresos, activoTotal);
  const ri = safe(cogs, inventario);

  const eficiencia: RatioResult[] = [
    {
      code: 'RA', name: 'Rotación de activos', value: ra, formula: 'Ingresos / Activo Total',
      benchmark: 1.8, benchmarkLabel: '1.8x', unit: 'x',
      status: statusByThreshold(ra, 1.8, undefined, 1.2),
      category: 'eficiencia',
    },
    {
      code: 'RI', name: 'Rotación de inventario', value: ri, formula: 'COGS / Inventario Promedio',
      benchmark: 6, benchmarkLabel: '≥ 6x', unit: 'x',
      status: statusByThreshold(ri, 6, undefined, 4),
      category: 'eficiencia',
    },
    {
      code: 'DI', name: 'Días de inventario', value: di, formula: '(Inventario / COGS) × 365',
      benchmark: 45, benchmarkLabel: '≤ 45 días', unit: 'días',
      status: statusByThreshold(di, undefined, 45, undefined, 60, false),
      category: 'eficiencia',
    },
    {
      code: 'DSO', name: 'DSO - Días de cobro', value: dso,
      formula: '(CxC / Ingresos a crédito) × 365',
      benchmark: 45, benchmarkLabel: '45-60 días', unit: 'días',
      status: statusByThreshold(dso, undefined, 45, undefined, 60, false),
      category: 'eficiencia',
    },
    {
      code: 'DPO', name: 'DPO - Días de pago', value: dpo,
      formula: '(CxP / Compras a crédito) × 365',
      benchmark: 40, benchmarkLabel: '35-45 días', unit: 'días',
      status: dpo >= 35 && dpo <= 45 ? 'green' : dpo >= 30 && dpo <= 60 ? 'yellow' : 'red',
      category: 'eficiencia',
    },
    {
      code: 'CCC', name: 'Ciclo de conversión de caja', value: ccc,
      formula: 'DI + DSO - DPO',
      benchmark: 45, benchmarkLabel: '≤ 45 días', unit: 'días',
      status: statusByThreshold(ccc, undefined, 45, undefined, 75, false),
      category: 'eficiencia',
    },
  ];

  // ── VALOR / CFO ───────────────────────────────────────────────
  const valor: RatioResult[] = [
    {
      code: 'WACC', name: 'WACC', value: wacc * 100, formula: '(E/V×Re) + (D/V×Rd×(1-t))',
      benchmark: 12, benchmarkLabel: '11-14% Ecuador', unit: '%',
      status: wacc * 100 <= 14 ? 'green' : wacc * 100 <= 16 ? 'yellow' : 'red',
      category: 'valor',
    },
    {
      code: 'EVA', name: 'EVA - Valor económico agregado', value: eva,
      formula: 'NOPAT - (WACC × Capital Invertido)',
      benchmark: 0, benchmarkLabel: '> 0 = crea valor', unit: 'USD',
      status: eva > 0 ? 'green' : eva > -ingresos * 0.02 ? 'yellow' : 'red',
      category: 'valor',
    },
    {
      code: 'FCF', name: 'Free Cash Flow', value: fcf,
      formula: 'NOPAT + Dep - CapEx - ΔWC',
      benchmark: 0, benchmarkLabel: '> 0', unit: 'USD',
      status: fcf > 0 ? 'green' : fcf > -ingresos * 0.03 ? 'yellow' : 'red',
      category: 'valor',
    },
    {
      code: 'NOPAT', name: 'NOPAT', value: nopat,
      formula: 'EBIT × (1 - t)',
      unit: 'USD',
      status: nopat > 0 ? 'green' : 'red',
      category: 'valor',
    },
    {
      code: 'ROIC_VS_WACC', name: 'ROIC vs WACC (spread)', value: roicVal - wacc * 100,
      formula: 'ROIC - WACC',
      benchmark: 0, benchmarkLabel: '> 0 = crea valor', unit: 'pp',
      status: roicVal > wacc * 100 ? 'green' : roicVal > wacc * 100 * 0.9 ? 'yellow' : 'red',
      category: 'valor',
    },
  ];

  // ── SRI ECUADOR ───────────────────────────────────────────────
  const ivaNeto = ivaRepercutido - ivaSoportado;

  const sri: RatioResult[] = [
    {
      code: 'IVA_NETO', name: 'IVA neto mensual', value: ivaNeto,
      formula: 'IVA Repercutido - IVA Soportado',
      benchmark: 0, benchmarkLabel: '> 0 = a pagar', unit: 'USD',
      status: ivaNeto >= 0 ? 'green' : 'yellow',
      category: 'sri',
    },
    {
      code: 'TET', name: 'Tasa impositiva efectiva', value: ECUADOR_PARAMS.effectiveTaxRate * 100,
      formula: '15% PT + 25% IR × (1 - 15%)',
      benchmark: 36.25, benchmarkLabel: '36.25% Ecuador', unit: '%',
      status: 'neutral',
      category: 'sri',
    },
    {
      code: 'PT', name: 'Participación trabajadores', value: pt,
      formula: 'Utilidad antes imp. × 15%', unit: 'USD',
      status: pt >= 0 ? 'green' : 'neutral',
      category: 'sri',
    },
    {
      code: 'IR', name: 'Impuesto a la renta', value: ir,
      formula: '(UAI - PT) × 25%', unit: 'USD',
      status: ir >= 0 ? 'green' : 'neutral',
      category: 'sri',
    },
  ];

  return { liquidez, solvencia, rentabilidad, eficiencia, valor, sri };
}

export async function getRatiosByCategory(companyId: string, category: string, period?: string) {
  const all = await getRatios(companyId, period);
  if (category === 'all') {
    return Object.values(all).flat();
  }
  return all[category as keyof typeof all] ?? [];
}

export default { getRatios, getRatiosByCategory };
