import { useEffect, useState } from 'react';
import { financialApi } from '../../api/financial';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../../hooks/useConfirm';

/** Notas a los Estados Financieros (NIC 1 §112-116) — texto libre editable por período. */
export default function FinancialNotes({ period, canEdit }: { period: string; canEdit: boolean }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const load = () => {
    setLoading(true);
    financialApi.getFinancialNotes(period)
      .then((r) => setNotes(r.data))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [period]);

  const startEdit = (n: any) => { setEditingId(n.id); setDraftTitle(n.title); setDraftContent(n.content); };
  const cancelEdit = () => { setEditingId(null); setAdding(false); setDraftTitle(''); setDraftContent(''); };

  const save = async () => {
    if (!draftTitle.trim()) { toast.error('El título es obligatorio'); return; }
    try {
      if (adding) {
        await financialApi.createFinancialNote({ period, title: draftTitle, content: draftContent, order: notes.length });
      } else if (editingId) {
        await financialApi.updateFinancialNote(editingId, { title: draftTitle, content: draftContent });
      }
      cancelEdit();
      load();
    } catch {
      toast.error('No se pudo guardar la nota');
    }
  };

  const remove = async (id: string) => {
    if (!(await confirm({ title: 'Eliminar nota', message: '¿Eliminar esta nota permanentemente?' }))) return;
    try { await financialApi.deleteFinancialNote(id); load(); } catch { toast.error('No se pudo eliminar la nota'); }
  };

  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between">
        <span className="font-semibold text-surface-900 dark:text-white">Notas a los Estados Financieros</span>
        {canEdit && !adding && !editingId && (
          <button onClick={() => { setAdding(true); setDraftTitle(''); setDraftContent(''); }} className="text-sm text-brand-500 hover:underline">+ Agregar nota</button>
        )}
      </div>
      <div className="p-4 space-y-3">
        {loading && <div className="flex justify-center py-6"><div className="animate-spin w-6 h-6 border-4 border-brand-500 border-t-transparent rounded-full" /></div>}
        {!loading && notes.length === 0 && !adding && <p className="text-sm text-surface-400">Sin notas para este período.</p>}
        {!loading && notes.map((n) => (
          <div key={n.id} className="border border-surface-100 dark:border-surface-700 rounded-lg p-3">
            {editingId === n.id ? (
              <div className="space-y-2">
                <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Título"
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white" />
                <textarea value={draftContent} onChange={(e) => setDraftContent(e.target.value)} placeholder="Contenido de la nota" rows={4}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white" />
                <div className="flex gap-2">
                  <button onClick={save} className="text-sm bg-brand-500 text-white px-3 py-1.5 rounded-lg">Guardar</button>
                  <button onClick={cancelEdit} className="text-sm text-surface-500 px-3 py-1.5">Cancelar</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-surface-900 dark:text-white">{n.title}</h4>
                  {canEdit && (
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => startEdit(n)} className="text-brand-500 hover:underline">Editar</button>
                      <button onClick={() => remove(n.id)} className="text-red-500 hover:underline">Eliminar</button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-surface-600 dark:text-surface-300 whitespace-pre-wrap mt-1">{n.content}</p>
              </div>
            )}
          </div>
        ))}
        {adding && (
          <div className="border border-brand-200 dark:border-brand-700 rounded-lg p-3 space-y-2">
            <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Título (ej. Políticas contables)" autoFocus
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white" />
            <textarea value={draftContent} onChange={(e) => setDraftContent(e.target.value)} placeholder="Contenido de la nota" rows={4}
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white" />
            <div className="flex gap-2">
              <button onClick={save} className="text-sm bg-brand-500 text-white px-3 py-1.5 rounded-lg">Guardar</button>
              <button onClick={cancelEdit} className="text-sm text-surface-500 px-3 py-1.5">Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
