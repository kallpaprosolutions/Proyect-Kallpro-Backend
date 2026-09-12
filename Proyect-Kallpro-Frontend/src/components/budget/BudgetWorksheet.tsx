import { useEffect, useState } from 'react';
import { budgetApi } from '../../api/budget';
import { useToast } from '../ui/Toast';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface MonthCell { month: number; budget: number; actual: number; variance: number; }
interface Row {
  departmentId: string | null;
  departmentName: string;
  months: MonthCell[];
  budgetTotal: number;
  actualTotal: number;
  variance: number;
  variancePct: number;
}

const money = (n: number) => `$${n.toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function BudgetWorksheet() {
  const toast = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // edición local de presupuesto por fila: { [deptKey]: number[12] }
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [showDept, setShowDept] = useState(false);
  const [deptName, setDeptName] = useState('');

  const keyOf = (r: { departmentId: string | null }) => r.departmentId ?? 'GENERAL';

  const load = () => {
    setLoading(true);
    setError('');
    budgetApi.getWorksheet(year)
      .then((res) => {
        const data: Row[] = res.data;
        setRows(data);
        const d: Record<string, string[]> = {};
        for (const r of data) d[keyOf(r)] = r.months.map((m) => (m.budget ? String(m.budget) : ''));
        setDraft(d);
      })
      .catch(() => setError('No se pudo cargar la planilla de presupuesto.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [year]);

  const setCell = (key: string, monthIdx: number, value: string) => {
    const v = value.replace(/[^0-9.]/g, '');
    setDraft((d) => ({ ...d, [key]: (d[key] ?? Array(12).fill('')).map((x, i) => (i === monthIdx ? v : x)) }));
  };

  const saveRow = async (r: Row) => {
    const key = keyOf(r);
    setSavingKey(key);
    try {
      await budgetApi.bulkUpsert({
        departmentId: r.departmentId,
        year,
        months: (draft[key] ?? Array(12).fill('')).map((x) => Number(x || 0)),
      });
      toast.success(`Presupuesto guardado: ${r.departmentName}`, '✓');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo guardar', 'Error');
    } finally {
      setSavingKey(null);
    }
  };

  const addDept = async () => {
    if (!deptName.trim()) return;
    try {
      await budgetApi.createDepartment({ name: deptName.trim() });
      setDeptName('');
      setShowDept(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo crear el departamento', 'Error');
    }
  };

  const draftTotal = (key: string) => (draft[key] ?? []).reduce((s, x) => s + Number(x || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white">Planilla de Presupuesto {year}</h2>
          <p className="text-sm text-surface-500">Presupuesto anual por departamento vs. real (consumido) con variación.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white">
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setShowDept((s) => !s)}
            className="text-sm px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-lg text-surface-600 dark:text-surface-300 hover:border-brand-400">
            + Departamento
          </button>
        </div>
      </div>

      {showDept && (
        <div className="flex gap-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-3">
          <input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="Nombre del departamento"
            className="flex-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white" />
          <button onClick={addDept} className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm">Crear</button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <span className="text-red-500 text-lg">⚠️</span>
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button onClick={load} className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline">Reintentar</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="space-y-6">
          {rows.map((r) => {
            const key = keyOf(r);
            const bTotal = draftTotal(key);
            const aTotal = r.actualTotal;
            const variance = bTotal - aTotal;
            const favorable = variance >= 0; // gasto real ≤ presupuesto = favorable
            return (
              <div key={key} className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 dark:border-surface-700">
                  <h3 className="font-semibold text-surface-800 dark:text-white">{r.departmentName}</h3>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-surface-500">Presupuesto <strong className="text-surface-800 dark:text-white">{money(bTotal)}</strong></span>
                    <span className="text-xs text-surface-500">Real <strong className="text-surface-800 dark:text-white">{money(aTotal)}</strong></span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${favorable ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'}`}>
                      Var {money(variance)} ({bTotal > 0 ? Math.round((variance / bTotal) * 100) : 0}%)
                    </span>
                    <button onClick={() => saveRow(r)} disabled={savingKey === key}
                      className="text-xs px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50">
                      {savingKey === key ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs">
                        <th className="text-left px-3 py-2 sticky left-0 bg-surface-50 dark:bg-surface-900/50">Concepto</th>
                        {MONTHS.map((m) => <th key={m} className="text-right px-2 py-2">{m}</th>)}
                        <th className="text-right px-3 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-surface-100 dark:border-surface-700">
                        <td className="px-3 py-2 text-surface-600 dark:text-surface-300 sticky left-0 bg-white dark:bg-surface-800">Presupuesto</td>
                        {Array.from({ length: 12 }).map((_, i) => (
                          <td key={i} className="px-1 py-1">
                            <input inputMode="decimal" value={(draft[key] ?? [])[i] ?? ''}
                              onChange={(e) => setCell(key, i, e.target.value)}
                              className="w-20 text-right bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded px-2 py-1 text-xs text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-mono font-medium text-surface-900 dark:text-white">{money(bTotal)}</td>
                      </tr>
                      <tr className="border-t border-surface-100 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-900/30">
                        <td className="px-3 py-2 text-surface-600 dark:text-surface-300 sticky left-0 bg-surface-50 dark:bg-surface-900/50">Real</td>
                        {r.months.map((m) => (
                          <td key={m.month} className="px-2 py-2 text-right font-mono text-surface-500">{m.actual ? money(m.actual) : '—'}</td>
                        ))}
                        <td className="px-3 py-2 text-right font-mono font-medium text-surface-700 dark:text-surface-300">{money(aTotal)}</td>
                      </tr>
                      <tr className="border-t border-surface-100 dark:border-surface-700">
                        <td className="px-3 py-2 text-surface-600 dark:text-surface-300 sticky left-0 bg-white dark:bg-surface-800">Variación</td>
                        {r.months.map((m, i) => {
                          const b = Number((draft[key] ?? [])[i] || 0);
                          const v = b - m.actual;
                          const fav = v >= 0;
                          return (
                            <td key={m.month} className={`px-2 py-2 text-right font-mono text-xs ${b === 0 && m.actual === 0 ? 'text-surface-300' : fav ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {b === 0 && m.actual === 0 ? '—' : money(v)}
                            </td>
                          );
                        })}
                        <td className={`px-3 py-2 text-right font-mono font-semibold ${favorable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{money(variance)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
