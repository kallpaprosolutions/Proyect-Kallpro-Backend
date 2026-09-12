import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getOrCreatePeriod } from './payroll.service';

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Asistencia (biométrico) → horas extras de nómina.
 *
 * Normativa (Código del Trabajo):
 *  - Jornada ordinaria: 8 horas diarias (lun–vie).
 *  - Horas SUPLEMENTARIAS (+50%): las que exceden la jornada en días laborables.
 *  - Horas EXTRAORDINARIAS (+100%): las trabajadas en sábados, domingos y feriados.
 *
 * Integración: los relojes biométricos (ZKTeco y similares) exportan CSV con
 * cédula, fecha, primera marcación y última marcación. El endpoint de import
 * recibe esos registros ya parseados; `applyOvertimeToPayroll` convierte el
 * resumen del mes en novedades de nómina (reemplaza las novedades de origen
 * biométrico anteriores para que el proceso sea re-ejecutable).
 */

export const STANDARD_DAILY_HOURS = 8;
const BIOMETRIC_TAG = '[Biométrico]';

export interface AttendanceInput {
  cedula: string;
  date: string;     // YYYY-MM-DD
  checkIn: string;  // HH:mm (o ISO completo)
  checkOut: string; // HH:mm (o ISO completo)
  deviceId?: string;
}

/** Horas netas entre marcaciones, descontando 1h de almuerzo si la jornada supera 5h. */
export function netHours(checkIn: Date, checkOut: Date): number {
  const raw = (checkOut.getTime() - checkIn.getTime()) / 3600000;
  if (raw <= 0) return 0;
  return r2(raw > 5 ? raw - 1 : raw);
}

/** Clasifica las horas de un día en ordinarias / suplementarias / extraordinarias. */
export function classifyDay(date: Date, hoursWorked: number): { regular: number; supplementary: number; extraordinary: number } {
  const dow = date.getUTCDay(); // 0=domingo, 6=sábado
  if (dow === 0 || dow === 6) {
    return { regular: 0, supplementary: 0, extraordinary: r2(hoursWorked) }; // fin de semana: todo al 100%
  }
  const regular = Math.min(hoursWorked, STANDARD_DAILY_HOURS);
  return { regular: r2(regular), supplementary: r2(Math.max(0, hoursWorked - STANDARD_DAILY_HOURS)), extraordinary: 0 };
}

function parseWhen(dateStr: string, time: string): Date {
  if (time.includes('T')) return new Date(time);
  return new Date(`${dateStr}T${time.length === 5 ? time + ':00' : time}Z`);
}

export async function importAttendance(companyId: string, records: AttendanceInput[], source = 'BIOMETRIC') {
  if (!Array.isArray(records) || records.length === 0) throw new Error('VALIDATION: sin registros para importar');
  const employees = await prisma.employee.findMany({ where: { companyId }, select: { id: true, cedula: true } });
  const byCedula = new Map(employees.map((e) => [e.cedula, e.id]));

  let imported = 0;
  const skipped: string[] = [];
  for (const rec of records) {
    const employeeId = byCedula.get(String(rec.cedula).trim());
    if (!employeeId) { skipped.push(`cédula ${rec.cedula} no registrada`); continue; }
    const date = new Date(`${rec.date}T00:00:00Z`);
    if (isNaN(date.getTime())) { skipped.push(`fecha inválida ${rec.date}`); continue; }
    const checkIn = parseWhen(rec.date, rec.checkIn);
    const checkOut = parseWhen(rec.date, rec.checkOut);
    const hours = netHours(checkIn, checkOut);
    if (hours <= 0) { skipped.push(`marcaciones inválidas ${rec.cedula} ${rec.date}`); continue; }

    await prisma.attendanceRecord.upsert({
      where: { companyId_employeeId_date: { companyId, employeeId, date } },
      update: { checkIn, checkOut, hoursWorked: new Prisma.Decimal(hours), source, deviceId: rec.deviceId ?? null },
      create: {
        companyId, employeeId, date, checkIn, checkOut,
        hoursWorked: new Prisma.Decimal(hours), source, deviceId: rec.deviceId ?? null,
      },
    });
    imported++;
  }
  return { imported, skipped };
}

export async function getMonthlySummary(companyId: string, year: number, month: number) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  const records = await prisma.attendanceRecord.findMany({
    where: { companyId, date: { gte: from, lt: to } },
    include: { employee: { select: { id: true, firstName: true, lastName: true, cedula: true } } },
    orderBy: { date: 'asc' },
  });

  const byEmployee = new Map<string, {
    employee: { id: string; firstName: string; lastName: string; cedula: string };
    days: number; totalHours: number; supplementary: number; extraordinary: number;
  }>();
  for (const rec of records) {
    const agg = byEmployee.get(rec.employeeId) ?? {
      employee: rec.employee, days: 0, totalHours: 0, supplementary: 0, extraordinary: 0,
    };
    const hours = Number(rec.hoursWorked);
    const cls = classifyDay(rec.date, hours);
    agg.days += 1;
    agg.totalHours = r2(agg.totalHours + hours);
    agg.supplementary = r2(agg.supplementary + cls.supplementary);
    agg.extraordinary = r2(agg.extraordinary + cls.extraordinary);
    byEmployee.set(rec.employeeId, agg);
  }
  return Array.from(byEmployee.values());
}

/**
 * Convierte el resumen del mes en novedades de nómina (idempotente: elimina
 * las novedades biométricas previas del período antes de crear las nuevas).
 */
export async function applyOvertimeToPayroll(companyId: string, year: number, month: number, userId?: string) {
  const summary = await getMonthlySummary(companyId, year, month);
  const period = await getOrCreatePeriod(companyId, year, month, userId);
  if (period.status === 'POSTED' || period.status === 'PAID') throw new Error('PERIOD_LOCKED');

  await prisma.payrollNovelty.deleteMany({
    where: { periodId: period.id, notes: { contains: BIOMETRIC_TAG } },
  });

  let created = 0;
  for (const row of summary) {
    if (row.supplementary > 0) {
      await prisma.payrollNovelty.create({
        data: {
          companyId, periodId: period.id, employeeId: row.employee.id,
          type: 'HORAS_SUPLEMENTARIAS', hours: new Prisma.Decimal(row.supplementary),
          notes: `${BIOMETRIC_TAG} ${row.days} días marcados`, createdBy: userId,
        },
      });
      created++;
    }
    if (row.extraordinary > 0) {
      await prisma.payrollNovelty.create({
        data: {
          companyId, periodId: period.id, employeeId: row.employee.id,
          type: 'HORAS_EXTRAORDINARIAS', hours: new Prisma.Decimal(row.extraordinary),
          notes: `${BIOMETRIC_TAG} fines de semana/feriados`, createdBy: userId,
        },
      });
      created++;
    }
  }
  return { periodId: period.id, noveltiesCreated: created, employees: summary.length };
}
