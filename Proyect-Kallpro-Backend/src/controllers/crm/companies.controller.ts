import { Request } from 'express';
import {
  createCrmCompany,
  getCrmCompany,
  listCrmCompanies,
  updateCrmCompany,
  validateRUC,
} from '../../services/crm/company.service';
import { asyncHandler } from '../../middleware/error-handler';
import { AppError } from '../../utils/errors';

export const createCompanyHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  if (!req.body.name) throw AppError.badRequest('name es requerido', 'VALIDATION_ERROR');
  const company = await createCrmCompany(companyId, req.body);
  res.status(201).json(company);
});

export const getCompanyHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const company = await getCrmCompany(companyId, req.params.id);
  if (!company) throw AppError.notFound('Empresa no encontrada', 'CRM_COMPANY_NOT_FOUND');
  res.json(company);
});

export const listCompaniesHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  const result = await listCrmCompanies(companyId, {
    search: req.query.search as string,
    sector: req.query.sector as string,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  });
  res.json(result);
});

export const updateCompanyHandler = asyncHandler(async (req: Request, res) => {
  const companyId = (req as any).user?.companyId;
  await updateCrmCompany(companyId, req.params.id, req.body);
  res.json({ updated: true });
});

export const validateRUCHandler = asyncHandler(async (req: Request, res) => {
  const { ruc } = req.body;
  if (!ruc) throw AppError.badRequest('ruc es requerido', 'VALIDATION_ERROR');
  const result = await validateRUC(ruc);
  res.json(result);
});
