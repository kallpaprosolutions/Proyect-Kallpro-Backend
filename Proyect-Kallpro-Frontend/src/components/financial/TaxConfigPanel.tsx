import { useEffect, useState } from 'react';
import { financialApi } from '../../api/financial';
import { useToast } from '../ui/Toast';
import AccountMappingPanel from './AccountMappingPanel';

export default function TaxConfigPanel({ onSeeded }: { onSeeded?: () => void }) {
  const toast = useToast();
  const [iva, setIva] = useState<any[]>([]);
  const [retRenta, setRetRenta] = useState<any[]>([]);
  const [retIva, setRetIva] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      financialApi.listIva(),
      financialApi.listRetentions('RENTA'),
      financialApi.listRetentions('IVA'),
    ]).then((res) => {
      if (res[0].status === 'fulfilled') setIva(res[0].value.data);
      if (res[1].status === 'fulfilled') setRetRenta(res[1].value.data);
      if (res[2].status === 'fulfilled') setRetIva(res[2].value.data);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const seed = async () => {
    setSeeding(true);
    try {
      const r = await financialApi.seedAccounts();
      toast.success(`Inicializado: ${r.data.accounts} cuentas, ${r.data.mappings} mapeos, ${r.data.taxes?.iva ?? 0} IVA, ${r.data.taxes?.retentions ?? 0} retenciones`, '✓');
      load();
      onSeeded?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo inicializar', 'Error');
    } finally {
      setSeeding(false);
    }
  };

  const toggleIva = async (t: any) => {
    try { await financialApi.upsertIva({ ...t, porcentaje: Number(t.porcentaje), activo: !t.activo }); load(); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'Error', 'Error'); }
  };
  const toggleRet = async (r: any) => {
    try { await financialApi.upsertRetention({ ...r, porcentaje: Number(r.porcentaje), activo: !r.activo }); load(); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'Error', 'Error'); }
  };

  const RetTable = ({ title, rows, onToggle }: { title: string; rows: any[]; onToggle: (r: any) => void }) => (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700 font-semibold text-surface-900 dark:text-white">{title}</div>
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
            {rows.map((r) => (
              <tr key={r.codigo}>
                <td className="px-3 py-2 font-mono text-xs text-surface-500 w-14">{r.codigo}</td>
                <td className="px-2 py-2 text-surface-700 dark:text-surface-300">{r.descripcion}</td>
                <td className="px-2 py-2 text-right font-mono text-surface-900 dark:text-white w-16">{Number(r.porcentaje)}%</td>
                <td className="px-3 py-2 text-right w-20">
                  <button onClick={() => onToggle(r)}
                    className={`text-xs px-2 py-1 rounded-full font-medium ${r.activo ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-surface-100 dark:bg-surface-700 text-surface-500'}`}>
                    {r.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-surface-400">Sin registros — inicializa los catálogos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl p-4">
        <div>
          <h3 className="font-semibold text-surface-900 dark:text-white">Inicialización contable</h3>
          <p className="text-sm text-surface-600 dark:text-surface-400">Carga el plan de cuentas Supercías, la configuración de cuentas y los catálogos de IVA y retenciones SRI.</p>
        </div>
        <button onClick={seed} disabled={seeding}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
          {seeding ? 'Inicializando...' : '🌱 Inicializar plan de cuentas + impuestos'}
        </button>
      </div>

      <AccountMappingPanel />

      {loading ? (
        <div className="flex items-center justify-center py-8"><div className="animate-spin w-6 h-6 border-4 border-brand-500 border-t-transparent rounded-full" /></div>
      ) : (
        <>
          <RetTable title="Tarifas de IVA" rows={iva} onToggle={toggleIva} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RetTable title="Retenciones en la Fuente (IR)" rows={retRenta} onToggle={toggleRet} />
            <RetTable title="Retenciones de IVA" rows={retIva} onToggle={toggleRet} />
          </div>
        </>
      )}
    </div>
  );
}
