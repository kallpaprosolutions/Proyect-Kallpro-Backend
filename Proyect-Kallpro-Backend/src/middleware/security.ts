import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from '../lib/logger';

/**
 * Cabeceras de seguridad HTTP (helmet).
 * - CSP deshabilitado: la API sirve JSON; el SPA (otro origen) tiene su propia política.
 * - CORP cross-origin: permite que el frontend (puerto 3001) cargue imágenes de /uploads.
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'no-referrer' },
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 15552000, includeSubDomains: true } // 180 días
    : false,
});

/** Límite global anti-abuso (generoso para un ERP con muchas llamadas). */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 600,                 // 600 req / 15 min por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta de nuevo en unos minutos.' },
});

/** Límite estricto para endpoints de autenticación (anti fuerza bruta). */
export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 10,                  // 10 intentos / 10 min por IP
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // solo cuenta intentos fallidos
  message: { error: 'Demasiados intentos de acceso. Espera unos minutos antes de reintentar.' },
});

/**
 * Límite para la captura pública de leads (Sprint 13).
 *
 * El endpoint no lleva sesión: cualquiera con la clave pública puede enviar. Se deja
 * margen para un formulario compartido en una oficina (varias personas, misma IP), pero
 * corta el envío masivo automatizado. El honeypot y el tiempo mínimo de llenado atrapan
 * al resto (ver capture-form.service).
 */
export const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20,                  // 20 envíos / hora por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados envíos desde esta conexión. Intenta más tarde.' },
});

/** Verifica que el secreto JWT exista y sea suficientemente fuerte al arrancar. */
export function assertJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    logger.error('[SECURITY] FATAL: JWT_SECRET no está definido. La app no puede firmar tokens de forma segura.');
    return;
  }
  if (secret.length < 32) {
    logger.warn('[SECURITY] Advertencia: JWT_SECRET es corto (<32 caracteres). Usa un secreto largo y aleatorio en producción.');
  }
}
