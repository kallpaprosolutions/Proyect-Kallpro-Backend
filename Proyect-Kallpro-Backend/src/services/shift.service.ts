import { prisma } from '../lib/prisma';

/**
 * Calendario de turnos de TTHH (Talento Humano).
 *
 * `ShiftTemplate` es una plantilla reutilizable (ej. "Turno mañana" 08:00-17:00);
 * `ShiftAssignment` es la tarjeta concreta de un colaborador en un día — lo que se
 * ve y se arrastra en el calendario. El biométrico real vive aparte en
 * `AttendanceRecord` (ver attendance.service.ts): el turno es lo PLANEADO, la
 * asistencia es lo REGISTRADO; el calendario los muestra juntos mas no se fusionan.
 */

function normalizeDate(date: string | Date): Date {
  const d = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : date;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Resuelve horario final de un turno: el override manual gana sobre la plantilla. */
export function resolveShiftTimes(
  template: { startTime: string; endTime: string } | null,
  overrides: { startTime?: string; endTime?: string },
): { startTime: string; endTime: string } {
  const startTime = overrides.startTime ?? template?.startTime;
  const endTime = overrides.endTime ?? template?.endTime;
  if (!startTime || !endTime) throw new Error('VALIDATION: se requiere plantilla de turno u horario manual (startTime/endTime)');
  return { startTime, endTime };
}

// ── Plantillas de turno ──
export async function listShiftTemplates(companyId: string) {
  return prisma.shiftTemplate.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
}

export async function createShiftTemplate(companyId: string, data: {
  name: string; startTime: string; endTime: string; breakMinutes?: number; color?: string;
}) {
  if (!data.name || !data.startTime || !data.endTime) {
    throw new Error('VALIDATION: nombre, hora de entrada y hora de salida son obligatorios');
  }
  return prisma.shiftTemplate.create({
    data: {
      companyId,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      breakMinutes: data.breakMinutes ?? 60,
      color: data.color,
    },
  });
}

export async function updateShiftTemplate(id: string, companyId: string, data: Partial<{
  name: string; startTime: string; endTime: string; breakMinutes: number; color: string; isActive: boolean;
}>) {
  const existing = await prisma.shiftTemplate.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error('SHIFT_TEMPLATE_NOT_FOUND');
  return prisma.shiftTemplate.update({ where: { id }, data });
}

// ── Turnos asignados (tarjetas del calendario) ──
export async function assignShift(companyId: string, createdById: string, data: {
  employeeId: string; date: string; shiftTemplateId?: string; startTime?: string; endTime?: string; notes?: string;
}) {
  if (!data.employeeId || !data.date) throw new Error('VALIDATION: employeeId y date son obligatorios');
  const employee = await prisma.employee.findFirst({ where: { id: data.employeeId, companyId } });
  if (!employee) throw new Error('EMPLOYEE_NOT_FOUND');

  let template = null;
  if (data.shiftTemplateId) {
    template = await prisma.shiftTemplate.findFirst({ where: { id: data.shiftTemplateId, companyId } });
    if (!template) throw new Error('SHIFT_TEMPLATE_NOT_FOUND');
  }
  const { startTime, endTime } = resolveShiftTimes(template, data);
  const date = normalizeDate(data.date);

  const existing = await prisma.shiftAssignment.findUnique({
    where: { companyId_employeeId_date: { companyId, employeeId: data.employeeId, date } },
  });
  if (existing) throw new Error('SHIFT_ALREADY_ASSIGNED');

  return prisma.shiftAssignment.create({
    data: {
      companyId, employeeId: data.employeeId, date, startTime, endTime,
      shiftTemplateId: data.shiftTemplateId, notes: data.notes, createdById,
    },
    include: { employee: { select: { id: true, firstName: true, lastName: true } }, shiftTemplate: true },
  });
}

/** Reprograma un turno: cambia día y/u horario (drag-and-drop en el calendario). */
export async function rescheduleShift(id: string, companyId: string, data: {
  date?: string; startTime?: string; endTime?: string; notes?: string; status?: string;
}) {
  const existing = await prisma.shiftAssignment.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error('SHIFT_NOT_FOUND');

  const nextDate = data.date ? normalizeDate(data.date) : existing.date;
  const dateChanged = nextDate.getTime() !== existing.date.getTime();
  if (dateChanged) {
    const clash = await prisma.shiftAssignment.findUnique({
      where: { companyId_employeeId_date: { companyId, employeeId: existing.employeeId, date: nextDate } },
    });
    if (clash) throw new Error('SHIFT_ALREADY_ASSIGNED');
  }

  return prisma.shiftAssignment.update({
    where: { id },
    data: {
      date: nextDate,
      startTime: data.startTime ?? existing.startTime,
      endTime: data.endTime ?? existing.endTime,
      notes: data.notes ?? existing.notes,
      status: data.status ?? existing.status,
    },
    include: { employee: { select: { id: true, firstName: true, lastName: true } }, shiftTemplate: true },
  });
}

export async function cancelShift(id: string, companyId: string) {
  const existing = await prisma.shiftAssignment.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error('SHIFT_NOT_FOUND');
  return prisma.shiftAssignment.update({ where: { id }, data: { status: 'CANCELLED' } });
}

// ── Vista de calendario (turnos + asistencia + permisos aprobados) ──
export async function getCalendar(companyId: string, from: Date, to: Date, employeeIds?: string[]) {
  const employeeFilter = employeeIds && employeeIds.length > 0 ? { employeeId: { in: employeeIds } } : {};

  const [shifts, attendance, leaves] = await Promise.all([
    prisma.shiftAssignment.findMany({
      where: { companyId, date: { gte: from, lt: to }, ...employeeFilter },
      include: { employee: { select: { id: true, firstName: true, lastName: true } }, shiftTemplate: true },
      orderBy: { date: 'asc' },
    }),
    prisma.attendanceRecord.findMany({
      where: { companyId, date: { gte: from, lt: to }, ...employeeFilter },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.leaveRequest.findMany({
      where: {
        companyId,
        status: { in: ['APROBADO', 'PENDIENTE_JEFATURA', 'PENDIENTE_TTHH'] },
        startDate: { lt: to },
        endDate: { gte: from },
        ...employeeFilter,
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { startDate: 'asc' },
    }),
  ]);

  return { shifts, attendance, leaves };
}
