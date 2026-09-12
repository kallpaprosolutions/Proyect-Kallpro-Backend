import { z } from 'zod';
import { AuthRequest } from '../types/index';
import * as svc from '../services/credit-note.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

export const creditNoteSchema = z.object({
  reason: z.string().min(3, 'Indica el motivo de la nota de crédito'),
  restock: z.boolean().optional(),
  lines: z.array(z.object({
    salesOrderItemId: z.string().min(1),
    quantity: z.number().positive(),
  })).min(1),
});

/** Líneas elegibles para NC de una factura (alimenta el modal). */
export const getCreditable = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const data = await svc.getCreditableLines(req.user!.companyId, req.params.id);
    res.json(data);
  } catch (e: any) {
    if (e?.message === 'INVOICE_NOT_FOUND') throw AppError.notFound('Factura no encontrada', 'INVOICE_NOT_FOUND');
    throw e;
  }
});

export const listForInvoice = asyncHandler(async (req: AuthRequest, res) => {
  const data = await svc.getCreditNotesForInvoice(req.user!.companyId, req.params.id);
  res.json(data);
});

export const getOne = asyncHandler(async (req: AuthRequest, res) => {
  const cn = await svc.getCreditNoteById(req.user!.companyId, req.params.id);
  if (!cn) throw AppError.notFound('Nota de crédito no encontrada', 'CREDIT_NOTE_NOT_FOUND');
  res.json(cn);
});

export const create = asyncHandler(async (req: AuthRequest, res) => {
  // body validado por validateSchema en la ruta
  const body = req.body as z.infer<typeof creditNoteSchema>;
  try {
    const cn = await svc.createCreditNote(req.user!.companyId, req.params.id, body, req.user!.userId);
    res.status(201).json(cn);
  } catch (e: any) {
    switch (e?.message) {
      case 'INVOICE_NOT_FOUND': throw AppError.notFound('Factura no encontrada', 'INVOICE_NOT_FOUND');
      case 'INVOICE_CANCELLED': throw AppError.badRequest('La factura ya está anulada', 'INVOICE_CANCELLED');
      case 'INVOICE_NO_ORDER': throw AppError.badRequest('Solo se pueden acreditar facturas originadas de un pedido de venta', 'INVOICE_NO_ORDER');
      case 'ORDER_ITEM_NOT_FOUND': throw AppError.badRequest('Una línea no corresponde a la factura', 'ORDER_ITEM_NOT_FOUND');
      case 'INVALID_QTY': throw AppError.badRequest('La cantidad debe ser mayor a cero', 'INVALID_QTY');
      case 'NC_EXCEEDS_INVOICED': throw AppError.badRequest('La cantidad supera lo facturado pendiente de acreditar', 'NC_EXCEEDS_INVOICED');
      case 'NO_LINES': throw AppError.badRequest('Indica al menos una línea a acreditar', 'NO_LINES');
      default: throw e;
    }
  }
});
