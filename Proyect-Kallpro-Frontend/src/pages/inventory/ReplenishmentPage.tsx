import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';
import { useToast } from '../../components/ui/Toast';

interface Suggestion {
  productId: string;
  productName: string;
  sku: string | null;
  unit: string;
  warehouseId: string;
  warehouseName: string;
  available: number;
  min: number;
  max: number | null;
  target: number;
  needed: number;
  route: 'TRANSFER' | 'PURCHASE';
  transferFromWarehouseId: string | null;
  transferFromWarehouseName: string | null;
  daysOfStock: number;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

const URGENCY_STYLE: Record<string, string> = {
  CRITICAL: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
  HIGH: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20',
  MEDIUM: 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20',
};

function fmt(n: number, dec = 1) {
  return Number(n ?? 0).toLocaleString('es', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function ReplenishmentPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const toast = useToast();

  const rowKey = (s: Suggestion) => `${s.productId}:${s.warehouseId}`;

  const load = () => {
    setLoading(true);
    inventoryApi.getReplenishmentSuggestions()
      .then((r) => setSuggestions(r.data))
      .catch(() => toast.error('No se pudieron cargar las sugerencias de reabastecimiento', 'Error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function handleExecute(s: Suggestion) {
    setBusyKey(rowKey(s));
    try {
      if (s.route === 'TRANSFER') {
        await inventoryApi.applySuggestedTransfer(s.productId, s.warehouseId);
        toast.success(`Traslado creado: ${fmt(s.needed)} ${s.unit} de ${s.transferFromWarehouseName} a ${s.warehouseName}`, '✓ Listo');
      } else {
        await inventoryApi.applySuggestedRequisition(s.productId, s.warehouseId);
        toast.success(`Requisición creada por ${fmt(s.needed)} ${s.unit} de ${s.productName}`, '✓ Listo');
      }
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo ejecutar la sugerencia', 'Error');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSnooze(s: Suggestion) {
    setBusyKey(rowKey(s));
    try {
      await inventoryApi.snoozeReplenishment(s.productId, s.warehouseId, 7);
      toast.success('Sugerencia pospuesta 7 días', '✓ Listo');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'No se pudo posponer', 'Error');
    } finally {
      setBusyKey(null);
    }
  }

  const criticalCount = suggestions.filter((s) => s.urgency === 'CRITICAL').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white flex items-center gap-2">
            🔄 Reabastecimiento entre bodegas
          </h1>
          <p className="text-sm text-surface-500">
            Mín/máx por bodega — sugiere trasladar desde una bodega con excedente antes de comprar de más.
          </p>
        </div>
        <Link to="/inventory" className="text-xs px-3 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 rounded-lg transition-colors">
          ← Volver a Inventario
        </Link>
      </div>

      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden shadow-soft">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-100 dark:border-surface-700">
          <span className="text-sm font-semibold text-surface-700 dark:text-surface-200">
            {suggestions.length} producto-bodega bajo su mínimo
          </span>
          {criticalCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full border text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20">
              {criticalCount} críticos
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-6 text-surface-400 text-sm">Calculando sugerencias...</div>
        ) : suggestions.length === 0 ? (
          <div className="p-6 text-surface-400 text-sm">✓ Todas las bodegas están sobre su mínimo</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-surface-500 border-b border-surface-100 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50">
                  <th className="text-left px-4 py-2">Producto</th>
                  <th className="text-left px-4 py-2">Bodega</th>
                  <th className="text-right px-4 py-2">Disponible</th>
                  <th className="text-right px-4 py-2">Mín / Máx</th>
                  <th className="text-right px-4 py-2">Días stock</th>
                  <th className="text-left px-4 py-2">Urgencia</th>
                  <th className="text-left px-4 py-2">Ruta preferida</th>
                  <th className="text-right px-4 py-2">A pedir</th>
                  <th className="text-right px-4 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => {
                  const key = rowKey(s);
                  const busy = busyKey === key;
                  return (
                    <tr key={key} className="border-b border-surface-100 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/30">
                      <td className="px-4 py-2">
                        <Link to={`/inventory/products/${s.productId}`} className="text-brand-600 dark:text-brand-400 hover:underline font-medium">{s.productName}</Link>
                        {s.sku && <span className="text-surface-400 ml-1 font-mono">({s.sku})</span>}
                      </td>
                      <td className="px-4 py-2 text-surface-600 dark:text-surface-300">{s.warehouseName}</td>
                      <td className="px-4 py-2 text-right font-mono text-orange-600 dark:text-orange-400">{fmt(s.available)} {s.unit}</td>
                      <td className="px-4 py-2 text-right font-mono text-surface-500">{fmt(s.min)} / {s.max != null ? fmt(s.max) : '—'}</td>
                      <td className={`px-4 py-2 text-right font-mono font-bold ${s.daysOfStock <= 7 ? 'text-red-600 dark:text-red-400' : s.daysOfStock <= 14 ? 'text-yellow-600 dark:text-yellow-400' : 'text-surface-700 dark:text-surface-300'}`}>
                        {s.daysOfStock >= 9999 ? '∞' : `${s.daysOfStock}d`}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${URGENCY_STYLE[s.urgency]}`}>{s.urgency}</span>
                      </td>
                      <td className="px-4 py-2">
                        {s.route === 'TRANSFER' ? (
                          <span className="text-blue-600 dark:text-blue-400">⇄ Trasladar desde {s.transferFromWarehouseName}</span>
                        ) : (
                          <span className="text-purple-600 dark:text-purple-400">🛒 Comprar</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-green-600 dark:text-green-400">{fmt(s.needed)} {s.unit}</td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <button
                          disabled={busy}
                          onClick={() => handleExecute(s)}
                          className="text-xs px-2 py-1 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-md font-medium transition-colors mr-1"
                        >
                          {s.route === 'TRANSFER' ? 'Trasladar' : 'Requisición'}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => handleSnooze(s)}
                          className="text-xs px-2 py-1 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 disabled:opacity-50 text-surface-600 dark:text-surface-300 rounded-md transition-colors"
                        >
                          Posponer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
