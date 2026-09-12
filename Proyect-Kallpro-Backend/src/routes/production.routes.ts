import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/production.controller';
import * as q from '../controllers/quality.controller';

const router = Router();
router.use(authMiddleware);

// BOM
router.get('/bom',          ctrl.listBOMsCtrl);
router.post('/bom',         ctrl.createBOMCtrl);
router.get('/bom/:id',      ctrl.getBOMCtrl);
router.put('/bom/:id',      ctrl.updateBOMCtrl);

// Production Orders
router.get('/orders',                     ctrl.listOrdersCtrl);
router.post('/orders',                    ctrl.createOrderCtrl);
router.get('/orders/:id',                 ctrl.getOrderCtrl);
router.patch('/orders/:id/start',         ctrl.startOrderCtrl);
router.patch('/orders/:id/complete',      ctrl.completeOrderCtrl);
router.patch('/orders/:id/cancel',        ctrl.cancelOrderCtrl);

// MRP
router.get('/mrp',                        ctrl.mrpRequirementsCtrl);

// ── Calidad (Sprint 12 — ISO 9001 · ISO 22000 · ARCSA) ──
// Especificaciones por producto
router.get('/quality/parameters',         q.listParametersCtrl);
router.post('/quality/parameters',        q.createParameterCtrl);
router.put('/quality/parameters/:id',     q.updateParameterCtrl);
router.delete('/quality/parameters/:id',  q.deleteParameterCtrl);
// Inspecciones
router.get('/quality/inspections',        q.listInspectionsCtrl);
router.post('/quality/inspections',       q.createInspectionCtrl);
router.get('/quality/inspections/:id',    q.getInspectionCtrl);
// Liberación de lote y trazabilidad (por orden de producción)
router.patch('/orders/:id/release',       q.releaseLotCtrl);
router.get('/orders/:id/traceability',    q.traceabilityCtrl);
// No conformidades (CAPA)
router.get('/quality/non-conformities',      q.listNcCtrl);
router.post('/quality/non-conformities',     q.createNcCtrl);
router.get('/quality/non-conformities/:id',  q.getNcCtrl);
router.patch('/quality/non-conformities/:id', q.updateNcCtrl);
// Indicadores de calidad
router.get('/quality/kpis',               q.kpisCtrl);

export default router;
