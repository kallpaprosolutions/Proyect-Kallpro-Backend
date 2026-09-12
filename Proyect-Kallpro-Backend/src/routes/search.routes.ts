import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { search, relatedDocs } from '../controllers/search.controller';

const router = Router();
router.use(authMiddleware);
router.get('/', search);
// Smart buttons (A4): documentos vinculados a una entidad
router.get('/related/:entityType/:entityId', relatedDocs);

export default router;
