import { useEffect, useState } from 'react';
import { financialApi } from '../../api/financial';
import { downloadClientCsv } from '../../lib/csv';

const yearRange = () => {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
};

const money = (n: number) => `$${Number(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Acc { code: string; name: string; balance: number; }

function Group({ title, rows }: { title: string; rows: Acc[] }) {
  if (rows.length === 0) return null;
  return (
    <>
      <tr className="bg-surface-50 dark:bg-surface-900/50"><td colSpan={3} className="px-4 py-2 text-xs uppercase tracking-wider text-surface-500 font-semibold">{title}</td></tr>
      {rows.map((a) => (
        <tr key={a.code} className="border-t border-surface-100 dark:border-surface-700">
          <td className="px-4 py-2 text-surface-500 font-mono text-xs w-16">{a.code}</td>
          <td className="px-2 py-2 text-surface-700 dark:text-surface-300">{a.name}</td>
          <td className="px-4 py-2 text-right font-mono text-surface-900 dark:text-white">{money(a.balance)}</td>
        </tr>
      ))}
    </>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <tr className={`border-t border-surface-200 dark:border-surface-600 ${strong ? 'bg-surface-50 dark:bg-surface-900/50' : ''}`}>
      <td colSpan={2} className={`px-4 py-2 ${strong ? 'font-semibold text-surface-900 dark:text-white' : 'text-surface-700 dark:text-surface-300'}`}>{label}</td>
      <td className={`px-4 py-2 text-right font-mono ${value >= 0 ? 'text-surface-900 dark:text-white' : 'text-red-600 dark:text-red-400'} ${strong ? 'font-bold' : ''}`}>{money(value)}</td>
    </tr>
  );
}

export default function IncomeStatement() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true); setError('');
    const y = new Date().getFullYear();
    financialApi.getIncomeStatement(`${y}-01-01`, `${y}-12-31`)
      .then((r) => setData(r.data))
      .catch(() => setError('No se pudo cargar el Estado de Resultados.'))
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-surface-900 dark:text-white">Estado de Resultados <span className="text-sm text-surface-500 font-normal">del año en curso</span></h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => downloadClientCsv(`estado-resultados-${new Date().getFullYear()}.csv`,
              ['Sección', 'Cuenta', 'Nombre', 'Valor'],
              [
                ...data.ingresos.map((a: Acc) => ['INGRESOS', a.code, a.name, a.balance]),
                ['INGRESOS', '', 'TOTAL INGRESOS', data.totalIngresos],
                ...data.costos.map((a: Acc) => ['COSTOS', a.code, a.name, a.balance]),
                ['', '', 'UTILIDAD BRUTA', data.utilidadBruta],
                ...data.gastos.map((a: Acc) => ['GASTOS', a.code, a.name, a.balance]),
                ['', '', 'UTILIDAD OPERATIVA', data.utilidadOperativa],
                ['', '', 'UTILIDAD NETA', data.utilidadNeta],
              ])}
            className="text-xs text-brand-500 hover:underline" title="Descargar CSV">
            ⬇️ CSV
          </button>
          <button onClick={() => financialApi.downloadIncomeStatementPdf(yearRange().from, yearRange().to)}
            className="text-xs text-brand-500 hover:underline" title="Descargar PDF">
            ⬇️ PDF
          </button>
          <button onClick={() => financialApi.downloadIncomeStatementExcel(yearRange().from, yearRange().to)}
            className="text-xs text-brand-500 hover:underline" title="Descargar Excel">
            ⬇️ Excel
          </button>
        </div>
      </div>
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            <Group title="Ingresos" rows={data.ingresos} />
            <TotalRow label="Total Ingresos" value={data.totalIngresos} />
            <Group title="Costo de Ventas" rows={data.costos} />
            <TotalRow label="Utilidad Bruta" value={data.utilidadBruta} strong />
            <Group title="Gastos Operativos" rows={data.gastos} />
            <TotalRow label="Utilidad Operativa" value={data.utilidadOperativa} strong />
            <TotalRow label="Utilidad Neta" value={data.utilidadNeta} strong />
          </tbody>
        </table>
      </div>
    </div>
  );
}
