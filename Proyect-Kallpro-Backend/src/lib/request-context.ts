import { AsyncLocalStorage } from 'async_hooks';

/**
 * Contexto por request basado en AsyncLocalStorage (Sprint 2.3 · Correlation ID).
 *
 * Permite que el `requestId` se propague implícitamente por toda la cadena async de una
 * request (middlewares, controladores, servicios) sin tener que pasarlo por parámetro.
 * El logger lo lee de aquí e inyecta `requestId` en cada línea de log automáticamente.
 */
export interface RequestContext {
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/** requestId de la request en curso, o undefined fuera de una request (jobs, arranque). */
export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
