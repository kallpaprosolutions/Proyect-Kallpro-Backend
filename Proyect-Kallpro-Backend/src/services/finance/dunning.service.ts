/**
 * Cobranza automática: corre el plan de dunning (engine puro) sobre la cartera vencida real y
 * materializa cada recordatorio como una `CollectionActivity` automática en el radar de
 * cobranza — el mismo historial que ve el contador, no un canal paralelo. EMAIL se envía si
 * hay SendGrid; WHATSAPP/CALL quedan como tarea con `nextActionAt` hoy para que la persona
 * (o, más adelante, el canal Unipile del CRM) la ejecute. Sin cron obligatorio: el job diario
 * lo llama, y el botón "Ejecutar recordatorios" del radar también.
 */
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { sendEmail } from '../../lib/mailer';
import { getErpConfig } from '../erp-config.service';
import { listReceivables } from './ar.service';
import { planDunning, renderDunningMessage, OverdueInvoiceRef } from './engines/dunning.engine';

export interface DunningRunResult {
  enabled: boolean;
  evaluated: number;
  created: number;
  emailed: number;
  pendingManual: number;
  skippedPromise: number;
  details: Array<{ invoiceNumber: string; customerName: string; step: number; type: string; delivery: 'EMAIL_ENVIADO' | 'PENDIENTE_MANUAL' }>;
}

export async function runDunning(companyId: string, opts: { force?: boolean } = {}): Promise<DunningRunResult> {
  const config = await getErpConfig(companyId);
  const dunning = config.finance.dunning;
  const empty: DunningRunResult = { enabled: dunning.enabled, evaluated: 0, created: 0, emailed: 0, pendingManual: 0, skippedPromise: 0, details: [] };
  if (!dunning.enabled && !opts.force) return empty;

  const overdue = (await listReceivables(companyId, { overdue: true })).filter((r) => r.customerId);
  if (overdue.length === 0) return { ...empty, enabled: true };

  const invoiceIds = overdue.map((r) => r.id);
  const customerIds = [...new Set(overdue.map((r) => r.customerId as string))];
  const today = new Date();
  const [fired, promises, customers, company] = await Promise.all([
    prisma.collectionActivity.findMany({ where: { companyId, automated: true, invoiceId: { in: invoiceIds } }, select: { invoiceId: true, dunningStep: true } }),
    prisma.collectionActivity.findMany({ where: { companyId, customerId: { in: customerIds }, promisedDate: { gte: today } }, select: { customerId: true } }),
    prisma.customer.findMany({ where: { companyId, id: { in: customerIds } }, select: { id: true, name: true, razonSocial: true, email: true } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
  ]);
  const firedByInvoice = new Map<string, number[]>();
  for (const f of fired) {
    if (!f.invoiceId || f.dunningStep == null) continue;
    firedByInvoice.set(f.invoiceId, [...(firedByInvoice.get(f.invoiceId) ?? []), f.dunningStep]);
  }
  const promiseCustomers = new Set(promises.map((p) => p.customerId));
  const customerById = new Map(customers.map((c) => [c.id, c]));

  const refs: OverdueInvoiceRef[] = overdue.map((r) => ({
    invoiceId: r.id, customerId: r.customerId as string, number: r.number, daysOverdue: r.daysOverdue, balance: r.balance,
    firedSteps: firedByInvoice.get(r.id) ?? [], hasActivePromise: promiseCustomers.has(r.customerId as string),
  }));
  const skippedPromise = dunning.pauseWhenPromise ? refs.filter((r) => r.hasActivePromise).length : 0;
  const actions = planDunning(refs, dunning.steps, { pauseWhenPromise: dunning.pauseWhenPromise });

  const result: DunningRunResult = { enabled: true, evaluated: refs.length, created: 0, emailed: 0, pendingManual: 0, skippedPromise, details: [] };
  for (const a of actions) {
    const ref = refs.find((r) => r.invoiceId === a.invoiceId)!;
    const customer = customerById.get(a.customerId);
    const customerName = customer?.razonSocial || customer?.name || 'Cliente';
    const invoiceRow = overdue.find((r) => r.id === a.invoiceId)!;
    const message = renderDunningMessage(a.step.message, {
      cliente: customerName, factura: ref.number, saldo: ref.balance.toFixed(2), dias: ref.daysOverdue,
      vencimiento: invoiceRow.dueDate ? new Date(invoiceRow.dueDate).toLocaleDateString('es-EC') : '—', empresa: company?.name ?? 'KallpaPro',
    });

    let delivery: 'EMAIL_ENVIADO' | 'PENDIENTE_MANUAL' = 'PENDIENTE_MANUAL';
    if (a.step.type === 'EMAIL' && customer?.email) {
      const mail = await sendEmail({ to: customer.email, subject: `Recordatorio de pago · Factura ${ref.number}`, text: message, fromName: company?.name });
      if (mail.sent) delivery = 'EMAIL_ENVIADO';
      else logger.info('[dunning] email no enviado, queda pendiente manual', { invoice: ref.number, reason: mail.reason });
    }

    await prisma.collectionActivity.create({
      data: {
        companyId, customerId: a.customerId, invoiceId: a.invoiceId, type: a.step.type, automated: true, dunningStep: a.stepIndex,
        result: delivery === 'EMAIL_ENVIADO' ? 'Recordatorio automático enviado por email' : `Recordatorio automático (${a.step.type}) — pendiente de ejecutar`,
        notes: message,
        nextActionAt: delivery === 'EMAIL_ENVIADO' ? null : today,
        createdBy: 'system:dunning',
      },
    });
    result.created += 1;
    if (delivery === 'EMAIL_ENVIADO') result.emailed += 1; else result.pendingManual += 1;
    result.details.push({ invoiceNumber: ref.number, customerName, step: a.stepIndex + 1, type: a.step.type, delivery });
  }
  if (result.created > 0) logger.info('[dunning] recordatorios generados', { companyId, created: result.created, emailed: result.emailed });
  return result;
}

/** Job diario: recorre todas las empresas con dunning habilitado. */
export async function runDunningForAllCompanies(): Promise<void> {
  const companies = await prisma.company.findMany({ select: { id: true } });
  for (const c of companies) {
    try { await runDunning(c.id); }
    catch (e) { logger.warn('[dunning] falló para una empresa', { companyId: c.id, err: (e as Error)?.message }); }
  }
}
