import { z } from 'zod';
import { AuthRequest } from '../types/index';
import * as svc from '../services/company.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

export const getSettings = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const settings = await svc.getCompanySettings(req.user!.companyId);
    res.json(settings);
  } catch (e: any) {
    if (e?.message === 'COMPANY_NOT_FOUND') throw AppError.notFound('Empresa no encontrada', 'COMPANY_NOT_FOUND');
    throw e;
  }
});

export const updateSettings = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    isPublicEntity: z.boolean().optional(),
    aiEnabled: z.boolean().optional(),
    name: z.string().min(1).optional(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    industry: z.string().optional().nullable(),
    settings: z.object({
      purchases: z.object({ minQuotations: z.number().int().min(1).max(3) }).partial().optional(),
      documents: z.object({
        reqPrefix: z.string().max(10),
        poPrefix: z.string().max(10),
        adjPrefix: z.string().max(10),
      }).partial().optional(),
      inventory: z.object({ requireAdjustmentApproval: z.boolean(), enableCameraScanner: z.boolean() }).partial().optional(),
      sales: z.object({
        enforceCreditLimit: z.boolean(),
        allowPartialDispatch: z.boolean(),
        // Tope de descuento por rol: porcentaje 0-100 por cada rol (roles no listados → 0%).
        maxDiscountByRole: z.record(z.string().min(1).max(40), z.number().min(0).max(100)),
        // Roles que pueden aprobar una cotización PENDING_APPROVAL (descuento fuera de tope o venta bajo costo).
        discountApproverRoles: z.array(z.string().min(1).max(40)).max(30),
      }).partial().optional(),
      security: z.object({
        sessionTimeoutMinutes: z.number().int().min(5).max(1440),
        require2FAForRoles: z.array(z.string().min(1).max(40)).max(30),
      }).partial().optional(),
      finance: z.object({
        paymentResponsableLimit: z.number().min(0),
        paymentGerencialLimit: z.number().min(0),
        dunning: z.object({
          enabled: z.boolean(),
          pauseWhenPromise: z.boolean(),
          steps: z.array(z.object({
            daysOverdue: z.number().int().min(1).max(365),
            type: z.enum(['EMAIL', 'WHATSAPP', 'CALL']),
            message: z.string().min(1).max(1000),
          })).max(10),
        }),
      }).partial().optional(),
      regional: z.object({ currencyCode: z.string().max(8), currencySymbol: z.string().max(4) }).partial().optional(),
      company: z.object({
        ruc: z.string().max(20),
        address: z.string().max(200),
        city: z.string().max(80),
        website: z.string().max(120),
      }).partial().optional(),
    }).partial().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR', parsed.error.flatten());
  const data = {
    ...parsed.data,
    email: parsed.data.email ?? undefined,
    phone: parsed.data.phone ?? undefined,
    industry: parsed.data.industry ?? undefined,
  };
  try {
    const updated = await svc.updateCompanySettings(req.user!.companyId, data);
    res.json(updated);
  } catch (e: any) {
    if (e?.message?.startsWith('ERP_CONFIG_INVALID')) throw AppError.badRequest(e.message, 'ERP_CONFIG_INVALID');
    throw e;
  }
});
