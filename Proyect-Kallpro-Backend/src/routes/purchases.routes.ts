import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize';
import * as ctrl from '../controllers/purchases.controller';
import * as scoreCtrl from '../controllers/supplier-scoring.controller';
import * as attachCtrl from '../controllers/attachment.controller';
import { inviteSupplierCtrl, getPortalResponsesCtrl } from '../controllers/portal.controller';
import multer from 'multer';

const router = Router();
router.use(authMiddleware);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Pipeline del flujo de compras (Hub guiado)
router.get('/pipeline', ctrl.getPipeline);

// Suppliers
router.get('/suppliers/ranking',                   scoreCtrl.getSupplierRanking);
router.get('/suppliers',                            ctrl.listSuppliers);
router.post('/suppliers',                           authorize('create', 'Supplier'), ctrl.addSupplier);
router.get('/suppliers/:id/performance',            scoreCtrl.getSupplierPerformance);
router.post('/suppliers/:id/recalculate-score',     scoreCtrl.recalculateScore);
router.get('/suppliers/:id',                        ctrl.getSupplier);
router.put('/suppliers/:id',                        ctrl.editSupplier);
router.post('/suppliers/:id/invite-portal',         inviteSupplierCtrl);
router.get('/requisitions/:id/portal-responses',    getPortalResponsesCtrl);

// Orders
router.get('/orders',                              ctrl.listPOs);
router.post('/orders',                             authorize('create',  'Purchase'), ctrl.addPO);
router.get('/orders/:id',                          ctrl.getPO);
router.patch('/orders/:id/status',                 authorize('update',  'Purchase'), ctrl.updateStatus);
router.post('/orders/:id/submit',                  authorize('update',  'Purchase'), ctrl.submitPO);
router.post('/orders/:id/approve',                 authorize('approve', 'Purchase'), ctrl.approvePO);
router.post('/orders/:id/reject',                  authorize('approve', 'Purchase'), ctrl.rejectPO);
router.post('/orders/:id/receive',                 authorize('receive', 'Purchase'), ctrl.receivePO);
router.post('/orders/:id/pay-advance',             authorize('pay',     'Purchase'), ctrl.payAdvancePO);
router.post('/orders/:id/pay-balance',             authorize('pay',     'Purchase'), ctrl.payBalancePO);

// Attachments on orders
router.post('/orders/:entityId/attachments',       upload.single('file'), (req, res, next) => {
  (req.params as any).entityType = 'PURCHASE_ORDER';
  attachCtrl.uploadFile(req as any, res, next);
});
router.get('/orders/:entityId/attachments',        (req, res, next) => {
  (req.params as any).entityType = 'PURCHASE_ORDER';
  attachCtrl.listFiles(req as any, res, next);
});

export default router;
