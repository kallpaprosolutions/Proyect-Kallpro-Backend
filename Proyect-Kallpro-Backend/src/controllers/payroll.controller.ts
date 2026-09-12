import { Request } from 'express';
import * as svc from '../services/payroll.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';
import { listCompanyUsers } from '../services/auth.service';

/** Traduce errores de dominio del servicio a AppError con mensaje claro. */
function domainError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith('VALIDATION:')) throw AppError.badRequest(msg.replace('VALIDATION: ', ''), 'VALIDATION_ERROR');
  const map: Record<string, [number, string]> = {
    EMPLOYEE_NOT_FOUND: [404, 'Empleado no encontrado'],
    DEPARTMENT_NOT_FOUND: [404, 'Departamento no encontrado'],
    MANAGER_NOT_FOUND: [404, 'El jefe seleccionado no existe'],
    USER_NOT_FOUND: [404, 'El usuario seleccionado no existe'],
    USER_ALREADY_LINKED: [409, 'Ese usuario ya está vinculado a otro empleado'],
    PERIOD_NOT_FOUND: [404, 'Período de nómina no encontrado'],
    NOVELTY_NOT_FOUND: [404, 'Novedad no encontrada'],
    PERIOD_LOCKED: [409, 'El período ya fue contabilizado; no se puede modificar'],
    PERIOD_NOT_PROCESSED: [409, 'Primero genera el rol de pagos del período'],
    PERIOD_NOT_POSTED: [409, 'Primero contabiliza el período'],
    ALREADY_PAID: [409, 'El período ya está pagado'],
    NO_EMPLOYEES: [400, 'No hay empleados activos para calcular la nómina'],
    NO_PAYSLIPS: [400, 'El período no tiene roles de pago generados'],
  };
  const hit = map[msg];
  if (hit) throw new AppError(hit[1], hit[0], msg);
  throw e;
}
const run = async <T>(fn: () => Promise<T>): Promise<T> => fn().catch(domainError);

// ── Config ──
export const getConfig = asyncHandler(async (_req: Request, res) => {
  res.json(svc.getPayrollConfig());
});

// ── Organigrama ──
const ORG_CHART_EDIT_ROLES = ['ADMIN', 'TTHH'];

export const getOrgChart = asyncHandler(async (req: Request, res) => {
  const employees = await svc.getOrgChart(req.user!.companyId);
  res.json({ employees, canEdit: ORG_CHART_EDIT_ROLES.includes(req.user!.role) });
});

export const updateOrgChartManager = asyncHandler(async (req: Request, res) => {
  const data = await run(() => svc.updateEmployee(req.params.id, req.user!.companyId, { managerId: req.body.managerId ?? null }));
  res.json(data);
});

// ── Empleados ──
export const listEmployees = asyncHandler(async (req: Request, res) => {
  const data = await svc.listEmployees(req.user!.companyId, { includeInactive: req.query.all === '1' });
  res.json(data);
});

export const createEmployee = asyncHandler(async (req: Request, res) => {
  const data = await run(() => svc.createEmployee(req.user!.companyId, req.body));
  res.status(201).json(data);
});

export const updateEmployee = asyncHandler(async (req: Request, res) => {
  const data = await run(() => svc.updateEmployee(req.params.id, req.user!.companyId, req.body));
  res.json(data);
});

// Usuarios del ERP disponibles para vincular a un empleado (selector "Usuario del sistema").
export const listLinkableUsers = asyncHandler(async (req: Request, res) => {
  const [users, linkedEmployees] = await Promise.all([
    listCompanyUsers(req.user!.companyId),
    svc.listEmployees(req.user!.companyId, { includeInactive: true }),
  ]);
  const linkedByUserId = new Map(linkedEmployees.filter((e) => e.userId).map((e) => [e.userId as string, e]));
  const data = users.map((u) => {
    const linked = linkedByUserId.get(u.id);
    return { ...u, linkedEmployeeId: linked?.id ?? null, linkedEmployeeName: linked ? `${linked.firstName} ${linked.lastName}` : null };
  });
  res.json(data);
});

// ── Períodos ──
export const listPeriods = asyncHandler(async (req: Request, res) => {
  res.json(await svc.listPeriods(req.user!.companyId));
});

export const getPeriod = asyncHandler(async (req: Request, res) => {
  const data = await run(() => svc.getPeriodDetail(req.params.id, req.user!.companyId));
  res.json(data);
});

export const generatePayroll = asyncHandler(async (req: Request, res) => {
  const { year, month } = req.body;
  if (!year || !month) throw AppError.badRequest('year y month requeridos', 'VALIDATION_ERROR');
  const data = await run(() => svc.generatePayroll(req.user!.companyId, Number(year), Number(month), req.user!.userId));
  res.json(data);
});

export const postPeriod = asyncHandler(async (req: Request, res) => {
  const data = await run(() => svc.postPeriod(req.params.id, req.user!.companyId, req.user!.userId));
  res.json(data);
});

export const payPeriod = asyncHandler(async (req: Request, res) => {
  const data = await run(() => svc.payPeriod(req.params.id, req.user!.companyId, req.user!.userId));
  res.json(data);
});

// ── Novedades ──
export const getUtilidades = asyncHandler(async (req: Request, res) => {
  const { calculateUtilidades } = await import('../services/payroll/utilidades.service');
  const year = Number(req.query.year);
  const profit = Number(req.query.profit);
  res.json(await calculateUtilidades((req as any).user!.companyId, year, profit));
});

export const addNovelty = asyncHandler(async (req: Request, res) => {
  const data = await run(() => svc.addNovelty(req.user!.companyId, req.body, req.user!.userId));
  res.status(201).json(data);
});

export const deleteNovelty = asyncHandler(async (req: Request, res) => {
  const data = await run(() => svc.deleteNovelty(req.params.id, req.user!.companyId, req.user!.userId));
  res.json(data);
});
