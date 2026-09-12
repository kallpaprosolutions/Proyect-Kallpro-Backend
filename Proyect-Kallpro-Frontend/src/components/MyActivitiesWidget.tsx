import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, getMyActivities, completeActivity } from '../api/activities';

// ============================================================
// "MIS ACTIVIDADES" (mejora A3 — patrón Odoo, widget de Inicio)
// ============================================================
// Mismo patrón visual que "Mis pendientes" de Compras (ProcurementHubPage): tarjeta con
// contador, lista clickable, vencidas en rojo — pero de actividades agendadas por el propio
// usuario en cualquier documento, no solo aprobaciones de compras.

const TYPE_LABELS: Record<string, string> = {
  LLAMAR: '📞 Llamar', REUNION: '🤝 Reunión', REVISAR: '🔍 Revisar',
  PAGAR: '💳 Pagar', EMAIL: '✉️ Email', OTRO: '📌 Otro',
};

// La misma actividad puede vivir en distintos documentos — el link al detalle depende
// del entityType (mismo mapa de rutas que usan Chatter/SmartButtons en cada documento).
const ENTITY_PATH: Record<string, (id: string) => string> = {
  PURCHASE_ORDER: (id) => `/purchases/${id}`,
  SALES_ORDER: (id) => `/sales/orders/${id}`,
  INVOICE: (id) => `/financial/invoices/${id}`,
  REQUISITION: (id) => `/purchases/requisitions/${id}`,
};

export default function MyActivitiesWidget() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    getMyActivities().then(setActivities).catch(() => setActivities([])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  async function quickComplete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try { await completeActivity(id); load(); } catch { /* noop */ }
  }

  if (!loading && activities.length === 0) return null; // sin ruido si no hay nada pendiente

  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-4 shadow-soft">
      <h2 className="font-semibold text-surface-900 dark:text-white mb-3 flex items-center gap-2">
        🗓️ Mis actividades
        {activities.length > 0 && <span className="text-xs bg-brand-500 text-white px-2 py-0.5 rounded-full">{activities.length}</span>}
      </h2>
      {loading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 bg-surface-100 dark:bg-surface-700 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {activities.map((a) => {
            const path = ENTITY_PATH[a.entityType]?.(a.entityId);
            return (
              <div key={a.id} role={path ? 'button' : undefined} tabIndex={path ? 0 : undefined}
                onClick={() => path && navigate(path)}
                onKeyDown={(e) => { if (path && (e.key === 'Enter' || e.key === ' ')) navigate(path); }}
                className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border border-surface-100 dark:border-surface-700 transition-colors group ${path ? 'cursor-pointer hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50/50 dark:hover:bg-brand-900/10' : ''}`}>
                <button onClick={(e) => quickComplete(e, a.id)} title="Marcar como hecha"
                  className="w-5 h-5 rounded-full border-2 border-surface-300 dark:border-surface-600 flex-shrink-0 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-800 dark:text-surface-100 truncate">
                    {TYPE_LABELS[a.type] ?? a.type}{a.note ? ` — ${a.note}` : ''}
                  </p>
                  <p className={`text-xs ${a.status === 'OVERDUE' ? 'text-red-500 font-medium' : a.status === 'TODAY' ? 'text-amber-500 font-medium' : 'text-surface-400'}`}>
                    {a.status === 'OVERDUE' ? `Venció el ${new Date(a.dueDate).toLocaleDateString('es-EC', { timeZone: 'UTC' })}`
                      : a.status === 'TODAY' ? 'Vence hoy'
                      : `Vence el ${new Date(a.dueDate).toLocaleDateString('es-EC', { timeZone: 'UTC' })}`}
                  </p>
                </div>
                {path && <span className="text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
