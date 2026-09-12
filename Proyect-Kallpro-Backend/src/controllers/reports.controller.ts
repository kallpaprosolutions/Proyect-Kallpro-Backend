import { AuthRequest } from '../types/index';
import * as reports from '../services/reports.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

// Excel exports (transmiten a `res`; un fallo se delega al errorHandler global,
// que comprueba headersSent antes de responder)
export const inventoryExcelCtrl = asyncHandler(async (req: AuthRequest, res) => {
  await reports.exportInventoryExcel(req.user!.companyId, res);
});

export const purchasesExcelCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  await reports.exportPurchasesExcel(req.user!.companyId, from, to, res);
});

export const salesExcelCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  await reports.exportSalesExcel(req.user!.companyId, from, to, res);
});

export const suppliersExcelCtrl = asyncHandler(async (req: AuthRequest, res) => {
  await reports.exportSuppliersExcel(req.user!.companyId, res);
});

export const glExcelCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  await reports.exportGLExcel(req.user!.companyId, from, to, res);
});

export const productionExcelCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  await reports.exportProductionExcel(req.user!.companyId, from, to, res);
});

// PDF exports
export const poPdfCtrl = asyncHandler(async (req: AuthRequest, res) => {
  try {
    await reports.exportPOPdf(req.params.id, req.user!.companyId, res);
  } catch (e: any) {
    if (e?.message === 'PO_NOT_FOUND') throw AppError.notFound('Orden de compra no encontrada', 'PO_NOT_FOUND');
    throw e;
  }
});

export const requisitionPdfCtrl = asyncHandler(async (req: AuthRequest, res) => {
  try {
    await reports.exportRequisitionPdf(req.params.id, req.user!.companyId, res);
  } catch (e: any) {
    if (e?.message === 'REQUISITION_NOT_FOUND') throw AppError.notFound('Requisición no encontrada', 'REQUISITION_NOT_FOUND');
    throw e;
  }
});

export const salesInvoicePdfCtrl = asyncHandler(async (req: AuthRequest, res) => {
  try {
    await reports.exportSalesInvoicePdf(req.params.id, req.user!.companyId, res);
  } catch (e: any) {
    if (e?.message === 'INVOICE_NOT_FOUND') throw AppError.notFound('Factura no encontrada', 'INVOICE_NOT_FOUND');
    throw e;
  }
});

export const creditNotePdfCtrl = asyncHandler(async (req: AuthRequest, res) => {
  try {
    await reports.exportCreditNotePdf(req.params.id, req.user!.companyId, res);
  } catch (e: any) {
    if (e?.message === 'CREDIT_NOTE_NOT_FOUND') throw AppError.notFound('Nota de crédito no encontrada', 'CREDIT_NOTE_NOT_FOUND');
    throw e;
  }
});

export const debitNotePdfCtrl = asyncHandler(async (req: AuthRequest, res) => {
  try {
    await reports.exportDebitNotePdf(req.params.id, req.user!.companyId, res);
  } catch (e: any) {
    if (e?.message === 'DEBIT_NOTE_NOT_FOUND') throw AppError.notFound('Nota de débito no encontrada', 'DEBIT_NOTE_NOT_FOUND');
    throw e;
  }
});

export const deliveryGuidePdfCtrl = asyncHandler(async (req: AuthRequest, res) => {
  try {
    await reports.exportDeliveryGuidePdf(req.params.id, req.user!.companyId, res);
  } catch (e: any) {
    if (e?.message === 'DELIVERY_GUIDE_NOT_FOUND') throw AppError.notFound('Guía de remisión no encontrada', 'DELIVERY_GUIDE_NOT_FOUND');
    throw e;
  }
});
