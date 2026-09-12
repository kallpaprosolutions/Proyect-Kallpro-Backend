import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { procurementApi } from '../../api/procurement';
import { financialApi } from '../../api/financial';
import SupplierScoreCard from '../../components/SupplierScoreCard';
import AccountStatement from '../../components/finance/AccountStatement';
import BackButton from '../../components/ui/BackButton';

const STATUS_COLORS: Record<string, string> = {
  RECEIVED:  'text-green-600 dark:text-green-400',
  APPROVED:  'text-blue-600 dark:text-blue-400',
  SUBMITTED: 'text-yellow-600 dark:text-yellow-400',
  DRAFT:     'text-surface-500',
  CANCELLED: 'text-red-600 dark:text-red-400',
};

export default function SupplierProfilePage() {
  const { id }     = useParams<{ id: string }>();
  const [data, setData]   = useState<any>(null);
  const [payables, setPayables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    setLoading(true);
    try {
      const res = await procurementApi.getSupplierPerformance(id!);
      setData(res.data);
      const pay = await financialApi.listPayables({ supplierId: id! });
      setPayables(pay.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al cargar proveedor');
    }
    setLoading(false);
  }

  async function recalculate() {
    setRecalculating(true);
    try {
      await procurementApi.recalculateScore(id!);
      await load();
    } catch {}
    setRecalculating(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  if (error || !data) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Proveedor no encontrado'}</p>
        <Link to="/purchases/suppliers" className="text-brand-500 hover:text-brand-600 text-sm">← Proveedores</Link>
      </div>
    </div>
  );

  const { supplier, score, recentOrders, monthlySpend } = data;
  const months = Object.entries(monthlySpend as Record<string, number>).sort();
  const maxSpend = Math.max(...months.map(([, v]) => v), 1);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <BackButton fallback="/purchases/suppliers" label="Proveedores" />
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🏢</div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-surface-900 dark:text-white">{supplier.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${supplier.isActive
                ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                : 'bg-surface-100 dark:bg-surface-700 text-surface-500'}`}>
                {supplier.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <p className="text-sm text-surface-500">Perfil de proveedor</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to={`/purchases/suppliers/${id}/edit`}
            className="text-xs px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors">
            ✏️ {supplier.kycCompletedAt ? 'Editar KYC' : 'Completar KYC'}
          </Link>
          <button onClick={recalculate} disabled={recalculating}
            className="text-xs px-3 py-1.5 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white rounded-lg disabled:opacity-40 transition-colors">
            {recalculating ? 'Recalculando...' : '🔄 Recalcular score'}
          </button>
        </div>
      </div>

      {!supplier.kycCompletedAt && (
        <div className="mb-4 flex items-center gap-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3">
          <span className="text-yellow-500 text-lg">⚠️</span>
          <p className="text-sm text-yellow-700 dark:text-yellow-400 flex-1">KYC UAFE pendiente. Complétalo para habilitar plenamente al proveedor.</p>
          <Link to={`/purchases/suppliers/${id}/edit`} className="text-sm font-medium text-yellow-700 dark:text-yellow-400 hover:underline flex-shrink-0">Completar →</Link>
        </div>
      )}

      <div className="space-y-6">
        {/* Info + Score */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-5 space-y-2 shadow-soft">
            <p className="text-xs text-surface-500 uppercase mb-3 font-medium tracking-wide">Información</p>
            {supplier.ruc && <p className="text-surface-700 dark:text-surface-300 text-sm"><span className="text-surface-500">RUC: </span>{supplier.ruc}</p>}
            {supplier.email && <p className="text-surface-700 dark:text-surface-300 text-sm"><span className="text-surface-500">Email: </span>{supplier.email}</p>}
            {supplier.phone && <p className="text-surface-700 dark:text-surface-300 text-sm"><span className="text-surface-500">Teléfono: </span>{supplier.phone}</p>}
            {supplier.city && <p className="text-surface-700 dark:text-surface-300 text-sm"><span className="text-surface-500">Ciudad: </span>{supplier.city}, {supplier.country}</p>}
            {supplier.paymentTerms && <p className="text-surface-700 dark:text-surface-300 text-sm"><span className="text-surface-500">Pago: </span>{supplier.paymentTerms}</p>}
          </div>
          <div className="md:col-span-2">
            <SupplierScoreCard score={score} />
          </div>
        </div>

        {/* Monthly spend chart */}
        {months.length > 0 && (
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-5 shadow-soft">
            <h3 className="font-semibold text-surface-800 dark:text-white text-sm mb-4">📊 Gasto mensual (últimos 6 meses)</h3>
            <div className="flex items-end gap-2 h-32">
              {months.map(([month, total]) => (
                <div key={month} className="flex flex-col items-center flex-1 gap-1">
                  <span className="text-xs text-surface-500">${(total as number / 1000).toFixed(1)}k</span>
                  <div className="w-full bg-brand-500 hover:bg-brand-600 rounded-t transition-colors"
                    style={{ height: `${Math.max(4, ((total as number) / maxSpend) * 100)}%` }} />
                  <span className="text-xs text-surface-400 text-center">{month.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent orders */}
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl overflow-hidden shadow-soft">
          <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700">
            <h3 className="font-semibold text-surface-800 dark:text-white">Últimas órdenes de compra</h3>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-surface-400 text-sm text-center py-8">Sin órdenes de compra</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700 text-surface-500 text-xs uppercase">
                  <th className="text-left px-5 py-3">OC</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-center px-4 py-3">Estado</th>
                  <th className="text-left px-5 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {recentOrders.map((o: any) => (
                  <tr key={o.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                    <td className="px-5 py-3">
                      <Link to={`/purchases/${o.id}`} className="text-brand-500 hover:text-brand-700 dark:hover:text-brand-300 font-mono text-xs">{o.poNumber}</Link>
                    </td>
                    <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">${Number(o.totalAmount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${STATUS_COLORS[o.status] ?? 'text-surface-500'}`}>{o.status}</span>
                    </td>
                    <td className="px-5 py-3 text-surface-500 text-xs">
                      {new Date(o.createdAt).toLocaleDateString('es-EC')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Cuenta corriente (CxP) — antes este perfil no mostraba ningún dato financiero, solo desempeño */}
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl overflow-hidden shadow-soft">
          <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700 flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-surface-800 dark:text-white">Cuenta corriente</h3>
            {payables.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-medium">
                Saldo pendiente: ${payables.reduce((s, p) => s + Number(p.balance), 0).toFixed(2)}
              </span>
            )}
          </div>
          <div className="p-5 space-y-5">
            {payables.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700 text-surface-500 text-xs uppercase">
                    <th className="text-left px-3 py-2">Documento</th>
                    <th className="text-left px-3 py-2">Vence</th>
                    <th className="text-right px-3 py-2">Saldo</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {payables.map((p: any) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 font-mono text-xs text-brand-600 dark:text-brand-400">{p.numeroDoc || '—'}</td>
                      <td className={`px-3 py-2 text-xs ${new Date(p.dueDate).getTime() < Date.now() ? 'text-red-600 dark:text-red-400 font-medium' : 'text-surface-500'}`}>
                        {new Date(p.dueDate).toLocaleDateString('es-EC')}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">${Number(p.balance).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">
                        <Link to={`/sri/${p.id}`} className="text-xs text-brand-500 hover:underline whitespace-nowrap">Ver / pagar →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <AccountStatement kind="supplier" entityId={id!} />
          </div>
        </div>

        {/* Performance records */}
        {data.recentRecords?.length > 0 && (
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl overflow-hidden shadow-soft">
            <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700">
              <h3 className="font-semibold text-surface-800 dark:text-white">Historial de desempeño</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700 text-surface-500 text-xs uppercase">
                  <th className="text-left px-5 py-3">Fecha</th>
                  <th className="text-center px-4 py-3">Puntualidad</th>
                  <th className="text-right px-4 py-3">Días tardanza</th>
                  <th className="text-right px-5 py-3">Variación precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                {data.recentRecords.map((r: any) => (
                  <tr key={r.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                    <td className="px-5 py-3 text-surface-500 text-xs">{new Date(r.createdAt).toLocaleDateString('es-EC')}</td>
                    <td className="px-4 py-3 text-center">
                      {r.isOnTime
                        ? <span className="text-green-600 dark:text-green-400">✓ A tiempo</span>
                        : <span className="text-red-600 dark:text-red-400">✗ Atrasado</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={r.onTimeDays > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                        {r.onTimeDays !== null ? `${r.onTimeDays > 0 ? '+' : ''}${r.onTimeDays}d` : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={Math.abs(Number(r.priceVariancePct)) > 5 ? 'text-orange-600 dark:text-orange-400' : 'text-surface-700 dark:text-surface-300'}>
                        {Number(r.priceVariancePct).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
