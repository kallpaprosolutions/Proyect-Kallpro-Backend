import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/reports.controller';

const router = Router();
router.use(authMiddleware);

// Excel exports
router.get('/inventory/excel',    ctrl.inventoryExcelCtrl);
router.get('/purchases/excel',    ctrl.purchasesExcelCtrl);
router.get('/sales/excel',        ctrl.salesExcelCtrl);
router.get('/suppliers/excel',    ctrl.suppliersExcelCtrl);
router.get('/gl/excel',           ctrl.glExcelCtrl);
router.get('/production/excel',   ctrl.productionExcelCtrl);

// PDF exports
router.get('/po/:id/pdf',          ctrl.poPdfCtrl);
router.get('/requisition/:id/pdf', ctrl.requisitionPdfCtrl);
/**
 * @openapi
 * /api/reports/sales-invoice/{id}/pdf:
 *   get:
 *     tags: [Reports]
 *     summary: PDF de la factura de venta (FAC-V) con retenciones y neto a cobrar
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: PDF (application/pdf) }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/sales-invoice/:id/pdf', ctrl.salesInvoicePdfCtrl);
/**
 * @openapi
 * /api/reports/credit-note/{id}/pdf:
 *   get:
 *     tags: [Reports]
 *     summary: PDF de la nota de crédito (NC)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: PDF (application/pdf) }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/credit-note/:id/pdf', ctrl.creditNotePdfCtrl);
router.get('/debit-note/:id/pdf', ctrl.debitNotePdfCtrl);
router.get('/delivery-guide/:id/pdf', ctrl.deliveryGuidePdfCtrl);

export default router;
