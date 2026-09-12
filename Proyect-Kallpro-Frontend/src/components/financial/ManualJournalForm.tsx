import { useState } from 'react';
import { financialApi } from '../../api/financial';
import { useToast } from '../ui/Toast';
import { AccountSelect } from './ChartOfAccountsTree';

interface Line { accountCode: string; accountName: string; debit: string; credit: string; description: string; }

const emptyLine = (): Line => ({ accountCode: '', accountName: '', debit: '', credit: '', description: '' });

export default function ManualJournalForm({ onSaved }: { onSaved?: () => void }) {
  const toast = useToast();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);

  const num = (s: string) => Number(s.replace(/[^0-9.]/g, '') || 0);
  const totalDebit = lines.reduce((s, l) => s + num(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + num(l.credit), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const save = async () => {
    if (!balanced) { toast.error('El asiento debe cuadrar (débitos = créditos) y ser mayor a cero', 'No cuadra'); return; }
    const valid = lines.filter((l) => l.accountCode && (num(l.debit) > 0 || num(l.credit) > 0));
    if (valid.length < 2) { toast.error('Se requieren al menos 2 líneas con cuenta y monto', 'Faltan líneas'); return; }
    setSaving(true);
    try {
      await financialApi.createJournalEntry({
        date, description,
        lines: valid.map((l) => ({ accountCode: l.accountCode, debit: num(l.debit), credit: num(l.credit), description: l.description })),
      });
      toast.success('Asiento manual registrado', '✓');
      setDescription(''); setLines([emptyLine(), emptyLine()]);
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo registrar el asiento', 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-5 space-y-4">
      <h3 className="font-semibold text-surface-900 dark:text-white">Nuevo asiento manual</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-surface-500 mb-1">Fecha</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-surface-500 mb-1">Glosa / descripción</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Concepto del asiento"
            className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-xs text-surface-500 px-1">
          <div className="col-span-5">Cuenta</div>
          <div className="col-span-3">Detalle</div>
          <div className="col-span-2 text-right">Debe</div>
          <div className="col-span-2 text-right">Haber</div>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-start">
            <div className="col-span-5">
              <AccountSelect value={l.accountCode} onChange={(code, name) => setLine(i, { accountCode: code, accountName: name })} />
            </div>
            <input className="col-span-3 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-2 text-sm text-surface-900 dark:text-white"
              value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="..." />
            <input inputMode="decimal" className="col-span-2 text-right bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-2 text-sm text-surface-900 dark:text-white"
              value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: '' })} placeholder="0.00" />
            <input inputMode="decimal" className="col-span-2 text-right bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-2 text-sm text-surface-900 dark:text-white"
              value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: '' })} placeholder="0.00" />
          </div>
        ))}
        <button type="button" onClick={() => setLines((ls) => [...ls, emptyLine()])}
          className="text-brand-500 hover:text-brand-600 text-sm font-medium">+ Agregar línea</button>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-surface-100 dark:border-surface-700">
        <div className="text-sm flex gap-4">
          <span className="text-surface-500">Debe: <strong className="text-surface-900 dark:text-white font-mono">${totalDebit.toFixed(2)}</strong></span>
          <span className="text-surface-500">Haber: <strong className="text-surface-900 dark:text-white font-mono">${totalCredit.toFixed(2)}</strong></span>
          <span className={`font-medium ${balanced ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {balanced ? '✓ Cuadra' : `Descuadre $${Math.abs(totalDebit - totalCredit).toFixed(2)}`}
          </span>
        </div>
        <button onClick={save} disabled={!balanced || saving}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium">
          {saving ? 'Guardando...' : 'Registrar asiento'}
        </button>
      </div>
    </div>
  );
}
