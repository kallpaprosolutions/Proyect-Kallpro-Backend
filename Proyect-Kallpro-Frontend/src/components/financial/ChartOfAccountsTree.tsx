import { useEffect, useMemo, useState } from 'react';
import { financialApi } from '../../api/financial';

interface Account {
  id: string; code: string; name: string; accountType: string; level: number; isMovement: boolean;
}

const TYPE_COLOR: Record<string, string> = {
  ACTIVO: 'text-blue-600 dark:text-blue-400',
  PASIVO: 'text-red-600 dark:text-red-400',
  PATRIMONIO: 'text-purple-600 dark:text-purple-400',
  INGRESO: 'text-emerald-600 dark:text-emerald-400',
  GASTO: 'text-orange-600 dark:text-orange-400',
  COSTO: 'text-amber-600 dark:text-amber-400',
};

export default function ChartOfAccountsTree() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const load = () => {
    setLoading(true); setError('');
    financialApi.getChartOfAccounts()
      .then((r) => setAccounts(r.data))
      .catch(() => setError('No se pudo cargar el plan de cuentas. Inicialízalo en la pestaña Impuestos / Configuración.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const list = [...accounts].sort((a, b) => a.code.localeCompare(b.code));
    if (!q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter((a) => a.code.includes(q) || a.name.toLowerCase().includes(s));
  }, [accounts, q]);

  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;
  if (error) return (
    <div className="flex items-center gap-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3">
      <span className="text-yellow-500 text-lg">⚠️</span><p className="text-sm text-yellow-700 dark:text-yellow-400 flex-1">{error}</p>
      <button onClick={load} className="text-sm font-medium text-yellow-700 dark:text-yellow-400 hover:underline">Reintentar</button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-surface-900 dark:text-white">Plan de Cuentas — Superintendencia de Compañías (NIIF)</h3>
        <span className="text-xs text-surface-500">{accounts.length} cuentas</span>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Buscar por código o nombre..."
        className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-4 py-2 text-sm text-surface-800 dark:text-white placeholder:text-surface-400 focus:outline-none focus:border-brand-500" />
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft max-h-[60vh] overflow-y-auto">
        {filtered.map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-4 py-1.5 border-b border-surface-50 dark:border-surface-700/50 last:border-0"
            style={{ paddingLeft: `${12 + (a.level - 1) * 18}px` }}>
            <span className="font-mono text-xs text-surface-500 w-20 flex-shrink-0">{a.code}</span>
            <span className={`text-sm flex-1 ${a.isMovement ? 'text-surface-700 dark:text-surface-300' : 'font-semibold text-surface-900 dark:text-white'}`}>{a.name}</span>
            <span className={`text-[10px] font-medium ${TYPE_COLOR[a.accountType] ?? 'text-surface-400'}`}>{a.accountType}</span>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center py-8 text-surface-400 text-sm">Sin cuentas que coincidan.</p>}
      </div>
    </div>
  );
}

// Selector de cuenta (solo cuentas de movimiento) reutilizable
export function AccountSelect({ value, onChange, placeholder }: { value: string; onChange: (code: string, name: string) => void; placeholder?: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => { financialApi.getChartOfAccounts().then((r) => setAccounts(r.data)).catch(() => {}); }, []);

  const movement = useMemo(() => accounts.filter((a) => a.isMovement).sort((a, b) => a.code.localeCompare(b.code)), [accounts]);
  const filtered = q.trim() ? movement.filter((a) => a.code.includes(q) || a.name.toLowerCase().includes(q.toLowerCase())) : movement.slice(0, 50);
  const selected = accounts.find((a) => a.code === value);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full text-left bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white">
        {selected ? <span><span className="font-mono text-xs text-surface-500">{selected.code}</span> {selected.name}</span> : <span className="text-surface-400">{placeholder ?? 'Seleccionar cuenta...'}</span>}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cuenta..."
            className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 focus:outline-none text-surface-900 dark:text-white" />
          {filtered.map((a) => (
            <button key={a.id} type="button" onClick={() => { onChange(a.code, a.name); setOpen(false); setQ(''); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50 dark:hover:bg-brand-900/30 border-b border-surface-50 dark:border-surface-700/50">
              <span className="font-mono text-xs text-brand-600 dark:text-brand-400 mr-2">{a.code}</span>
              <span className="text-surface-700 dark:text-surface-300">{a.name}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-3 text-xs text-surface-400">Sin resultados</p>}
        </div>
      )}
    </div>
  );
}
