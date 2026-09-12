import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/ollama.controller';
import * as procCtrl from '../controllers/procurement-ai.controller';
import * as aiCtrl from '../controllers/ai-structured.controller';

const router = Router();
router.use(authMiddleware);

// IA estructurada (Vercel AI SDK + generateObject + Zod sobre Ollama)
router.get('/structured/status', aiCtrl.structuredStatus);
router.post('/structured/extract-invoice', aiCtrl.extractInvoice);
router.post('/structured/suggest-account', aiCtrl.suggestAccount);
router.post('/structured/price-anomaly', aiCtrl.priceAnomaly);

// Status
router.get('/status', ctrl.getOllamaStatus);

// Product helpers
router.post('/product-description', ctrl.genProductDesc);
router.get('/demand/:productId', ctrl.getDemandPrediction);
router.get('/smart-forecast/:productId', ctrl.getSmartForecast);

// Inventory analysis
router.get('/reorder-recommendations', ctrl.getReorderRecommendations);
router.post('/financial-insight', ctrl.getFinancialInsight);
router.get('/health-score', ctrl.getInventoryHealthScore);

// Procurement AI
router.post('/supplier-recommendation',  procCtrl.getSupplierRecommendation);
router.post('/price-anomaly-check',       procCtrl.checkPriceAnomaly);
router.get('/procurement-insights',       procCtrl.getProcurementInsights);

// General assistant
router.post('/ask', ctrl.askAssistant);

// Dev tools
router.post('/sql', ctrl.generateSQL);

export default router;
