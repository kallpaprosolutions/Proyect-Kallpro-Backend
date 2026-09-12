/**
 * Servicio de leads (Sprint 13) — captura, scoring, deduplicación, enrutamiento y conversión.
 *
 * El pipeline de entrada de un lead, en orden:
 *   1. normalizar (teléfono a E.164, correo en minúsculas)
 *   2. deduplicar contra los leads y contactos existentes de la empresa
 *   3. puntuar con las reglas de la empresa (fit + engagement - negativos)
 *   4. enrutar a un responsable con las reglas de asignación
 *   5. registrar el evento de captura
 *
 * Ninguno de los pasos 2-5 puede tumbar la captura: si el scoring falla, el lead entra
 * igual con score 0. Perder un lead porque una regla estaba mal escrita sería peor que
 * tenerlo sin puntuar.
 */

import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { logger } from '../../lib/logger';
import { calculateLeadScore } from './engines/lead-scoring.engine';
import { findDuplicate, DedupCandidate } from './engines/lead-dedup.engine';
import { routeLead } from './engines/lead-routing.engine';
import {
  getScoringConfig, getScoringRules, getAssignmentRules,
} from './crm-config.service';

export const LEAD_STATUSES = ['NEW', 'WORKING', 'QUALIFIED', 'CONVERTED', 'DISQUALIFIED'] as const;
export type LeadStatus = typeof LEAD_STATUSES[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'Nuevo',
  WORKING: 'En gestión',
  QUALIFIED: 'Calificado',
  CONVERTED: 'Convertido',
  DISQUALIFIED: 'Descartado',
};

export const LEAD_EVENT_TYPES = [
  'form_submit', 'email_open', 'email_click', 'page_view', 'pricing_view',
  'demo_request', 'message_reply', 'meeting_booked', 'doc_download', 'unsubscribe',
] as const;

export const LEAD_EVENT_LABELS: Record<string, string> = {
  form_submit: 'Envió un formulario',
  email_open: 'Abrió un correo',
  email_click: 'Hizo clic en un correo',
  page_view: 'Visitó una página',
  pricing_view: 'Vio la página de precios',
  demo_request: 'Solicitó una demostración',
  message_reply: 'Respondió un mensaje',
  meeting_booked: 'Agendó una reunión',
  doc_download: 'Descargó material',
  unsubscribe: 'Se dio de baja',
};

export interface CreateLeadInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  companyName?: string;
  ruc?: string;
  website?: string;
  city?: string;
  message?: string;
  rawPayload?: Record<string, any>;
  source?: string;
  formId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
  landingPage?: string;
  gclid?: string;
  ipAddress?: string;
  userAgent?: string;
  ownerUserId?: string;
  tags?: string[];
}

/**
 * Normaliza un teléfono ecuatoriano a E.164.
 * "0998887766" → "+593998887766". Si ya viene con +, se respeta.
 */
export function toE164(phone?: string | null, countryCode = '593'): string | undefined {
  if (!phone) return undefined;
  const trimmed = String(phone).trim();
  if (trimmed.startsWith('+')) return '+' + trimmed.slice(1).replace(/\D/g, '');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return undefined;
  // 09XXXXXXXX (celular local) o 0X-XXXXXXX (fijo): se quita el 0 inicial.
  const national = digits.startsWith('0') ? digits.slice(1) : digits;
  if (national.startsWith(countryCode)) return `+${national}`;
  return `+${countryCode}${national}`;
}

// ════════════════════════════════════════════════════════════════════
// Captura
// ════════════════════════════════════════════════════════════════════

export async function createLead(companyId: string, input: CreateLeadInput) {
  const email = input.email ? String(input.email).trim().toLowerCase() : undefined;
  const phone = toE164(input.phone);

  // ── 1. Deduplicación contra leads y contactos vivos de la empresa ──
  const dedupe = await checkDuplicate(companyId, { email, phone, ruc: input.ruc, firstName: input.firstName, lastName: input.lastName, companyName: input.companyName });

  const lead = await prisma.crmLead.create({
    data: {
      companyId,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      email: email ?? null,
      phone: phone ?? null,
      jobTitle: input.jobTitle ?? null,
      companyName: input.companyName ?? null,
      ruc: input.ruc ?? null,
      website: input.website ?? null,
      city: input.city ?? null,
      message: input.message ?? null,
      rawPayload: (input.rawPayload ?? {}) as any,
      source: input.source ?? 'manual',
      formId: input.formId ?? null,
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      utmTerm: input.utmTerm ?? null,
      utmContent: input.utmContent ?? null,
      referrer: input.referrer ?? null,
      landingPage: input.landingPage ?? null,
      gclid: input.gclid ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      ownerUserId: input.ownerUserId ?? null,
      tags: input.tags ?? [],
      isDuplicate: dedupe.isDuplicate,
      duplicateOfId: dedupe.isDuplicate ? dedupe.best!.candidateId : null,
      dedupeScore: dedupe.best?.score ?? 0,
      dedupeReason: dedupe.best?.reason ?? null,
    },
  });

  // ── 2. Evento de captura: es la primera señal de interacción ──
  await prisma.crmLeadEvent.create({
    data: {
      leadId: lead.id,
      eventType: input.source === 'web_form' ? 'form_submit' : 'page_view',
      channel: input.source === 'web_form' ? 'web' : null,
      metadata: { source: input.source, campaign: input.utmCampaign } as any,
    },
  }).catch(err => logger.warn('[crm-lead] no se pudo registrar el evento de captura', { err, leadId: lead.id }));

  // ── 3 y 4. Scoring y enrutamiento: nunca deben tumbar la captura ──
  try {
    await rescoreLead(companyId, lead.id);
  } catch (err) {
    logger.error('[crm-lead] fallo el scoring inicial (no-fatal)', { err, leadId: lead.id });
  }

  if (!input.ownerUserId) {
    try {
      await assignLead(companyId, lead.id);
    } catch (err) {
      logger.error('[crm-lead] fallo la asignación automática (no-fatal)', { err, leadId: lead.id });
    }
  }

  return prisma.crmLead.findUnique({ where: { id: lead.id } });
}

/** Busca duplicados sin crear nada. Lo usa también la interfaz antes de guardar. */
export async function checkDuplicate(companyId: string, candidate: Partial<DedupCandidate>) {
  const incoming: DedupCandidate = { id: 'incoming', ...candidate };

  // Solo se comparan leads que siguen vivos: uno descartado ya no es un duplicado útil.
  const [leads, contacts] = await Promise.all([
    prisma.crmLead.findMany({
      where: { companyId, status: { notIn: ['DISQUALIFIED'] } },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, ruc: true, companyName: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.crmContact.findMany({
      where: { companyId },
      select: {
        id: true, firstName: true, lastName: true, email: true, phoneE164: true,
        crmCompany: { select: { ruc: true, legalName: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    }),
  ]);

  const candidates: DedupCandidate[] = [
    ...leads,
    ...contacts.map(c => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phoneE164,
      ruc: c.crmCompany?.ruc ?? null,
      companyName: c.crmCompany?.legalName ?? null,
    })),
  ];

  return findDuplicate(incoming, candidates);
}

// ════════════════════════════════════════════════════════════════════
// Scoring
// ════════════════════════════════════════════════════════════════════

/** Recalcula el score de un lead con la configuración vigente de la empresa. */
export async function rescoreLead(companyId: string, leadId: string) {
  const lead = await prisma.crmLead.findFirst({
    where: { id: leadId, companyId },
    include: { events: { select: { eventType: true, occurredAt: true } } },
  });
  if (!lead) throw AppError.notFound('Lead no encontrado', 'LEAD_NOT_FOUND');

  const [rules, config] = await Promise.all([
    getScoringRules(companyId),
    getScoringConfig(companyId),
  ]);

  // Los campos personalizados del formulario también son puntuables: se aplanan junto
  // a los campos fijos para que una regla pueda mirar "presupuesto" o "sector".
  const flat = { ...(lead.rawPayload as Record<string, any> ?? {}), ...lead };

  const result = calculateLeadScore(flat, lead.events, rules, config);

  const updated = await prisma.crmLead.update({
    where: { id: leadId },
    data: {
      score: result.score,
      fitScore: result.fitScore,
      engageScore: result.engageScore,
      grade: result.grade,
      temperature: result.temperature,
      scoreBreakdown: result.breakdown as any,
      scoredAt: new Date(),
    },
  });

  return { lead: updated, result };
}

/** Recalcula todos los leads abiertos. Útil tras cambiar las reglas. */
export async function rescoreAllLeads(companyId: string) {
  const leads = await prisma.crmLead.findMany({
    where: { companyId, status: { in: ['NEW', 'WORKING', 'QUALIFIED'] } },
    select: { id: true },
  });

  let ok = 0;
  let failed = 0;
  for (const { id } of leads) {
    try {
      await rescoreLead(companyId, id);
      ok++;
    } catch (err) {
      failed++;
      logger.warn('[crm-lead] no se pudo recalcular el score', { err, leadId: id });
    }
  }
  return { total: leads.length, recalculados: ok, fallidos: failed };
}

/** Registra una señal de interacción y vuelve a puntuar. */
export async function registerEvent(
  companyId: string,
  leadId: string,
  eventType: string,
  channel?: string,
  metadata?: Record<string, any>,
) {
  const lead = await prisma.crmLead.findFirst({ where: { id: leadId, companyId } });
  if (!lead) throw AppError.notFound('Lead no encontrado', 'LEAD_NOT_FOUND');

  await prisma.crmLeadEvent.create({
    data: { leadId, eventType, channel: channel ?? null, metadata: (metadata ?? {}) as any },
  });

  const { lead: updated, result } = await rescoreLead(companyId, leadId);
  return { lead: updated, score: result };
}

// ════════════════════════════════════════════════════════════════════
// Enrutamiento
// ════════════════════════════════════════════════════════════════════

export async function assignLead(companyId: string, leadId: string, fallbackOwnerUserId?: string | null) {
  const lead = await prisma.crmLead.findFirst({ where: { id: leadId, companyId } });
  if (!lead) throw AppError.notFound('Lead no encontrado', 'LEAD_NOT_FOUND');

  const rules = await getAssignmentRules(companyId);
  const decision = routeLead(lead as any, rules, fallbackOwnerUserId);

  if (!decision.ownerUserId) return { lead, decision };

  // El cursor del round-robin se persiste aquí para que el motor siga siendo puro.
  const writes: any[] = [
    prisma.crmLead.update({
      where: { id: leadId },
      data: { ownerUserId: decision.ownerUserId, assignedByRuleId: decision.ruleId },
    }),
  ];
  if (decision.ruleId) {
    writes.push(prisma.crmAssignmentRule.update({
      where: { id: decision.ruleId },
      data: {
        matchCount: { increment: 1 },
        ...(decision.nextCursor !== null && { rrCursor: decision.nextCursor }),
      },
    }));
  }
  const [updated] = await prisma.$transaction(writes);

  return { lead: updated, decision };
}

// ════════════════════════════════════════════════════════════════════
// Consulta
// ════════════════════════════════════════════════════════════════════

export async function listLeads(companyId: string, filters?: {
  status?: string;
  grade?: string;
  temperature?: string;
  source?: string;
  ownerUserId?: string;
  search?: string;
  onlyDuplicates?: boolean;
  minScore?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'score' | 'createdAt';
}) {
  const where: any = { companyId };
  if (filters?.status) where.status = filters.status;
  if (filters?.grade) where.grade = filters.grade;
  if (filters?.temperature) where.temperature = filters.temperature;
  if (filters?.source) where.source = filters.source;
  if (filters?.ownerUserId) where.ownerUserId = filters.ownerUserId;
  if (filters?.onlyDuplicates) where.isDuplicate = true;
  if (filters?.minScore !== undefined) where.score = { gte: filters.minScore };
  if (filters?.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { companyName: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: filters.search } },
    ];
  }

  const orderBy = filters?.sortBy === 'createdAt'
    ? { createdAt: 'desc' as const }
    : [{ score: 'desc' as const }, { createdAt: 'desc' as const }];

  const [leads, total] = await Promise.all([
    prisma.crmLead.findMany({
      where,
      orderBy,
      take: filters?.limit ?? 50,
      skip: filters?.offset ?? 0,
      include: { form: { select: { id: true, name: true } }, _count: { select: { events: true } } },
    }),
    prisma.crmLead.count({ where }),
  ]);

  return { leads, total };
}

export async function getLead(companyId: string, id: string) {
  const lead = await prisma.crmLead.findFirst({
    where: { id, companyId },
    include: {
      form: { select: { id: true, name: true } },
      events: { orderBy: { occurredAt: 'desc' }, take: 50 },
    },
  });
  if (!lead) throw AppError.notFound('Lead no encontrado', 'LEAD_NOT_FOUND');
  return lead;
}

export async function updateLead(companyId: string, id: string, data: Partial<CreateLeadInput> & { status?: LeadStatus; disqualifyReason?: string }) {
  const lead = await prisma.crmLead.findFirst({ where: { id, companyId } });
  if (!lead) throw AppError.notFound('Lead no encontrado', 'LEAD_NOT_FOUND');
  if (lead.status === 'CONVERTED') {
    // Regla transversal 5: lo convertido no se edita, se trabaja sobre el contacto.
    throw AppError.badRequest('Este lead ya fue convertido; edita el contacto resultante', 'LEAD_ALREADY_CONVERTED');
  }
  if (data.status && !LEAD_STATUSES.includes(data.status)) {
    throw AppError.badRequest('Estado de lead inválido', 'INVALID_LEAD_STATUS');
  }
  if (data.status === 'CONVERTED') {
    throw AppError.badRequest('Usa la acción Convertir para pasar el lead a contacto', 'USE_CONVERT_ACTION');
  }

  const updated = await prisma.crmLead.update({
    where: { id },
    data: {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.email !== undefined && { email: data.email?.toLowerCase() ?? null }),
      ...(data.phone !== undefined && { phone: toE164(data.phone) ?? null }),
      ...(data.jobTitle !== undefined && { jobTitle: data.jobTitle }),
      ...(data.companyName !== undefined && { companyName: data.companyName }),
      ...(data.ruc !== undefined && { ruc: data.ruc }),
      ...(data.website !== undefined && { website: data.website }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.message !== undefined && { message: data.message }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.ownerUserId !== undefined && { ownerUserId: data.ownerUserId }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.disqualifyReason !== undefined && { disqualifyReason: data.disqualifyReason }),
    },
  });

  // Si cambiaron datos que alimentan el scoring, se vuelve a puntuar.
  const scoringFields = ['jobTitle', 'companyName', 'ruc', 'city', 'email', 'phone', 'website', 'message'];
  if (scoringFields.some(f => (data as any)[f] !== undefined)) {
    await rescoreLead(companyId, id).catch(() => undefined);
  }

  return prisma.crmLead.findUnique({ where: { id } });
}

/** Descarta un lead con motivo. No se borra: la tasa de descarte es una métrica. */
export async function disqualifyLead(companyId: string, id: string, reason: string) {
  const lead = await prisma.crmLead.findFirst({ where: { id, companyId } });
  if (!lead) throw AppError.notFound('Lead no encontrado', 'LEAD_NOT_FOUND');
  if (lead.status === 'CONVERTED') {
    throw AppError.badRequest('Un lead convertido no se puede descartar', 'LEAD_ALREADY_CONVERTED');
  }
  return prisma.crmLead.update({
    where: { id },
    data: { status: 'DISQUALIFIED', disqualifyReason: reason },
  });
}

// ════════════════════════════════════════════════════════════════════
// Conversión lead → contacto + empresa + oportunidad
// ════════════════════════════════════════════════════════════════════

export interface ConvertLeadInput {
  createDeal?: boolean;
  dealName?: string;
  dealAmount?: number;
  dealStage?: string;
  expectedCloseDate?: string;
  /** Reutilizar un contacto existente en vez de crear uno (caso duplicado). */
  existingContactId?: string;
  existingCrmCompanyId?: string;
}

/**
 * Convierte el lead. Es una operación de UNA SOLA VEZ y transaccional: o se crean el
 * contacto, la empresa y la oportunidad, o no se crea nada. Una conversión a medias deja
 * un contacto sin oportunidad y el vendedor no se entera.
 */
export async function convertLead(
  companyId: string,
  leadId: string,
  input: ConvertLeadInput = {},
  userId?: string,
) {
  const lead = await prisma.crmLead.findFirst({ where: { id: leadId, companyId } });
  if (!lead) throw AppError.notFound('Lead no encontrado', 'LEAD_NOT_FOUND');
  if (lead.status === 'CONVERTED') {
    throw AppError.conflict('Este lead ya fue convertido', 'LEAD_ALREADY_CONVERTED');
  }
  if (lead.status === 'DISQUALIFIED') {
    throw AppError.badRequest('Un lead descartado no se puede convertir; reactívalo primero', 'LEAD_DISQUALIFIED');
  }
  if (!lead.firstName && !lead.email && !lead.phone) {
    throw AppError.badRequest('El lead necesita al menos nombre, correo o teléfono para convertirse', 'LEAD_TOO_EMPTY');
  }

  const stages = await prisma.crmPipelineStage.findMany({
    where: { companyId, isActive: true },
    orderBy: { sequence: 'asc' },
  });
  const firstStage = stages.find(s => !s.isWon && !s.isLost);
  const targetStageCode = input.dealStage ?? firstStage?.code ?? 'lead';
  const targetStage = stages.find(s => s.code === targetStageCode);

  return prisma.$transaction(async tx => {
    // ── Empresa ──
    let crmCompanyId = input.existingCrmCompanyId ?? null;
    if (!crmCompanyId && (lead.companyName || lead.ruc)) {
      // Si ya existe una empresa con ese RUC no se duplica: el RUC es único en Ecuador.
      const existing = lead.ruc
        ? await tx.crmCompany.findFirst({ where: { companyId, ruc: lead.ruc } })
        : null;
      if (existing) {
        crmCompanyId = existing.id;
      } else {
        const created = await tx.crmCompany.create({
          data: {
            companyId,
            legalName: lead.companyName ?? `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim(),
            ruc: lead.ruc,
            website: lead.website,
            city: lead.city,
            lifecycleStage: 'opportunity',
            ownerUserId: lead.ownerUserId,
          },
        });
        crmCompanyId = created.id;
      }
    }

    // ── Contacto ──
    let contactId = input.existingContactId ?? null;
    if (!contactId) {
      const contact = await tx.crmContact.create({
        data: {
          companyId,
          crmCompanyId,
          firstName: lead.firstName ?? 'Sin nombre',
          lastName: lead.lastName,
          email: lead.email,
          phoneE164: lead.phone,
          title: lead.jobTitle,
          ownerUserId: lead.ownerUserId,
          leadScore: lead.score,
          leadTemperature: lead.temperature,
          tags: lead.tags,
        },
      });
      contactId = contact.id;
    } else {
      // Al reutilizar un contacto se refresca su score con el del lead entrante.
      await tx.crmContact.update({
        where: { id: contactId },
        data: { leadScore: lead.score, leadTemperature: lead.temperature },
      });
    }

    // ── Oportunidad ──
    let dealId: string | null = null;
    if (input.createDeal !== false) {
      const deal = await tx.crmDeal.create({
        data: {
          companyId,
          contactId,
          crmCompanyId,
          name: input.dealName ?? `${lead.companyName ?? lead.firstName ?? 'Nueva'} — oportunidad`,
          stage: targetStageCode,
          amountUsd: input.dealAmount ?? 0,
          probability: targetStage?.probability ?? 10,
          forecastCategory: targetStage?.forecastCategory ?? 'PIPELINE',
          expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : null,
          ownerUserId: lead.ownerUserId,
          leadId: lead.id,
          notes: lead.message,
          tags: lead.tags,
          lastActivityAt: new Date(),
        },
      });
      dealId = deal.id;

      await tx.crmDealStageHistory.create({
        data: { dealId, fromStage: null, toStage: targetStageCode, changedBy: userId, notes: 'Creada al convertir el lead' },
      });
    }

    const updatedLead = await tx.crmLead.update({
      where: { id: leadId },
      data: {
        status: 'CONVERTED',
        convertedAt: new Date(),
        convertedContactId: contactId,
        convertedCompanyId: crmCompanyId,
        convertedDealId: dealId,
      },
    });

    return { lead: updatedLead, contactId, crmCompanyId, dealId };
  });
}

// ════════════════════════════════════════════════════════════════════
// Métricas de la bandeja
// ════════════════════════════════════════════════════════════════════

export async function getLeadStats(companyId: string) {
  const [byStatus, byGrade, bySource, total, duplicates, converted, aggregate] = await Promise.all([
    prisma.crmLead.groupBy({ by: ['status'], where: { companyId }, _count: { id: true } }),
    prisma.crmLead.groupBy({ by: ['grade'], where: { companyId, status: { notIn: ['CONVERTED', 'DISQUALIFIED'] } }, _count: { id: true } }),
    prisma.crmLead.groupBy({ by: ['source'], where: { companyId }, _count: { id: true } }),
    prisma.crmLead.count({ where: { companyId } }),
    prisma.crmLead.count({ where: { companyId, isDuplicate: true, status: { notIn: ['CONVERTED', 'DISQUALIFIED'] } } }),
    prisma.crmLead.count({ where: { companyId, status: 'CONVERTED' } }),
    prisma.crmLead.aggregate({ where: { companyId, status: { notIn: ['CONVERTED', 'DISQUALIFIED'] } }, _avg: { score: true } }),
  ]);

  const config = await getScoringConfig(companyId);
  const [mql, sql] = await Promise.all([
    prisma.crmLead.count({ where: { companyId, score: { gte: config.mqlThreshold, lt: config.sqlThreshold }, status: { notIn: ['CONVERTED', 'DISQUALIFIED'] } } }),
    prisma.crmLead.count({ where: { companyId, score: { gte: config.sqlThreshold }, status: { notIn: ['CONVERTED', 'DISQUALIFIED'] } } }),
  ]);

  return {
    total,
    converted,
    // Tasa de conversión sobre el total capturado: la métrica que justifica el canal.
    conversionRate: total > 0 ? Math.round((converted / total) * 1000) / 10 : 0,
    duplicatesPending: duplicates,
    avgScore: Math.round(aggregate._avg.score ?? 0),
    mql,
    sql,
    byStatus: byStatus.map(s => ({ status: s.status, label: LEAD_STATUS_LABELS[s.status as LeadStatus] ?? s.status, count: s._count.id })),
    byGrade: byGrade.map(g => ({ grade: g.grade, count: g._count.id })),
    bySource: bySource.map(s => ({ source: s.source, count: s._count.id })),
    thresholds: { mql: config.mqlThreshold, sql: config.sqlThreshold },
  };
}
