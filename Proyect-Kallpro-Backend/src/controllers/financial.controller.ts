import { z } from 'zod';
import { AuthRequest } from '../types/index';
import * as svc from '../services/financial.service';
import { parseStatements } from '../services/financial.parser.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

export const listInvoices = asyncHandler(async (req: AuthRequest, res) => {
  const { type } = req.query as { type?: string };
  const items = await svc.getInvoices(req.user!.companyId, type);
  res.json(items);
});

export const getInvoice = asyncHandler(async (req: AuthRequest, res) => {
  const item = await svc.getInvoiceById(req.params.id, req.user!.companyId);
  if (!item) throw AppError.notFound('Not found', 'INVOICE_NOT_FOUND');
  res.json(item);
});

export const addInvoice = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    type: z.enum(['SALES', 'PURCHASE']),
    dueDate: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
      description: z.string().min(1),
      quantity: z.number().positive(),
      unitPrice: z.number().min(0),
    })).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR', parsed.error.flatten());
  const invoice = await svc.createInvoice(req.user!.companyId, {
    ...parsed.data,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
  });
  res.status(201).json(invoice);
});

export const updateStatus = asyncHandler(async (req: AuthRequest, res) => {
  const { status, paidAmount } = req.body;
  const validStatuses = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];
  if (!validStatuses.includes(status)) throw AppError.badRequest('Invalid status', 'INVALID_STATUS');
  const invoice = await svc.updateInvoiceStatus(req.params.id, req.user!.companyId, status, paidAmount, req.user!.userId);
  res.json(invoice);
});

export const getKPIs = asyncHandler(async (req: AuthRequest, res) => {
  const kpis = await svc.getFinancialKPIs(req.user!.companyId);
  res.json(kpis);
});

/**
 * POST /financial/parse-statement
 * Parses uploaded Balance Sheet and/or Income Statement (PDF or Excel).
 * Multipart fields: balanceSheet (file, optional), incomeStatement (file, optional)
 */
export const parseStatement = asyncHandler(async (req: AuthRequest, res) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const bsFile  = files?.balanceSheet?.[0]  ?? null;
  const pygFile = files?.incomeStatement?.[0] ?? null;

  if (!bsFile && !pygFile) {
    throw AppError.badRequest('Se requiere al menos un archivo (balanceSheet o incomeStatement)', 'NO_FILE_PROVIDED');
  }

  const result = await parseStatements(
    bsFile  ? bsFile.buffer  : null,
    bsFile  ? bsFile.mimetype : '',
    pygFile ? pygFile.buffer : null,
    pygFile ? pygFile.mimetype : '',
  );

  res.json(result);
});
