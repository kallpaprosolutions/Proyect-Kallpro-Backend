/**
 * Envío de correo transaccional vía SendGrid (API REST v3, sin dependencia extra — `fetch`
 * es global en Node 18+). Si SENDGRID_API_KEY no está configurada (o sigue con el valor del
 * .env.example) NO falla: devuelve `sent:false` con el motivo, para que el llamador deje la
 * gestión como "pendiente de envío manual" en vez de reventar un job completo.
 */
import { logger } from './logger';

export interface MailResult {
  sent: boolean;
  reason?: string;
}

function isConfigured(): boolean {
  const key = process.env.SENDGRID_API_KEY;
  return !!key && key !== 'your_sendgrid_key';
}

export async function sendEmail(args: { to: string; subject: string; text: string; fromName?: string }): Promise<MailResult> {
  if (!isConfigured()) return { sent: false, reason: 'SENDGRID_API_KEY no configurada' };
  const from = process.env.SENDER_EMAIL || 'noreply@kallpapro.com';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(args.to)) return { sent: false, reason: `Email inválido: ${args.to}` };
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: args.to }] }],
        from: { email: from, name: args.fromName ?? 'KallpaPro' },
        subject: args.subject,
        content: [{ type: 'text/plain', value: args.text }],
      }),
    });
    if (res.status >= 200 && res.status < 300) return { sent: true };
    const body = await res.text().catch(() => '');
    logger.warn('[mailer] SendGrid rechazó el envío', { status: res.status, body: body.slice(0, 300) });
    return { sent: false, reason: `SendGrid HTTP ${res.status}` };
  } catch (e: any) {
    logger.warn('[mailer] error de red enviando correo', { err: e?.message });
    return { sent: false, reason: e?.message ?? 'error de red' };
  }
}
