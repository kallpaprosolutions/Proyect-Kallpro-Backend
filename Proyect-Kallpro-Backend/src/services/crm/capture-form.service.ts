/**
 * Formularios de captura web (Sprint 13).
 *
 * El usuario define los campos desde la interfaz y el backend valida contra esa
 * definición al recibir el envío. La alternativa —campos fijos en el código— obliga a
 * un despliegue cada vez que marketing quiere preguntar algo nuevo.
 *
 * Seguridad del endpoint público (no lleva token de sesión):
 *   · la `publicKey` es lo único que viaja al navegador; NO expone el companyId
 *   · honeypot: un campo oculto que un humano nunca llena y un bot sí
 *   · tiempo mínimo de llenado: un envío en menos de 2 s es un bot
 *   · límite de tasa por IP en la ruta (ver crm.routes.ts)
 *   · solo se aceptan los campos declarados; el resto se ignora
 */

import { randomBytes } from 'crypto';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { createLead, CreateLeadInput } from './lead.service';

export const FIELD_TYPES = ['text', 'email', 'phone', 'textarea', 'select', 'number', 'checkbox'] as const;
export type FieldType = typeof FIELD_TYPES[number];

/** Campos de CrmLead a los que un campo del formulario puede mapearse. */
export const MAPPABLE_LEAD_FIELDS = [
  'firstName', 'lastName', 'email', 'phone', 'jobTitle',
  'companyName', 'ruc', 'website', 'city', 'message',
] as const;

export const LEAD_FIELD_LABELS: Record<string, string> = {
  firstName: 'Nombre',
  lastName: 'Apellido',
  email: 'Correo electrónico',
  phone: 'Teléfono',
  jobTitle: 'Cargo',
  companyName: 'Empresa',
  ruc: 'RUC',
  website: 'Sitio web',
  city: 'Ciudad',
  message: 'Mensaje',
};

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  /** Campo de CrmLead al que se copia; si falta, va a rawPayload. */
  mapsTo?: string;
}

/** Campos ocultos de atribución que el script del sitio envía siempre. */
export const ATTRIBUTION_KEYS = [
  'utmSource', 'utmMedium', 'utmCampaign', 'utmTerm', 'utmContent',
  'referrer', 'landingPage', 'gclid',
] as const;

function generatePublicKey(): string {
  return `kp_${randomBytes(12).toString('hex')}`;
}

/**
 * Formulario de arranque, listo para publicar.
 *
 * Cinco campos, solo dos obligatorios: el límite recomendado antes de que cada pregunta
 * extra empiece a costar conversión. Se piden cargo y teléfono aunque sean opcionales
 * porque son las dos señales de perfil que más pesan en el puntaje; sin ellas el motor
 * de scoring casi no tiene con qué distinguir a un comprador de un curioso.
 */
export function defaultFormFields(): FormField[] {
  return [
    { key: 'firstName', label: 'Nombre', type: 'text', required: true, mapsTo: 'firstName', placeholder: 'Tu nombre' },
    { key: 'email', label: 'Correo electrónico', type: 'email', required: true, mapsTo: 'email', placeholder: 'nombre@empresa.com' },
    { key: 'companyName', label: 'Empresa', type: 'text', required: false, mapsTo: 'companyName', placeholder: 'Nombre de tu empresa' },
    { key: 'jobTitle', label: 'Cargo', type: 'text', required: false, mapsTo: 'jobTitle', placeholder: 'Gerente, jefe de compras…' },
    { key: 'message', label: '¿En qué podemos ayudarte?', type: 'textarea', required: false, mapsTo: 'message' },
  ];
}

// ════════════════════════════════════════════════════════════════════
// Administración (con sesión)
// ════════════════════════════════════════════════════════════════════

export async function listForms(companyId: string) {
  return prisma.crmCaptureForm.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { leads: true } } },
  });
}

export async function getForm(companyId: string, id: string) {
  const form = await prisma.crmCaptureForm.findFirst({
    where: { id, companyId },
    include: { _count: { select: { leads: true } } },
  });
  if (!form) throw AppError.notFound('Formulario no encontrado', 'FORM_NOT_FOUND');
  return form;
}

function validateFields(fields: FormField[]) {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw AppError.badRequest('El formulario necesita al menos un campo', 'FORM_NO_FIELDS');
  }
  const keys = new Set<string>();
  for (const f of fields) {
    if (!f.key || !f.label) throw AppError.badRequest('Cada campo necesita clave y etiqueta', 'FIELD_INCOMPLETE');
    if (keys.has(f.key)) throw AppError.badRequest(`Clave de campo repetida: "${f.key}"`, 'FIELD_KEY_DUPLICATE');
    keys.add(f.key);
    if (f.type && !FIELD_TYPES.includes(f.type)) {
      throw AppError.badRequest(`Tipo de campo no soportado: "${f.type}"`, 'FIELD_TYPE_INVALID');
    }
    if (f.type === 'select' && (!f.options || f.options.length === 0)) {
      throw AppError.badRequest(`El campo "${f.label}" es una lista y necesita opciones`, 'FIELD_OPTIONS_REQUIRED');
    }
    if (f.mapsTo && !MAPPABLE_LEAD_FIELDS.includes(f.mapsTo as any)) {
      throw AppError.badRequest(`No se puede mapear a "${f.mapsTo}"`, 'FIELD_MAPPING_INVALID');
    }
  }
  // Sin forma de contactar, el lead no sirve para nada.
  const hasContact = fields.some(f => f.mapsTo === 'email' || f.mapsTo === 'phone');
  if (!hasContact) {
    throw AppError.badRequest('El formulario debe pedir al menos correo o teléfono', 'FORM_NEEDS_CONTACT');
  }
}

export async function createForm(companyId: string, data: any, userId?: string) {
  const fields: FormField[] = data.fields?.length ? data.fields : defaultFormFields();
  validateFields(fields);

  return prisma.crmCaptureForm.create({
    data: {
      companyId,
      name: data.name,
      publicKey: generatePublicKey(),
      description: data.description ?? null,
      fields: fields as any,
      consentText: data.consentText ?? 'Autorizo el tratamiento de mis datos personales para ser contactado con fines comerciales.',
      requireConsent: data.requireConsent ?? true,
      successMessage: data.successMessage ?? '¡Gracias! Nos pondremos en contacto contigo.',
      redirectUrl: data.redirectUrl ?? null,
      defaultOwnerUserId: data.defaultOwnerUserId ?? null,
      autoScore: data.autoScore ?? true,
      autoAssign: data.autoAssign ?? true,
      tags: data.tags ?? [],
      isActive: data.isActive ?? true,
      createdBy: userId ?? null,
    },
  });
}

export async function updateForm(companyId: string, id: string, data: any) {
  await getForm(companyId, id);
  if (data.fields) validateFields(data.fields);

  // La clave pública ya está publicada en el sitio del cliente: cambiarla rompería
  // todos los formularios en producción.
  const { publicKey, companyId: _c, submissionCount, ...safe } = data;

  return prisma.crmCaptureForm.update({ where: { id }, data: safe });
}

export async function deleteForm(companyId: string, id: string) {
  const form = await getForm(companyId, id);
  if (form._count.leads > 0) {
    throw AppError.badRequest(
      `No se puede eliminar: el formulario ya capturó ${form._count.leads} lead(s). Desactívalo en su lugar.`,
      'FORM_HAS_LEADS',
    );
  }
  await prisma.crmCaptureForm.delete({ where: { id } });
  return { deleted: true };
}

/** Rota la clave pública (por si se filtró y recibe spam). */
export async function rotatePublicKey(companyId: string, id: string) {
  await getForm(companyId, id);
  return prisma.crmCaptureForm.update({
    where: { id },
    data: { publicKey: generatePublicKey() },
  });
}

/** Fragmento HTML listo para pegar en el sitio del cliente. */
export function buildEmbedSnippet(form: { publicKey: string; name: string }, apiBaseUrl: string): string {
  return `<!-- Formulario KallpaPro: ${form.name} -->
<form id="kp-${form.publicKey}">
  <!-- tus campos visibles aquí; el atributo name debe coincidir con la clave del campo -->
  <input type="text" name="firstName" placeholder="Nombre" required />
  <input type="email" name="email" placeholder="Correo" required />
  <!-- honeypot: invisible para humanos, los bots lo llenan -->
  <input type="text" name="_hp" style="position:absolute;left:-9999px" tabindex="-1" autocomplete="off" />
  <button type="submit">Enviar</button>
</form>
<script>
(function () {
  var f = document.getElementById('kp-${form.publicKey}');
  var t0 = Date.now();
  var qs = new URLSearchParams(location.search);
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = Object.fromEntries(new FormData(f).entries());
    data._elapsedMs = Date.now() - t0;
    data.utmSource = qs.get('utm_source');
    data.utmMedium = qs.get('utm_medium');
    data.utmCampaign = qs.get('utm_campaign');
    data.utmTerm = qs.get('utm_term');
    data.utmContent = qs.get('utm_content');
    data.gclid = qs.get('gclid');
    data.referrer = document.referrer;
    data.landingPage = location.href;
    fetch('${apiBaseUrl}/api/public/crm/forms/${form.publicKey}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (r) { return r.json(); })
      .then(function (r) { f.innerHTML = '<p>' + (r.message || 'Gracias') + '</p>'; });
  });
})();
</script>`;
}

// ════════════════════════════════════════════════════════════════════
// Endpoint público
// ════════════════════════════════════════════════════════════════════

/** Definición que se le entrega al navegador. Nunca incluye el companyId. */
export async function getPublicForm(publicKey: string) {
  const form = await prisma.crmCaptureForm.findUnique({ where: { publicKey } });
  if (!form || !form.isActive) throw AppError.notFound('Formulario no disponible', 'FORM_NOT_FOUND');

  return {
    publicKey: form.publicKey,
    name: form.name,
    description: form.description,
    fields: form.fields,
    consentText: form.consentText,
    requireConsent: form.requireConsent,
    successMessage: form.successMessage,
    redirectUrl: form.redirectUrl,
  };
}

/** Tiempo mínimo de llenado creíble para un humano. */
const MIN_FILL_MS = 2000;

export interface SubmissionMeta {
  ipAddress?: string;
  userAgent?: string;
}

export async function submitPublicForm(
  publicKey: string,
  payload: Record<string, any>,
  meta: SubmissionMeta = {},
) {
  const form = await prisma.crmCaptureForm.findUnique({ where: { publicKey } });
  if (!form || !form.isActive) throw AppError.notFound('Formulario no disponible', 'FORM_NOT_FOUND');

  // ── Anti-bot ──
  // Se responde con éxito falso a propósito: si el bot supiera que fue detectado,
  // reintentaría cambiando de táctica.
  if (payload._hp) {
    return { ok: true, message: form.successMessage, leadId: null, spam: true };
  }
  const elapsed = Number(payload._elapsedMs);
  if (Number.isFinite(elapsed) && elapsed > 0 && elapsed < MIN_FILL_MS) {
    return { ok: true, message: form.successMessage, leadId: null, spam: true };
  }

  // ── Consentimiento (Ley Orgánica de Protección de Datos Personales, Ecuador) ──
  if (form.requireConsent && !payload.consent) {
    throw AppError.badRequest('Debes autorizar el tratamiento de tus datos', 'CONSENT_REQUIRED');
  }

  const fields = (form.fields as unknown as FormField[]) ?? [];

  // ── Validación contra la definición del formulario ──
  const missing = fields
    .filter(f => f.required)
    .filter(f => {
      const v = payload[f.key];
      return v === undefined || v === null || String(v).trim() === '';
    })
    .map(f => f.label);
  if (missing.length > 0) {
    throw AppError.badRequest(`Faltan campos obligatorios: ${missing.join(', ')}`, 'MISSING_REQUIRED_FIELDS');
  }

  const emailField = fields.find(f => f.mapsTo === 'email');
  if (emailField && payload[emailField.key]) {
    const value = String(payload[emailField.key]).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      throw AppError.badRequest('El correo electrónico no es válido', 'INVALID_EMAIL');
    }
  }

  // ── Mapeo: solo los campos declarados; el resto se descarta ──
  const mapped: CreateLeadInput = { source: 'web_form', formId: form.id, tags: form.tags };
  const rawPayload: Record<string, any> = {};

  for (const field of fields) {
    const value = payload[field.key];
    if (value === undefined || value === null || String(value).trim() === '') continue;
    if (field.mapsTo) {
      (mapped as any)[field.mapsTo] = typeof value === 'string' ? value.trim() : value;
    } else {
      rawPayload[field.key] = value;
    }
  }
  mapped.rawPayload = rawPayload;

  // ── Atribución ──
  for (const key of ATTRIBUTION_KEYS) {
    const value = payload[key];
    if (value) (mapped as any)[key] = String(value).slice(0, 500);
  }
  mapped.ipAddress = meta.ipAddress;
  mapped.userAgent = meta.userAgent?.slice(0, 500);
  if (!form.autoAssign && form.defaultOwnerUserId) mapped.ownerUserId = form.defaultOwnerUserId;

  const lead = await createLead(form.companyId, mapped);

  // Si el formulario no asignó por reglas, cae al responsable por defecto.
  if (form.autoAssign && form.defaultOwnerUserId && lead && !lead.ownerUserId) {
    await prisma.crmLead.update({ where: { id: lead.id }, data: { ownerUserId: form.defaultOwnerUserId } });
  }

  await prisma.crmCaptureForm.update({
    where: { id: form.id },
    data: { submissionCount: { increment: 1 } },
  });

  return {
    ok: true,
    message: form.successMessage,
    redirectUrl: form.redirectUrl,
    leadId: lead?.id ?? null,
  };
}
