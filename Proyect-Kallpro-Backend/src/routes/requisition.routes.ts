import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize';
import * as ctrl from '../controllers/requisition.controller';
import * as attachCtrl from '../controllers/attachment.controller';

const router = Router();
router.use(authMiddleware);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', ctrl.listRequisitions);
router.post('/', authorize('create', 'Requisition'), ctrl.addRequisition);
router.get('/:id', ctrl.getRequisition);
router.post('/:id/approve', authorize('approve', 'Requisition'), ctrl.approveReq);
router.post('/:id/reject', authorize('approve', 'Requisition'), ctrl.rejectReq);
router.get('/:id/quotations', ctrl.listQuotations);
router.post('/:id/quotations', ctrl.addQuotation);
router.post('/:id/select-winner', ctrl.selectWinner);

// Evaluación ponderada (pesos)
router.put('/:id/criteria', ctrl.saveCriteria);
router.post('/:id/evaluate', ctrl.evaluateQuotations);
router.put('/:id/quotations/:qid/manual-scores', ctrl.saveManualScores);

// Attachments
router.post('/:entityId/attachments', upload.single('file'), (req, res, next) => {
  (req.params as any).entityType = 'REQUISITION';
  attachCtrl.uploadFile(req as any, res, next);
});
router.get('/:entityId/attachments', (req, res, next) => {
  (req.params as any).entityType = 'REQUISITION';
  attachCtrl.listFiles(req as any, res, next);
});
router.delete('/attachments/:id', attachCtrl.deleteFile as any);
router.get('/attachments/:id/download', attachCtrl.downloadFile as any);

export default router;
