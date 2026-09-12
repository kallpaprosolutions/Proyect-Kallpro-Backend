import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/payment.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.post('/apply', ctrl.apply); // body: { paymentId, invoiceId, amountApplied }
router.get('/:id', ctrl.getOne);

export default router;
