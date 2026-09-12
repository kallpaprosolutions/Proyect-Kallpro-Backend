import { useEffect, useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { inventoryApi } from '../../api/inventory';
import { DataTable } from '../../components/ui/DataTable';

/**
 * Valorización de inventario — vista contable + KPI.
 * Muestra el valor del stock (por bodega, por categoría y por SKU) y lo
 * CONCILIA contra el saldo del mayor de la cuenta de inventario (1010306),
 * para que contabilidad e inventario hablen el mismo idioma.
 */

const fmt$ = (n: number) => '$' + Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BAR_COLORS = ['#00B8E0', '#36cfe8', '#7adef0', '#a9e9f5', '#cdf2f9', '#e2f8fc'];

export default function InventoryValuationPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const load = () => {
    setError('');
    setLoading(true);
    inventoryApi.getInventoryValuation({ warehouseId: warehouseId || undefined, categoryId: categoryId || undefined })
      .then((r) => setData(r.data))
      .catch(() => setError('No se pudo cargar la valorización. Verifica el backend.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    inventoryApi.getWarehouses().then((r) => setWarehouses(r.data)).catch(() => {});
    inventoryApi.getCategories().then((r) => setCategories(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [warehouseId, categoryId]);

  const reconciled = data && Math.abs(data.difference) < 0.01;

  const columns = useMemo<ColumnDef<any, any>[]>(() => [
    { accessorKey: 'sku', header: 'SKU', cell: ({ getValue }) => <span className="font-mono text-brand-600 dark:text-brand-400">{getValue() as string}</span> },
    { accessorKey: 'name', header: 'Producto' },
    { accessorKey: 'warehouseName', header: 'Bodega', cell: ({ getValue }) => <span className="text-surface-500">{getValue() as string}</span> },
    { accessorKey: 'category', header: 'Categoría', cell: ({ getValue }) => <span className="text-surface-500">{getValue() as string}</span> },
    { accessorKey: 'method', header: 'Método', cell: ({ getValue }) => <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300">{getValue() as string}</span> },
    { accessorKey: 'qty', header: 'Cantidad', cell: ({ getValue }) => <span className="font-mono">{Number(getValue()).toLocaleString('es')}</span> },
    { accessorKey: 'avgCost', header: 'Costo prom.', cell: ({ getValue }) => <span className="font-mono text-surface-500">{fmt$(getValue() as number)}</span> },
    { accessorKey: 'value', header: 'Valor', cell: ({ getValue }) => <span className="font-mono font-semibold">{fmt$(getValue() as number)}</span> },
  ], []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">💎</div>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Valorización de Inventario</h1>
          <p className="text-sm text-surface-500">Valor contable del stock conciliado contra el mayor ({data?.inventoryAccount ?? '1010306'})</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <span className="text-red-500 text-lg">⚠️</span>
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button onClick={load} className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline">Reintentar</button>
        </div>
      )}

      {/* Conciliación contable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-4 shadow-soft">
          <p className="text-sm text-surface-500">Valor total del inventario</p>
          <p className="text-2xl font-bold text-surface-900 dark:text-white mt-1">{data ? fmt$(data.totals.totalValue) : '—'}</p>
          <p className="text-xs text-surface-400 mt-1">{data ? `${data.totals.skuCount} SKUs · ${Number(data.totals.totalQty).toLocaleString('es')} unidades` : ''}</p>
        </div>
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-4 shadow-soft">
          <p className="text-sm text-surface-500">Saldo según mayor ({data?.inventoryAccount ?? '1010306'})</p>
          <p className="text-2xl font-bold text-surface-900 dark:text-white mt-1">{data ? fmt$(data.glBalance) : '—'}</p>
          <p className="text-xs text-surface-400 mt-1">Asientos contables de inventario</p>
        </div>
        <div className={`rounded-2xl border p-4 shadow-soft ${!data ? 'bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700'
          : reconciled ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
          : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'}`}>
          <p className={`text-sm ${!data ? 'text-surface-500' : reconciled ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            Diferencia {reconciled ? '· conciliado ✓' : ''}
          </p>
          <p className={`text-2xl font-bold mt-1 ${!data ? 'text-surface-900 dark:text-white' : reconciled ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {data ? fmt$(data.difference) : '—'}
          </p>
          <p className="text-xs text-surface-400 mt-1">
            {data && !reconciled ? 'Stock sin asiento (legado) o asientos sin stock — revisar' : 'Inventario físico = mayor contable'}
          </p>
        </div>
      </div>

      {/* Filtros + gráfico por bodega */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-semibold text-surface-900 dark:text-white">Valor por bodega</h2>
          <div className="flex gap-2 flex-wrap">
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}
              className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-700 dark:text-white">
              <option value="">Todas las bodegas (incluye sub-bodegas)</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-700 dark:text-white">
              <option value="">Todas las categorías</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        {data && data.byWarehouse.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byWarehouse} layout="vertical" margin={{ left: 8, right: 24 }}>
              <XAxis type="number" tickFormatter={(v) => '$' + Number(v).toLocaleString('es')} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => fmt$(Number(v))} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {data.byWarehouse.map((_: any, i: number) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-sm text-surface-400 py-8">{loading ? 'Cargando…' : 'Sin stock valorizable con los filtros actuales.'}</p>
        )}
      </div>

      {/* Detalle por SKU */}
      <DataTable
        columns={columns}
        data={data?.lines ?? []}
        loading={loading}
        searchPlaceholder="🔍 Buscar por SKU, producto, bodega..."
        emptyIcon="💎"
        emptyMessage="Sin líneas de stock valorizable."
        pageSize={10}
      />
    </div>
  );
}
