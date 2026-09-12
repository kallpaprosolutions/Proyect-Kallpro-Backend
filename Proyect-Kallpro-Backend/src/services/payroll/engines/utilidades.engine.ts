/**
 * Participación de trabajadores en las utilidades (art. 97 Código del Trabajo, Ecuador):
 * el 15% de la utilidad líquida del ejercicio se reparte así:
 *   - 10% entre todos los trabajadores, en proporción al tiempo trabajado en el año;
 *   - 5% entre los trabajadores en proporción a sus cargas familiares (cónyuge/conviviente,
 *     hijos menores de 18 o con discapacidad), también ponderado por tiempo trabajado.
 * Tope individual: 24 SBU (Ley de Justicia Laboral); el excedente se entrega al régimen de
 * prestaciones solidarias del IESS — se reporta aparte para que el contador lo transfiera.
 * Motor puro: recibe la utilidad y la lista de trabajadores, no toca BD.
 */
export interface UtilidadesWorker {
  employeeId: string;
  name: string;
  hireDate: Date;
  terminationDate?: Date | null;
  familyBurdens: number;
}

export interface UtilidadesLine {
  employeeId: string;
  name: string;
  daysWorked: number;
  familyBurdens: number;
  porTiempo: number;
  porCargas: number;
  bruto: number;
  neto: number; // con tope de 24 SBU
  excedenteIess: number;
}

export interface UtilidadesResult {
  year: number;
  utilidadLiquida: number;
  participacionTotal: number; // 15%
  fondo10: number;
  fondo5: number;
  topeIndividual: number;
  totalDiasTrabajados: number;
  totalCargasPonderadas: number;
  lines: UtilidadesLine[];
  totalNeto: number;
  totalExcedenteIess: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const DAY_MS = 86_400_000;

/** Días trabajados dentro del año calendario (inclusive), tope 365. */
export function daysWorkedInYear(hireDate: Date, terminationDate: Date | null | undefined, year: number): number {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const start = hireDate > yearStart ? hireDate : yearStart;
  const end = terminationDate && terminationDate < yearEnd ? terminationDate : yearEnd;
  if (end < start) return 0;
  const days = Math.floor((Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) - Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) / DAY_MS) + 1;
  return Math.min(365, Math.max(0, days));
}

export function computeUtilidades(args: { year: number; utilidadLiquida: number; sbu: number; workers: UtilidadesWorker[] }): UtilidadesResult {
  const { year, sbu } = args;
  const utilidadLiquida = Math.max(0, args.utilidadLiquida);
  const participacionTotal = r2(utilidadLiquida * 0.15);
  const fondo10 = r2(utilidadLiquida * 0.10);
  const fondo5 = r2(utilidadLiquida * 0.05);
  const topeIndividual = r2(24 * sbu);

  const prepared = args.workers
    .map((w) => ({ ...w, daysWorked: daysWorkedInYear(w.hireDate, w.terminationDate, year), familyBurdens: Math.max(0, Math.floor(w.familyBurdens || 0)) }))
    .filter((w) => w.daysWorked > 0);

  const totalDiasTrabajados = prepared.reduce((s, w) => s + w.daysWorked, 0);
  const totalCargasPonderadas = prepared.reduce((s, w) => s + w.familyBurdens * w.daysWorked, 0);

  const lines: UtilidadesLine[] = prepared.map((w) => {
    const porTiempo = totalDiasTrabajados > 0 ? r2(fondo10 * (w.daysWorked / totalDiasTrabajados)) : 0;
    const porCargas = totalCargasPonderadas > 0 ? r2(fondo5 * ((w.familyBurdens * w.daysWorked) / totalCargasPonderadas)) : 0;
    const bruto = r2(porTiempo + porCargas);
    const neto = Math.min(bruto, topeIndividual);
    return { employeeId: w.employeeId, name: w.name, daysWorked: w.daysWorked, familyBurdens: w.familyBurdens, porTiempo, porCargas, bruto, neto: r2(neto), excedenteIess: r2(bruto - neto) };
  });

  return {
    year, utilidadLiquida, participacionTotal, fondo10, fondo5, topeIndividual, totalDiasTrabajados, totalCargasPonderadas, lines,
    totalNeto: r2(lines.reduce((s, l) => s + l.neto, 0)),
    totalExcedenteIess: r2(lines.reduce((s, l) => s + l.excedenteIess, 0)),
  };
}
