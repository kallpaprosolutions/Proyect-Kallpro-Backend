import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as path from 'path';
import authRoutes from './routes/auth.routes';
import inventoryRoutes from './routes/inventory.routes';
import purchasesRoutes from './routes/purchases.routes';
import financialRoutes from './routes/financial.routes';
import sriDocumentRoutes from './routes/sri-document.routes';
import requisitionRoutes from './routes/requisition.routes';
import budgetRoutes from './routes/budget.routes';
import dashboardRoutes from './routes/dashboard.routes';
import rotationRoutes from './routes/rotation.routes';
import ollamaRoutes from './routes/ollama.routes';
import salesRoutes from './routes/sales.routes';
import portalRoutes from './routes/portal.routes';
import productionRoutes from './routes/production.routes';
import reportsRoutes from './routes/reports.routes';
import researchRoutes from './routes/research.routes';
import crmRoutes from './routes/crm.routes';
import publicCrmRoutes from './routes/public-crm.routes';
import logisticsRoutes from './routes/logistics.routes';
import logisticsWebhookRoutes from './routes/logistics-webhook.routes';
import approvalMatrixRoutes from './routes/approval-matrix.routes';
import companyRoutes from './routes/company.routes';
import paymentRoutes from './routes/payment.routes';
import priceListRoutes from './routes/price-list.routes';
import payrollRoutes from './routes/payroll.routes';
import treasuryRoutes from './routes/treasury.routes';
import hrCalendarRoutes from './routes/hr-calendar.routes';
import searchRoutes from './routes/search.routes';
import chatterRoutes from './routes/chatter.routes';
import activityRoutes from './routes/activity.routes';
import recurringInvoiceRoutes from './routes/recurring-invoice.routes';
import fixedAssetRoutes from './routes/fixed-asset.routes';
import swaggerUi from 'swagger-ui-express';
import { securityHeaders, globalLimiter, assertJwtSecret } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { swaggerSpec } from './lib/swagger';

dotenv.config();

/**
 * Construye la app Express (middleware + rutas + manejo de errores), SIN arrancar el
 * servidor ni los workers. Esto permite reutilizarla en tests de integración (supertest).
 * El arranque real (listen, WebSocket, jobs) vive en index.ts.
 */
const app: Express = express();

// ── Seguridad: cabeceras + límites de abuso ──
assertJwtSecret();
app.set('trust proxy', 1); // necesario para rate-limit detrás de proxy/Vite
app.use(securityHeaders);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',')
    : ['http://localhost:3001', 'http://localhost:3000'],
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Log estructurado de cada request + Correlation ID (X-Request-Id)
app.use(requestLogger);

// Límite global anti-abuso sobre la API
app.use('/api', globalLimiter);

// Servir archivos subidos (imágenes de producto, attachments)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Documentación interactiva OpenAPI (sin auth)
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'KallpaPro API Docs' }));
app.get('/api/docs.json', (_req: Request, res: Response) => res.json(swaggerSpec));

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Estado del servicio
 *     security: []
 *     responses:
 *       200:
 *         description: Servicio operativo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 timestamp: { type: string, format: date-time }
 *                 service: { type: string, example: KallpaPro Backend }
 *                 version: { type: string, example: 0.1.0 }
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'KallpaPro Backend',
    version: '0.1.0',
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/sri', sriDocumentRoutes);
app.use('/api/logistics/webhooks', logisticsWebhookRoutes); // público (token por empresa), antes del router autenticado
app.use('/api/logistics', logisticsRoutes);
app.use('/api/requisitions', requisitionRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/rotation', rotationRoutes);
app.use('/api/ai', ollamaRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/approval-matrix', approvalMatrixRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/price-lists', priceListRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/treasury', treasuryRoutes);
app.use('/api/hr', hrCalendarRoutes);
app.use('/api/crm', crmRoutes);
// Captura pública de leads (Sprint 13). CORS abierto A PROPÓSITO y solo en esta rama:
// el formulario se incrusta en el sitio web del cliente, cuyo dominio no conocemos de
// antemano. No lee datos: solo devuelve la definición del formulario y acepta envíos.
app.use('/api/public/crm', cors({ origin: true }), publicCrmRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/chatter', chatterRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/financial/recurring-invoices', recurringInvoiceRoutes);
app.use('/api/financial/fixed-assets', fixedAssetRoutes);

// API index
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    message: 'Welcome to KallpaPro API v1',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      inventory: '/api/inventory',
      purchases: '/api/purchases',
    },
  });
});

// 404 para rutas no registradas
app.use(notFoundHandler);

// Manejo de errores centralizado (debe ir al final, después de las rutas)
app.use(errorHandler);

export default app;
