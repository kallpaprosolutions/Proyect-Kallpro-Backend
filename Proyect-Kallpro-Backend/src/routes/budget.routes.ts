import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/budget.controller';

const router = Router();
router.use(authMiddleware);

router.get('/departments', ctrl.listDepartments);
router.post('/departments', ctrl.addDepartment);
router.get('/summary', ctrl.getBudgetSummaryCtrl);
router.get('/worksheet', ctrl.getWorksheet);
router.post('/bulk', ctrl.bulkUpsert);
router.get('/check', ctrl.checkBudget);
router.get('/', ctrl.listBudgets);
router.post('/', ctrl.upsertBudgetCtrl);

export default router;
