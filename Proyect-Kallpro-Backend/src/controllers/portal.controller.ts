import { Request } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../types/index';
import { PortalRequest } from '../middleware/portal.middleware';
import * as portal from '../services/portal.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

// ─── Public: login ────────────────────────────────────────────────────────────

export const portalLoginCtrl = asyncHandler(async (req: Request, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Email y contraseña requeridos', 'VALIDATION_ERROR');
  try {
    const result = await portal.portalLogin(parsed.data.email, parsed.data.password);
    res.json(result);
  } catch (e: any) {
    if (e?.message === 'INVALID_CREDENTIALS') throw AppError.unauthorized('Credenciales inválidas', 'INVALID_CREDENTIALS');
    if (e?.message === 'ACCOUNT_DISABLED') throw AppError.forbidden('Cuenta desactivada', 'ACCOUNT_DISABLED');
    if (e?.message === 'PORTAL_NOT_CONFIGURED') throw AppError.forbidden('Portal no configurado para este proveedor', 'PORTAL_NOT_CONFIGURED');
    throw e;
  }
});

// ─── Portal routes (requires portalAuthMiddleware) ────────────────────────────

export const portalGetRFQs = asyncHandler(async (req: PortalRequest, res) => {
  const rfqs = await portal.getRFQsForSupplier(req.supplier!.supplierId, req.supplier!.companyId);
  res.json(rfqs);
});

export const portalSubmitQuotation = asyncHandler(async (req: PortalRequest, res) => {
  const schema = z.object({
    notes: z.string().optional(),
    validUntil: z.string().optional(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().positive(),
      unitPrice: z.number().min(0),
      deliveryDays: z.number().int().min(0).optional(),
      notes: z.string().optional(),
    })).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const result = await portal.submitPortalQuotation(
      req.supplier!.supplierId,
      req.supplier!.companyId,
      req.params.requisitionId,
      parsed.data,
    );
    res.status(201).json(result);
  } catch (e: any) {
    if (e?.message === 'REQUISITION_NOT_FOUND') throw AppError.notFound('Requisición no encontrada', 'REQUISITION_NOT_FOUND');
    throw e;
  }
});

export const portalGetMyQuotations = asyncHandler(async (req: PortalRequest, res) => {
  const quotes = await portal.getMyQuotations(req.supplier!.supplierId);
  res.json(quotes);
});

export const portalGetMyOrders = asyncHandler(async (req: PortalRequest, res) => {
  const orders = await portal.getMyPurchaseOrders(req.supplier!.supplierId);
  res.json(orders);
});

// ─── ERP routes (requires authMiddleware) ─────────────────────────────────────

export const inviteSupplierCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({ password: z.string().min(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Contraseña requerida (mínimo 6 caracteres)', 'VALIDATION_ERROR');
  try {
    const result = await portal.inviteSupplierToPortal(req.params.id, req.user!.companyId, parsed.data.password);
    res.json(result);
  } catch (e: any) {
    if (e?.message === 'SUPPLIER_NOT_FOUND') throw AppError.notFound('Proveedor no encontrado', 'SUPPLIER_NOT_FOUND');
    if (e?.message === 'SUPPLIER_NO_EMAIL') throw AppError.badRequest('El proveedor no tiene email registrado', 'SUPPLIER_NO_EMAIL');
    throw e;
  }
});

export const getPortalResponsesCtrl = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const responses = await portal.getPortalResponsesForRequisition(req.params.id, req.user!.companyId);
    res.json(responses);
  } catch (e: any) {
    if (e?.message === 'REQUISITION_NOT_FOUND') throw AppError.notFound('Requisición no encontrada', 'REQUISITION_NOT_FOUND');
    throw e;
  }
});
