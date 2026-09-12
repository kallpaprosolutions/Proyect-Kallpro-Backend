import { Router } from 'express';
import { portalAuthMiddleware } from '../middleware/portal.middleware';
import * as ctrl from '../controllers/portal.controller';

const router = Router();

// Public
router.post('/auth/login', ctrl.portalLoginCtrl);

// Authenticated portal routes
router.get('/rfqs',                              portalAuthMiddleware, ctrl.portalGetRFQs);
router.post('/rfqs/:requisitionId/quote',        portalAuthMiddleware, ctrl.portalSubmitQuotation);
router.get('/quotes',                            portalAuthMiddleware, ctrl.portalGetMyQuotations);
router.get('/orders',                            portalAuthMiddleware, ctrl.portalGetMyOrders);

export default router;
