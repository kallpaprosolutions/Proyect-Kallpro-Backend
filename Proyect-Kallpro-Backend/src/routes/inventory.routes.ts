import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize';
import { validateSchema } from '../middleware/validate';
import * as ctrl from '../controllers/inventory.controller';
import * as adjCtrl from '../controllers/inventory-adjustment.controller';
import * as locCtrl from '../controllers/storage-location.controller';

const router = Router();
router.use(authMiddleware);

// Multer en memoria para imágenes (max 5 MB)
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.get('/kpis', ctrl.getKPIs);

// Valorización de inventario (contable + KPI, conciliable contra el mayor)
router.get('/valuation', ctrl.getValuation);

// Lookups rápidos por barcode / SKU
router.get('/products/by-barcode/:code', ctrl.getProductByBarcode);
router.get('/products/by-sku/:code',     ctrl.getProductBySku);

// Imagen del producto
router.post('/products/:id/image',  imageUpload.single('image'), ctrl.uploadProductImage);
router.delete('/products/:id/image', ctrl.deleteProductImage);

router.get('/categories', ctrl.listCategories);
router.post('/categories', ctrl.addCategory);
router.put('/categories/:id', ctrl.editCategory);

router.get('/warehouses', ctrl.listWarehouses);
router.get('/warehouses/tree', ctrl.getWarehouseTreeCtrl);
router.post('/warehouses', ctrl.addWarehouse);
router.put('/warehouses/:id', ctrl.editWarehouse);
router.patch('/warehouses/:id/toggle', ctrl.toggleWarehouseStatus);

// Ubicaciones físicas (layout: zona/percha/piso)
router.get('/locations', locCtrl.listLocations);
router.post('/locations', authorize('update', 'StorageLocation'), locCtrl.createLocation);
router.put('/locations/:id', authorize('update', 'StorageLocation'), locCtrl.updateLocation);
router.delete('/locations/:id', authorize('update', 'StorageLocation'), locCtrl.deleteLocation);

/**
 * @openapi
 * /api/inventory/products:
 *   get:
 *     tags: [Inventory]
 *     summary: Lista los productos de la empresa
 *     responses:
 *       200: { description: Array de productos }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/products', ctrl.listProducts);
router.get('/products/search', ctrl.searchProductsCtrl);
router.post('/products', ctrl.addProduct);
router.get('/products/:id', ctrl.getProduct);
router.put('/products/:id', ctrl.editProduct);
router.patch('/products/:id/reclassify', ctrl.reclassifyProductCtrl);

router.post('/movements', ctrl.addMovement);
router.get('/movements/:id', ctrl.getMovement);

// Ajustes de inventario con doble autorización (bodeguero solicita → finanzas/gerencia aprueba)
router.get('/adjustments', adjCtrl.listAdjustments);
router.post('/adjustments', authorize('create', 'Inventory'), adjCtrl.createAdjustment);
router.post('/adjustments/:id/approve', authorize('approve', 'Inventory'), adjCtrl.approveAdjustment);
router.post('/adjustments/:id/reject', authorize('approve', 'Inventory'), adjCtrl.rejectAdjustment);

router.get('/kardex/:productId', ctrl.getKardex);
router.get('/fifo-batches/:productId', ctrl.getFifoBatchesCtrl);
router.patch('/products/:id/valuation', ctrl.updateValuationCtrl);
router.get('/products/:id/valuation-comparison', ctrl.getValuationComparisonCtrl);

// Transferencias entre bodegas
router.post('/transfer', ctrl.transferStockCtrl);

// Reservas de stock
router.post('/reserve', ctrl.reserveStockCtrl);
router.post('/release-reservation', ctrl.releaseReservationCtrl);

/**
 * @openapi
 * /api/inventory/stock-check:
 *   post:
 *     tags: [Inventory]
 *     summary: Chequeo blando de disponibilidad (advierte sin bloquear)
 *     description: Para cotización/pedido DRAFT. Devuelve por línea onHand, reserved, available y si es suficiente.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId: { type: string }
 *                     warehouseId: { type: string, nullable: true }
 *                     quantity: { type: number, minimum: 0 }
 *     responses:
 *       200:
 *         description: Disponibilidad por línea + hasWarnings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasWarnings: { type: boolean }
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productId: { type: string }
 *                       productName: { type: string, nullable: true }
 *                       requested: { type: number }
 *                       onHand: { type: number }
 *                       reserved: { type: number }
 *                       available: { type: number }
 *                       sufficient: { type: boolean }
 *                       shortage: { type: number }
 *                       found: { type: boolean }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/stock-check', validateSchema({ body: ctrl.stockCheckSchema }), ctrl.checkStockCtrl);

// Reorden inteligente
router.get('/reorder-suggestions', ctrl.getReorderSuggestionsCtrl);

// C1 — Reabastecimiento entre bodegas (push/pull simplificado, por producto-bodega)
router.get('/replenishment-suggestions', ctrl.getReplenishmentSuggestionsCtrl);
router.post('/replenishment-suggestions/:productId/:warehouseId/transfer', authorize('update', 'Inventory'), ctrl.applySuggestedTransferCtrl);
router.post('/replenishment-suggestions/:productId/:warehouseId/requisition', authorize('create', 'Requisition'), ctrl.applySuggestedRequisitionCtrl);
router.post('/replenishment-suggestions/:productId/:warehouseId/snooze', authorize('update', 'Inventory'), ctrl.snoozeReplenishmentCtrl);
router.patch('/products/:productId/stock/:warehouseId/thresholds', authorize('update', 'Inventory'), ctrl.updateStockThresholdsCtrl);

// C2 — Panel de operaciones de inventario (recepciones/expediciones/traslados por bodega)
router.get('/operations-panel', ctrl.getOperationsPanelCtrl);

// Lotes próximos a vencer
router.get('/batches/near-expiry', ctrl.getBatchesNearExpiryCtrl);

// Conteo físico
router.get('/physical-counts', ctrl.listPhysicalCountsCtrl);
router.post('/physical-count/start', ctrl.startPhysicalCountCtrl);
router.post('/physical-count/:countId/items', ctrl.addPhysicalCountItemsCtrl);
router.post('/physical-count/:countId/finalize', ctrl.finalizePhysicalCountCtrl);

// Analytics avanzados de inventario
router.get('/analytics', ctrl.getInventoryAnalyticsCtrl);
router.get('/demand-forecast', ctrl.getDemandForecastCtrl);
router.get('/rotation-trend', ctrl.getRotationTrendCtrl);

export default router;
