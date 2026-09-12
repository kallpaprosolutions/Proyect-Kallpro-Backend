import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize';
import * as ctrl from '../controllers/recurring-invoice.controller';

const router = Router();
router.use(authMiddleware);

router.get('/',                 ctrl.listTemplates);
router.get('/:id',               ctrl.getTemplate);
router.post('/',                authorize('create', 'Accounting'), ctrl.createTemplate);
router.put('/:id',              authorize('update', 'Accounting'), ctrl.updateTemplate);
// Genera el SriDocument (PENDING_REVIEW) de cada plantilla vencida — no contabiliza nada por
// sí solo, así que basta el mismo permiso de captura que crear un documento manual.
router.post('/generate-due',    authorize('create', 'Accounting'), ctrl.generateDue);

export default router;
