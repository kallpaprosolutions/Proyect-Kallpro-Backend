import { FormEvent, useEffect, useState } from 'react';
import { getMessages, postMessage, getFollowers, follow, unfollow, ChatterEntityType, ChatterMessage } from '../api/chatter';

// ============================================================
// CHATTER LIGERO (mejora A2 — patrón Odoo; A2.2 amplía con log y notas)
// ============================================================
// Hilo de mensajes reusable montado al pie del detalle de OC, factura,
// pedido y requisición. Un solo componente para los 4 documentos.
//
// A2.2 agrega:
//  - Nota interna vs mensaje (mismo hilo, insignia distinta).
//  - Log automático de cambios de estado (kind=LOG): el backend solo guarda el código
//    crudo (logFrom/logTo) — `statusLabels` (el mismo mapa que cada página ya usa para
//    pintar el badge de estado) lo traduce aquí a español, sin duplicar el mapa en backend.
//  - Seguidores: seguir/dejar de seguir el documento (sin notificación push/email todavía
//    — hoy es visibilidad de quién está pendiente, no una bandeja de avisos).

interface ChatterProps {
  entityType: ChatterEntityType;
  entityId: string;
  statusLabels?: Record<string, string>;
}

const timeEs = (iso: string) =>
  new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const initials = (name: string) =>
  name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

export default function Chatter({ entityType, entityId, statusLabels }: ChatterProps) {
  const [messages, setMessages] = useState<ChatterMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [kind, setKind] = useState<'MESSAGE' | 'NOTE'>('MESSAGE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [followers, setFollowers] = useState<{ userId: string; userName: string }[]>([]);
  const [followingMe, setFollowingMe] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMessages(entityType, entityId)
      .then(m => { if (!cancelled) setMessages(m); })
      .catch(() => { /* documento sin hilo aún o error transitorio: se muestra vacío */ });
    getFollowers(entityType, entityId)
      .then(r => { if (!cancelled) { setFollowers(r.followers); setFollowingMe(r.followingMe); } })
      .catch(() => { /* noop */ });
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const msg = await postMessage(entityType, entityId, draft.trim(), kind);
      setMessages(prev => [...prev, msg]);
      setDraft('');
    } catch {
      setError('No se pudo enviar el mensaje. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleFollow() {
    setFollowBusy(true);
    try {
      if (followingMe) await unfollow(entityType, entityId);
      else await follow(entityType, entityId);
      const r = await getFollowers(entityType, entityId);
      setFollowers(r.followers); setFollowingMe(r.followingMe);
    } catch { /* noop */ } finally { setFollowBusy(false); }
  }

  const label = (code: string | null) => (code ? (statusLabels?.[code] ?? code) : '—');

  return (
    <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700 flex items-center gap-2 flex-wrap">
        <span className="text-lg">💬</span>
        <h2 className="font-semibold text-surface-900 dark:text-white">Mensajes</h2>
        {messages.filter(m => m.kind !== 'LOG').length > 0 && (
          <span className="text-xs text-surface-400">({messages.filter(m => m.kind !== 'LOG').length})</span>
        )}
        <div className="flex-1" />
        <button onClick={() => setShowFollowers(v => !v)} title="Ver seguidores"
          className="text-xs text-surface-500 hover:text-surface-800 dark:hover:text-white flex items-center gap-1">
          👁 {followers.length}
        </button>
        <button onClick={toggleFollow} disabled={followBusy}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 ${followingMe ? 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300' : 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'}`}>
          {followingMe ? '✓ Siguiendo' : '+ Seguir'}
        </button>
      </div>

      {showFollowers && (
        <div className="px-5 py-3 border-b border-surface-100 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/40 text-xs text-surface-600 dark:text-surface-300">
          {followers.length === 0 ? 'Nadie sigue este documento todavía.' : (
            <span>Siguen: {followers.map(f => f.userName).join(', ')}</span>
          )}
        </div>
      )}

      <div className="p-5 space-y-4">
        {messages.length === 0 ? (
          <p className="text-sm text-surface-400 text-center py-2">
            Sin mensajes todavía. Escribe el primero para dejar contexto a tu equipo.
          </p>
        ) : (
          <ul className="space-y-3">
            {messages.map(m => m.kind === 'LOG' ? (
              <li key={m.id} className="flex items-center gap-2 text-xs text-surface-400 dark:text-surface-500 pl-1">
                <span>🕓</span>
                <span>
                  <span className="font-medium text-surface-500 dark:text-surface-400">{m.userName}</span>
                  {' cambió el estado: '}
                  <span className="font-mono">{label(m.logFrom)} → {label(m.logTo)}</span>
                </span>
                <span className="text-surface-300 dark:text-surface-600">· {timeEs(m.createdAt)}</span>
              </li>
            ) : (
              <li key={m.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">{initials(m.userName)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium text-surface-900 dark:text-white">{m.userName}</span>
                    {m.kind === 'NOTE' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">Nota interna</span>
                    )}
                    <span className="text-xs text-surface-400">{timeEs(m.createdAt)}</span>
                  </div>
                  <p className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap break-words mt-0.5">{m.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        <form onSubmit={send} className="space-y-2">
          <div className="flex gap-1 text-xs">
            <button type="button" onClick={() => setKind('MESSAGE')}
              className={`px-2.5 py-1 rounded-md font-medium ${kind === 'MESSAGE' ? 'bg-brand-500 text-white' : 'bg-surface-100 dark:bg-surface-700 text-surface-500'}`}>
              💬 Mensaje
            </button>
            <button type="button" onClick={() => setKind('NOTE')}
              className={`px-2.5 py-1 rounded-md font-medium ${kind === 'NOTE' ? 'bg-amber-500 text-white' : 'bg-surface-100 dark:bg-surface-700 text-surface-500'}`}>
              📝 Nota interna
            </button>
          </div>
          <div className="flex gap-2 items-end">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(e as unknown as FormEvent);
                }
              }}
              rows={2}
              maxLength={2000}
              placeholder={kind === 'NOTE' ? 'Nota interna… (solo referencia, no se envía al cliente)' : 'Escribe un mensaje… (Enter para enviar, Shift+Enter para salto de línea)'}
              className="flex-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm rounded-xl font-medium transition-colors whitespace-nowrap"
            >
              {busy ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
