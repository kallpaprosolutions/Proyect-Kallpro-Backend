// Motor PURO (sin BD) — réplica del Formulario 101 OFICIAL del SRI (Impuesto a la Renta
// Sociedades), mismo patrón que los Formularios 104 y 103 (`sri-form104-official.engine.ts` /
// `sri-form103-official.engine.ts`). Números de casilla y fórmulas tomados del formulario oficial
// real (Resolución NAC-DGERCGC15-00000143, estructura vigente de Conciliación Tributaria/Cálculo
// del Impuesto — ver memoria `sri-formularios-104-103-estructura-real-2026-09-28.md` §"Formulario
// 101" para la investigación y la fuente primaria, fetch 2026-10-01).
//
// Alcance deliberado (mismo criterio ya usado en el 104 y el 103, confirmado por el usuario): NO
// se reconstruye el Estado de Situación Financiera ni el Estado de Resultados completos del 101
// (~300 casillas de detalle de balance) — eso ya lo cubren el Balance General y el Estado de
// Resultados existentes del módulo de Contabilidad. Lo que faltaba y SÍ se construye aquí, con
// numeración real, es la parte específicamente tributaria: Conciliación Tributaria, Cálculo del
// Impuesto Causado, Anticipo y Valores a Pagar (casillas 801-999) — la misma sección que ya tenía
// una versión simplificada en `sri-form101.engine.ts` (sin numeración oficial, sin mapeo a
// cuentas, sin edición manual). Las dos casillas "puente" con el Estado de Resultados (6999 total
// ingresos, 7999 total costos y gastos) son hoja, mapeables a rangos de cuentas como cualquier
// otra casilla del patrón.

export type CasillaColumn = 'valor';

export interface CasillaDef {
  code: string;
  label: string;
  section: string;
  column: CasillaColumn;
  kind: 'leaf' | 'formula';
  formula?: (v: Record<string, number>) => number;
  style?: 'total' | 'resultado' | 'informativo';
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Tarifas del Impuesto a la Renta Sociedades — configurables porque la ley las cambia por año fiscal. */
export interface Form101Rates {
  tarifaGeneral: number; // ej. 0.25
  tarifaReinversion: number; // ej. 0.25 (igual a la general si la sociedad no reinvierte/capitaliza)
}

export const FORM101_DEFAULT_RATES: Form101Rates = { tarifaGeneral: 0.25, tarifaReinversion: 0.25 };

export const FORM101_SECTIONS = [
  'Puente con el Estado de Resultados',
  'Conciliación tributaria',
  'Cálculo del impuesto causado',
  'Liquidación del impuesto — anticipo y retenciones',
  'Impuesto a la renta único y resultado',
  'Anticipo determinado para el próximo ejercicio',
  'Valores a pagar',
] as const;

export const FORM101_CASILLAS: CasillaDef[] = [
  // ── Puente con el Estado de Resultados (hoja — se mapea a los rangos de cuentas de ingresos/costos y gastos) ──
  { code: '6999', label: 'Total ingresos del ejercicio (suma 6011 a 6131 del Estado de Resultados)', section: FORM101_SECTIONS[0], column: 'valor', kind: 'leaf' },
  { code: '7999', label: 'Total costos y gastos del ejercicio (suma 7010 a 7991 del Estado de Resultados)', section: FORM101_SECTIONS[0], column: 'valor', kind: 'leaf' },

  // ── Conciliación tributaria ──
  { code: '801', label: 'Utilidad del ejercicio (6999−7999 > 0)', section: FORM101_SECTIONS[1], column: 'valor', kind: 'formula', formula: (v) => Math.max(r2(v['6999'] - v['7999']), 0) },
  { code: '802', label: 'Pérdida del ejercicio (6999−7999 < 0)', section: FORM101_SECTIONS[1], column: 'valor', kind: 'formula', formula: (v) => Math.max(r2(v['7999'] - v['6999']), 0) },
  { code: '803', label: '(−) 15% participación a trabajadores', section: FORM101_SECTIONS[1], column: 'valor', kind: 'formula', formula: (v) => r2(v['801'] * 0.15) },
  { code: '804', label: '(−) Dividendos exentos', section: FORM101_SECTIONS[1], column: 'valor', kind: 'leaf' },
  { code: '805', label: '(−) Otras rentas exentas', section: FORM101_SECTIONS[1], column: 'valor', kind: 'leaf' },
  { code: '806', label: '(−) Otras rentas exentas derivadas del COPCI', section: FORM101_SECTIONS[1], column: 'valor', kind: 'leaf' },
  { code: '807', label: '(+) Gastos no deducibles locales', section: FORM101_SECTIONS[1], column: 'valor', kind: 'leaf' },
  { code: '808', label: '(+) Gastos no deducibles del exterior', section: FORM101_SECTIONS[1], column: 'valor', kind: 'leaf' },
  { code: '809', label: '(+) Gastos incurridos para generar ingresos exentos', section: FORM101_SECTIONS[1], column: 'valor', kind: 'leaf' },
  {
    code: '810', label: '(+) Participación trabajadores atribuible a ingresos exentos — {(804×15%)+[(805+806−809)×15%]}', section: FORM101_SECTIONS[1], column: 'valor', kind: 'formula',
    formula: (v) => r2(v['804'] * 0.15 + (v['805'] + v['806'] - v['809']) * 0.15),
  },
  { code: '811', label: '(−) Amortización de pérdidas tributarias de años anteriores', section: FORM101_SECTIONS[1], column: 'valor', kind: 'leaf' },
  { code: '812', label: '(−) Deducciones por leyes especiales', section: FORM101_SECTIONS[1], column: 'valor', kind: 'leaf' },
  { code: '813', label: '(−) Deducciones especiales derivadas del COPCI', section: FORM101_SECTIONS[1], column: 'valor', kind: 'leaf' },
  { code: '814', label: '(+) Ajuste por precios de transferencia', section: FORM101_SECTIONS[1], column: 'valor', kind: 'leaf' },
  { code: '815', label: '(−) Deducción por incremento neto de empleados', section: FORM101_SECTIONS[1], column: 'valor', kind: 'leaf' },
  { code: '816', label: '(−) Deducción por pago a trabajadores con discapacidad', section: FORM101_SECTIONS[1], column: 'valor', kind: 'leaf' },
  { code: '817', label: '(−) Ingresos sujetos a Impuesto a la Renta Único', section: FORM101_SECTIONS[1], column: 'valor', kind: 'leaf' },
  { code: '818', label: '(+) Costos y gastos deducibles incurridos para generar ingresos sujetos a Impuesto a la Renta Único', section: FORM101_SECTIONS[1], column: 'valor', kind: 'leaf' },
  {
    code: '819', label: 'UTILIDAD GRAVABLE', section: FORM101_SECTIONS[1], column: 'valor', kind: 'formula', style: 'total',
    formula: (v) => r2(v['801'] - v['802'] - v['803'] - v['804'] - v['805'] - v['806'] + v['807'] + v['808'] + v['809'] + v['810'] - v['811'] - v['812'] - v['813'] + v['814'] - v['815'] - v['816'] - v['817'] + v['818']),
  },
  { code: '821', label: 'Pérdida sujeta a amortización en períodos siguientes', section: FORM101_SECTIONS[1], column: 'valor', kind: 'formula', style: 'informativo', formula: (v) => Math.max(r2(-v['819']), 0) },

  // ── Cálculo del impuesto causado ──
  { code: '831', label: 'Utilidad a reinvertir y capitalizar (sujeta legalmente a reducción de tarifa)', section: FORM101_SECTIONS[2], column: 'valor', kind: 'leaf' },
  { code: '832', label: 'Saldo utilidad gravable (819−831)', section: FORM101_SECTIONS[2], column: 'valor', kind: 'formula', formula: (v) => Math.max(r2(v['819']), 0) - v['831'] },
  { code: '839', label: 'TOTAL IMPUESTO CAUSADO (831 × tarifa reinversión) + (832 × tarifa general)', section: FORM101_SECTIONS[2], column: 'valor', kind: 'formula', style: 'total', formula: (v) => r2(v['831'] * v['__tarifaReinversion'] + v['832'] * v['__tarifaGeneral']) },

  // ── Liquidación — anticipo y retenciones ──
  { code: '841', label: '(−) Anticipo determinado correspondiente al ejercicio fiscal declarado', section: FORM101_SECTIONS[3], column: 'valor', kind: 'leaf' },
  { code: '842', label: '(=) Impuesto a la renta causado mayor al anticipo determinado (839−841 > 0)', section: FORM101_SECTIONS[3], column: 'valor', kind: 'formula', formula: (v) => Math.max(r2(v['839'] - v['841']), 0) },
  { code: '843', label: '(=) Crédito tributario generado por anticipo (839−841 < 0)', section: FORM101_SECTIONS[3], column: 'valor', kind: 'formula', formula: (v) => Math.max(r2(v['841'] - v['839']), 0) },
  { code: '844', label: '(+) Saldo del anticipo pendiente de pago', section: FORM101_SECTIONS[3], column: 'valor', kind: 'leaf' },
  { code: '845', label: '(−) Retenciones en la fuente que le realizaron en el ejercicio fiscal', section: FORM101_SECTIONS[3], column: 'valor', kind: 'leaf' },
  { code: '847', label: '(−) Retenciones por dividendos anticipados', section: FORM101_SECTIONS[3], column: 'valor', kind: 'leaf' },
  { code: '848', label: '(−) Retenciones por ingresos del exterior con derecho a crédito tributario', section: FORM101_SECTIONS[3], column: 'valor', kind: 'leaf' },
  { code: '849', label: '(−) Anticipo de Impuesto a la Renta pagado por espectáculos públicos', section: FORM101_SECTIONS[3], column: 'valor', kind: 'leaf' },
  { code: '850', label: '(−) Crédito tributario de años anteriores', section: FORM101_SECTIONS[3], column: 'valor', kind: 'leaf' },
  { code: '851', label: '(−) Crédito tributario generado por Impuesto a la Salida de Divisas', section: FORM101_SECTIONS[3], column: 'valor', kind: 'leaf' },
  { code: '852', label: '(−) Exoneración y crédito tributario por leyes especiales', section: FORM101_SECTIONS[3], column: 'valor', kind: 'leaf' },
  {
    code: '855', label: 'Subtotal impuesto a pagar (842−843+844−845−847−848−849−850−851−852 > 0)', section: FORM101_SECTIONS[3], column: 'valor', kind: 'formula', style: 'total',
    formula: (v) => Math.max(r2(v['842'] - v['843'] + v['844'] - v['845'] - v['847'] - v['848'] - v['849'] - v['850'] - v['851'] - v['852']), 0),
  },
  {
    code: '856', label: 'Subtotal saldo a favor (842−843+844−845−847−848−849−850−851−852 < 0)', section: FORM101_SECTIONS[3], column: 'valor', kind: 'formula', style: 'total',
    formula: (v) => Math.max(r2(-(v['842'] - v['843'] + v['844'] - v['845'] - v['847'] - v['848'] - v['849'] - v['850'] - v['851'] - v['852'])), 0),
  },

  // ── Impuesto a la renta único y resultado ──
  { code: '857', label: '(+) Impuesto a la renta único', section: FORM101_SECTIONS[4], column: 'valor', kind: 'leaf' },
  { code: '858', label: '(−) Crédito tributario para la liquidación del Impuesto a la Renta Único', section: FORM101_SECTIONS[4], column: 'valor', kind: 'leaf' },
  { code: '859', label: 'IMPUESTO A LA RENTA A PAGAR', section: FORM101_SECTIONS[4], column: 'valor', kind: 'formula', style: 'total', formula: (v) => Math.max(r2(v['855'] + v['857'] - v['858']), 0) },
  { code: '869', label: 'SALDO A FAVOR DEL CONTRIBUYENTE', section: FORM101_SECTIONS[4], column: 'valor', kind: 'formula', style: 'informativo', formula: (v) => r2(v['856']) },

  // ── Anticipo determinado para el próximo ejercicio ──
  { code: '871', label: 'Primera cuota', section: FORM101_SECTIONS[5], column: 'valor', kind: 'leaf' },
  { code: '872', label: 'Segunda cuota', section: FORM101_SECTIONS[5], column: 'valor', kind: 'leaf' },
  { code: '873', label: 'Saldo a liquidarse en declaración del próximo año', section: FORM101_SECTIONS[5], column: 'valor', kind: 'leaf' },
  { code: '879', label: 'ANTICIPO DETERMINADO PRÓXIMO AÑO (871+872+873)', section: FORM101_SECTIONS[5], column: 'valor', kind: 'formula', style: 'total', formula: (v) => r2(v['871'] + v['872'] + v['873']) },

  // ── Valores a pagar ──
  { code: '890', label: 'Pago previo (informativo, declaraciones sustitutivas)', section: FORM101_SECTIONS[6], column: 'valor', kind: 'leaf', style: 'informativo' },
  { code: '898', label: 'Impuesto ya pagado en la declaración original (declaraciones sustitutivas)', section: FORM101_SECTIONS[6], column: 'valor', kind: 'leaf' },
  { code: '902', label: 'TOTAL IMPUESTO A PAGAR (859−898)', section: FORM101_SECTIONS[6], column: 'valor', kind: 'formula', style: 'total', formula: (v) => Math.max(r2(v['859'] - v['898']), 0) },
  { code: '903', label: 'Interés por mora', section: FORM101_SECTIONS[6], column: 'valor', kind: 'leaf' },
  { code: '904', label: 'Multa', section: FORM101_SECTIONS[6], column: 'valor', kind: 'leaf' },
  { code: '999', label: 'TOTAL PAGADO', section: FORM101_SECTIONS[6], column: 'valor', kind: 'formula', style: 'resultado', formula: (v) => r2(v['902'] + v['903'] + v['904']) },
];

/** Motor PURO: dado el valor sugerido (del Mayor) de cada casilla hoja y las tarifas vigentes, calcula subtotales y totales. */
export function computeForm101Values(leafValues: Record<string, number>, rates: Form101Rates = FORM101_DEFAULT_RATES): Record<string, number> {
  const v: Record<string, number> = { __tarifaGeneral: rates.tarifaGeneral, __tarifaReinversion: rates.tarifaReinversion };
  for (const c of FORM101_CASILLAS) v[c.code] = 0;
  for (const [k, val] of Object.entries(leafValues)) v[k] = Number(val) || 0;

  for (let pass = 0; pass < 3; pass++) {
    for (const c of FORM101_CASILLAS) {
      if (c.kind === 'formula' && c.formula) v[c.code] = c.formula(v);
    }
  }
  return v;
}
