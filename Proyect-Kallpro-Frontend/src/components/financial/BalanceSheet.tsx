import { useEffect, useState } from 'react';
import { financialApi } from '../../api/financial';
import { downloadClientCsv } from '../../lib/csv';

const money = (n: number) => `$${Number(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Acc { code: string; name: string; balance: number; }

function Section({ title, rows, total, accent, onAccountClick }: { title: string; rows: Acc[]; total: number; accent: string; onAccountClick?: (code: string) => void }) {
  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
      <div className={`px-4 py-3 border-b border-surface-100 dark:border-surface-700 font-semibold ${accent}`}>{title}</div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
          {rows.length === 0 && <tr><td className="px-4 py-3 text-surface-400">Sin movimientos</td></tr>}
          {rows.map((a) => {
            const clickable = !!onAccountClick && a.code !== '—';
            return (
            <tr key={a.code}
              onClick={clickable ? () => onAccountClick!(a.code) : undefined}
              title={clickable ? 'Ver mayor de la cuenta' : undefined}
              className={clickable ? 'cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors' : undefined}>
              <td className={`px-4 py-2 font-mono text-xs w-16 ${clickable ? 'text-brand-600 dark:text-brand-400' : 'text-surface-500'}`}>{a.code}</td>
              <td className="px-2 py-2 text-surface-700 dark:text-surface-300">{a.name}</td>
              <td className="px-4 py-2 text-right font-mono text-surface-900 dark:text-white">{money(a.balance)}</td>
            </tr>
            );
          })}
          <tr className="bg-surface-50 dark:bg-surface-900/50 font-semibold">
            <td colSpan={2} className="px-4 py-2 text-surface-700 dark:text-surface-300">Total {title}</td>
            <td className="px-4 py-2 text-right font-mono text-surface-900 dark:text-white">{money(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function BalanceSheet({ onAccountClick }: { onAccountClick?: (code: string) => void } = {}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true); setError('');
    financialApi.getBalanceSheet()
      .then((r) => setData(r.data))
      .catch(() => setError('No se pudo cargar el Balance General.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;
  if (error) return (
    <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
      <span className="text-red-500 text-lg">⚠️</span><p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
      <button onClick={load} className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline">Reintentar</button>
    </div>
  );
  if (!data) return null;

  const balancea = Math.abs(data.cuadre) < 0.01;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-surface-900 dark:text-white">Balance General <span className="text-sm text-surface-500 font-normal">al {new Date(data.asOf).toLocaleDateString('es')}</span></h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${balancea ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'}`}>
            {balancea ? '✓ Cuadrado' : `Descuadre ${money(data.cuadre)}`}
          </span>
          <button
            onClick={() => downloadClientCsv(`balance-general-${new Date(data.asOf).toISOString().slice(0, 10)}.csv`,
              ['Sección', 'Cuenta', 'Nombre', 'Saldo'],
              [
                ...data.activos.map((a: Acc) => ['ACTIVO', a.code, a.name, a.balance]),
                ['ACTIVO', '', 'TOTAL ACTIVOS', data.totalActivos],
                ...data.pasivos.map((a: Acc) => ['PASIVO', a.code, a.name, a.balance]),
                ['PASIVO', '', 'TOTAL PASIVOS', data.totalPasivos],
                ...data.patrimonio.map((a: Acc) => ['PATRIMONIO', a.code, a.name, a.balance]),
                ['PATRIMONIO', '', 'Resultado del ejercicio', data.utilidadEjercicio],
                ['PATRIMONIO', '', 'TOTAL PATRIMONIO', data.totalPatrimonio],
              ])}
            className="text-xs text-brand-500 hover:underline" title="Descargar CSV">
            ⬇️ CSV
          </button>
          <button onClick={() => financialApi.downloadBalanceSheetPdf()} className="text-xs text-brand-500 hover:underline" title="Descargar PDF">
            ⬇️ PDF
          </button>
          <button onClick={() => financialApi.downloadBalanceSheetExcel()} className="text-xs text-brand-500 hover:underline" title="Descargar Excel">
            ⬇️ Excel
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Activos" rows={data.activos} total={data.totalActivos} accent="text-blue-600 dark:text-blue-400" onAccountClick={onAccountClick} />
        <div className="space-y-4">
          <Section title="Pasivos" rows={data.pasivos} total={data.totalPasivos} accent="text-red-600 dark:text-red-400" onAccountClick={onAccountClick} />
          <Section
            title="Patrimonio"
            rows={[...data.patrimonio, { code: '—', name: 'Resultado del ejercicio', balance: data.utilidadEjercicio }]}
            total={data.totalPatrimonio}
            accent="text-green-600 dark:text-green-400"
            onAccountClick={onAccountClick}
          />
        </div>
      </div>
    </div>
  );
}
