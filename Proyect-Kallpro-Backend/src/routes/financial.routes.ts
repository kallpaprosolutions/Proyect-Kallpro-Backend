import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize';
import { validateSchema } from '../middleware/validate';
import * as ctrl from '../controllers/financial.controller';
import * as creditNoteCtrl from '../controllers/credit-note.controller';
import * as debitNoteCtrl from '../controllers/debit-note.controller';
import * as journalCtrl from '../controllers/journal.controller';
import * as executiveCtrl from '../controllers/finance/executive.controller';
import * as ratiosCtrl from '../controllers/finance/ratios.controller';
import * as dcfCtrl from '../controllers/finance/dcf.controller';
import * as scenariosCtrl from '../controllers/finance/scenarios.controller';
import * as savingsCtrl from '../controllers/finance/savings.controller';
import * as sriCtrl from '../controllers/finance/sri.controller';
import * as insightsCtrl from '../controllers/finance/insights.controller';
import * as accountingCtrl from '../controllers/finance/accounting.controller';
import * as apCtrl from '../controllers/finance/ap.controller';
import * as arCtrl from '../controllers/finance/ar.controller';
import * as collectionCtrl from '../controllers/finance/collection.controller';
import * as fiscalConfigCtrl from '../controllers/finance/fiscal-config.controller';
import * as sriRetryCtrl from '../controllers/finance/sri-retry.controller';
import * as eInvoiceCtrl from '../controllers/finance/electronic-invoice.controller';
import * as eCreditNoteCtrl from '../controllers/finance/electronic-creditnote.controller';
import * as eDebitNoteCtrl from '../controllers/finance/electronic-debitnote.controller';
import * as notesCtrl from '../controllers/finance/financial-notes.controller';
import { runDunning } from '../services/finance/dunning.service';
import { asyncHandler } from '../middleware/error-handler';

const router = Router();
router.use(authMiddleware);

// Multer for financial statement uploads (PDF + Excel, up to 15 MB)
const statementUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ].includes(file.mimetype) || file.originalname.endsWith('.pdf') ||
      file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls');
    ok ? cb(null, true) : cb(new Error('Solo se permiten PDF o Excel'));
  },
});

router.get('/kpis', ctrl.getKPIs);
// Parse financial statements (PDF or Excel)
router.post(
  '/parse-statement',
  authorize('create', 'Finance'),
  statementUpload.fields([
    { name: 'balanceSheet', maxCount: 1 },
    { name: 'incomeStatement', maxCount: 1 },
  ]),
  ctrl.parseStatement,
);
router.get('/invoices', ctrl.listInvoices);
router.post('/invoices', authorize('create', 'Finance'), ctrl.addInvoice);
router.get('/invoices/:id', ctrl.getInvoice);
router.patch('/invoices/:id/status', authorize('update', 'Finance'), ctrl.updateStatus);

// Facturación electrónica SRI (Etapa 3): emitir = firma + recepción + autorización reales.
// Emitir ante el SRI es un acto tributario → mismo gate que contabilizar ('post','Journal').
router.get('/invoices/:id/sri', eInvoiceCtrl.status);
router.get('/invoices/:id/sri/xml', eInvoiceCtrl.downloadXml);
router.post('/invoices/:id/sri/emit', authorize('post', 'Journal'), eInvoiceCtrl.emit);
router.post('/invoices/:id/sri/check-authorization', authorize('post', 'Journal'), eInvoiceCtrl.checkAuthorization);

// ── Notas de Crédito de venta (Sprint 4) ──
/**
 * @openapi
 * /api/financial/invoices/{id}/creditable:
 *   get:
 *     tags: [Credit Notes]
 *     summary: Líneas de la factura elegibles para nota de crédito (cant. facturada − acreditada)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: '{ invoiceId, lines[] }' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/invoices/:id/creditable', creditNoteCtrl.getCreditable);
/**
 * @openapi
 * /api/financial/invoices/{id}/credit-notes:
 *   get:
 *     tags: [Credit Notes]
 *     summary: Lista las notas de crédito de una factura
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Array de notas de crédito }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [Credit Notes]
 *     summary: Emite una nota de crédito (anula total/parcial la factura)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason, lines]
 *             properties:
 *               reason: { type: string }
 *               restock: { type: boolean, description: 'Devuelve la mercancía a stock (default true)' }
 *               lines:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [salesOrderItemId, quantity]
 *                   properties:
 *                     salesOrderItemId: { type: string }
 *                     quantity: { type: number, minimum: 0 }
 *     responses:
 *       201: { description: Nota de crédito creada }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/invoices/:id/credit-notes', creditNoteCtrl.listForInvoice);
router.post('/invoices/:id/credit-notes', authorize('update', 'Finance'), validateSchema({ body: creditNoteCtrl.creditNoteSchema }), creditNoteCtrl.create);
/**
 * @openapi
 * /api/financial/credit-notes/{id}:
 *   get:
 *     tags: [Credit Notes]
 *     summary: Detalle de una nota de crédito
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Nota de crédito }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/credit-notes/:id', creditNoteCtrl.getOne);

// Facturación electrónica SRI de notas de crédito (Etapa 4): mismo gate que emitir facturas.
router.get('/credit-notes/:id/sri', eCreditNoteCtrl.status);
router.get('/credit-notes/:id/sri/xml', eCreditNoteCtrl.downloadXml);
router.post('/credit-notes/:id/sri/emit', authorize('post', 'Journal'), eCreditNoteCtrl.emit);
router.post('/credit-notes/:id/sri/check-authorization', authorize('post', 'Journal'), eCreditNoteCtrl.checkAuthorization);

// ── Notas de Débito de venta (Etapa 4 del plan SRI, resto) ──
// Mismo patrón que las notas de crédito: cargo adicional sobre una factura ya emitida (interés
// por mora, gasto no facturado). 'update','Finance' para crear el documento interno, 'post',
// 'Journal' para el acto tributario de emitirlo ante el SRI (mismo gate que factura/NC).
router.get('/invoices/:id/debit-notes', debitNoteCtrl.listForInvoice);
router.post('/invoices/:id/debit-notes', authorize('update', 'Finance'), validateSchema({ body: debitNoteCtrl.debitNoteSchema }), debitNoteCtrl.create);
router.get('/debit-notes/:id', debitNoteCtrl.getOne);
router.get('/debit-notes/:id/sri', eDebitNoteCtrl.status);
router.get('/debit-notes/:id/sri/xml', eDebitNoteCtrl.downloadXml);
router.post('/debit-notes/:id/sri/emit', authorize('post', 'Journal'), eDebitNoteCtrl.emit);
router.post('/debit-notes/:id/sri/check-authorization', authorize('post', 'Journal'), eDebitNoteCtrl.checkAuthorization);

// Facturación electrónica SRI — base normativa (Etapa 1): ambiente, establecimientos,
// puntos de emisión y certificado .p12. Todo bajo 'configure','Accounting' (mismo gate que
// seed-accounts/account-mappings/fiscal-periods: son ajustes estructurales de la empresa).
const certUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 }, // un .p12 típico pesa unos pocos KB
  fileFilter: (_req, file, cb) => {
    const ok = file.originalname.endsWith('.p12') || file.originalname.endsWith('.pfx');
    ok ? cb(null, true) : cb(new Error('Solo se permiten archivos .p12 o .pfx'));
  },
});
router.get('/fiscal-config', fiscalConfigCtrl.getFiscalConfig);
router.post('/fiscal-config', authorize('configure', 'Accounting'), fiscalConfigCtrl.upsertFiscalConfig);
router.post('/fiscal-config/ambiente', authorize('configure', 'Accounting'), fiscalConfigCtrl.setAmbiente);
router.get('/fiscal-config/production-checklist', fiscalConfigCtrl.getProductionChecklist);
router.post('/fiscal-config/tipo-emision', authorize('configure', 'Accounting'), fiscalConfigCtrl.setTipoEmision);
router.post('/fiscal-config/establishments', authorize('configure', 'Accounting'), fiscalConfigCtrl.createEstablishment);
router.patch('/fiscal-config/establishments/:id', authorize('configure', 'Accounting'), fiscalConfigCtrl.updateEstablishment);
router.post('/fiscal-config/establishments/:establishmentId/emission-points', authorize('configure', 'Accounting'), fiscalConfigCtrl.createEmissionPoint);
router.patch('/fiscal-config/emission-points/:id', authorize('configure', 'Accounting'), fiscalConfigCtrl.updateEmissionPoint);
router.get('/fiscal-config/certificates', fiscalConfigCtrl.listCertificates);
router.post('/fiscal-config/certificates', authorize('configure', 'Accounting'), certUpload.single('file'), fiscalConfigCtrl.uploadCertificate);
router.post('/fiscal-config/certificates/:id/deactivate', authorize('configure', 'Accounting'), fiscalConfigCtrl.deactivateCertificate);
router.post('/fiscal-config/sri-test/preview', authorize('configure', 'Accounting'), fiscalConfigCtrl.previewSignedTest);

// Cola de reintentos (Etapa 5, contingencia): comprobantes ENVIADA/RECIBIDA sin autorización
// aún — mismo gate que emitir/consultar (acto tributario).
router.get('/sri/pending', sriRetryCtrl.listPending);
router.post('/sri/retry-pending', authorize('post', 'Journal'), sriRetryCtrl.retryPending);

// Contabilidad: plan de cuentas, balanza y estados financieros
router.post('/seed-accounts', authorize('configure', 'Accounting'), accountingCtrl.seedAccounts);
router.get('/chart-of-accounts', accountingCtrl.getChart);
router.get('/trial-balance', accountingCtrl.getTrialBalance);
router.get('/trial-balance-v2', accountingCtrl.getTrialBalance2); // saldo inicial + movimientos + saldo final (+CSV)

// Períodos fiscales — cierre contable mensual (Sprint 6)
router.get('/fiscal-periods', accountingCtrl.listFiscalPeriods);
router.post('/fiscal-periods/close', authorize('configure', 'Accounting'), accountingCtrl.closeFiscalPeriod);
router.post('/fiscal-periods/reopen', authorize('configure', 'Accounting'), accountingCtrl.reopenFiscalPeriod);
router.get('/balance-sheet', accountingCtrl.getBalanceSheet);
router.get('/income-statement', accountingCtrl.getIncomeStatement);
router.get('/ledger/:accountCode', accountingCtrl.getLedger);     // mayor por cuenta (drill-down)
router.get('/cash-flow', accountingCtrl.getCashFlow);             // estado de flujo de efectivo (NIC 7)
router.get('/equity-statement', accountingCtrl.getEquityStatement); // estado de cambios en el patrimonio (NIC 1)

// Notas a los estados financieros (NIC 1, Etapa 8) — texto configurable por período
router.get('/financial-notes', notesCtrl.listNotes);
router.post('/financial-notes', authorize('update', 'Accounting'), notesCtrl.createNote);
router.patch('/financial-notes/:id', authorize('update', 'Accounting'), notesCtrl.updateNote);
router.delete('/financial-notes/:id', authorize('update', 'Accounting'), notesCtrl.deleteNote);

// Paquete NIIF/Supercías: Balance + Resultados + Cambios en Patrimonio + Flujo de Efectivo +
// Notas, en un solo PDF listo para adjuntar (la carga al portal de Supercías la hace el
// usuario — no hay API pública oficial confirmada, ver plan-contabilidad-tributaria-sri.md §3).
router.get('/financial-statements/package.pdf', accountingCtrl.exportSuperciasPackagePdf);

// Descarga de un solo reporte (pestaña "Reporte" de Contabilidad) en PDF/Excel
router.get('/balance-sheet/export.pdf', accountingCtrl.exportBalanceSheetPdf);
router.get('/balance-sheet/export.xlsx', accountingCtrl.exportBalanceSheetExcel);
router.get('/income-statement/export.pdf', accountingCtrl.exportIncomeStatementPdf);
router.get('/income-statement/export.xlsx', accountingCtrl.exportIncomeStatementExcel);
router.get('/cash-flow/export.pdf', accountingCtrl.exportCashFlowPdf);
router.get('/cash-flow/export.xlsx', accountingCtrl.exportCashFlowExcel);

// Financiero: valoración de cartera y proyección de caja
router.get('/ar-aging', accountingCtrl.getArAging);               // cartera CxC por buckets/cliente
router.get('/ap-aging', accountingCtrl.getApAging);               // pagos CxP por buckets/proveedor
router.get('/cash-flow-forecast', accountingCtrl.getCashFlowForecast); // proyección semanal de caja

// Configuración de cuentas (posting setup)
router.get('/account-mappings', accountingCtrl.getMappings);
router.patch('/account-mappings', authorize('configure', 'Accounting'), accountingCtrl.updateMapping);

// Impuestos y retenciones (TRIBUTARIO administra estos catálogos → 'update', no 'configure')
router.get('/taxes/iva', accountingCtrl.listIva);
router.post('/taxes/iva', authorize('update', 'Accounting'), accountingCtrl.upsertIva);
router.get('/taxes/retentions', accountingCtrl.listRetentions);
router.post('/taxes/retentions', authorize('update', 'Accounting'), accountingCtrl.upsertRetention);

// Journal entries (GL)
router.get('/journal-entries', journalCtrl.listJournalEntries);
router.post('/journal-entries', authorize('create', 'Journal'), accountingCtrl.createManualEntry); // asiento manual (captura, no contabiliza)
router.post('/journal-entries/:id/reverse', authorize('post', 'Journal'), accountingCtrl.reverseEntry); // reversar ya contabilizado
router.post('/journal-entries/reclassify', authorize('pay', 'Payment'), accountingCtrl.reclassifyEntry); // regularización de un mal registro (mismo gate que Pagar/Cobrar en CxP/CxC)
router.get('/journal-entries/:id', journalCtrl.getJournalEntry);
router.post('/journal-entries/:entityType/:entityId/post', authorize('post', 'Journal'), journalCtrl.postEntry);

// ── Finance v2 ──────────────────────────────────────────────────────────────

// Executive summary + 4D optimization
router.get('/executive-summary', executiveCtrl.getExecutiveSummary);
router.get('/optimization/4d', executiveCtrl.get4DOptimization);

// Ratios financieros
router.get('/ratios', ratiosCtrl.getFinancialRatios);

// DCF Valuation
router.post('/dcf/calculate', authorize('read', 'Finance'), dcfCtrl.calculateDCFHandler);
router.post('/dcf/save', authorize('create', 'Finance'), dcfCtrl.saveDCFModelHandler);
router.get('/dcf/models', dcfCtrl.listDCFModelsHandler);

// Scenarios & What-if
router.post('/scenarios/simulate', authorize('read', 'Finance'), scenariosCtrl.simulateScenario);
router.get('/scenarios/predefined', scenariosCtrl.getPredefinedScenarios);
router.post('/scenarios/save', authorize('create', 'Finance'), scenariosCtrl.saveScenarioHandler);
router.get('/scenarios', scenariosCtrl.getScenariosHandler);
router.post('/scenarios/compare', authorize('read', 'Finance'), scenariosCtrl.compareScenariosHandler);

// Savings LOGIFI™
router.get('/savings/summary', savingsCtrl.getSavingsSummaryHandler);
router.post('/savings/log', authorize('create', 'Finance'), savingsCtrl.logSavingHandler);

// SRI Ecuador
router.get('/sri/forms', sriCtrl.getSRIFormsHandler);
router.get('/sri/form-104/:period', sriCtrl.getForm104Handler);
router.get('/sri/form-103/:period', sriCtrl.getForm103Handler);
// Declaraciones por casillas SRI + tablero contable (Sprint 11)
router.get('/sri/form-104-casillas/:period', sriCtrl.getForm104CasillasHandler);
router.get('/sri/form-103-casillas/:period', sriCtrl.getForm103CasillasHandler);
// Cierre de impuestos automático (Etapa 6 del plan SRI): mismo gate que fiscal-periods/close,
// es el mismo candado contable (FiscalPeriod), solo que con el asiento de liquidación de IVA.
router.get('/sri/tax-closing/:period', sriCtrl.getTaxClosingPreviewHandler);
router.post('/sri/tax-closing/:period/close', authorize('configure', 'Accounting'), sriCtrl.closeTaxPeriodHandler);
// ATS (Anexo Transaccional Simplificado) — detalle compras/ventas/retenciones + export XML.
router.get('/sri/ats/:period', sriCtrl.getAtsReportHandler);
router.get('/sri/ats/:period/xml', sriCtrl.getAtsXmlHandler);
router.get('/accounting-panel', sriCtrl.getAccountingPanelHandler);
router.get('/sri/calendar-warnings', sriCtrl.getCalendarWarningsHandler);

// Cuentas por Pagar (CxP)
router.get('/ap/payables', apCtrl.listPayables);
router.get('/ap/kpis', apCtrl.getKpis);
router.get('/ap/aging', apCtrl.getAging);
router.post('/ap/payables/:id/pay', authorize('pay', 'Payment'), apCtrl.pay);
router.get('/ap/retentions', apCtrl.getRetentions);
router.get('/ap/credit-notes', apCtrl.getCreditNotes);
router.get('/ap/suppliers/:supplierId/statement', apCtrl.getStatement);
router.get('/ap/payables/:id/reconciliation', apCtrl.getReconciliation);

// ── CxP: priorización y programación de pagos (Fase 3) ──
router.get('/ap/payment-priority', apCtrl.getPaymentPriority);
router.post('/ap/payables/:id/schedule', authorize('pay', 'Payment'), apCtrl.schedulePayment);
router.get('/ap/scheduled', apCtrl.listScheduled);
router.delete('/ap/scheduled/:id', authorize('pay', 'Payment'), apCtrl.cancelScheduled);
router.post('/ap/scheduled/process', authorize('pay', 'Payment'), apCtrl.processScheduled);

// ── CxP: ajustes y notas de crédito (flujo real de trabajo) ──
router.post('/ap/payables/:id/write-off', authorize('pay', 'Payment'), apCtrl.writeOff);
router.get('/ap/suppliers/:supplierId/unlinked-credit-notes', apCtrl.getUnlinkedCreditNotes);
router.post('/ap/credit-notes/:id/link', authorize('pay', 'Payment'), apCtrl.linkCreditNote);
router.post('/ap/credit-notes/:id/unlink', authorize('pay', 'Payment'), apCtrl.unlinkCreditNote);

// Cuentas por Cobrar (CxC)
router.get('/ar/receivables', arCtrl.listReceivables);
router.get('/ar/kpis', arCtrl.getKpis);
router.get('/ar/aging', arCtrl.getAging);
router.post('/ar/receivables/:id/collect', authorize('pay', 'Payment'), arCtrl.collect);
router.get('/ar/credit-status/:customerId', arCtrl.getCreditStatus);
router.get('/ar/customers/:customerId/statement', arCtrl.getStatement);
router.get('/ar/receivables/:id/reconciliation', arCtrl.getReconciliation);
router.post('/ar/receivables/:id/write-off', authorize('pay', 'Payment'), arCtrl.writeOff);

// ── Gestión de cobranza (CxC) ───────────────────────────────────────────────
router.get('/ar/collection/radar', collectionCtrl.getRadar);
router.get('/ar/collection/:customerId/history', collectionCtrl.getHistory);
router.post('/ar/collection', authorize('pay', 'Payment'), collectionCtrl.logActivity); // mismo gate que el resto de la mesa de trabajo CxC
// Cobranza automática: genera los recordatorios que tocan hoy (el job diario hace lo mismo a las 07:30)
router.post('/ar/collection/run-dunning', authorize('pay', 'Payment'), asyncHandler(async (req: any, res) => {
  res.json(await runDunning(req.user!.companyId, { force: req.body?.force === true }));
}));

// AI Insights
router.get('/insights/:period', insightsCtrl.getInsightsHandler);
router.get('/insights', insightsCtrl.getInsightsHandler);

export default router;
