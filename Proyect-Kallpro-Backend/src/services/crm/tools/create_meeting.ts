import { AgentContext } from '../agents/base.agent';

export async function execute(
  args: {
    contactId?: string;
    datetime: string;
    durationMinutes?: number;
    title?: string;
    description?: string;
  },
  ctx: AgentContext,
) {
  // Placeholder — integrate with Google Calendar / Zoom / Teams
  return {
    status: 'SCHEDULED',
    meetingId: `meet-${Date.now()}`,
    title: args.title ?? 'Demo KallpaPro ERP',
    datetime: args.datetime,
    durationMinutes: args.durationMinutes ?? 30,
    meetLink: 'https://meet.google.com/placeholder',
    note: 'Reunión registrada. Enviar confirmación al contacto.',
  };
}

export default execute;
