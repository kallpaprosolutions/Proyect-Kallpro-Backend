/**
 * Errores de aplicación con código HTTP y código semántico.
 *
 * Objetivo (Sprint 2.2 — endurecimiento transversal): que los servicios lancen un
 * error tipado en vez de `throw new Error('CODIGO')` + mapeo manual `if (e.message === …)`
 * repetido en cada controlador. El `errorHandler` global traduce un `AppError` a su
 * respuesta HTTP de forma centralizada.
 *
 * Convención de respuesta (retrocompatible con el frontend actual):
 *   { error: <mensaje>, message: <mensaje>, code: <CODIGO>, details?: <...> }
 *   - `error` (string) se mantiene porque el cliente actual lo lee directamente.
 *   - `code` permite al frontend mapear el error a un texto (ver getErrorMessage del cliente).
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    // Necesario al extender Error transpilando a ES5/ES2015 (instanceof funciona).
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown) {
    return new AppError(message, 400, code, details);
  }
  static unauthorized(message: string, code = 'UNAUTHORIZED', details?: unknown) {
    return new AppError(message, 401, code, details);
  }
  static forbidden(message: string, code = 'FORBIDDEN', details?: unknown) {
    return new AppError(message, 403, code, details);
  }
  static notFound(message: string, code = 'NOT_FOUND', details?: unknown) {
    return new AppError(message, 404, code, details);
  }
  static conflict(message: string, code = 'CONFLICT', details?: unknown) {
    return new AppError(message, 409, code, details);
  }
  static unprocessable(message: string, code = 'VALIDATION_ERROR', details?: unknown) {
    return new AppError(message, 422, code, details);
  }
}

/**
 * Catálogo de códigos legacy que los servicios actuales lanzan como `throw new Error('CODIGO')`.
 * Mientras los controladores migran al patrón `asyncHandler` + `AppError`, el `errorHandler`
 * usa este mapa como red de seguridad para que esos códigos sigan devolviendo el HTTP correcto.
 *
 * Solo incluye códigos verificados en el código real o documentados en el plan #18.
 * Ampliar a medida que se migren más flujos.
 */
export const LEGACY_ERROR_CODES: Record<string, { status: number; message: string }> = {
  // Ventas / cotizaciones / pedidos
  QUOTATION_NOT_FOUND: { status: 404, message: 'Cotización no encontrada' },
  ALREADY_CONVERTED: { status: 400, message: 'Esta cotización ya fue convertida en pedido' },
  QUOTATION_EXPIRED: { status: 400, message: 'La cotización está vencida; genere una nueva' },
  ORDER_NOT_FOUND: { status: 404, message: 'Pedido no encontrado' },
  INVALID_STATUS: { status: 400, message: 'El documento no está en un estado válido para esta operación' },
  QUOTATION_PENDING_APPROVAL: { status: 400, message: 'La cotización está pendiente de aprobación' },
  QUOTATION_NOT_PENDING: { status: 400, message: 'La cotización no está pendiente de aprobación' },
  ORDER_NOT_PENDING: { status: 400, message: 'El pedido no está pendiente de aprobación' },
  // Listas de precios / descuentos
  NO_PRICE_AVAILABLE: { status: 404, message: 'No hay precio en lista ni precio base para este producto' },
  PRICE_LIST_NOT_FOUND: { status: 404, message: 'Lista de precios no encontrada' },
  ITEM_NOT_FOUND: { status: 404, message: 'Ítem no encontrado' },
  PRODUCT_NOT_FOUND: { status: 404, message: 'Producto no encontrado' },
  // Autenticación / sesiones
  INVALID_CREDENTIALS: { status: 401, message: 'Credenciales inválidas' },
  SESSION_EXPIRED: { status: 401, message: 'Sesión expirada, vuelve a iniciar sesión' },
  // Configuración
  ERP_CONFIG_INVALID: { status: 400, message: 'La configuración de la empresa es inválida' },
};
