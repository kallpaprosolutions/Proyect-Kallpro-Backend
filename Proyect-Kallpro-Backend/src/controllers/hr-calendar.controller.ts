import { Request } from 'express';
import * as shiftSvc from '../services/shift.service';
import * as leaveSvc from '../services/leave.service';
import { hasFullHrAccess, resolveVisibleEmployeeIds, getOwnEmployeeId } from '../services/hr-scope.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

/** Traduce errores de dominio del servicio a AppError con mensaje claro. */
function domainError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith('VALIDATION:')) throw AppError.badRequest(msg.replace('VALIDATION: ', ''), 'VALIDATION_ERROR');
  const map: Record<string, [number, string]> = {
    EMPLOYEE_NOT_FOUND: [404, 'Empleado no encontrado'],
    SHIFT_TEMPLATE_NOT_FOUND: [404, 'Plantilla de turno no encontrada'],
    SHIFT_NOT_FOUND: [404, 'Turno no encontrado'],
    SHIFT_ALREADY_ASSIGNED: [409, 'El colaborador ya tiene un turno asignado ese día'],
    LEAVE_REQUEST_NOT_FOUND: [404, 'Solicitud de permiso no encontrada'],
    NOT_THE_MANAGER: [403, 'No eres el jefe directo de este colaborador'],
    NOT_THE_REQUESTER: [403, 'No puedes cancelar una solicitud que no es tuya'],
    INVALID_TRANSITION: [409, 'La solicitud ya no está en un estado que permita esta acción'],
  };
  const hit = map[msg];
  if (hit) throw new AppError(hit[1], hit[0], msg);
  throw e;
}
const run = async <T>(fn: () => Promise<T>): Promise<T> => fn().catch(domainError);

// ── Calendario ──
export const getCalendar = asyncHandler(async (req: Request, res) => {
  const { companyId, userId, role } = req.user!;
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const to = req.query.to ? new Date(String(req.query.to)) : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1));
  if (isNaN(from.getTime()) || isNaN(to.getTime())) throw AppError.badRequest('Rango de fechas inválido', 'VALIDATION_ERROR');

  const visibleIds = await resolveVisibleEmployeeIds(companyId, userId, role);
  let employeeIds = visibleIds ?? undefined;
  if (req.query.employeeId) {
    const requested = String(req.query.employeeId);
    if (visibleIds !== null && !visibleIds.includes(requested)) {
      throw AppError.forbidden('No tienes acceso al calendario de ese colaborador', 'FORBIDDEN');
    }
    employeeIds = [requested];
  }

  const data = await run(() => shiftSvc.getCalendar(companyId, from, to, employeeIds));
  res.json({ ...data, canManage: hasFullHrAccess(role) });
});

// ── Plantillas de turno (solo TTHH/ADMIN, gateado en rutas) ──
export const listShiftTemplates = asyncHandler(async (req: Request, res) => {
  res.json(await shiftSvc.listShiftTemplates(req.user!.companyId));
});

export const createShiftTemplate = asyncHandler(async (req: Request, res) => {
  const data = await run(() => shiftSvc.createShiftTemplate(req.user!.companyId, req.body));
  res.status(201).json(data);
});

export const updateShiftTemplate = asyncHandler(async (req: Request, res) => {
  const data = await run(() => shiftSvc.updateShiftTemplate(req.params.id, req.user!.companyId, req.body));
  res.json(data);
});

// ── Turnos asignados (solo TTHH/ADMIN) ──
export const assignShift = asyncHandler(async (req: Request, res) => {
  const data = await run(() => shiftSvc.assignShift(req.user!.companyId, req.user!.userId, req.body));
  res.status(201).json(data);
});

export const rescheduleShift = asyncHandler(async (req: Request, res) => {
  const data = await run(() => shiftSvc.rescheduleShift(req.params.id, req.user!.companyId, req.body));
  res.json(data);
});

export const cancelShift = asyncHandler(async (req: Request, res) => {
  const data = await run(() => shiftSvc.cancelShift(req.params.id, req.user!.companyId));
  res.json(data);
});

// ── Solicitudes de permiso ──
export const createLeaveRequest = asyncHandler(async (req: Request, res) => {
  const { companyId, userId, role } = req.user!;
  const body = hasFullHrAccess(role) ? req.body : { ...req.body, employeeId: undefined };
  const data = await run(() => leaveSvc.createLeaveRequest(companyId, userId, body));
  res.status(201).json(data);
});

export const listLeaveRequests = asyncHandler(async (req: Request, res) => {
  const { companyId, userId, role } = req.user!;
  const status = req.query.status ? String(req.query.status) : undefined;
  const scope = req.query.scope ? String(req.query.scope) : undefined; // 'mine' | 'team' | (sin scope)

  // 'mine' y 'team' se resuelven siempre sobre el Employee propio del usuario, sin
  // importar el rol — un TTHH también tiene sus propias solicitudes y puede además
  // ser jefatura directa de alguien, y ninguna de esas vistas debe mostrar TODO.
  if (scope === 'mine') {
    const employeeId = await getOwnEmployeeId(companyId, userId);
    res.json(employeeId ? await leaveSvc.listLeaveRequests(companyId, { status, employeeId }) : []);
    return;
  }
  if (scope === 'team') {
    res.json(await leaveSvc.listLeaveRequests(companyId, { status, managerUserId: userId }));
    return;
  }

  // Sin scope: bandeja de TTHH (todas, con filtros opcionales) o, para el resto, las propias.
  if (hasFullHrAccess(role)) {
    const data = await leaveSvc.listLeaveRequests(companyId, { status, employeeId: req.query.employeeId ? String(req.query.employeeId) : undefined });
    res.json(data);
    return;
  }
  const visibleIds = await resolveVisibleEmployeeIds(companyId, userId, role);
  const employeeId = visibleIds && visibleIds.length > 0 ? visibleIds[0] : undefined;
  res.json(employeeId ? await leaveSvc.listLeaveRequests(companyId, { status, employeeId }) : []);
});

export const managerDecision = asyncHandler(async (req: Request, res) => {
  const { decision, comment } = req.body;
  if (decision !== 'APPROVE' && decision !== 'REJECT') throw AppError.badRequest('decision debe ser APPROVE o REJECT', 'VALIDATION_ERROR');
  const data = await run(() => leaveSvc.decideAsManager(req.user!.companyId, req.user!.userId, req.params.id, decision, comment));
  res.json(data);
});

export const hrDecision = asyncHandler(async (req: Request, res) => {
  const { decision, comment } = req.body;
  if (decision !== 'APPROVE' && decision !== 'REJECT') throw AppError.badRequest('decision debe ser APPROVE o REJECT', 'VALIDATION_ERROR');
  const data = await run(() => leaveSvc.decideAsHR(req.user!.companyId, req.user!.userId, req.params.id, decision, comment));
  res.json(data);
});

export const cancelLeaveRequest = asyncHandler(async (req: Request, res) => {
  const { companyId, userId, role } = req.user!;
  const data = await run(() => leaveSvc.cancelLeaveRequest(companyId, userId, req.params.id, hasFullHrAccess(role)));
  res.json(data);
});
