import { z } from 'zod';
import { AuthRequest } from '../types/index';
import * as svc from '../services/finance/recurring-invoice.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

// Traduce errores de validación del servicio (mensajes con prefijo VALIDATION:) a AppError 400.
function templateError(e: any): AppError | null {
  if (e?.message?.startsWith('VALIDATION:')) return AppError.badRequest(e.message.replace('VALIDATION: ', ''), 'VALIDATION_ERROR');
  if (e?.message === 'RECURRING_TEMPLATE_NOT_FOUND') return AppError.notFound('Plantilla no encontrada', 'RECURRING_TEMPLATE_NOT_FOUND');
  return null;
}

const templateSchema = z.object({
  supplierId: z.string(),
  description: z.string().min(1),
  amount: z.number().positive(),
  taxCode: z.string(),
  taxRate: z.number().min(0).max(100),
  dayOfMonth: z.number().int().min(1).max(28),
  startDate: z.string(),
  endDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const listTemplates = asyncHandler(async (req: AuthRequest, res) => {
  const items = await svc.listRecurringTemplates(req.user!.companyId);
  res.json(items);
});

export const getTemplate = asyncHandler(async (req: AuthRequest, res) => {
  const item = await svc.getRecurringTemplateById(req.params.id, req.user!.companyId);
  if (!item) throw AppError.notFound('Plantilla no encontrada', 'RECURRING_TEMPLATE_NOT_FOUND');
  res.json(item);
});

export const createTemplate = asyncHandler(async (req: AuthRequest, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const item = await svc.createRecurringTemplate(req.user!.companyId, {
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
    }, req.user!.userId);
    res.status(201).json(item);
  } catch (e: any) {
    throw templateError(e) ?? e;
  }
});

export const updateTemplate = asyncHandler(async (req: AuthRequest, res) => {
  const parsed = templateSchema.partial().safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const item = await svc.updateRecurringTemplate(req.params.id, req.user!.companyId, {
      ...parsed.data,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate: parsed.data.endDate !== undefined ? (parsed.data.endDate ? new Date(parsed.data.endDate) : null) : undefined,
    });
    res.json(item);
  } catch (e: any) {
    throw templateError(e) ?? e;
  }
});

export const generateDue = asyncHandler(async (req: AuthRequest, res) => {
  const result = await svc.generateDueRecurringInvoices(req.user!.companyId, req.user!.userId);
  res.json(result);
});
