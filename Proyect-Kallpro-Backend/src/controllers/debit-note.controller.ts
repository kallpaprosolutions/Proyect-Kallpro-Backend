import { z } from 'zod';
import { AuthRequest } from '../types/index';
import * as svc from '../services/debit-note.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

export const debitNoteSchema = z.object({
  reason: z.string().min(3, 'Indica el motivo de la nota de débito'),
  taxRate: z.number().min(0).max(100),
  concepts: z.array(z.object({
    description: z.string().min(1),
    amount: z.number().positive(),
  })).min(1),
});

export const listForInvoice = asyncHandler(async (req: AuthRequest, res) => {
  const data = await svc.getDebitNotesForInvoice(req.user!.companyId, req.params.id);
  res.json(data);
});

export const getOne = asyncHandler(async (req: AuthRequest, res) => {
  const dn = await svc.getDebitNoteById(req.user!.companyId, req.params.id);
  if (!dn) throw AppError.notFound('Nota de débito no encontrada', 'DEBIT_NOTE_NOT_FOUND');
  res.json(dn);
});

export const create = asyncHandler(async (req: AuthRequest, res) => {
  const body = req.body as z.infer<typeof debitNoteSchema>;
  try {
    const dn = await svc.createDebitNote(req.user!.companyId, req.params.id, body, req.user!.userId);
    res.status(201).json(dn);
  } catch (e: any) {
    switch (e?.message) {
      case 'INVOICE_NOT_FOUND': throw AppError.notFound('Factura no encontrada', 'INVOICE_NOT_FOUND');
      case 'INVOICE_CANCELLED': throw AppError.badRequest('La factura ya está anulada', 'INVOICE_CANCELLED');
      case 'NO_CONCEPTS': throw AppError.badRequest('Indica al menos un concepto', 'NO_CONCEPTS');
      default:
        if (typeof e?.message === 'string' && e.message.startsWith('VALIDATION: ')) {
          throw AppError.badRequest(e.message.replace('VALIDATION: ', ''), 'VALIDATION');
        }
        throw e;
    }
  }
});
