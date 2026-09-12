import { z } from 'zod';
import { AuthRequest } from '../types/index';
import * as sales from '../services/sales.service';
import { previewOrderWithholdings } from '../services/withholding.service';
import { CustomerKycSchema, validateKyc, toPrismaPayload } from '../schemas/uafe-kyc.schema';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

/**
 * Controlador de Ventas — migrado al patrón asyncHandler + AppError (Sprint 2.2).
 *
 * Handlers simples: sin try/catch; los códigos del servicio los traduce el errorHandler
 * global (LEGACY_ERROR_CODES). Handlers con errores parametrizados o mensajes dependientes
 * del contexto: try/catch mínimo que re-lanza un AppError ya formateado.
 * Se preservan los status codes originales para no alterar el contrato con el frontend.
 */

// ── Customers ──────────────────────────────────────────────────

export const listCustomers = asyncHandler(async (req: AuthRequest, res) => {
  const items = await sales.getCustomers(req.user!.companyId);
  res.json(items);
});

export const getCustomer = asyncHandler(async (req: AuthRequest, res) => {
  const item = await sales.getCustomerById(req.params.id, req.user!.companyId);
  if (!item) throw AppError.notFound('Cliente no encontrado', 'CUSTOMER_NOT_FOUND');
  res.json(item);
});

export const addCustomer = asyncHandler(async (req: AuthRequest, res) => {
  const parsed = CustomerKycSchema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  const kycError = validateKyc(parsed.data as any);
  if (kycError) throw AppError.badRequest(kycError, 'KYC_INVALID');
  const payload = toPrismaPayload(parsed.data);
  if (parsed.data.personType && !payload.kycCompletedAt) {
    payload.kycCompletedAt = new Date();
    payload.kycCompletedBy = req.user!.userId;
  }
  const item = await sales.createCustomer(req.user!.companyId, payload);
  res.status(201).json(item);
});

export const editCustomer = asyncHandler(async (req: AuthRequest, res) => {
  const parsed = CustomerKycSchema.partial().safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  if (parsed.data.personType) {
    const kycError = validateKyc(parsed.data as any);
    if (kycError) throw AppError.badRequest(kycError, 'KYC_INVALID');
  }
  const payload = toPrismaPayload(parsed.data as any);
  const item = await sales.updateCustomer(req.params.id, req.user!.companyId, payload, req.user!.userId);
  res.json(item);
});

// ── Quotations ─────────────────────────────────────────────────

export const listQuotations = asyncHandler(async (req: AuthRequest, res) => {
  const items = await sales.getQuotations(req.user!.companyId);
  res.json(items);
});

export const getQuotation = asyncHandler(async (req: AuthRequest, res) => {
  const item = await sales.getQuotationById(req.params.id, req.user!.companyId);
  if (!item) throw AppError.notFound('Cotización no encontrada', 'QUOTATION_NOT_FOUND');
  res.json(item);
});

export const addQuotation = asyncHandler(async (req: AuthRequest, res) => {
  const itemSchema = z.object({
    productId:   z.string(),
    description: z.string().optional(),
    quantity:    z.number().positive(),
    unitPrice:   z.number().min(0).optional(), // se ignora: el precio sale de la lista vigente
    discount:    z.number().min(0).max(100).optional(),
    taxRate:     z.number().min(0).max(100).optional(),
  });
  const schema = z.object({
    customerId: z.string(),
    validUntil: z.string().optional(),
    notes:      z.string().optional(),
    items:      z.array(itemSchema).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const item = await sales.createQuotation(req.user!.companyId, {
      ...parsed.data,
      validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : undefined,
      createdBy: req.user!.userId,
      role: req.user!.role,
    });
    res.status(201).json(item);
  } catch (e: any) {
    throw salesPricingError(e) ?? e;
  }
});

// Traduce errores de precio a AppError (status 400, igual que antes); null si no aplica.
// El descuento fuera de tope YA NO es un error: buildPricedItems lo enruta a PENDING_APPROVAL
// (ver sales.service.ts — evaluateDiscountApproval).
function salesPricingError(e: any): AppError | null {
  if (e?.message === 'NO_PRICE_AVAILABLE') return AppError.badRequest('Un producto no tiene precio en la lista vigente ni precio base', 'NO_PRICE_AVAILABLE');
  if (e?.message === 'PRODUCT_NOT_FOUND') return AppError.badRequest('Producto no encontrado', 'PRODUCT_NOT_FOUND');
  return null;
}

export const changeQuotationStatus = asyncHandler(async (req: AuthRequest, res) => {
  const { status } = req.body;
  if (!status) throw AppError.badRequest('status requerido', 'STATUS_REQUIRED');
  const item = await sales.updateQuotationStatus(req.params.id, req.user!.companyId, status);
  res.json(item);
});

// Aprobación de cotizaciones/pedidos que exceden el tope de descuento del rol o venden bajo
// costo (ErpConfig.sales.discountApproverRoles, gate `approve:Sales` — ver sales.routes.ts).
export const approveQuotationCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const item = await sales.approveQuotation(req.params.id, req.user!.companyId, req.user!.userId, req.user!.role);
  res.json(item);
});

export const rejectQuotationCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({ reason: z.string().min(1, 'El motivo es obligatorio').max(500) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Motivo de rechazo requerido', 'VALIDATION_ERROR', parsed.error.flatten());
  const item = await sales.rejectQuotation(req.params.id, req.user!.companyId, req.user!.userId, parsed.data.reason, req.user!.role);
  res.json(item);
});

export const convertQuotation = asyncHandler(async (req: AuthRequest, res) => {
  // QUOTATION_NOT_FOUND / ALREADY_CONVERTED / QUOTATION_EXPIRED los mapea el errorHandler global.
  const order = await sales.convertQuotationToOrder(req.params.id, req.user!.companyId, req.user!.userId);
  res.status(201).json(order);
});

// ── Sales Orders ───────────────────────────────────────────────

export const listOrders = asyncHandler(async (req: AuthRequest, res) => {
  const items = await sales.getSalesOrders(req.user!.companyId);
  res.json(items);
});

export const getOrder = asyncHandler(async (req: AuthRequest, res) => {
  const item = await sales.getSalesOrderById(req.params.id, req.user!.companyId);
  if (!item) throw AppError.notFound('Pedido no encontrado', 'ORDER_NOT_FOUND');
  res.json(item);
});

export const addOrder = asyncHandler(async (req: AuthRequest, res) => {
  const itemSchema = z.object({
    productId:   z.string(),
    warehouseId: z.string().optional(),
    description: z.string().optional(),
    quantity:    z.number().positive(),
    unitPrice:   z.number().min(0).optional(), // se ignora: el precio sale de la lista vigente
    discount:    z.number().min(0).max(100).optional(),
    taxRate:     z.number().min(0).max(100).optional(),
  });
  const schema = z.object({
    customerId:      z.string(),
    quotationId:     z.string().optional(),
    deliveryDate:    z.string().optional(),
    deliveryAddress: z.string().optional(),
    notes:           z.string().optional(),
    items:           z.array(itemSchema).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const item = await sales.createSalesOrder(req.user!.companyId, {
      ...parsed.data,
      deliveryDate: parsed.data.deliveryDate ? new Date(parsed.data.deliveryDate) : undefined,
      createdBy: req.user!.userId,
      role: req.user!.role,
    });
    res.status(201).json(item);
  } catch (e: any) {
    throw salesPricingError(e) ?? e;
  }
});

export const confirmOrderCtrl = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const order = await sales.confirmOrder(req.params.id, req.user!.companyId, req.user!.userId);
    res.json(order);
  } catch (e: any) {
    if (e?.message === 'ORDER_NOT_FOUND') throw AppError.notFound('Pedido no encontrado', 'ORDER_NOT_FOUND');
    if (e?.message === 'INVALID_STATUS') throw AppError.badRequest('El pedido no está en estado DRAFT', 'INVALID_STATUS');
    if (e?.message?.startsWith('STOCK_ERROR:')) throw AppError.badRequest('Stock insuficiente para uno o más productos', 'STOCK_ERROR', e.message);
    if (e?.message?.startsWith('CREDIT_LIMIT_EXCEEDED')) {
      const [, exposure, limit] = e.message.split(':');
      throw AppError.badRequest(`Límite de crédito excedido (expuesto $${exposure} / límite $${limit})`, 'CREDIT_LIMIT_EXCEEDED', e.message);
    }
    throw e;
  }
});

export const approveOrderCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const item = await sales.approveSalesOrder(req.params.id, req.user!.companyId, req.user!.userId, req.user!.role);
  res.json(item);
});

export const rejectOrderCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({ reason: z.string().min(1, 'El motivo es obligatorio').max(500) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Motivo de rechazo requerido', 'VALIDATION_ERROR', parsed.error.flatten());
  const item = await sales.rejectSalesOrder(req.params.id, req.user!.companyId, req.user!.userId, parsed.data.reason, req.user!.role);
  res.json(item);
});

export const dispatchOrderCtrl = asyncHandler(async (req: AuthRequest, res) => {
  // Body opcional para despacho PARCIAL: { items: [{ salesOrderItemId, quantity }] }.
  // Si no viene `items`, se despacha todo lo restante.
  const schema = z.object({
    items: z.array(z.object({ salesOrderItemId: z.string(), quantity: z.number().positive() })).optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const order = await sales.dispatchOrder(req.params.id, req.user!.companyId, req.user!.userId, parsed.data.items);
    res.json(order);
  } catch (e: any) {
    if (e?.message === 'ORDER_NOT_FOUND') throw AppError.notFound('Pedido no encontrado', 'ORDER_NOT_FOUND');
    if (e?.message === 'INVALID_STATUS') throw AppError.badRequest('El pedido debe estar confirmado (o parcialmente despachado) para despachar', 'INVALID_STATUS');
    if (e?.message === 'NOTHING_TO_SHIP') throw AppError.badRequest('No queda nada por despachar en este pedido', 'NOTHING_TO_SHIP');
    if (e?.message === 'INVALID_QTY') throw AppError.badRequest('La cantidad a despachar debe ser mayor a cero', 'INVALID_QTY');
    if (e?.message?.startsWith('QTY_EXCEEDS_REMAINING')) throw AppError.badRequest('La cantidad supera lo pendiente por despachar de un ítem', 'QTY_EXCEEDS_REMAINING', e.message);
    if (e?.message?.startsWith('ITEM_NOT_FOUND')) throw AppError.badRequest('Ítem de pedido no encontrado', 'ITEM_NOT_FOUND', e.message);
    throw e;
  }
});

// Preview de retenciones de un pedido (neto a cobrar antes de facturar)
export const getWithholdingPreview = asyncHandler(async (req: AuthRequest, res) => {
  // ORDER_NOT_FOUND lo mapea el errorHandler global.
  const preview = await previewOrderWithholdings(req.user!.companyId, req.params.id);
  res.json(preview);
});

// ── KPIs ───────────────────────────────────────────────────────

export const getKPIs = asyncHandler(async (req: AuthRequest, res) => {
  const kpis = await sales.getSalesKPIs(req.user!.companyId);
  res.json(kpis);
});
