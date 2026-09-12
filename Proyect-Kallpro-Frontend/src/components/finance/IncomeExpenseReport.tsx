import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { treasuryApi } from '../../api/treasury';

const money = (n: number) => `$${Number(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Reporte gerencial de ingresos vs egresos (base contable: cuentas 4x y 5x del
 * libro diario). Alimenta las decisiones financieras sin tocar Contabilidad.
 */
export default function IncomeExpenseReport() {
  const [data, setData] = useState<any>(null);
  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    treasuryApi.getIncomeExpense(months)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [months]);

  if (loading) return <div className="flex justify-center py-14"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;
  if (!data) return <p className="text-center text-surface-400 text-sm py-10">No se pudo cargar el reporte.</p>;

  const margin = data.totals.income > 0 ? (data.totals.net / data.totals.income) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-surface-900 dark:text-white">Ingresos vs Egresos</h3>
          <p className="text-xs text-surface-400">Base contable (cuentas 4x/5x del diario) · {months} meses · <Link to="/tesoreria" className="text-brand-500 hover:underline">Ver Tesorería →</Link></p>
        </div>
        <div className="flex gap-1.5">
          {[6, 12, 24].map((m) => (
            <button key={m} onClick={() => setMonths(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${months === m ? 'bg-brand-500 text-white' : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300'}`}>
              {m}M
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Ingresos', value: money(data.totals.income), cls: 'text-green-600 dark:text-green-400' },
          { label: 'Egresos', value: money(data.totals.expense), cls: 'text-red-600 dark:text-red-400' },
          { label: 'Resultado neto', value: money(data.totals.net), cls: data.totals.net >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-600 dark:text-red-400' },
          { label: 'Margen', value: `${margin.toFixed(1)}%`, cls: 'text-surface-900 dark:text-white' },
        ].map((k) => (
          <div key={k.label} className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4 shadow-soft">
            <p className="text-[11px] text-surface-500 uppercase tracking-wider">{k.label}</p>
            <p className={`text-xl font-bold font-mono ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-5 shadow-soft">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data.series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => money(Number(v))} />
            <Legend />
            <Bar dataKey="income" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="Egresos" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="net" name="Neto" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
            <th className="text-left px-4 py-2.5">Mes</th><th className="text-right px-4 py-2.5">Ingresos</th>
            <th className="text-right px-4 py-2.5">Egresos</th><th className="text-right px-4 py-2.5">Neto</th>
          </tr></thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
            {data.series.map((s: any) => (
              <tr key={s.month}>
                <td className="px-4 py-2.5 font-mono text-surface-600 dark:text-surface-300">{s.month}</td>
                <td className="px-4 py-2.5 text-right font-mono text-green-600 dark:text-green-400">{s.income !== 0 ? money(s.income) : '—'}</td>
                <td className="px-4 py-2.5 text-right font-mono text-red-600 dark:text-red-400">{s.expense !== 0 ? money(s.expense) : '—'}</td>
                <td className={`px-4 py-2.5 text-right font-mono font-semibold ${s.net < 0 ? 'text-red-600 dark:text-red-400' : 'text-surface-900 dark:text-white'}`}>{money(s.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
