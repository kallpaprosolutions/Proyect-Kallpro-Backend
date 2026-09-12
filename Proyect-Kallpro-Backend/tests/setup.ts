/**
 * Setup global de jest (corre antes de importar cualquier módulo de test).
 * Fija un entorno determinista para los tests de integración: secretos JWT y nivel de log
 * silencioso. Al setearse aquí, dotenv.config() en app.ts NO los sobrescribe (dotenv no
 * pisa variables ya definidas), así que no dependemos del .env real.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = 'test-secret-key-of-at-least-32-characters-1234';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-of-at-least-32-chars-5678';
process.env.LOG_LEVEL = 'error'; // silencia los logs info/warn de requests en los tests
