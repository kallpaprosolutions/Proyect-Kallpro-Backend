import winston from 'winston';
import { getRequestId } from './request-context';

/**
 * Logger centralizado (Sprint 2.2 · paso 2).
 *
 * - Nivel: LOG_LEVEL, o 'info' en producción / 'debug' en el resto.
 * - Producción: JSON en una línea (apto para agregadores tipo Loki/Datadog/CloudWatch).
 * - Desarrollo: salida coloreada y legible con timestamp.
 *
 * Reemplaza los `console.*` dispersos. Usar:
 *   logger.info('mensaje', { meta })   logger.error({ err }, 'mensaje')  (estilo objeto-meta)
 *   logger.warn('mensaje')             logger.debug('mensaje')
 */
const isProd = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');

// Los Error anidados en meta (p.ej. logger.warn('x', { err: e })) se serializan a `{}`
// con JSON.stringify. Este format los expande a { name, message, stack } para no perder
// el detalle en los logs (especialmente en producción).
const expandErrors = winston.format((info) => {
  for (const key of Object.keys(info)) {
    const val = (info as Record<string, unknown>)[key];
    if (val instanceof Error) {
      (info as Record<string, unknown>)[key] = { name: val.name, message: val.message, stack: val.stack };
    }
  }
  return info;
});

// Inyecta el requestId del contexto (AsyncLocalStorage) en cada log dentro de una request.
const injectRequestId = winston.format((info) => {
  const requestId = getRequestId();
  if (requestId && !info.requestId) info.requestId = requestId;
  return info;
});

const devFormat = winston.format.combine(
  expandErrors(),
  injectRequestId(),
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const rest = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${timestamp} ${level}: ${message}${rest}`;
  }),
);

const prodFormat = winston.format.combine(
  expandErrors(),
  injectRequestId(),
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const logger = winston.createLogger({
  level,
  format: isProd ? prodFormat : devFormat,
  defaultMeta: { service: 'kallpapro-backend' },
  transports: [new winston.transports.Console()],
});
