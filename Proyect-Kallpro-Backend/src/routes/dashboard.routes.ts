import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDashboard, getProcurementKPIs, getHomeSummaryHandler } from '../controllers/dashboard.controller';

const router = Router();
router.use(authMiddleware);
router.get('/', getDashboard);
router.get('/home-summary', getHomeSummaryHandler);
router.get('/procurement-kpis', getProcurementKPIs);

export default router;
