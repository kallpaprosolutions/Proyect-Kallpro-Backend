import { getDealsAtRisk } from '../services/crm/deal.service';
import { prisma } from '../lib/prisma';
import { getDashboardMetrics } from '../services/crm/dashboard.service';
import { getForecast } from '../services/crm/forecast.service';
import { logger } from '../lib/logger';

export async function runNightlyWorkflows(): Promise<void> {
  logger.info('[crm-workflows] Running nightly workflows...');

  const companies = await prisma.company.findMany({
    select: { id: true },
  });

  for (const company of companies) {
    try {
      // 1. Foto del pronóstico del mes en curso. getForecast ya la guarda (o refresca)
      //    salvo que el período esté cerrado, así que no hace falta guardarla aparte.
      await getForecast(company.id);

      // 2. Check deals at risk
      const atRisk = await getDealsAtRisk(company.id, 7);
      if (atRisk.length > 0) {
        logger.info(`[crm-workflows] Company ${company.id}: ${atRisk.length} deals at risk`, { companyId: company.id, atRisk: atRisk.length });
        // TODO: send notifications
      }
    } catch (err: any) {
      logger.error('[crm-workflows] Error en workflows nocturnos', { companyId: company.id, err: err.message });
    }
  }

  logger.info('[crm-workflows] Nightly workflows complete');
}

let scheduledWorker: any = null;

export async function startCrmWorkflowsWorker(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.info('[crm-workflows] Redis not configured, scheduling via setInterval');
    // Run once at startup after 30s delay, then every 24h
    setTimeout(() => {
      runNightlyWorkflows().catch((e) => logger.error('[crm-workflows] run inicial falló', { err: e }));
      setInterval(() => runNightlyWorkflows().catch((e) => logger.error('[crm-workflows] run programado falló', { err: e })), 24 * 60 * 60 * 1000);
    }, 30000);
    return;
  }

  try {
    const { Worker, Queue } = await import('bullmq');
    const { default: IORedis } = await import('ioredis');
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

    scheduledWorker = new Worker(
      'crm-workflows',
      async () => { await runNightlyWorkflows(); },
      { connection, concurrency: 1 },
    );

    // Schedule nightly job
    const queue = new Queue('crm-workflows', { connection });
    await queue.upsertJobScheduler(
      'nightly',
      { pattern: '0 2 * * *' }, // 2 AM UTC
      { name: 'nightly-workflows', data: {} },
    );

    logger.info('[crm-workflows] BullMQ scheduled worker started');
  } catch (err: any) {
    logger.warn('[crm-workflows] BullMQ not available', { err: err.message });
  }
}
