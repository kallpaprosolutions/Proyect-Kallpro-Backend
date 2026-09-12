import cron from 'node-cron';
import { logger } from '../lib/logger';
import { runDunningForAllCompanies } from '../services/finance/dunning.service';

/** Recordatorios automáticos de cobranza, todos los días a las 07:30 (hora del servidor). */
export function startDunningJob() {
  cron.schedule('30 7 * * *', () => {
    runDunningForAllCompanies().catch((e) => logger.warn('[dunning] run programado falló', { err: e }));
  });
  logger.info('🕒 Job de cobranza automática programado (diario 07:30)');
}
