import { FormEvent, useEffect, useState } from 'react';
import {
  Activity, ActivityType, AssignableUser,
  getEntityActivities, createActivity, completeActivity, reopenActivity, deleteActivity, getAssignableUsers,
} from '../api/activities';
import { ChatterEntityType } from '../api/chatter';
import { useAuthStore } from '../store/auth.store';

// ============================================================
// ACTIVIDADES PROGRAMADAS (mejora A3 — patrón Odoo)
// ============================================================
// Panel reusable montado junto al Chatter en el detalle de OC, factura, pedido y
// requisición: agenda un to-do (llamar, revisar, pagar…) con vencimiento y responsable.

interface ActivitiesProps {
  entityType: ChatterEntityType;
  entityId: string;
}

const TYPE_LABELS: Record<ActivityType, string> = {
  LLAMAR: '📞 Llamar', REUNION: '🤝 Reunión', REVISAR: '🔍 Revisar',
  PAGAR: '💳 Pagar', EMAIL: '✉️ Email', OTRO: '📌 Otro',
};

const STATUS_STYLES: Record<string, string> = {
  OVERDUE: 'text-red-600 dark:text-red-400 font-semibold',
  TODAY: 'text-amber-600 dark:text-amber-400 font-semibold',
  UPCOMING: 'text-surface-500 dark:text-surface-400',
  DONE: 'text-surface-400 dark:text-surface-500',
};

const dateEs = (iso: string) => new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

function dueLabel(a: Activity): string {
  if (a.status === 'DONE') return `Hecha el ${dateEs(a.doneAt!)}`;
  if (a.status === 'OVERDUE') return `Venció el ${dateEs(a.dueDate)}`;
  if (a.status === 'TODAY') return 'Vence hoy';
  return `Vence el ${dateEs(a.dueDate)}`;
}

export default function Activities({ entityType, entityId }: ActivitiesProps) {
  const currentUser = useAuthStore((s) => s.user);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<ActivityType>('LLAMAR');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [assignedToId, setAssignedToId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showDone, setShowDone] = useState(false);

  const load = () => {
    getEntityActivities(entityType, entityId).then(setActivities).catch(() => { /* sin actividades aún */ });
  };

  useEffect(() => {
    load();
    getAssignableUsers().then(setUsers).catch(() => setUsers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await createActivity(entityType, entityId, {
        type, dueDate, note: note.trim() || undefined, assignedToId: assignedToId || undefined,
      });
      setNote(''); setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo agendar la actividad.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleDone(a: Activity) {
    try {
      if (a.status === 'DONE') await reopenActivity(a.id);
      else await completeActivity(a.id);
      load();
    } catch { /* deja la UI como estaba; el usuario puede reintentar */ }
  }

  async function remove(a: Activity) {
    try { await deleteActivity(a.id); load(); } catch { /* noop */ }
  }

  const canModify = (a: Activity) => currentUser && (a.assignedToId === currentUser.id || a.createdById === currentUser.id);
  const visible = activities.filter((a) => showDone || a.status !== 'DONE');
  const pendingCount = activities.filter((a) => a.status !== 'DONE').length;

  return (
    <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700 flex items-center gap-2">
        <span className="text-lg">🗓️</span>
        <h2 className="font-semibold text-surface-900 dark:text-white">Actividades</h2>
        {pendingCount > 0 && <span className="text-xs text-surface-400">({pendingCount})</span>}
        <div className="flex-1" />
        {activities.some((a) => a.status === 'DONE') && (
          <button onClick={() => setShowDone((v) => !v)} className="text-xs text-brand-500 hover:underline">
            {showDone ? 'Ocultar hechas' : 'Ver hechas'}
          </button>
        )}
        <button onClick={() => setShowForm((v) => !v)} className="text-xs px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium">
          + Agendar
        </button>
      </div>

      <div className="p-5 space-y-3">
        {showForm && (
          <form onSubmit={submit} className="bg-surface-50 dark:bg-surface-900/50 border border-surface-200 dark:border-surface-700 rounded-xl p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select value={type} onChange={(e) => setType(e.target.value as ActivityType)}
                className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1.5 text-sm text-surface-900 dark:text-white">
                {(Object.keys(TYPE_LABELS) as ActivityType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required
                className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1.5 text-sm text-surface-900 dark:text-white" />
            </div>
            {users.length > 0 && (
              <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}
                className="w-full bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1.5 text-sm text-surface-900 dark:text-white">
                <option value="">Para mí</option>
                {users.filter((u) => u.id !== currentUser?.id).map((u) => (
                  <option key={u.id} value={u.id}>{[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}</option>
                ))}
              </select>
            )}
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" maxLength={500}
              className="w-full bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1.5 text-sm text-surface-900 dark:text-white placeholder-surface-400" />
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="text-xs px-3 py-1.5 text-surface-500 hover:text-surface-800 dark:hover:text-white">Cancelar</button>
              <button type="submit" disabled={busy} className="text-xs px-3 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
                {busy ? 'Agendando…' : 'Agendar'}
              </button>
            </div>
          </form>
        )}

        {visible.length === 0 ? (
          <p className="text-sm text-surface-400 text-center py-2">Sin actividades agendadas.</p>
        ) : (
          <ul className="space-y-2">
            {visible.map((a) => (
              <li key={a.id} className={`flex items-start gap-3 p-2.5 rounded-lg border border-surface-100 dark:border-surface-700 ${a.status === 'OVERDUE' ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                <button onClick={() => canModify(a) && toggleDone(a)} disabled={!canModify(a)}
                  title={a.status === 'DONE' ? 'Reabrir' : 'Marcar como hecha'}
                  className={`w-5 h-5 mt-0.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs ${a.status === 'DONE' ? 'bg-green-500 border-green-500 text-white' : 'border-surface-300 dark:border-surface-600'} ${canModify(a) ? 'cursor-pointer' : 'cursor-default opacity-60'}`}>
                  {a.status === 'DONE' && '✓'}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${a.status === 'DONE' ? 'line-through text-surface-400' : 'text-surface-800 dark:text-surface-100'}`}>
                    {TYPE_LABELS[a.type]}{a.note ? ` — ${a.note}` : ''}
                  </p>
                  <p className={`text-xs ${STATUS_STYLES[a.status]}`}>
                    {dueLabel(a)} · {a.assignedToName}
                  </p>
                </div>
                {canModify(a) && (
                  <button onClick={() => remove(a)} title="Cancelar actividad" className="text-surface-300 hover:text-red-500 text-xs flex-shrink-0">✕</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
