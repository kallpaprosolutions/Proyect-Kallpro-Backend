import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'KallpaPro Backend',
    version: '0.1.0',
  });
});

// API Routes (to be implemented)
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    message: 'Welcome to KallpaPro API v1',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      inventory: '/api/inventory',
      purchases: '/api/purchases',
      logistics: '/api/logistics',
      financials: '/api/financials',
      sales: '/api/sales',
      subscriptions: '/api/subscriptions',
    },
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
  });
});

// Error handler (simple for now)
app.use((err: any, _req: Request, res: Response) => {
  console.error(err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 KallpaPro Backend running on port ${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
});
