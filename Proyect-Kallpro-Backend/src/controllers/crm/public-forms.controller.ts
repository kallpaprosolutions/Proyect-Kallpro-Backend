import { Request } from 'express';
import { asyncHandler } from '../../middleware/error-handler';
import * as forms from '../../services/crm/capture-form.service';

/**
 * Endpoints PÚBLICOS de captura (sin sesión). Se montan bajo /api/public/crm.
 *
 * La `publicKey` es la única credencial y solo permite dos cosas: leer la definición
 * del formulario y enviar un lead. Nunca devuelve datos de la empresa ni de otros leads.
 */

export const getPublicFormHandler = asyncHandler(async (req: Request, res) => {
  res.json(await forms.getPublicForm(req.params.publicKey));
});

export const submitPublicFormHandler = asyncHandler(async (req: Request, res) => {
  const result = await forms.submitPublicForm(req.params.publicKey, req.body ?? {}, {
    // Detrás de un proxy, la IP real viene en X-Forwarded-For.
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(201).json(result);
});
