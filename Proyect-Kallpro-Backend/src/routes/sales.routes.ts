import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize';
import * as ctrl from '../controllers/sales.controller';

const router = Router();
router.use(authMiddleware);

// KPIs
router.get('/kpis', ctrl.getKPIs);

// Customers
router.get('/customers',         ctrl.listCustomers);
router.post('/customers',        authorize('create', 'Customer'), ctrl.addCustomer);
router.get('/customers/:id',     ctrl.getCustomer);
router.put('/customers/:id',     authorize('update', 'Customer'), ctrl.editCustomer);

// Quotations
router.get('/quotations',                    ctrl.listQuotations);
router.post('/quotations',                   authorize('create', 'Sales'), ctrl.addQuotation);
router.get('/quotations/:id',                ctrl.getQuotation);
router.patch('/quotations/:id/status',       authorize('update', 'Sales'), ctrl.changeQuotationStatus);
router.post('/quotations/:id/convert',       authorize('create', 'Sales'), ctrl.convertQuotation);
router.post('/quotations/:id/approve',       authorize('approve', 'Sales'), ctrl.approveQuotationCtrl);
router.post('/quotations/:id/reject',        authorize('approve', 'Sales'), ctrl.rejectQuotationCtrl);

// Sales Orders
router.get('/orders',                        ctrl.listOrders);
router.post('/orders',                       authorize('create', 'Sales'), ctrl.addOrder);
router.get('/orders/:id',                    ctrl.getOrder);
router.get('/orders/:id/withholding-preview', ctrl.getWithholdingPreview);
router.post('/orders/:id/confirm',           authorize('update', 'Sales'), ctrl.confirmOrderCtrl);
router.post('/orders/:id/dispatch',          authorize('update', 'Sales'), ctrl.dispatchOrderCtrl);
router.post('/orders/:id/approve',           authorize('approve', 'Sales'), ctrl.approveOrderCtrl);
router.post('/orders/:id/reject',            authorize('approve', 'Sales'), ctrl.rejectOrderCtrl);

export default router;
