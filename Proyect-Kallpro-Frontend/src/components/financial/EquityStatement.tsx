import { useEffect, useState } from 'react';
import { financialApi } from '../../api/financial';

const money = (n: number) => {
  const abs = Math.abs(Number(n)).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? '-' : ''}$${abs}`;
};

const CATEGORY_LABEL: Record<string, string> = {
  CAPITAL: 'Capital', RESERVAS: 'Reservas', RESULTADOS_ACUMULADOS: 'Resultados acumulados', OTROS_PATRIMONIO: 'Otros',
};

/** Estado de Cambios en el Patrimonio (NIC 1) — Etapa 8 del plan SRI/NIIF. `from`/`to` en formato AAAA-MM-DD. */
export default function EquityStatement({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true); setError('');
    financialApi.getEquityStatement(from, to)
      .then((r) => setData(r.data))
      .catch(() => setError('No se pudo cargar el Estado de Cambios en el Patrimonio.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [from, to]);

  if (loading) return <div className="flex items-center justify-center py-10"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;
  if (error) return (
    <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
      <span className="text-red-500 text-lg">⚠️</span><p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
      <button onClick={load} className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline">Reintentar</button>
    </div>
  );
  if (!data) return null;

  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700 font-semibold text-surface-900 dark:text-white">
        Estado de Cambios en el Patrimonio <span className="text-sm text-surface-500 font-normal">(NIC 1)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-surface-500 text-xs uppercase">
              <th className="px-4 py-2 text-left">Categoría</th>
              <th className="px-4 py-2 text-right">Saldo inicial</th>
              <th className="px-4 py-2 text-right">Aumentos</th>
              <th className="px-4 py-2 text-right">Disminuciones</th>
              <th className="px-4 py-2 text-right">Saldo final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
            {data.categories.map((c: any) => (
              <tr key={c.category}>
                <td className="px-4 py-2 text-surface-700 dark:text-surface-300">{CATEGORY_LABEL[c.category] ?? c.category}</td>
                <td className="px-4 py-2 text-right font-mono text-surface-900 dark:text-white">{money(c.opening)}</td>
                <td className="px-4 py-2 text-right font-mono text-green-600 dark:text-green-400">{c.increases > 0 ? `+${money(c.increases)}` : money(0)}</td>
                <td className="px-4 py-2 text-right font-mono text-red-600 dark:text-red-400">{c.decreases > 0 ? `−${money(c.decreases)}` : money(0)}</td>
                <td className="px-4 py-2 text-right font-mono text-surface-900 dark:text-white">{money(c.closing)}</td>
              </tr>
            ))}
            <tr>
              <td className="px-4 py-2 text-surface-500 italic" colSpan={4}>Utilidad acumulada de ejercicios anteriores (no cerrada al mayor)</td>
              <td className="px-4 py-2 text-right font-mono text-surface-500" />
            </tr>
            <tr>
              <td className="px-4 py-2 text-surface-700 dark:text-surface-300">Resultado del ejercicio actual</td>
              <td className="px-4 py-2 text-right font-mono text-surface-400">—</td>
              <td className="px-4 py-2 text-right font-mono text-surface-400">—</td>
              <td className="px-4 py-2 text-right font-mono text-surface-400">—</td>
              <td className="px-4 py-2 text-right font-mono text-surface-900 dark:text-white">{money(data.utilidadEjercicio)}</td>
            </tr>
            <tr className="bg-surface-50 dark:bg-surface-900/50 font-semibold">
              <td className="px-4 py-2 text-surface-700 dark:text-surface-300">TOTAL PATRIMONIO</td>
              <td className="px-4 py-2 text-right font-mono text-surface-900 dark:text-white">{money(data.totalInicial)}</td>
              <td className="px-4 py-2 text-right font-mono text-green-600 dark:text-green-400">+{money(data.totalAumentos)}</td>
              <td className="px-4 py-2 text-right font-mono text-red-600 dark:text-red-400">−{money(data.totalDisminuciones)}</td>
              <td className="px-4 py-2 text-right font-mono text-surface-900 dark:text-white">{money(data.totalFinal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
