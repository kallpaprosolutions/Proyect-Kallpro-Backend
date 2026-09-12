import { Request } from 'express';
import * as svc from '../services/budget.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

export const listDepartments = asyncHandler(async (req: Request, res) => {
  const data = await svc.getDepartments(req.user!.companyId);
  res.json(data);
});

export const addDepartment = asyncHandler(async (req: Request, res) => {
  const { name, code, managerId } = req.body;
  if (!name) throw AppError.badRequest('Nombre requerido', 'VALIDATION_ERROR');
  const data = await svc.createDepartment(req.user!.companyId, { name, code, managerId });
  res.status(201).json(data);
});

export const listBudgets = asyncHandler(async (req: Request, res) => {
  const { year, month } = req.query;
  const data = await svc.getBudgets(
    req.user!.companyId,
    year ? Number(year) : undefined,
    month ? Number(month) : undefined,
  );
  res.json(data);
});

export const upsertBudgetCtrl = asyncHandler(async (req: Request, res) => {
  const { departmentId, year, month, budgetAmount, notes } = req.body;
  if (!year || !month || !budgetAmount) throw AppError.badRequest('year, month y budgetAmount requeridos', 'VALIDATION_ERROR');
  const data = await svc.upsertBudget(req.user!.companyId, {
    departmentId, year: Number(year), month: Number(month),
    budgetAmount: Number(budgetAmount), notes,
  });
  res.json(data);
});

export const getBudgetSummaryCtrl = asyncHandler(async (req: Request, res) => {
  const now = new Date();
  const year = req.query.year ? Number(req.query.year) : now.getFullYear();
  const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
  const data = await svc.getBudgetSummary(req.user!.companyId, year, month);
  res.json(data);
});

export const getWorksheet = asyncHandler(async (req: Request, res) => {
  const now = new Date();
  const year = req.query.year ? Number(req.query.year) : now.getFullYear();
  const data = await svc.getAnnualWorksheet(req.user!.companyId, year);
  res.json(data);
});

export const bulkUpsert = asyncHandler(async (req: Request, res) => {
  const { departmentId, year, months } = req.body;
  if (!year || !Array.isArray(months)) throw AppError.badRequest('year y months[12] requeridos', 'VALIDATION_ERROR');
  const data = await svc.bulkUpsertBudget(req.user!.companyId, {
    departmentId: departmentId ?? null, year: Number(year), months: months.map(Number),
  });
  res.json(data);
});

export const checkBudget = asyncHandler(async (req: Request, res) => {
  const { departmentId, amount } = req.query;
  const data = await svc.checkBudgetAvailability(
    req.user!.companyId,
    departmentId as string | undefined,
    Number(amount ?? 0),
  );
  res.json(data);
});
