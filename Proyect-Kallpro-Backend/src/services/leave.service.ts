import { prisma } from '../lib/prisma';

/**
 * Solicitudes de permiso/vacaciones con doble aprobación: jefatura directa → TTHH.
 *
 * Máquina de estados (pura, sin BD — regla transversal 6):
 *   sin jefe asignado  → PENDIENTE_TTHH directo (TTHH actúa también como jefatura)
 *   con jefe asignado  → PENDIENTE_JEFATURA → (aprueba) → PENDIENTE_TTHH → (aprueba) → APROBADO
 *                                           → (rechaza) → RECHAZADO
 *   en cualquier etapa pendiente el propio empleado puede CANCELAR.
 */

export type LeaveStatus = 'PENDIENTE_JEFATURA' | 'PENDIENTE_TTHH' | 'APROBADO' | 'RECHAZADO' | 'CANCELADO';
export type Decision = 'APPROVE' | 'REJECT';

export function resolveInitialStatus(hasManager: boolean): LeaveStatus {
  return hasManager ? 'PENDIENTE_JEFATURA' : 'PENDIENTE_TTHH';
}

export function applyManagerDecision(currentStatus: LeaveStatus, decision: Decision): LeaveStatus {
  if (currentStatus !== 'PENDIENTE_JEFATURA') throw new Error('INVALID_TRANSITION');
  return decision === 'APPROVE' ? 'PENDIENTE_TTHH' : 'RECHAZADO';
}

export function applyHrDecision(currentStatus: LeaveStatus, decision: Decision): LeaveStatus {
  if (currentStatus !== 'PENDIENTE_TTHH') throw new Error('INVALID_TRANSITION');
  return decision === 'APPROVE' ? 'APROBADO' : 'RECHAZADO';
}

export function canCancel(status: LeaveStatus): boolean {
  return status === 'PENDIENTE_JEFATURA' || status === 'PENDIENTE_TTHH';
}

export function validateDateRange(startDate: Date, endDate: Date): void {
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) throw new Error('VALIDATION: fechas inválidas');
  if (endDate.getTime() < startDate.getTime()) throw new Error('VALIDATION: la fecha de fin no puede ser anterior a la de inicio');
}

async function getEmployeeByUserId(companyId: string, userId: string) {
  return prisma.employee.findFirst({ where: { companyId, userId } });
}

export async function createLeaveRequest(companyId: string, requesterUserId: string, data: {
  employeeId?: string; type: string; startDate: string; endDate: string; reason: string;
}) {
  if (!data.type || !data.startDate || !data.endDate || !data.reason) {
    throw new Error('VALIDATION: tipo, fechas y motivo son obligatorios');
  }
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  validateDateRange(startDate, endDate);

  const employee = data.employeeId
    ? await prisma.employee.findFirst({ where: { id: data.employeeId, companyId } })
    : await getEmployeeByUserId(companyId, requesterUserId);
  if (!employee) throw new Error('EMPLOYEE_NOT_FOUND');

  const status = resolveInitialStatus(!!employee.managerId);

  return prisma.leaveRequest.create({
    data: {
      companyId, employeeId: employee.id, type: data.type, startDate, endDate, reason: data.reason,
      status, managerId: employee.managerId ?? null,
    },
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function listLeaveRequests(companyId: string, filter: {
  employeeId?: string; status?: string; managerUserId?: string; mine?: string;
}) {
  const where: Record<string, unknown> = { companyId };
  if (filter.status) where.status = filter.status;

  if (filter.managerUserId) {
    const manager = await getEmployeeByUserId(companyId, filter.managerUserId);
    if (!manager) return [];
    where.managerId = manager.id;
  } else if (filter.employeeId) {
    where.employeeId = filter.employeeId;
  }

  return prisma.leaveRequest.findMany({
    where,
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function decideAsManager(companyId: string, actingUserId: string, leaveRequestId: string, decision: Decision, comment?: string) {
  const request = await prisma.leaveRequest.findFirst({ where: { id: leaveRequestId, companyId } });
  if (!request) throw new Error('LEAVE_REQUEST_NOT_FOUND');

  const manager = await getEmployeeByUserId(companyId, actingUserId);
  if (!manager || request.managerId !== manager.id) throw new Error('NOT_THE_MANAGER');

  const nextStatus = applyManagerDecision(request.status as LeaveStatus, decision);
  return prisma.leaveRequest.update({
    where: { id: leaveRequestId },
    data: { status: nextStatus, managerDecisionAt: new Date(), managerComment: comment },
  });
}

export async function decideAsHR(companyId: string, actingUserId: string, leaveRequestId: string, decision: Decision, comment?: string) {
  const request = await prisma.leaveRequest.findFirst({ where: { id: leaveRequestId, companyId } });
  if (!request) throw new Error('LEAVE_REQUEST_NOT_FOUND');

  const nextStatus = applyHrDecision(request.status as LeaveStatus, decision);
  return prisma.leaveRequest.update({
    where: { id: leaveRequestId },
    data: { status: nextStatus, hrDecisionById: actingUserId, hrDecisionAt: new Date(), hrComment: comment },
  });
}

export async function cancelLeaveRequest(companyId: string, actingUserId: string, leaveRequestId: string, isHR: boolean) {
  const request = await prisma.leaveRequest.findFirst({ where: { id: leaveRequestId, companyId } });
  if (!request) throw new Error('LEAVE_REQUEST_NOT_FOUND');

  if (!isHR) {
    const employee = await getEmployeeByUserId(companyId, actingUserId);
    if (!employee || employee.id !== request.employeeId) throw new Error('NOT_THE_REQUESTER');
  }
  if (!canCancel(request.status as LeaveStatus)) throw new Error('INVALID_TRANSITION');

  return prisma.leaveRequest.update({ where: { id: leaveRequestId }, data: { status: 'CANCELADO' } });
}
