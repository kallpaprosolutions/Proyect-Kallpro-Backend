import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/price-list.controller';

const router = Router();
router.use(authMiddleware);

// Resolución de precio (autollenado en cotización/pedido)
router.get('/resolve', ctrl.resolve);
router.get('/discount-cap', ctrl.discountCap);

// CRUD de listas
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getOne);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

// Ítems de una lista
router.post('/:id/items', ctrl.upsertItem);
router.delete('/items/:itemId', ctrl.removeItem);

export default router;
