import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
/**
 * Marca como EXPIRED las cotizaciones de venta cuya validez ya pasó.
 * Solo afecta cotizaciones que todavía están vivas (DRAFT | SENT).
 * Devuelve cuántas se expiraron (útil para logging/tests).
 */
export async function expireQuotationsNow(): Promise<number> {
  const result = await prisma.salesQuotation.updateMany({
    where: {
      status: { in: ['DRAFT', 'SENT'] },
      validUntil: { not: null, lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });
  if (result.count > 0) {
    logger.info(`[expireQuotations] ${result.count} cotización(es) marcadas EXPIRED`, { count: result.count });
  }
  return result.count;
}

/** Programa la expiración diaria a las 00:05 (hora del servidor). */
export function startExpireQuotationsJob() {
  // Corre una vez al arrancar para ponerse al día, y luego cada día.
  expireQuotationsNow().catch((e) => logger.warn('[expireQuotations] run inicial falló', { err: e }));
  cron.schedule('5 0 * * *', () => {
    expireQuotationsNow().catch((e) => logger.warn('[expireQuotations] run programado falló', { err: e }));
  });
  logger.info('🕒 Job de expiración de cotizaciones programado (diario 00:05)');
}
