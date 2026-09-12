import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize';
import * as ctrl from '../controllers/fixed-asset.controller';

const router = Router();
router.use(authMiddleware);

router.get('/categories',       ctrl.listCategories);
router.get('/',                 ctrl.listAssets);
router.get('/:id',              ctrl.getAsset);
router.post('/',                authorize('create', 'Accounting'), ctrl.createAsset);
router.put('/:id',              authorize('update', 'Accounting'), ctrl.updateAsset);
router.post('/:id/dispose',     authorize('update', 'Accounting'), ctrl.disposeAsset);
// Genera y CONTABILIZA (postea) el asiento de depreciación — no es solo "capturar" un
// documento como en las facturas recurrentes, así que exige el mismo gate que asientos
// manuales/confirmar factura de compra: post:Journal.
router.post('/generate-due',    authorize('post', 'Journal'), ctrl.generateDue);

export default router;
