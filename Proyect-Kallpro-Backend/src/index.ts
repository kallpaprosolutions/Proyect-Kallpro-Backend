import { createServer } from 'http';
import app from './app';
import { crmWS } from './services/websocket/crmChannel';
import { startCrmRouterWorker } from './jobs/crm-router.worker';
import { startCrmWorkflowsWorker } from './jobs/crm-workflows.worker';
import { startExpireQuotationsJob } from './jobs/expireQuotations';
import { startDunningJob } from './jobs/dunning.job';
import { initDocumentSequences } from './lib/init-sequences';
import { logger } from './lib/logger';

const httpServer = createServer(app);
const PORT = process.env.PORT || 5001;

// Start
httpServer.listen(PORT, () => {
  logger.info(`🚀 KallpaPro Backend running on port ${PORT}`);
  logger.info(`📝 Health check: http://localhost:${PORT}/health`);
  logger.info(`🔗 API: http://localhost:${PORT}/api`);
  logger.info(`🔌 WebSocket CRM: ws://localhost:${PORT}/ws/crm`);

  // Initialize WebSocket
  crmWS.initialize(httpServer);

  // Start background workers
  startCrmRouterWorker().catch((e) => logger.error('startCrmRouterWorker falló', { err: e }));
  startCrmWorkflowsWorker().catch((e) => logger.error('startCrmWorkflowsWorker falló', { err: e }));

  // Auto-seed de correlativos si la tabla está vacía (no rompe el arranque si falla)
  initDocumentSequences().catch((e) => logger.warn('[init-sequences] auto-seed falló (no-fatal)', { err: e }));

  // Job: expiración diaria de cotizaciones de venta
  startExpireQuotationsJob();
  startDunningJob();
});
