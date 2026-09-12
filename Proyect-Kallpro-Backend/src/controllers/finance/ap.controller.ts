import { AuthRequest } from '../../types/index';
import * as ap from '../../services/finance/ap.service';
import { asyncHandler } from '../../middleware/error-handler';
import { AppError } from '../../utils/errors';
import { getReconciliationBySource } from '../../services/reconciliation.service';

export const listPayables = asyncHandler(async (req: AuthRequest, res) => {
  const companyId = req.user!.companyId;
  const { supplierId, overdue, search } = req.query as Record<string, string>;
  const list = await ap.listPayables(companyId, {
    supplierId, overdue: overdue === 'true', search,
  });
  res.json(list);
});

export const getKpis = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await ap.getApKpis(req.user!.companyId));
});

export const getAging = asyncHandler(async (req: AuthRequest, res) => {
  const { supplierId } = req.query as { supplierId?: string };
  res.json(await ap.getAging(req.user!.companyId, supplierId));
});

export const pay = asyncHandler(async (req: AuthRequest, res) => {
  const companyId = req.user!.companyId;
  const { id } = req.params;
  const { amount, bankAccountId, reference, method } = req.body;
  if (!amount || Number(amount) <= 0) throw AppError.badRequest('El monto debe ser mayor a cero', 'VALIDATION');
  const result = await ap.payPayable(companyId, id, { amount: Number(amount), bankAccountId, reference, method }, req.user!.userId);
  res.status(201).json(result);
});

export const getRetentions = asyncHandler(async (req: AuthRequest, res) => {
  const { supplierId } = req.query as { supplierId?: string };
  res.json(await ap.getRetentionsBySupplier(req.user!.companyId, supplierId));
});

export const getCreditNotes = asyncHandler(async (req: AuthRequest, res) => {
  const { supplierId } = req.query as { supplierId?: string };
  res.json(await ap.getSupplierCreditNotes(req.user!.companyId, supplierId));
});

export const getStatement = asyncHandler(async (req: AuthRequest, res) => {
  const { supplierId } = req.params;
  res.json(await ap.getSupplierStatement(req.user!.companyId, supplierId));
});

/** GET /api/financial/ap/payables/:id/reconciliation — Fase 5: conciliación bancaria del pago. */
export const getReconciliation = asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  res.json(await getReconciliationBySource(req.user!.companyId, 'AP_INVOICE', id));
});

// ── Fase 3: Programación y priorización de pagos ────────────────────────────

export const getPaymentPriority = asyncHandler(async (req: AuthRequest, res) => {
  res.json(await ap.getPaymentPriority(req.user!.companyId));
});

export const schedulePayment = asyncHandler(async (req: AuthRequest, res) => {
  const companyId = req.user!.companyId;
  const { id } = req.params;
  const { scheduledDate, amount, bankAccountId, notes } = req.body;
  if (!scheduledDate) throw AppError.badRequest('La fecha de programación es obligatoria', 'VALIDATION');
  if (!amount || Number(amount) <= 0) throw AppError.badRequest('El monto debe ser mayor a cero', 'VALIDATION');
  const row = await ap.schedulePayment(companyId, id, {
    scheduledDate: new Date(scheduledDate), amount: Number(amount), bankAccountId, notes,
  }, req.user!.userId);
  res.status(201).json(row);
});

export const listScheduled = asyncHandler(async (req: AuthRequest, res) => {
  const { status } = req.query as { status?: string };
  res.json(await ap.listScheduledPayments(req.user!.companyId, { status }));
});

export const cancelScheduled = asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  res.json(await ap.cancelScheduledPayment(req.user!.companyId, id));
});

export const processScheduled = asyncHandler(async (req: AuthRequest, res) => {
  const { ids } = req.body as { ids?: string[] };
  const result = await ap.processScheduledPayments(req.user!.companyId, ids, req.user!.userId);
  res.json(result);
});

// ── Ajustes, notas de crédito y flujo real de trabajo ──────────────────────

export const writeOff = asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { amount, reason } = req.body as { amount?: number; reason?: string };
  if (!amount || Number(amount) <= 0) throw AppError.badRequest('El monto debe ser mayor a cero', 'VALIDATION');
  if (!reason?.trim()) throw AppError.badRequest('El motivo del ajuste es obligatorio', 'VALIDATION');
  try {
    const result = await ap.writeOffPayable(req.user!.companyId, id, { amount: Number(amount), reason }, req.user!.userId);
    res.status(201).json(result);
  } catch (e: any) {
    if (e instanceof AppError) throw e; // preserva el 403 de aprobación por monto (Fase 4), no todo es BAD_REQUEST
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST');
  }
});

export const getUnlinkedCreditNotes = asyncHandler(async (req: AuthRequest, res) => {
  const { supplierId } = req.params;
  res.json(await ap.getUnlinkedCreditNotes(req.user!.companyId, supplierId));
});

export const linkCreditNote = asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { sriDocumentId } = req.body as { sriDocumentId?: string };
  if (!sriDocumentId) throw AppError.badRequest('sriDocumentId requerido', 'VALIDATION');
  try {
    res.json(await ap.linkCreditNoteToDocument(req.user!.companyId, id, sriDocumentId));
  } catch (e: any) {
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST');
  }
});

export const unlinkCreditNote = asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    res.json(await ap.unlinkCreditNote(req.user!.companyId, id));
  } catch (e: any) {
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST');
  }
});
