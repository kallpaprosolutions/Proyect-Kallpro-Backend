import { prisma } from '../../lib/prisma';

/**
 * Períodos fiscales — cierre contable mensual (Sprint 6, Contabilidad Pro).
 *
 * Modelo operativo (estilo Odoo "lock date", pero por mes explícito):
 *  - Un período existe como fila solo cuando alguien lo cierra (o lo reabre);
 *    los meses sin fila están ABIERTOS por defecto.
 *  - Cerrado un mes, NO se pueden crear ni reversar asientos con fecha dentro
 *    de él (assertPeriodOpen se invoca desde journal.service).
 *  - Reabrir exige permiso de configuración contable y deja huella de auditoría.
 */

export class PeriodClosedError extends Error {
  constructor(year: number, month: number) {
    super(`PERIOD_CLOSED:${year}-${String(month).padStart(2, '0')}`);
    this.name = 'PeriodClosedError';
  }
}

// Todo este módulo clasifica fechas por mes calendario en UTC, nunca en hora local
// del servidor. Las fechas "solo fecha" (YYYY-MM-DD) que llegan del frontend o de
// otros servicios se parsean como medianoche UTC; si aquí se leyera con
// getFullYear()/getMonth() (hora local), en un servidor con offset negativo (p.ej.
// Ecuador, UTC-5) el día 1 de cada mes se clasificaría como el mes ANTERIOR — un
// asiento del "01 de agosto" quedaría bloqueado por el cierre de julio. Ver Sprint 6 QA.
export function utcYearMonth(date: Date): { year: number; month: number } {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function monthRangeUTC(year: number, month: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(year, month - 1, 1)),
    to: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

/** Lanza PeriodClosedError si la fecha cae en un mes cerrado de la empresa. */
export async function assertPeriodOpen(companyId: string, date: Date): Promise<void> {
  const { year, month } = utcYearMonth(date);
  const period = await prisma.fiscalPeriod.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
    select: { status: true },
  });
  if (period?.status === 'CLOSED') throw new PeriodClosedError(year, month);
}

/**
 * Lista los últimos `monthsBack` meses con su estado efectivo (OPEN por defecto)
 * y los totales de asientos del mes, para el grid de cierres de la UI.
 */
export async function listPeriods(companyId: string, monthsBack = 18) {
  const stored = await prisma.fiscalPeriod.findMany({ where: { companyId } });
  const byKey = new Map(stored.map((p) => [`${p.year}-${p.month}`, p]));

  const nowUTC = utcYearMonth(new Date());
  const out = [];
  for (let i = 0; i < monthsBack; i++) {
    // Aritmética de meses en UTC (evita el mismo desfase de zona horaria).
    const totalMonths = nowUTC.year * 12 + (nowUTC.month - 1) - i;
    const year = Math.floor(totalMonths / 12);
    const month = (totalMonths % 12) + 1;
    const { from, to } = monthRangeUTC(year, month);

    const agg = await prisma.journalEntry.aggregate({
      where: { companyId, status: { not: 'REVERSED' }, entryDate: { gte: from, lte: to } },
      _count: { id: true },
      _sum: { totalDebit: true },
    });

    const p = byKey.get(`${year}-${month}`);
    out.push({
      year,
      month,
      status: p?.status ?? 'OPEN',
      closedAt: p?.closedAt ?? null,
      closedBy: p?.closedBy ?? null,
      reopenedAt: p?.reopenedAt ?? null,
      notes: p?.notes ?? null,
      entryCount: agg._count.id,
      totalDebit: Number(agg._sum.totalDebit ?? 0),
    });
  }
  return out;
}

/** Cierra un mes. Idempotente: cerrar un mes ya cerrado no cambia nada. */
export async function closePeriod(companyId: string, year: number, month: number, userId?: string, notes?: string) {
  if (month < 1 || month > 12) throw new Error('INVALID_MONTH');
  // No se cierran meses futuros (aún pueden recibir operaciones normales). Comparación
  // en UTC, consistente con el resto del módulo.
  const nowUTC = utcYearMonth(new Date());
  if (year > nowUTC.year || (year === nowUTC.year && month > nowUTC.month)) {
    throw new Error('CANNOT_CLOSE_FUTURE');
  }

  return prisma.fiscalPeriod.upsert({
    where: { companyId_year_month: { companyId, year, month } },
    update: { status: 'CLOSED', closedAt: new Date(), closedBy: userId ?? null, notes: notes ?? undefined },
    create: { companyId, year, month, status: 'CLOSED', closedAt: new Date(), closedBy: userId ?? null, notes: notes ?? null },
  });
}

/** Reabre un mes cerrado (deja huella de quién y cuándo). */
export async function reopenPeriod(companyId: string, year: number, month: number, userId?: string) {
  const period = await prisma.fiscalPeriod.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
  });
  if (!period || period.status !== 'CLOSED') throw new Error('PERIOD_NOT_CLOSED');
  return prisma.fiscalPeriod.update({
    where: { id: period.id },
    data: { status: 'OPEN', reopenedAt: new Date(), reopenedBy: userId ?? null },
  });
}
