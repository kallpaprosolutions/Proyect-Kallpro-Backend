import { z } from 'zod';

/**
 * Validación de ErpConfig en el cliente (plan #18 · #14).
 * Espejo de la validación del backend (company.controller updateSettings) para dar
 * feedback inmediato por campo ANTES de enviar, en vez de un 400 genérico.
 */
export const documentsSchema = z.object({
  reqPrefix: z.string().min(1, 'Requerido').max(10, 'Máx. 10 caracteres'),
  poPrefix: z.string().min(1, 'Requerido').max(10, 'Máx. 10 caracteres'),
  adjPrefix: z.string().min(1, 'Requerido').max(10, 'Máx. 10 caracteres'),
});

export const companyProfileSchema = z.object({
  ruc: z.string().max(20, 'Máx. 20 caracteres'),
  address: z.string().max(200, 'Máx. 200 caracteres'),
  city: z.string().max(80, 'Máx. 80 caracteres'),
  website: z.string().max(120, 'Máx. 120 caracteres'),
});

export const purchasesSchema = z.object({
  minQuotations: z.number().int().min(1).max(3),
});

export const salesSchema = z.object({
  enforceCreditLimit: z.boolean(),
  allowPartialDispatch: z.boolean(),
  maxDiscountByRole: z.record(
    z.string(),
    z.number({ invalid_type_error: 'Debe ser un número' })
      .min(0, 'Mínimo 0%')
      .max(100, 'Máximo 100%'),
  ),
  discountApproverRoles: z.array(z.string()),
});

export const securitySchema = z.object({
  sessionTimeoutMinutes: z.number({ invalid_type_error: 'Debe ser un número' })
    .int('Debe ser un entero')
    .min(5, 'Mínimo 5 minutos')
    .max(1440, 'Máximo 24 horas (1440)'),
  require2FAForRoles: z.array(z.string()),
});

// Aprobaciones por monto en CxP/CxC (roadmap Asistente Contable, Fase 4).
export const financeSchema = z.object({
  paymentResponsableLimit: z.number({ invalid_type_error: 'Debe ser un número' })
    .min(0, 'No puede ser negativo'),
  paymentGerencialLimit: z.number({ invalid_type_error: 'Debe ser un número' })
    .min(0, 'No puede ser negativo'),
}).refine((v) => v.paymentGerencialLimit >= v.paymentResponsableLimit, {
  message: 'El límite gerencial debe ser mayor o igual al del responsable',
  path: ['paymentGerencialLimit'],
});

/** Aplana los errores de un safeParse a { campo: mensaje } con prefijo de sección. */
export function flattenErrors(prefix: string, err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = `${prefix}.${issue.path.join('.')}`;
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
