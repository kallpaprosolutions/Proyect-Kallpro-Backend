import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize';
import * as ctrl from '../controllers/company.controller';

const router = Router();
router.use(authMiddleware);

router.get('/settings',   ctrl.getSettings);
router.patch('/settings', authorize('configure', 'CompanySettings'), ctrl.updateSettings);

export default router;
