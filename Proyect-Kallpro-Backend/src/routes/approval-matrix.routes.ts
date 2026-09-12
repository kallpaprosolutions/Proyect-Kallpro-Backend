import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize';
import * as ctrl from '../controllers/approval-matrix.controller';

const router = Router();
router.use(authMiddleware);

router.get('/',        ctrl.getMatrix);
router.put('/',        authorize('configure', 'ApprovalMatrix'), ctrl.upsertMatrix);
router.post('/seed',   authorize('configure', 'ApprovalMatrix'), ctrl.seedDefault);

export default router;
