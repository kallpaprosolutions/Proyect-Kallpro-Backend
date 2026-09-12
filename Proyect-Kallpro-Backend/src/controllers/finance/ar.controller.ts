import { AuthRequest } from '../../types/index';
import * as ar from '../../services/finance/ar.service';
import { asyncHandler } from '../../middleware/error-handler';
import { AppError } from '../../utils/errors';
import { getReconciliationBySource } from '../../services/reconciliation.service';

export const listReceivables = asyncHandler(async (req: AuthRequest, res) => {
  const companyId = req.user!.companyId;
  const { customerId, overdue, search } = req.query as Record<string, string>;
  const list = await ar.listReceivables(companyId, {
    customerId, overdue: overdue === 'true', search,
  });
  res.json(list);
});

export const getKpis = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await ar.getArKpis(req.user!.companyId));
});

export const getAging = asyncHandler(async (req: AuthRequest, res) => {
  const { customerId } = req.query as { customerId?: string };
  res.json(await ar.getAging(req.user!.companyId, customerId));
});

export const collect = asyncHandler(async (req: AuthRequest, res) => {
  const companyId = req.user!.companyId;
  const { id } = req.params;
  const { amount, bankAccountId, reference, method } = req.body;
  if (!amount || Number(amount) <= 0) throw AppError.badRequest('El monto debe ser mayor a cero', 'VALIDATION');
  const result = await ar.collectReceivable(companyId, id, { amount: Number(amount), bankAccountId, reference, method }, req.user!.userId);
  res.status(201).json(result);
});

export const getCreditStatus = asyncHandler(async (req: AuthRequest, res) => {
  const { customerId } = req.params;
  if (!customerId) throw AppError.badRequest('Se requiere el ID del cliente', 'VALIDATION');
  res.json(await ar.getCreditStatus(req.user!.companyId, customerId));
});

export const getStatement = asyncHandler(async (req: AuthRequest, res) => {
  const { customerId } = req.params;
  res.json(await ar.getCustomerStatement(req.user!.companyId, customerId));
});

/** GET /api/financial/ar/receivables/:id/reconciliation — Fase 5: conciliación bancaria del cobro. */
export const getReconciliation = asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  res.json(await getReconciliationBySource(req.user!.companyId, 'AR_INVOICE', id));
});

export const writeOff = asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { amount, reason } = req.body as { amount?: number; reason?: string };
  if (!amount || Number(amount) <= 0) throw AppError.badRequest('El monto debe ser mayor a cero', 'VALIDATION');
  if (!reason?.trim()) throw AppError.badRequest('El motivo del ajuste es obligatorio', 'VALIDATION');
  try {
    const result = await ar.writeOffReceivable(req.user!.companyId, id, { amount: Number(amount), reason }, req.user!.userId);
    res.status(201).json(result);
  } catch (e: any) {
    if (e instanceof AppError) throw e; // preserva el 403 de aprobación por monto (Fase 4), no todo es BAD_REQUEST
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST');
  }
});
