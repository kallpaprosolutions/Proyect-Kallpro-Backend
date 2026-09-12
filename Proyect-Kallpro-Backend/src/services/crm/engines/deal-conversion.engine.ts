/**
 * Puente CRM → Ventas: decide con qué Customer del ERP se casa una oportunidad ganada y
 * arma las líneas de la cotización a partir de los productos conversados. Motor puro (sin
 * Prisma): el servicio le pasa los candidatos ya cargados.
 *
 * Regla de emparejamiento (en este orden, la primera coincidencia gana): RUC de la empresa
 * CRM → email del contacto → razón social exacta (sin mayúsculas/espacios). Nunca se
 * empareja por nombre "parecido": crear un cliente de más es barato de corregir, mezclar
 * dos clientes reales no.
 */
export interface CustomerCandidate {
  id: string;
  ruc?: string | null;
  email?: string | null;
  name: string;
  razonSocial?: string | null;
}

export interface CrmCompanyRef {
  ruc?: string | null;
  legalName: string;
  tradeName?: string | null;
  city?: string | null;
  address?: string | null;
  size?: string | null;
}

export interface CrmContactRef {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phoneE164?: string | null;
}

export interface DealItemInput {
  productId: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
}

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();

export function pickCustomerMatch(
  candidates: CustomerCandidate[],
  crmCompany?: CrmCompanyRef | null,
  contact?: CrmContactRef | null,
): string | null {
  const ruc = norm(crmCompany?.ruc);
  if (ruc) {
    const byRuc = candidates.find((c) => norm(c.ruc) === ruc);
    if (byRuc) return byRuc.id;
  }
  const email = norm(contact?.email);
  if (email) {
    const byEmail = candidates.find((c) => norm(c.email) === email);
    if (byEmail) return byEmail.id;
  }
  const legal = norm(crmCompany?.legalName);
  if (legal) {
    const byName = candidates.find((c) => norm(c.razonSocial) === legal || norm(c.name) === legal);
    if (byName) return byName.id;
  }
  return null;
}

/** Datos mínimos para crear el Customer del ERP cuando no existe. */
export function buildCustomerDraft(crmCompany?: CrmCompanyRef | null, contact?: CrmContactRef | null) {
  const contactName = [contact?.firstName, contact?.lastName].filter(Boolean).join(' ').trim();
  const name = crmCompany?.tradeName || crmCompany?.legalName || contactName;
  if (!name) throw new Error('La oportunidad no tiene empresa ni contacto con nombre para crear el cliente');
  const ruc = (crmCompany?.ruc ?? '').trim() || null;
  return {
    name,
    razonSocial: crmCompany?.legalName ?? null,
    nombreComercial: crmCompany?.tradeName ?? null,
    ruc,
    documentType: ruc ? 'RUC' : null,
    personType: crmCompany ? 'JURIDICA' : 'NATURAL',
    email: contact?.email ?? null,
    phone: contact?.phoneE164 ?? null,
    address: crmCompany?.address ?? null,
    city: crmCompany?.city ?? null,
    country: 'EC',
  };
}

export function buildQuotationItems(items: DealItemInput[]) {
  if (items.length === 0) {
    throw new Error('La oportunidad no tiene productos: agrégalos antes de generar la cotización');
  }
  return items.map((it, idx) => {
    if (!it.productId) throw new Error(`La línea ${idx + 1} no tiene producto`);
    if (!(it.quantity > 0)) throw new Error(`La línea ${idx + 1} debe tener cantidad mayor a cero`);
    if (it.unitPrice < 0) throw new Error(`La línea ${idx + 1} tiene precio negativo`);
    return {
      productId: it.productId,
      description: it.description ?? undefined,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discount: 0,
    };
  });
}
