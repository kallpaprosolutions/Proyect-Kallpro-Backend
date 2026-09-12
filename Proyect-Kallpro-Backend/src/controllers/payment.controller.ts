import { z } from 'zod';
import { AuthRequest } from '../types/index';
import * as payments from '../services/payment.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

const appSchema = z.object({
  invoiceId: z.string(),
  amountApplied: z.number().positive(),
});

const createSchema = z.object({
  entityType: z.enum(['CUSTOMER', 'SUPPLIER']),
  entityId: z.string(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'CHECK', 'OTHER']),
  reference: z.string().optional(),
  totalAmount: z.number().positive(),
  notes: z.string().optional(),
  applications: z.array(appSchema).optional(),
});

const applySchema = z.object({
  paymentId: z.string(),
  invoiceId: z.string(),
  amountApplied: z.number().positive(),
});

// Traduce los códigos del servicio de pagos a AppError; null/throw si es inesperado.
function mapError(e: any): AppError | null {
  const msg: string = e?.message ?? 'Error';
  if (msg === 'PAYMENT_NOT_FOUND') return AppError.notFound('Pago no encontrado', 'PAYMENT_NOT_FOUND');
  if (msg === 'INVOICE_NOT_FOUND') return AppError.notFound('Factura no encontrada', 'INVOICE_NOT_FOUND');
  if (msg === 'INVALID_AMOUNT') return AppError.badRequest('El monto a aplicar debe ser mayor a cero', 'INVALID_AMOUNT');
  if (msg === 'APPLICATIONS_EXCEED_TOTAL') return AppError.badRequest('Las aplicaciones superan el total del pago', 'APPLICATIONS_EXCEED_TOTAL');
  if (msg === 'OVER_APPLIED_PAYMENT') return AppError.badRequest('El monto excede el remanente disponible del pago', 'OVER_APPLIED_PAYMENT');
  if (msg.startsWith('OVER_APPLIED_INVOICE')) return AppError.badRequest(`El monto excede el saldo de la factura (${msg.split(':')[1] ?? ''})`, 'OVER_APPLIED_INVOICE', msg);
  return null;
}

export const list = asyncHandler(async (req: AuthRequest, res) => {
  const items = await payments.listPayments(req.user!.companyId, {
    entityType: req.query.entityType as string | undefined,
    entityId: req.query.entityId as string | undefined,
  });
  res.json(items);
});

export const getOne = asyncHandler(async (req: AuthRequest, res) => {
  const item = await payments.getPaymentById(req.user!.companyId, req.params.id);
  if (!item) throw AppError.notFound('Pago no encontrado', 'PAYMENT_NOT_FOUND');
  res.json(item);
});

export const create = asyncHandler(async (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const payment = await payments.createPayment(req.user!.companyId, parsed.data, req.user!.userId);
    res.status(201).json(payment);
  } catch (e: any) {
    throw mapError(e) ?? e;
  }
});

export const apply = asyncHandler(async (req: AuthRequest, res) => {
  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const payment = await payments.applyPayment(
      req.user!.companyId,
      parsed.data.paymentId,
      { invoiceId: parsed.data.invoiceId, amountApplied: parsed.data.amountApplied },
      req.user!.userId,
    );
    res.json(payment);
  } catch (e: any) {
    throw mapError(e) ?? e;
  }
});
