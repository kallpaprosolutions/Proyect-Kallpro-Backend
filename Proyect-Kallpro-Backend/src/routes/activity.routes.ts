import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getMyActivities, getAssignableUsers, getEntityActivities, postActivity,
  patchComplete, patchReopen, removeActivity,
} from '../controllers/activity.controller';

const router = Router();
router.use(authMiddleware);

// Rutas fijas ANTES de las paramétricas /:entityType/:entityId (si no, Express las confunde).
router.get('/mine', getMyActivities);
router.get('/assignable-users', getAssignableUsers);

router.get('/:entityType/:entityId', getEntityActivities);
router.post('/:entityType/:entityId', postActivity);

router.patch('/:id/complete', patchComplete);
router.patch('/:id/reopen', patchReopen);
router.delete('/:id', removeActivity);

export default router;
