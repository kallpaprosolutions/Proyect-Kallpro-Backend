import swaggerJsdoc from 'swagger-jsdoc';

/**
 * Especificación OpenAPI (Sprint 2.4). Se genera a partir de:
 *  - Esta definición base (info, auth Bearer JWT, esquema de error reutilizable).
 *  - Anotaciones JSDoc `@openapi` en los archivos de rutas (escaneadas por `apis`).
 *
 * UI interactiva en /api/docs, JSON crudo en /api/docs.json.
 */
const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'KallpaPro API',
      version: '0.1.0',
      description:
        'API del ERP B2B KallpaPro. La mayoría de endpoints requieren autenticación ' +
        'vía Bearer JWT (botón "Authorize"). Los errores siguen el contrato ErrorResponse.',
    },
    servers: [{ url: '/', description: 'Servidor actual' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        // Contrato de error unificado del errorHandler global.
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Cotización no encontrada' },
            message: { type: 'string', example: 'Cotización no encontrada' },
            code: { type: 'string', example: 'QUOTATION_NOT_FOUND' },
            details: { type: 'object', nullable: true, description: 'Detalle de validación (Zod) u otra info' },
          },
          required: ['error', 'message', 'code'],
        },
      },
      responses: {
        Unauthorized: {
          description: 'Token ausente, inválido o expirado',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        ValidationError: {
          description: 'Datos inválidos (code: VALIDATION_ERROR)',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        NotFound: {
          description: 'Recurso no encontrado',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Health', description: 'Estado del servicio' },
      { name: 'Auth', description: 'Autenticación, 2FA y sesiones' },
      { name: 'CRM', description: 'Contactos, empresas, deals y conversaciones' },
      { name: 'Inventory', description: 'Productos, bodegas y movimientos de stock' },
      { name: 'Credit Notes', description: 'Notas de crédito de venta (devoluciones / anulaciones)' },
      { name: 'Reports', description: 'Exportaciones Excel y PDF (facturas, notas de crédito, órdenes)' },
    ],
  },
  // Escanea los archivos de rutas y app.ts en busca de anotaciones @openapi.
  apis: ['./src/routes/*.ts', './src/app.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
