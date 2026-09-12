/**
 * Parámetros de nómina — normativa Ecuador vigente 2026.
 *
 * Fuentes:
 *  - SBU 2026 = USD 482 (Acuerdo Ministerial MDT-2025-195).
 *  - Aportes IESS: personal 9,45% · patronal 11,15% + IECE 0,5% + SECAP 0,5%.
 *  - Fondos de reserva: 8,33% desde el 13.º mes de trabajo (mensual o acumulado IESS).
 *  - Décimo tercero: 1/12 de lo ganado en el año (mensualizable).
 *  - Décimo cuarto: 1 SBU por año (mensualizable) — proporcional a días trabajados.
 *  - Vacaciones: provisión 1/24 de lo ganado.
 *  - Horas extras (CT arts. 47-55): hora = sueldo/240; suplementarias +50%, extraordinarias +100%.
 *  - IR 2026: Resolución NAC-DGERCGC25-00000043 (fracción básica USD 12.208).
 *  - Rebaja gastos personales: 18% del menor entre gastos y tope por canastas
 *    (canasta básica ene-2026 = USD 821,80; 7/9/11/14/17/20 canastas según cargas; 100 si enf. catastrófica).
 */

export const PAYROLL_EC = {
  year: 2026,
  SBU: 482,
  /** Aporte personal IESS (empleado privado) */
  IESS_PERSONAL_RATE: 0.0945,
  /** Aporte patronal al Seguro General Obligatorio */
  IESS_PATRONAL_RATE: 0.1115,
  /** IECE + SECAP (0,5% c/u) — parte del costo patronal */
  IECE_SECAP_RATE: 0.01,
  /** Fondos de reserva (desde el 13.º mes) */
  RESERVE_FUND_RATE: 0.0833,
  /** Provisión mensual de vacaciones (1/24 de lo ganado) */
  VACATION_RATE: 1 / 24,
  /** Horas de la jornada mensual (CT: sueldo/240 = valor hora) */
  MONTHLY_HOURS: 240,
  /** Recargo horas suplementarias (después de jornada, hasta 24h00) */
  OVERTIME_50: 0.5,
  /** Recargo horas extraordinarias (fines de semana y feriados) */
  OVERTIME_100: 1.0,
  /** Tope legal de multas: 10% de la remuneración mensual (CT art. 44) */
  MAX_FINE_RATE: 0.10,
  /** Canasta básica familiar (INEC, enero 2026) — base de la rebaja de gastos personales */
  CANASTA_BASICA: 821.8,
  /** Rebaja gastos personales: porcentaje aplicable */
  PERSONAL_EXPENSES_REBATE_RATE: 0.18,
} as const;

/** Tabla de impuesto a la renta 2026 — personas naturales (anual, USD). */
export const IR_TABLE_2026: Array<{
  from: number; to: number | null; baseTax: number; ratePct: number;
}> = [
  { from: 0,       to: 12208,   baseTax: 0,     ratePct: 0 },
  { from: 12208,   to: 15549,   baseTax: 0,     ratePct: 5 },
  { from: 15549,   to: 20188,   baseTax: 167,   ratePct: 10 },
  { from: 20188,   to: 26700,   baseTax: 631,   ratePct: 12 },
  { from: 26700,   to: 35136,   baseTax: 1412,  ratePct: 15 },
  { from: 35136,   to: 46575,   baseTax: 2678,  ratePct: 20 },
  { from: 46575,   to: 62005,   baseTax: 4965,  ratePct: 25 },
  { from: 62005,   to: 82679,   baseTax: 8823,  ratePct: 30 },
  { from: 82679,   to: 109956,  baseTax: 15025, ratePct: 35 },
  { from: 109956,  to: null,    baseTax: 24572, ratePct: 37 },
];

/** Número de canastas básicas permitidas para la rebaja, según cargas familiares. */
export function canastasPorCargas(cargas: number): number {
  if (cargas <= 0) return 7;
  if (cargas === 1) return 9;
  if (cargas === 2) return 11;
  if (cargas === 3) return 14;
  if (cargas === 4) return 17;
  return 20; // 5 o más
}

/** Categorías de empleado del plan de nómina (jefaturas, asistentes, servicios). */
export const EMPLOYEE_CATEGORIES = ['JEFATURA', 'ASISTENTE', 'SERVICIOS'] as const;
export type EmployeeCategory = (typeof EMPLOYEE_CATEGORIES)[number];

export const NOVELTY_TYPES = [
  'HORAS_SUPLEMENTARIAS',   // +50% (cantidad en horas)
  'HORAS_EXTRAORDINARIAS',  // +100% (cantidad en horas)
  'BONO',                   // ingreso gravado IESS
  'COMISION',               // ingreso gravado IESS
  'OTRO_INGRESO',           // ingreso NO gravado (ej. viáticos no sujetos)
  'ANTICIPO',               // descuento
  'PRESTAMO_QUIROGRAFARIO', // descuento (se paga al IESS)
  'PRESTAMO_HIPOTECARIO',   // descuento (se paga al IESS)
  'PENSION_ALIMENTICIA',    // descuento (retención judicial)
  'MULTA',                  // descuento (tope 10% de la remuneración)
  'OTRO_DESCUENTO',         // descuento genérico (comisariato, seguros privados…)
] as const;
export type NoveltyType = (typeof NOVELTY_TYPES)[number];
