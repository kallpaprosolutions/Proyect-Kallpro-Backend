import { SHIPMENT_STATUS_META } from '../../api/logistics';

/**
 * Timeline vertical estilo courier (Servientrega/DHL): círculos conectados,
 * evento más reciente arriba con nodo pulsante, fecha/lugar/notas por evento.
 */

export interface TrackingEvent {
  id: string;
  status: string;
  eventTime: string;
  location?: string | null;
  notes?: string | null;
}

export default function TrackingTimeline({ events, compact = false }: { events: TrackingEvent[]; compact?: boolean }) {
  if (!events?.length) return <p className="text-sm text-surface-400 py-4 text-center">Sin eventos registrados aún.</p>;
  const shown = compact ? events.slice(0, 3) : events;
  return (
    <ol className="relative">
      {shown.map((e, i) => {
        const meta = SHIPMENT_STATUS_META[e.status] ?? { label: e.status, icon: '•', tone: '' };
        const isLatest = i === 0;
        const delivered = e.status === 'DELIVERED';
        return (
          <li key={e.id} className="relative pl-10 pb-5 last:pb-0">
            {/* Conector vertical */}
            {i < shown.length - 1 && (
              <span className="absolute left-[15px] top-7 bottom-0 w-0.5 bg-surface-200 dark:bg-surface-700" aria-hidden />
            )}
            {/* Nodo */}
            <span className={`absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 ${
              isLatest
                ? delivered
                  ? 'bg-green-500 border-green-300 text-white'
                  : 'bg-brand-500 border-brand-300 text-white animate-pulse'
                : 'bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-600'
            }`}>
              {meta.icon}
            </span>
            {/* Contenido */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-semibold ${isLatest ? 'text-surface-900 dark:text-white' : 'text-surface-600 dark:text-surface-300'}`}>
                  {meta.label}
                </span>
                <span className="text-xs text-surface-400">
                  {new Date(e.eventTime).toLocaleDateString('es')} {new Date(e.eventTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {e.location && <p className="text-xs text-surface-500 mt-0.5">📍 {e.location}</p>}
              {e.notes && !compact && <p className="text-xs text-surface-400 mt-0.5 italic">{e.notes}</p>}
            </div>
          </li>
        );
      })}
      {compact && events.length > 3 && (
        <li className="pl-10 text-xs text-surface-400">… {events.length - 3} evento(s) anteriores</li>
      )}
    </ol>
  );
}
