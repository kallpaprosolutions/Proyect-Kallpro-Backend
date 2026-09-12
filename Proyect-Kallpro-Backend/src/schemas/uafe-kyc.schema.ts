import { z } from 'zod';

/**
 * Schema Zod compartido para validación de campos UAFE (KYC).
 * Aplica tanto a Supplier como a Customer.
 *
 * Reglas condicionales:
 * - Si personType === 'JURIDICA': requiere razonSocial, legalRepName, beneficialOwners (suma 100%).
 * - Si personType === 'NATURAL': requiere birthDate, occupation.
 * - Si isPEP === true: requiere pepPosition.
 */

const BeneficialOwnerSchema = z.object({
  name: z.string().min(1),
  document: z.string().min(1),
  percentage: z.number().min(0).max(100),
});

const PersonType = z.enum(['NATURAL', 'JURIDICA']);
const DocType = z.enum(['RUC', 'CEDULA', 'PASAPORTE']);
const MaritalStatus = z.enum(['SOLTERO', 'CASADO', 'DIVORCIADO', 'VIUDO', 'UNION_LIBRE']);

export const UafeKycBaseFields = {
  // Identificación
  name: z.string().min(1),
  ruc: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')).transform((v) => v || undefined),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  paymentTerms: z.string().optional(),

  // UAFE comunes
  personType: PersonType.optional(),
  documentType: DocType.optional(),
  razonSocial: z.string().optional(),
  nombreComercial: z.string().optional(),
  ciiuCode: z.string().optional(),
  ciiuDescription: z.string().optional(),

  // Persona Natural
  birthDate: z.string().optional(),
  nationality: z.string().optional(),
  maritalStatus: MaritalStatus.optional(),
  spouseName: z.string().optional(),
  spouseDocument: z.string().optional(),
  occupation: z.string().optional(),
  employerName: z.string().optional(),
  workplace: z.string().optional(),

  // Persona Jurídica
  legalRepName: z.string().optional(),
  legalRepDocument: z.string().optional(),
  beneficialOwners: z.array(BeneficialOwnerSchema).optional(),

  // Financiero
  annualIncome: z.number().optional(),
  estimatedPatrimony: z.number().optional(),

  // PEP
  isPEP: z.boolean().optional().default(false),
  pepPosition: z.string().optional(),
  pepRelationship: z.string().optional(),

  // Régimen tributario
  contribuyenteEspecial: z.boolean().optional().default(false),
  obligadoContabilidad: z.boolean().optional().default(false),

  // Configuración tributaria por defecto (sincronización contable)
  taxRegime: z.string().optional(),
  defaultIvaCode: z.string().optional(),
  defaultRetentionCodeRenta: z.string().optional(),
  defaultRetentionCodeIva: z.string().optional(),

  // KYC audit
  kycCompletedAt: z.string().optional(),
} as const;

/** Validación condicional centralizada */
export function validateKyc(data: z.infer<typeof KycSchema>): string | null {
  if (data.personType === 'JURIDICA') {
    if (!data.razonSocial) return 'razonSocial es requerido para Persona Jurídica';
    if (!data.legalRepName) return 'legalRepName es requerido para Persona Jurídica';
    if (data.beneficialOwners && data.beneficialOwners.length > 0) {
      const sum = data.beneficialOwners.reduce((s, b) => s + Number(b.percentage), 0);
      if (Math.abs(sum - 100) > 0.01) return `La suma de porcentajes de beneficiarios debe ser 100% (actual: ${sum})`;
    }
  }
  if (data.personType === 'NATURAL') {
    if (!data.birthDate) return 'birthDate es requerido para Persona Natural';
  }
  if (data.isPEP && !data.pepPosition) {
    return 'pepPosition es requerido cuando isPEP es true';
  }
  return null;
}

export const KycSchema = z.object(UafeKycBaseFields);

/** Schema extendido para Customer: agrega creditLimit */
export const CustomerKycSchema = z.object({
  ...UafeKycBaseFields,
  creditLimit: z.number().optional().default(0),
  notes: z.string().optional(),
});

/** Adapter: convierte input validado a payload Prisma listo para create/update */
export function toPrismaPayload(data: z.infer<typeof KycSchema> | z.infer<typeof CustomerKycSchema>) {
  const { birthDate, kycCompletedAt, beneficialOwners, ...rest } = data as any;
  const payload: any = { ...rest };
  if (birthDate) payload.birthDate = new Date(birthDate);
  if (kycCompletedAt) payload.kycCompletedAt = new Date(kycCompletedAt);
  if (beneficialOwners !== undefined) payload.beneficialOwners = beneficialOwners;
  return payload;
}
