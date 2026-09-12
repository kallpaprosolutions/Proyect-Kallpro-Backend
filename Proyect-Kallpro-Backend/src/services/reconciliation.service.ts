import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const r2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 24 * 3600 * 1000;

/**
 * Conciliación bancaria (Sprint 9.1).
 *
 * Dos niveles:
 *  - AUTOMÁTICA: línea del extracto y movimiento del sistema coinciden en monto
 *    exacto + tipo, con fecha dentro de ±3 días y match ÚNICO (sin ambigüedad),
 *    o con la misma referencia (n.º de cheque/comprobante). Se concilia sola.
 *  - SEMIAUTOMÁTICA: mismo monto y tipo pero fecha entre 4 y 15 días, o varios
 *    candidatos posibles → se proponen SUGERENCIAS y el usuario confirma.
 *  - Líneas sin contraparte (comisiones, intereses, ND/NC bancarias) → el
 *    usuario puede crear el movimiento MANUAL desde la línea del extracto.
 */

export interface StatementLineInput {
  date: string;        // YYYY-MM-DD
  description: string;
  reference?: string;
  amount: number;      // + crédito (ingreso) · − débito (egreso)
}

export interface MatchCandidate { transactionId: string; score: number; reason: string }

interface TxLike {
  id: string;
  type: string;          // INGRESO | EGRESO
  amount: number;
  date: Date;
  reference?: string | null;
  status: string;        // solo REGISTRADO es conciliable
}

const AUTO_WINDOW_DAYS = 3;
const SUGGEST_WINDOW_DAYS = 15;

/**
 * Matcher puro (testeable): decide para cada línea si hay match automático,
 * sugerencias, o nada. Un movimiento solo puede asignarse a UNA línea.
 */
export function matchStatementLines(
  lines: Array<StatementLineInput & { key: number }>,
  transactions: TxLike[],
): { auto: Map<number, MatchCandidate>; suggestions: Map<number, MatchCandidate[]> } {
  const auto = new Map<number, MatchCandidate>();
  const suggestions = new Map<number, MatchCandidate[]>();
  const taken = new Set<string>();
  const available = transactions.filter((t) => t.status === 'REGISTRADO');

  const candidatesFor = (line: StatementLineInput) => {
    const lineType = line.amount >= 0 ? 'INGRESO' : 'EGRESO';
    const lineAmount = r2(Math.abs(line.amount));
    const lineDate = new Date(`${line.date}T00:00:00Z`).getTime();
    return available
      .filter((t) => !taken.has(t.id) && t.type === lineType && r2(t.amount) === lineAmount)
      .map((t) => {
        const days = Math.abs(t.date.getTime() - lineDate) / DAY;
        const refMatch = !!(line.reference && t.reference && line.reference.trim() === t.reference.trim());
        return { tx: t, days, refMatch };
      })
      .filter((c) => c.refMatch || c.days <= SUGGEST_WINDOW_DAYS)
      .sort((a, b) => (Number(b.refMatch) - Number(a.refMatch)) || (a.days - b.days));
  };

  // Pasada 1: matches automáticos (referencia idéntica, o único candidato en ±3 días)
  for (const line of lines) {
    const cands = candidatesFor(line);
    if (cands.length === 0) continue;
    const best = cands[0];
    const inAutoWindow = cands.filter((c) => c.refMatch || c.days <= AUTO_WINDOW_DAYS);
    if (best.refMatch || (inAutoWindow.length === 1 && best.days <= AUTO_WINDOW_DAYS)) {
      auto.set(line.key, {
        transactionId: best.tx.id,
        score: best.refMatch ? 100 : 90,
        reason: best.refMatch ? `Referencia idéntica (${line.reference})` : `Monto exacto · ${Math.round(best.days)} día(s) de diferencia`,
      });
      taken.add(best.tx.id);
    }
  }

  // Pasada 2: sugerencias para lo no conciliado
  for (const line of lines) {
    if (auto.has(line.key)) continue;
    const cands = candidatesFor(line);
    if (cands.length === 0) continue;
    suggestions.set(line.key, cands.slice(0, 3).map((c) => ({
      transactionId: c.tx.id,
      score: Math.max(10, 80 - Math.round(c.days * 4)),
      reason: `Monto exacto · ${Math.round(c.days)} día(s) de diferencia`,
    })));
  }

  return { auto, suggestions };
}

// ═══════════════════════════════════════════════════════════════
// PERSISTENCIA Y ORQUESTACIÓN
// ═══════════════════════════════════════════════════════════════

export async function importStatement(
  companyId: string,
  bankAccountId: string,
  lines: StatementLineInput[],
  userId?: string,
) {
  const account = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId } });
  if (!account) throw new Error('ACCOUNT_NOT_FOUND');
  const valid = (lines ?? []).filter((l) => l.date && Number.isFinite(Number(l.amount)) && Number(l.amount) !== 0);
  if (valid.length === 0) throw new Error('VALIDATION: sin líneas válidas (fecha y monto ≠ 0 requeridos)');

  // Movimientos aún no conciliados de esa cuenta
  const txs = await prisma.bankTransaction.findMany({
    where: { companyId, bankAccountId, status: 'REGISTRADO' },
  });
  const keyed = valid.map((l, i) => ({ ...l, key: i }));
  const { auto } = matchStatementLines(keyed, txs.map((t) => ({
    id: t.id, type: t.type, amount: Number(t.amount), date: t.date, reference: t.reference, status: t.status,
  })));

  let autoMatched = 0;
  const created: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const line of keyed) {
      const match = auto.get(line.key);
      const row = await tx.bankStatementLine.create({
        data: {
          companyId, bankAccountId,
          date: new Date(`${line.date}T00:00:00Z`),
          description: line.description?.trim() || 'Movimiento del extracto',
          reference: line.reference?.trim() || null,
          amount: new Prisma.Decimal(line.amount),
          status: match ? 'CONCILIADO' : 'PENDIENTE',
          matchedTransactionId: match?.transactionId ?? null,
          matchType: match ? 'AUTO' : null,
          importedBy: userId,
        },
      });
      created.push(row.id);
      if (match) {
        await tx.bankTransaction.update({ where: { id: match.transactionId }, data: { status: 'CONCILIADO' } });
        autoMatched++;
      }
    }
  });

  return { imported: created.length, autoMatched, pending: created.length - autoMatched };
}

/** Estado de conciliación de una cuenta: pendientes con sugerencias + estadísticas. */
export async function getReconciliationStatus(companyId: string, bankAccountId: string) {
  const [pendingLines, txs, stats] = await Promise.all([
    prisma.bankStatementLine.findMany({
      where: { companyId, bankAccountId, status: 'PENDIENTE' },
      orderBy: { date: 'asc' },
    }),
    prisma.bankTransaction.findMany({ where: { companyId, bankAccountId, status: 'REGISTRADO' } }),
    prisma.bankStatementLine.groupBy({
      by: ['status'],
      where: { companyId, bankAccountId },
      _count: { _all: true },
    }),
  ]);

  const keyed = pendingLines.map((l, i) => ({
    key: i, date: l.date.toISOString().slice(0, 10),
    description: l.description, reference: l.reference ?? undefined, amount: Number(l.amount),
  }));
  const { suggestions } = matchStatementLines(keyed, txs.map((t) => ({
    id: t.id, type: t.type, amount: Number(t.amount), date: t.date, reference: t.reference, status: t.status,
  })));
  const txById = new Map(txs.map((t) => [t.id, t]));

  return {
    stats: {
      conciliadas: stats.find((s) => s.status === 'CONCILIADO')?._count._all ?? 0,
      pendientes: stats.find((s) => s.status === 'PENDIENTE')?._count._all ?? 0,
      creadas: stats.find((s) => s.status === 'CREADO')?._count._all ?? 0,
      movimientosSinConciliar: txs.length,
    },
    pending: pendingLines.map((l, i) => ({
      id: l.id, date: l.date.toISOString(), description: l.description,
      reference: l.reference, amount: Number(l.amount),
      suggestions: (suggestions.get(i) ?? []).map((s) => {
        const t = txById.get(s.transactionId)!;
        return {
          ...s,
          transaction: { id: t.id, date: t.date.toISOString(), beneficiary: t.beneficiary, reference: t.reference, amount: Number(t.amount), type: t.type },
        };
      }),
    })),
    unreconciled: txs.map((t) => ({
      id: t.id, date: t.date.toISOString(), type: t.type, amount: Number(t.amount),
      beneficiary: t.beneficiary, reference: t.reference,
    })),
  };
}

/** Confirmación semiautomática: el usuario acepta una sugerencia (o elige un movimiento). */
export async function confirmMatch(companyId: string, lineId: string, transactionId: string) {
  const line = await prisma.bankStatementLine.findFirst({ where: { id: lineId, companyId } });
  if (!line) throw new Error('LINE_NOT_FOUND');
  if (line.status !== 'PENDIENTE') throw new Error('LINE_NOT_PENDING');
  const tx = await prisma.bankTransaction.findFirst({ where: { id: transactionId, companyId, bankAccountId: line.bankAccountId } });
  if (!tx) throw new Error('TRANSACTION_NOT_FOUND');
  if (tx.status !== 'REGISTRADO') throw new Error('TRANSACTION_NOT_AVAILABLE');
  const lineType = Number(line.amount) >= 0 ? 'INGRESO' : 'EGRESO';
  if (tx.type !== lineType || r2(Math.abs(Number(line.amount))) !== r2(Number(tx.amount))) {
    throw new Error('VALIDATION: el monto/tipo del movimiento no coincide con la línea del extracto');
  }

  await prisma.$transaction([
    prisma.bankStatementLine.update({
      where: { id: lineId },
      data: { status: 'CONCILIADO', matchedTransactionId: transactionId, matchType: 'MANUAL' },
    }),
    prisma.bankTransaction.update({ where: { id: transactionId }, data: { status: 'CONCILIADO' } }),
  ]);
  return { ok: true };
}

export interface SourceReconciliationInfo {
  bankTransactionId: string;
  amount: number;
  date: string;
  status: string; // REGISTRADO | CONCILIADO | ANULADO
  bankAccountLabel: string;
  matchType: string | null; // AUTO | MANUAL | null (viene de la línea del extracto que lo concilió, si aplica)
}

/**
 * Conciliación de los pagos/cobros de un documento de CxP/CxC (roadmap Asistente Contable,
 * Fase 5). Un documento puede tener varios `BankTransaction` (pagos parciales) — se listan
 * todos, más recientes primero. El motor de matching ya existe desde Sprint 9.1
 * (`matchStatementLines`); esto solo expone su resultado (`BankTransaction.status` +
 * la línea de extracto que lo conciliró) donde el contador de CxP/CxC lo necesita ver.
 */
export async function getReconciliationBySource(
  companyId: string,
  sourceType: 'AP_INVOICE' | 'AR_INVOICE',
  sourceId: string,
): Promise<SourceReconciliationInfo[]> {
  const transactions = await prisma.bankTransaction.findMany({
    where: { companyId, sourceType, sourceId },
    include: { bankAccount: { select: { alias: true, bankCode: true, accountNumber: true } } },
    orderBy: { date: 'desc' },
  });
  if (transactions.length === 0) return [];

  const matchLines = await prisma.bankStatementLine.findMany({
    where: { companyId, matchedTransactionId: { in: transactions.map((t) => t.id) } },
    select: { matchedTransactionId: true, matchType: true },
  });
  const matchTypeByTx = new Map(matchLines.map((l) => [l.matchedTransactionId as string, l.matchType]));

  return transactions.map((t) => ({
    bankTransactionId: t.id,
    amount: Number(t.amount),
    date: t.date.toISOString(),
    status: t.status,
    bankAccountLabel: t.bankAccount.alias || `${t.bankAccount.bankCode} · ${t.bankAccount.accountNumber}`,
    matchType: matchTypeByTx.get(t.id) ?? null,
  }));
}

/** Crea un movimiento MANUAL desde una línea sin contraparte (comisiones, intereses, ND/NC). */
export async function createFromStatementLine(companyId: string, lineId: string, userId?: string) {
  const line = await prisma.bankStatementLine.findFirst({ where: { id: lineId, companyId } });
  if (!line) throw new Error('LINE_NOT_FOUND');
  if (line.status !== 'PENDIENTE') throw new Error('LINE_NOT_PENDING');

  const amount = Number(line.amount);
  const tx = await prisma.bankTransaction.create({
    data: {
      companyId,
      bankAccountId: line.bankAccountId,
      type: amount >= 0 ? 'INGRESO' : 'EGRESO',
      method: 'TRANSFERENCIA',
      amount: new Prisma.Decimal(r2(Math.abs(amount))),
      date: line.date,
      reference: line.reference,
      beneficiary: line.description.slice(0, 120),
      status: 'CONCILIADO', // nace conciliado: viene del propio extracto
      sourceType: 'MANUAL',
      notes: 'Creado desde extracto bancario (conciliación)',
      createdBy: userId,
    },
  });
  await prisma.bankStatementLine.update({
    where: { id: lineId },
    data: { status: 'CREADO', matchedTransactionId: tx.id, matchType: 'MANUAL' },
  });
  return tx;
}
