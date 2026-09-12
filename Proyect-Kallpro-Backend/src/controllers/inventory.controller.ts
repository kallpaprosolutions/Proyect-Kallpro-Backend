import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { AuthRequest } from '../types/index';
import * as inv from '../services/inventory.service';
import { asyncHandler } from '../middleware/error-handler';
import { AppError } from '../utils/errors';

// ─────────── Lookups rápidos ───────────

export const getProductByBarcode = asyncHandler(async (req: AuthRequest, res) => {
  const { code } = req.params;
  if (!code) throw AppError.badRequest('barcode requerido', 'VALIDATION_ERROR');
  const item = await inv.getProductByBarcode(req.user!.companyId, code);
  // Respuesta 404 con campo `barcode` top-level (shape preservado).
  if (!item) { res.status(404).json({ error: 'Producto no encontrado por barcode', barcode: code }); return; }
  res.json(item);
});

export const getProductBySku = asyncHandler(async (req: AuthRequest, res) => {
  const { code } = req.params;
  if (!code) throw AppError.badRequest('sku requerido', 'VALIDATION_ERROR');
  const item = await inv.getProductBySku(req.user!.companyId, code);
  // Respuesta 404 con campo `sku` top-level (shape preservado).
  if (!item) { res.status(404).json({ error: 'Producto no encontrado por SKU', sku: code }); return; }
  res.json(item);
});

// ─────────── Image upload ───────────

const ALLOWED_IMG = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

export const uploadProductImage = asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) throw AppError.badRequest('No se recibió archivo', 'NO_FILE');
  if (!ALLOWED_IMG.includes(file.mimetype)) throw AppError.badRequest('Formato inválido. Use PNG, JPG, WEBP o GIF.', 'INVALID_IMAGE_FORMAT');
  if (file.size > 5 * 1024 * 1024) throw AppError.badRequest('Imagen demasiado grande (máx 5 MB)', 'IMAGE_TOO_LARGE');
  const product = await inv.getProductById(id, req.user!.companyId);
  if (!product) throw AppError.notFound('Producto no encontrado', 'PRODUCT_NOT_FOUND');

  // Guardar en uploads/{companyId}/products/{id}.{ext}
  const ext = file.mimetype.split('/')[1].replace('jpeg', 'jpg');
  const dir = path.join(process.cwd(), 'uploads', req.user!.companyId, 'products');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${id}-${Date.now()}.${ext}`;
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, file.buffer);

  // URL pública servida por express.static
  const publicUrl = `/uploads/${req.user!.companyId}/products/${filename}`;

  // Borrar imagen anterior si existía
  if (product.imageUrl) {
    try {
      const oldPath = path.join(process.cwd(), product.imageUrl.replace(/^\/+/, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    } catch {}
  }

  const updated = await inv.updateProduct(id, req.user!.companyId, { imageUrl: publicUrl }, req.user!.userId);
  res.json(updated);
});

export const deleteProductImage = asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const product = await inv.getProductById(id, req.user!.companyId);
  if (!product) throw AppError.notFound('Producto no encontrado', 'PRODUCT_NOT_FOUND');
  if (product.imageUrl) {
    try {
      const oldPath = path.join(process.cwd(), product.imageUrl.replace(/^\/+/, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    } catch {}
  }
  const updated = await inv.updateProduct(id, req.user!.companyId, { imageUrl: null }, req.user!.userId);
  res.json(updated);
});

// CATEGORÍAS
export const listCategories = asyncHandler(async (req: AuthRequest, res) => {
  const items = await inv.getCategories(req.user!.companyId);
  res.json(items);
});

export const addCategory = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({ name: z.string().min(1), description: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR');
  const item = await inv.createCategory(req.user!.companyId, parsed.data);
  res.status(201).json(item);
});

// BODEGAS
export const listWarehouses = asyncHandler(async (req: AuthRequest, res) => {
  const items = await inv.getWarehouses(req.user!.companyId);
  res.json(items);
});

export const addWarehouse = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({ name: z.string().min(1), code: z.string().optional(), address: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR');
  const item = await inv.createWarehouse(req.user!.companyId, parsed.data);
  res.status(201).json(item);
});

export const editWarehouse = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    code: z.string().optional(),
    address: z.string().optional(),
    isDefault: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const item = await inv.updateWarehouse(req.params.id, req.user!.companyId, parsed.data);
    res.json(item);
  } catch (e: any) {
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST'); // default original: 400
  }
});

export const toggleWarehouseStatus = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const item = await inv.toggleWarehouse(req.params.id, req.user!.companyId);
    res.json(item);
  } catch (e: any) {
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST');
  }
});

export const editCategory = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({ name: z.string().min(1).optional(), description: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR');
  try {
    const item = await inv.updateCategory(req.params.id, req.user!.companyId, parsed.data);
    res.json(item);
  } catch (e: any) {
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST');
  }
});

export const reclassifyProductCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({ categoryId: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('categoryId inválido', 'VALIDATION_ERROR');
  try {
    const item = await inv.reclassifyProduct(req.params.id, req.user!.companyId, parsed.data.categoryId);
    res.json(item);
  } catch (e: any) {
    throw AppError.badRequest(e?.message ?? 'Error', 'BAD_REQUEST');
  }
});

// PRODUCTOS
export const listProducts = asyncHandler(async (req: AuthRequest, res) => {
  const items = await inv.getProducts(req.user!.companyId);
  res.json(items);
});

// Búsqueda ligera para comboboxes: /products/search?q=&limit=
export const searchProductsCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const q = (req.query.q as string) || '';
  const limit = Number(req.query.limit ?? 20);
  const items = await inv.searchProducts(req.user!.companyId, q, limit);
  res.json(items);
});

export const getProduct = asyncHandler(async (req: AuthRequest, res) => {
  const item = await inv.getProductById(req.params.id, req.user!.companyId);
  if (!item) throw AppError.notFound('Not found', 'PRODUCT_NOT_FOUND');
  res.json(item);
});

export const addProduct = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    sku: z.string().optional(),
    barcode: z.string().optional(),
    name: z.string().min(1),
    description: z.string().optional(),
    categoryId: z.string().optional(),
    unit: z.string().optional(),
    // Unidad de compra ≠ venta (C3): null/omitido = sin distinción, comportamiento de siempre.
    purchaseUnit: z.string().optional(),
    purchaseConversionFactor: z.number().positive().optional(),
    type: z.enum(['PRODUCT', 'SERVICE']).optional(), // distingue bienes vs servicios (retenciones)
    salePrice: z.number().min(0),
    avgCost: z.number().min(0).optional(),
    standardCost: z.number().min(0).optional(),
    valuationMethod: z.enum(['AVG', 'FIFO', 'LIFO', 'STANDARD_COST']).optional(),
    minStock: z.number().min(0).optional(),
    maxStock: z.number().min(0).optional(),
    reorderPoint: z.number().min(0).optional(),
    imageUrl: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR', parsed.error.flatten());
  const item = await inv.createProduct(req.user!.companyId, parsed.data);
  res.status(201).json(item);
});

export const editProduct = asyncHandler(async (req: AuthRequest, res) => {
  const item = await inv.updateProduct(req.params.id, req.user!.companyId, req.body, req.user!.userId);
  res.json(item);
});

// MOVIMIENTOS
export const addMovement = asyncHandler(async (req: AuthRequest, res) => {
  // Los ajustes (ADJUSTMENT_*) ya NO se aplican directamente aquí: deben pasar por el
  // flujo de doble autorización (POST /inventory/adjustments). Esto evita que un atajo
  // mueva stock sin la segunda firma de finanzas/gerencia.
  if (req.body?.type === 'ADJUSTMENT_IN' || req.body?.type === 'ADJUSTMENT_OUT') {
    throw AppError.badRequest(
      'Los ajustes de inventario deben registrarse como solicitud para su aprobación (doble autorización). Usa el módulo de Ajustes.',
      'USE_ADJUSTMENT_FLOW',
    );
  }
  const schema = z.object({
    productId: z.string(),
    warehouseId: z.string(),
    type: z.enum(['IN', 'OUT']),
    quantity: z.number().positive(),
    unitCost: z.number().min(0).optional(),
    reference: z.string().optional(),
    notes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const mov = await inv.registerMovement(req.user!.companyId, { ...parsed.data, createdBy: req.user!.userId });
    res.status(201).json(mov);
  } catch (e: any) {
    if (e?.message === 'INSUFFICIENT_STOCK') throw AppError.badRequest('Stock insuficiente', 'INSUFFICIENT_STOCK');
    if (e?.message === 'PRODUCT_NOT_FOUND') throw AppError.notFound('Producto no encontrado', 'PRODUCT_NOT_FOUND');
    throw e;
  }
});

/** Un movimiento individual (link "Ver movimiento" desde Ajustes de Inventario). */
export const getMovement = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const movement = await inv.getMovementById(req.params.id, req.user!.companyId);
    res.json(movement);
  } catch (e: any) {
    if (e?.message === 'MOVEMENT_NOT_FOUND') throw AppError.notFound('Movimiento no encontrado', 'MOVEMENT_NOT_FOUND');
    throw e;
  }
});

export const getKardex = asyncHandler(async (req: AuthRequest, res) => {
  const { productId } = req.params;
  const { warehouseId } = req.query as { warehouseId?: string };
  const kardex = await inv.getKardex(productId, req.user!.companyId, warehouseId);
  res.json(kardex);
});

// Valorización de inventario (contable + conciliación contra el mayor)
export const getValuation = asyncHandler(async (req: AuthRequest, res) => {
  const { warehouseId, categoryId } = req.query as { warehouseId?: string; categoryId?: string };
  res.json(await inv.getInventoryValuation(req.user!.companyId, { warehouseId, categoryId }));
});

// KPIs
export const getKPIs = asyncHandler(async (req: AuthRequest, res) => {
  const kpis = await inv.getInventoryKPIs(req.user!.companyId);
  res.json(kpis);
});

// FIFO batches
export const getFifoBatchesCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const { productId } = req.params;
  const { warehouseId } = req.query as { warehouseId?: string };
  const batches = await inv.getFifoBatches(productId, req.user!.companyId, warehouseId);
  res.json(batches);
});

// Update valuation method (AVG / FIFO / STANDARD_COST)
export const updateValuationCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const { valuationMethod, standardCost } = req.body;
  if (!valuationMethod) throw AppError.badRequest('valuationMethod requerido', 'VALIDATION_ERROR');
  const product = await inv.updateValuationMethod(
    req.params.id,
    req.user!.companyId,
    { valuationMethod, standardCost },
  );
  res.json(product);
});

// Comparativo de 4 métodos de valoración para un producto
export const getValuationComparisonCtrl = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const comparison = await inv.getValuationComparison(req.params.id, req.user!.companyId);
    res.json(comparison);
  } catch (e: any) {
    if (e?.message === 'PRODUCT_NOT_FOUND') throw AppError.notFound('PRODUCT_NOT_FOUND', 'PRODUCT_NOT_FOUND');
    throw e;
  }
});

// ============================================================
// TRANSFERENCIAS
// ============================================================

export const transferStockCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    fromWarehouseId: z.string(),
    toWarehouseId: z.string(),
    productId: z.string(),
    quantity: z.number().positive(),
    notes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const result = await inv.transferStock(req.user!.companyId, { ...parsed.data, createdBy: req.user!.userId });
    res.status(201).json(result);
  } catch (e: any) {
    if (e?.message === 'INSUFFICIENT_STOCK') throw AppError.badRequest('Stock disponible insuficiente para transferir', 'INSUFFICIENT_STOCK');
    if (e?.message === 'PRODUCT_NOT_FOUND') throw AppError.notFound('Producto no encontrado', 'PRODUCT_NOT_FOUND');
    throw e;
  }
});

// ============================================================
// RESERVAS
// ============================================================

export const reserveStockCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    productId: z.string(),
    warehouseId: z.string(),
    quantity: z.number().positive(),
    reference: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const result = await inv.reserveStock(req.user!.companyId, parsed.data);
    res.json(result);
  } catch (e: any) {
    if (e?.message === 'INSUFFICIENT_STOCK') throw AppError.badRequest('Stock insuficiente para reservar', 'INSUFFICIENT_STOCK');
    throw e;
  }
});

export const releaseReservationCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    productId: z.string(),
    warehouseId: z.string(),
    quantity: z.number().positive(),
    reference: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR', parsed.error.flatten());
  const result = await inv.releaseReservation(req.user!.companyId, parsed.data);
  res.json(result);
});

// ============================================================
// REORDEN INTELIGENTE
// ============================================================

export const getReorderSuggestionsCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const suggestions = await inv.getReorderSuggestions(req.user!.companyId);
  res.json(suggestions);
});

// ============================================================
// C1 — Reabastecimiento entre bodegas
// ============================================================

export const getReplenishmentSuggestionsCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const suggestions = await inv.getReplenishmentSuggestions(req.user!.companyId);
  res.json(suggestions);
});

export const applySuggestedTransferCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const { productId, warehouseId } = req.params;
  try {
    const movement = await inv.applySuggestedTransfer(req.user!.companyId, productId, warehouseId, req.user!.userId);
    res.status(201).json(movement);
  } catch (e: any) {
    if (e?.message === 'SUGGESTION_NOT_FOUND') throw AppError.badRequest('La sugerencia ya no aplica: el stock cambió', 'SUGGESTION_STALE');
    if (e?.message === 'NOT_A_TRANSFER_ROUTE') throw AppError.badRequest('Esta sugerencia no es un traslado', 'NOT_A_TRANSFER_ROUTE');
    if (e?.message === 'INSUFFICIENT_STOCK') throw AppError.badRequest('La bodega donante ya no tiene el excedente suficiente', 'INSUFFICIENT_STOCK');
    throw e;
  }
});

export const applySuggestedRequisitionCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const { productId, warehouseId } = req.params;
  try {
    const requisition = await inv.applySuggestedRequisition(req.user!.companyId, productId, warehouseId, req.user!.userId);
    res.status(201).json(requisition);
  } catch (e: any) {
    if (e?.message === 'SUGGESTION_NOT_FOUND') throw AppError.badRequest('La sugerencia ya no aplica: el stock cambió', 'SUGGESTION_STALE');
    throw e;
  }
});

export const updateStockThresholdsCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const { productId, warehouseId } = req.params;
  const schema = z.object({
    minStock: z.number().min(0).nullable().optional(),
    maxStock: z.number().min(0).nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Datos inválidos', 'VALIDATION_ERROR', parsed.error.flatten());
  try {
    const stock = await inv.updateStockThresholds(req.user!.companyId, productId, warehouseId, parsed.data);
    res.json(stock);
  } catch (e: any) {
    if (e?.message === 'STOCK_NOT_FOUND') throw AppError.notFound('El producto no tiene stock registrado en esa bodega', 'STOCK_NOT_FOUND');
    throw e;
  }
});

export const snoozeReplenishmentCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const { productId, warehouseId } = req.params;
  const days = Number(req.body?.days) || 7;
  const snooze = await inv.snoozeReplenishmentSuggestion(req.user!.companyId, productId, warehouseId, req.user!.userId, days);
  res.status(201).json(snooze);
});

// ============================================================
// C2 — Panel de operaciones de inventario
// ============================================================

export const getOperationsPanelCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const panel = await inv.getInventoryOperationsPanel(req.user!.companyId);
  res.json(panel);
});

export const getWarehouseTreeCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const tree = await inv.getWarehouseTree(req.user!.companyId);
  res.json(tree);
});

export const getBatchesNearExpiryCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const days = Number(req.query.days) || 30;
  const batches = await inv.getBatchesNearExpiry(req.user!.companyId, days);
  res.json(batches);
});

// ============================================================
// CONTEO FÍSICO
// ============================================================

export const startPhysicalCountCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    warehouseId: z.string(),
    notes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR');
  const count = await inv.startPhysicalCount(req.user!.companyId, {
    ...parsed.data,
    countedBy: req.user!.userId,
  });
  res.status(201).json(count);
});

export const addPhysicalCountItemsCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const schema = z.object({
    items: z.array(z.object({
      productId: z.string(),
      physicalQty: z.number().min(0),
    })),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Invalid data', 'VALIDATION_ERROR');
  try {
    const result = await inv.addPhysicalCountItems(req.params.countId, req.user!.companyId, parsed.data.items);
    res.json(result);
  } catch (e: any) {
    if (e?.message === 'COUNT_NOT_FOUND_OR_CLOSED') throw AppError.notFound('Conteo no encontrado o ya cerrado', 'COUNT_NOT_FOUND_OR_CLOSED');
    throw e;
  }
});

export const finalizePhysicalCountCtrl = asyncHandler(async (req: AuthRequest, res) => {
  try {
    const result = await inv.finalizePhysicalCount(req.params.countId, req.user!.companyId, req.user!.userId);
    res.json(result);
  } catch (e: any) {
    if (e?.message === 'COUNT_NOT_FOUND_OR_CLOSED') throw AppError.notFound('Conteo no encontrado o ya cerrado', 'COUNT_NOT_FOUND_OR_CLOSED');
    throw e;
  }
});

export const listPhysicalCountsCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const { warehouseId } = req.query as { warehouseId?: string };
  const counts = await inv.getPhysicalCounts(req.user!.companyId, warehouseId);
  res.json(counts);
});

// ============================================================
// ANALYTICS AVANZADOS
// ============================================================

export const getInventoryAnalyticsCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const periodDays = Number(req.query.days) || 90;
  const analytics = await inv.getInventoryAnalytics(req.user!.companyId, periodDays);
  res.json(analytics);
});

// Pronóstico de demanda (top vendidos) y tendencia de rotación de productos.
export const getDemandForecastCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const months = Number(req.query.months) || 6;
  const topN = Number(req.query.top) || 10;
  res.json(await inv.getDemandForecast(req.user!.companyId, months, topN));
});

export const getRotationTrendCtrl = asyncHandler(async (req: AuthRequest, res) => {
  const months = Number(req.query.months) || 6;
  res.json(await inv.getRotationTrend(req.user!.companyId, months));
});

// ============================================================
// CHEQUEO BLANDO DE STOCK (Sprint 3) — disponibilidad sin bloquear
// ============================================================

export const stockCheckSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    warehouseId: z.string().nullish(),
    quantity: z.number().positive(),
  })).min(1),
});

export const checkStockCtrl = asyncHandler(async (req: AuthRequest, res) => {
  // El body ya viene validado por validateSchema en la ruta.
  const { items } = req.body as z.infer<typeof stockCheckSchema>;
  const result = await inv.checkStockAvailability(req.user!.companyId, items);
  res.json(result);
});
