import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/rotation.controller';

const router = Router();
router.use(authMiddleware);

router.get('/analysis',  ctrl.getRotationAnalysis);
router.get('/obsolescence', ctrl.getObsolescence);
router.get('/trend',     ctrl.getMovementTrendCtrl);
router.get('/expiring',  ctrl.getExpiringCtrl);
router.get('/lots/:productId', ctrl.getLotsByProductCtrl);

export default router;
