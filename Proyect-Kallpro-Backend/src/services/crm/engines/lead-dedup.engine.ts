/**
 * Motor de deduplicación de leads — PURO (sin BD, sin I/O). Regla transversal 6.
 *
 * Por qué existe: el mismo comprador entra por el formulario web, por WhatsApp y por una
 * feria, y termina siendo tres registros. Con tres registros la tasa de conversión miente,
 * el vendedor llama dos veces y el cliente percibe desorden. La industria coincide en que
 * hay que deduplicar EN LA PUERTA, no limpiar después.
 *
 * Decisión de diseño: NO se borra ni se fusiona automáticamente. Se marca el lead como
 * posible duplicado con un puntaje de confianza y el motivo, y un humano decide. Fusionar
 * solo por parecido es cómo se pierden datos de forma irreversible.
 *
 * Señales, de más a menos fiable:
 *   RUC idéntico            → 100 (identificador legal único en Ecuador)
 *   correo idéntico         →  95
 *   teléfono E.164 idéntico →  90
 *   dominio corporativo +
 *     nombre muy parecido   →  75
 *   nombre + empresa igual  →  70
 *   solo dominio corporativo→  40 (dos personas de la misma empresa NO son duplicados)
 */

import { normalize } from './condition.engine';

export interface DedupCandidate {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  ruc?: string | null;
  companyName?: string | null;
}

export interface DedupMatch {
  candidateId: string;
  score: number;   // 0-100 confianza
  reason: string;  // en español, para mostrárselo al usuario
}

/** Umbral por defecto a partir del cual se marca como duplicado. */
export const DEDUPE_THRESHOLD = 70;

/** Proveedores de correo personal: su dominio NO identifica a una empresa. */
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.es',
  'live.com', 'icloud.com', 'protonmail.com', 'hotmail.es', 'outlook.es',
]);

/** Solo los dígitos; los últimos 9 son los significativos en Ecuador. */
export function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length > 9 ? digits.slice(-9) : digits;
}

export function emailDomain(email?: string | null): string {
  if (!email || !email.includes('@')) return '';
  return normalize(email.split('@').pop());
}

export function isCorporateDomain(domain: string): boolean {
  return domain !== '' && !PERSONAL_EMAIL_DOMAINS.has(domain);
}

function fullName(c: { firstName?: string | null; lastName?: string | null }): string {
  return normalize(`${c.firstName ?? ''} ${c.lastName ?? ''}`).replace(/\s+/g, ' ').trim();
}

/**
 * Similitud de dos textos por coeficiente de Dice sobre bigramas (0-1).
 * Se prefiere a Levenshtein porque tolera bien el orden invertido de nombre y apellido,
 * que es el error de tipeo más común en un formulario.
 */
export function stringSimilarity(a: string, b: string): number {
  const x = normalize(a).replace(/\s+/g, '');
  const y = normalize(b).replace(/\s+/g, '');
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;

  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };

  const ba = bigrams(x);
  const bb = bigrams(y);
  let hits = 0;
  for (const [g, count] of ba) {
    const other = bb.get(g) ?? 0;
    hits += Math.min(count, other);
  }
  return (2 * hits) / (x.length - 1 + y.length - 1);
}

/** Compara el lead entrante contra UN candidato existente. */
export function scorePair(incoming: DedupCandidate, candidate: DedupCandidate): DedupMatch | null {
  if (incoming.id && candidate.id && incoming.id === candidate.id) return null;

  const rucA = normalize(incoming.ruc);
  const rucB = normalize(candidate.ruc);
  if (rucA && rucA === rucB) {
    return { candidateId: candidate.id, score: 100, reason: `Mismo RUC (${candidate.ruc})` };
  }

  const emailA = normalize(incoming.email);
  const emailB = normalize(candidate.email);
  if (emailA && emailA === emailB) {
    return { candidateId: candidate.id, score: 95, reason: `Mismo correo (${candidate.email})` };
  }

  const phoneA = normalizePhone(incoming.phone);
  const phoneB = normalizePhone(candidate.phone);
  if (phoneA && phoneA.length >= 7 && phoneA === phoneB) {
    return { candidateId: candidate.id, score: 90, reason: `Mismo teléfono (${candidate.phone})` };
  }

  const nameA = fullName(incoming);
  const nameB = fullName(candidate);
  const nameSim = nameA && nameB ? stringSimilarity(nameA, nameB) : 0;

  const domA = emailDomain(incoming.email);
  const domB = emailDomain(candidate.email);
  const sameCorpDomain = domA !== '' && domA === domB && isCorporateDomain(domA);

  if (sameCorpDomain && nameSim >= 0.8) {
    return {
      candidateId: candidate.id,
      score: 75,
      reason: `Mismo dominio corporativo (@${domA}) y nombre muy parecido`,
    };
  }

  const compA = normalize(incoming.companyName);
  const compB = normalize(candidate.companyName);
  if (nameSim >= 0.85 && compA && compA === compB) {
    return {
      candidateId: candidate.id,
      score: 70,
      reason: `Mismo nombre y misma empresa (${candidate.companyName})`,
    };
  }

  if (sameCorpDomain) {
    // Dos personas distintas de la misma empresa NO son duplicados: puntaje informativo,
    // por debajo del umbral, para que el vendedor vea la relación sin bloquear el lead.
    return {
      candidateId: candidate.id,
      score: 40,
      reason: `Misma empresa por dominio (@${domA}), persona distinta`,
    };
  }

  return null;
}

/**
 * Busca el mejor duplicado entre los candidatos.
 * Devuelve `isDuplicate` solo si supera el umbral.
 */
export function findDuplicate(
  incoming: DedupCandidate,
  candidates: DedupCandidate[],
  threshold: number = DEDUPE_THRESHOLD,
): { isDuplicate: boolean; best: DedupMatch | null; all: DedupMatch[] } {
  const all = (candidates ?? [])
    .map(c => scorePair(incoming, c))
    .filter((m): m is DedupMatch => m !== null)
    .sort((a, b) => b.score - a.score);

  const best = all[0] ?? null;
  return { isDuplicate: best !== null && best.score >= threshold, best, all };
}
