import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize';
import { validateSchema } from '../middleware/validate';
import * as ctrl from '../controllers/logistics.controller';
import * as guideCtrl from '../controllers/delivery-guide.controller';
import * as eGuideCtrl from '../controllers/finance/electronic-deliveryguide.controller';

const router = Router();
router.use(authMiddleware);

router.get('/kpis', ctrl.getKpis);
// Webhooks de couriers: token por empresa (rotarlo invalida el anterior de inmediato)
router.get('/webhook-token', authorize('configure', 'CompanySettings'), ctrl.getWebhookInfo);
router.post('/webhook-token/rotate', authorize('configure', 'CompanySettings'), ctrl.rotateWebhookToken);
router.get('/shipments', ctrl.list);
router.post('/shipments', authorize('create', 'Logistics'), ctrl.create);
router.get('/shipments/:id', ctrl.getOne);
router.post('/shipments/:id/events', authorize('update', 'Logistics'), ctrl.addEvent);
router.get('/by-order/:orderType/:orderId', ctrl.byOrder);
router.get('/track/:trackingNumber', ctrl.track);

// ── Guías de Remisión electrónicas (Etapa 4 del plan SRI, resto) ──
// Documentan el traslado de mercadería de un envío ya existente. Crear el documento interno
// usa el mismo gate que registrar eventos de tracking ('update','Logistics'); emitirlo ante el
// SRI es un acto tributario → mismo gate que factura/NC/ND ('post','Journal').
router.get('/shipments/:id/delivery-guides', guideCtrl.listForShipment);
router.post('/shipments/:id/delivery-guides', authorize('update', 'Logistics'), validateSchema({ body: guideCtrl.deliveryGuideSchema }), guideCtrl.create);
router.get('/delivery-guides/:id', guideCtrl.getOne);
router.get('/delivery-guides/:id/sri', eGuideCtrl.status);
router.get('/delivery-guides/:id/sri/xml', eGuideCtrl.downloadXml);
router.post('/delivery-guides/:id/sri/emit', authorize('post', 'Journal'), eGuideCtrl.emit);
router.post('/delivery-guides/:id/sri/check-authorization', authorize('post', 'Journal'), eGuideCtrl.checkAuthorization);

export default router;
