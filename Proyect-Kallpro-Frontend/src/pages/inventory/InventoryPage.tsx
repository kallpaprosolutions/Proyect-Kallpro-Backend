import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';
import { reportsApi } from '../../api/reports';
import BarcodeScanner from '../../components/ui/BarcodeScanner';
import { useToast } from '../../components/ui/Toast';
import QuickMovementModal from '../../components/QuickMovementModal';
import CollapsiblePanel from '../../components/ui/CollapsiblePanel';
import StatCard from '../../components/ui/StatCard';
import { Package, AlertTriangle, DollarSign, Layers } from 'lucide-react';

const VAL_COLORS: Record<string, string> = {
  AVG:           'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20',
  FIFO:          'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
  LIFO:          'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20',
  STANDARD_COST: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
};
const VAL_LABELS: Record<string, string> = {
  AVG: 'Avg', FIFO: 'FIFO', LIFO: 'LIFO', STANDARD_COST: 'Estándar',
};

function stockStatus(available: number, reorderPoint: number, minStock: number) {
  if (available <= 0)                                          return { label: 'Sin Stock', cls: 'text-red-600 dark:text-red-400',    dot: 'bg-red-500' };
  if (reorderPoint > 0 && available <= reorderPoint)          return { label: '⚠ Reorden',  cls: 'text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-500' };
  if (available <= minStock)                                   return { label: '↓ Bajo',      cls: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' };
  return                                                              { label: 'Normal',      cls: 'text-green-600 dark:text-green-400',  dot: 'bg-green-500' };
}

function fmt(n: any, dec = 2) {
  return Number(n ?? 0).toLocaleString('es', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// UNITS movido al wizard de creación de productos

// NewProductPanel eliminado — la creación de productos ahora usa el wizard en /inventory/products/new

function ReorderPanel({ onClose }: { onClose: () => void }) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inventoryApi.getReorderSuggestions()
      .then((r) => setSuggestions(r.data))
      .finally(() => setLoading(false));
  }, []);

  const urgencyColor: Record<string, string> = {
    CRITICAL: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
    HIGH: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20',
    MEDIUM: 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20',
  };

  return (
    <div className="bg-white dark:bg-surface-800 border border-yellow-300 dark:border-yellow-600/20 rounded-xl mb-4 overflow-hidden shadow-soft">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-100 dark:border-surface-700">
        <span className="text-yellow-500 text-sm">⚠</span>
        <h3 className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">Puntos de Reorden — {suggestions.length} productos</h3>
        <button onClick={onClose} className="ml-auto text-surface-400 hover:text-surface-700 dark:hover:text-white text-xs">✕</button>
      </div>
      {loading ? (
        <div className="p-4 text-surface-400 text-sm">Calculando...</div>
      ) : suggestions.length === 0 ? (
        <div className="p-4 text-surface-400 text-sm">✓ Todos los productos tienen stock suficiente</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-surface-500 border-b border-surface-100 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50">
                <th className="text-left px-4 py-2">Producto</th>
                <th className="text-left px-4 py-2">Urgencia</th>
                <th className="text-right px-4 py-2">Disponible</th>
                <th className="text-right px-4 py-2">Pt. Reorden</th>
                <th className="text-right px-4 py-2">Días Stock</th>
                <th className="text-right px-4 py-2">Sugerido</th>
                <th className="text-right px-4 py-2">Val. Orden</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s: any) => (
                <tr key={s.productId} className="border-b border-surface-100 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/30">
                  <td className="px-4 py-2">
                    <Link to={`/inventory/products/${s.productId}`} className="text-brand-600 dark:text-brand-400 hover:underline font-medium">{s.productName}</Link>
                    {s.sku && <span className="text-surface-400 ml-1 font-mono">({s.sku})</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${urgencyColor[s.urgency!] || ''}`}>
                      {s.urgency}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-orange-600 dark:text-orange-400">{fmt(s.availableQty, 1)} {s.unit}</td>
                  <td className="px-4 py-2 text-right font-mono text-surface-500">{fmt(s.reorderPoint, 1)}</td>
                  <td className={`px-4 py-2 text-right font-mono font-bold ${s.daysOfStock <= 7 ? 'text-red-600 dark:text-red-400' : s.daysOfStock <= 14 ? 'text-yellow-600 dark:text-yellow-400' : 'text-surface-700 dark:text-surface-300'}`}>
                    {s.daysOfStock >= 9999 ? '∞' : s.daysOfStock}d
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-green-600 dark:text-green-400">{fmt(s.suggestedQty, 1)}</td>
                  <td className="px-4 py-2 text-right font-mono text-surface-700 dark:text-surface-300">${fmt(s.estOrderValue, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterVal, setFilterVal] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  // (showNewForm removed — la creación de productos ahora usa /inventory/products/new wizard)
  const [showReorder, setShowReorder] = useState(false);
  const [showMovModal, setShowMovModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'value'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [scannerOpen, setScannerOpen] = useState(false);

  const navigate = useNavigate();
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);

  async function handleScan(code: string) {
    setScannerOpen(false);
    try {
      const r = await inventoryApi.getProductByBarcode(code).catch(() => null);
      if (r && r.data) { navigate(`/inventory/products/${r.data.id}`); return; }
      const r2 = await inventoryApi.getProductBySku(code).catch(() => null);
      if (r2 && r2.data) { navigate(`/inventory/products/${r2.data.id}`); return; }
      toast.warning(`No se encontró producto con código "${code}"`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al buscar');
    }
  }

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, cRes, wRes, kRes] = await Promise.all([
        inventoryApi.getProducts(),
        inventoryApi.getCategories(),
        inventoryApi.getWarehouses(),
        inventoryApi.getKPIs(),
      ]);
      setProducts(pRes.data);
      setCategories(cRes.data);
      setWarehouses(wRes.data);
      setKpis(kRes.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const filtered = products
    .filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.category?.name || '').toLowerCase().includes(q);

      const totalQty = p.stocks.reduce((s: number, st: any) => s + Number(st.quantity), 0);
      const reorderPoint = Number(p.reorderPoint ?? 0);
      const minStock = Number(p.minStock ?? 0);
      const avail = totalQty;
      const status = avail <= 0 ? 'nostock' : (reorderPoint > 0 && avail <= reorderPoint) ? 'reorder' : avail <= minStock ? 'low' : 'ok';

      return matchSearch &&
        (!filterCat || p.categoryId === filterCat) &&
        (!filterVal || p.valuationMethod === filterVal) &&
        (!filterStatus || status === filterStatus) &&
        (!filterWarehouse || p.stocks.some((s: any) => s.warehouseId === filterWarehouse && Number(s.quantity) > 0));
    })
    .sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
      else if (sortBy === 'stock') {
        va = a.stocks.reduce((s: number, st: any) => s + Number(st.quantity), 0);
        vb = b.stocks.reduce((s: number, st: any) => s + Number(st.quantity), 0);
      } else {
        va = a.stocks.reduce((s: number, st: any) => s + Number(st.quantity), 0) * Number(a.avgCost);
        vb = b.stocks.reduce((s: number, st: any) => s + Number(st.quantity), 0) * Number(b.avgCost);
      }
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

  const toggleSort = (col: 'name' | 'stock' | 'value') => {
    if (sortBy === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: string }) =>
    sortBy === col
      ? <span className="ml-0.5 text-brand-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
      : <span className="ml-0.5 text-surface-300 dark:text-surface-600">↕</span>;

  const alertCount = products.filter((p) => {
    const qty = p.stocks.reduce((s: number, st: any) => s + Number(st.quantity), 0);
    const rp = Number(p.reorderPoint ?? 0);
    const ms = Number(p.minStock ?? 0);
    return qty <= 0 || (rp > 0 && qty <= rp) || qty <= ms;
  }).length;

  const selectCls = 'bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="max-w-full">
      {/* Dashboard colapsable */}
      {kpis && (
        <CollapsiblePanel id="inventory-dashboard" title="Dashboard de Inventario" icon={Package}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Productos activos" value={String(kpis.totalProducts)} icon={<Package className="w-5 h-5" />} color="brand" index={0} />
            <StatCard label="Valoración total" value={`$${fmt(kpis.totalValue)}`} icon={<DollarSign className="w-5 h-5" />} color="emerald" index={1} />
            <StatCard label="Alertas de stock" value={String(alertCount)} icon={<AlertTriangle className="w-5 h-5" />} color={alertCount > 0 ? 'red' : 'emerald'} index={2} />
            <StatCard label="Categorías" value={String(categories.length)} icon={<Layers className="w-5 h-5" />} color="purple" index={3} />
          </div>
        </CollapsiblePanel>
      )}

      {/* Page header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-lg">📦</div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-surface-900 dark:text-white">Inventario</h1>
          <div className="flex items-center gap-3 text-xs text-surface-500">
            {kpis && (
              <>
                <span>{kpis.totalProducts} productos</span>
                <span className="text-brand-600 dark:text-brand-400 font-semibold">${fmt(kpis.totalValue)} valoración</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {alertCount > 0 && (
            <button onClick={() => setShowReorder(!showReorder)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${showReorder ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/30' : 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20 hover:bg-yellow-100 dark:hover:bg-yellow-500/20'}`}>
              ⚠ {alertCount} alertas
            </button>
          )}
          <button onClick={() => reportsApi.inventoryExcel()} title="Exportar Excel"
            className="text-xs px-3 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-green-600 dark:text-green-400 rounded-lg transition-colors">📊 Excel</button>
          <Link to="/inventory/warehouses" className="text-xs px-3 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 rounded-lg transition-colors">🏭 Bodegas</Link>
          <Link to="/inventory/categories" className="text-xs px-3 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 rounded-lg transition-colors">🏷 Categorías</Link>
          <Link to="/inventory/transfers" className="text-xs px-3 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-brand-600 dark:text-brand-400 rounded-lg transition-colors">⇄ Traslados</Link>
          <Link to="/inventory/replenishment" className="text-xs px-3 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-brand-600 dark:text-brand-400 rounded-lg transition-colors">🔄 Reposición</Link>
          <button onClick={() => setScannerOpen(true)} title="Buscar por código de barras/QR"
            className="text-xs px-3 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 rounded-lg transition-colors">📷 Escanear</button>
          <Link to="/inventory/quick-entry" className="text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors shadow-sm">
            ⚡ Entrada Rápida
          </Link>
          <Link to="/inventory/physical-count" className="text-xs px-3 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 rounded-lg transition-colors">🔢 Conteo Físico</Link>
          <Link to="/inventory/analytics" className="text-xs px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors">📊 Analytics</Link>
          <Link to="/inventory/products/new" className="text-xs px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors">
            ＋ Nuevo Producto
          </Link>
        </div>
      </div>

      {showReorder && <ReorderPanel onClose={() => setShowReorder(false)} />}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400 text-xs">🔍</span>
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Buscar… (/ para enfocar)'
            className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg pl-7 pr-7 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-700 dark:hover:text-white text-xs">✕</button>}
        </div>

        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className={selectCls}>
          <option value="">Todas las categorías</option>
          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={filterWarehouse} onChange={(e) => setFilterWarehouse(e.target.value)} className={selectCls}>
          <option value="">Todas las bodegas</option>
          {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>

        <select value={filterVal} onChange={(e) => setFilterVal(e.target.value)} className={selectCls}>
          <option value="">Todos métodos</option>
          <option value="AVG">Promedio</option>
          <option value="FIFO">FIFO</option>
          <option value="LIFO">LIFO</option>
          <option value="STANDARD_COST">Estándar</option>
        </select>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="">Todos los estados</option>
          <option value="ok">Normal</option>
          <option value="reorder">⚠ Reorden</option>
          <option value="low">↓ Stock Bajo</option>
          <option value="nostock">Sin Stock</option>
        </select>

        {(search || filterCat || filterVal || filterStatus || filterWarehouse) && (
          <button onClick={() => { setSearch(''); setFilterCat(''); setFilterVal(''); setFilterStatus(''); setFilterWarehouse(''); }}
            className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-white px-2 py-1.5 bg-surface-100 dark:bg-surface-700 rounded-lg transition-colors">✕ Limpiar</button>
        )}

        <span className="ml-auto text-xs text-surface-400">{filtered.length} / {products.length} productos</span>
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="text-center py-20 text-surface-400">Cargando inventario...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-surface-400 text-sm">
          {products.length === 0 ? (
            <>Sin productos. <Link to="/inventory/products/new" className="text-brand-500 underline">Crear el primero</Link></>
          ) : 'No hay productos con los filtros seleccionados.'}
        </div>
      ) : (
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden shadow-soft">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-400">
                <th className="text-left px-3 py-2.5 cursor-pointer hover:text-surface-800 dark:hover:text-white" onClick={() => toggleSort('name')}>
                  Producto <SortIcon col="name" />
                </th>
                <th className="text-left px-3 py-2.5">Barcode</th>
                <th className="text-left px-3 py-2.5">Categoría</th>
                <th className="text-left px-3 py-2.5">Bodega(s)</th>
                <th className="text-right px-3 py-2.5 cursor-pointer hover:text-surface-800 dark:hover:text-white" onClick={() => toggleSort('stock')}>
                  Stock Total <SortIcon col="stock" />
                </th>
                <th className="text-right px-3 py-2.5">Pt.Reorden</th>
                <th className="text-right px-3 py-2.5">Costo Avg</th>
                <th className="text-right px-3 py-2.5 cursor-pointer hover:text-surface-800 dark:hover:text-white" onClick={() => toggleSort('value')}>
                  Valoración <SortIcon col="value" />
                </th>
                <th className="text-center px-3 py-2.5">Método</th>
                <th className="text-left px-3 py-2.5">Estado</th>
                <th className="text-center px-3 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
              {filtered.map((p: any) => {
                const totalQty = p.stocks.reduce((s: number, st: any) => s + Number(st.quantity), 0);
                const reorderPoint = Number(p.reorderPoint ?? 0);
                const minStock = Number(p.minStock ?? 0);
                const status = stockStatus(totalQty, reorderPoint, minStock);
                const totalValue = totalQty * Number(p.avgCost);
                const activeStocks = p.stocks.filter((s: any) => Number(s.quantity) > 0);

                return (
                  <tr key={p.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/40 transition-colors group bg-white dark:bg-surface-800">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" className="w-8 h-8 rounded-md object-cover border border-surface-200 dark:border-surface-700 flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-surface-100 dark:bg-surface-700 flex items-center justify-center text-sm flex-shrink-0">📦</div>
                        )}
                        <div className="min-w-0">
                          <Link to={`/inventory/products/${p.id}`} className="font-medium text-surface-800 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors truncate block">
                            {p.name}
                          </Link>
                          {p.sku && <div className="text-surface-400 font-mono text-xs truncate">{p.sku}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {p.barcode ? (
                        <span className="font-mono text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-700 px-1.5 py-0.5 rounded text-xs">
                          ▌▌ {p.barcode}
                        </span>
                      ) : <span className="text-surface-300 dark:text-surface-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-surface-500">{p.category?.name || <span className="text-surface-300 dark:text-surface-600">—</span>}</td>
                    <td className="px-3 py-2">
                      {activeStocks.length === 0 ? (
                        <span className="text-surface-300 dark:text-surface-600">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {activeStocks.slice(0, 2).map((s: any) => (
                            <div key={s.id} className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                              <span className="text-surface-500 truncate max-w-[80px]">{s.warehouse?.name}</span>
                              <span className="text-surface-700 dark:text-surface-300 font-mono ml-auto">{fmt(s.quantity, 0)}</span>
                            </div>
                          ))}
                          {activeStocks.length > 2 && (
                            <span className="text-surface-400 text-xs">+{activeStocks.length - 2} más</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-surface-800 dark:text-white">
                      {fmt(totalQty, 0)}
                      <span className="text-surface-400 font-normal ml-1">{p.unit}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {reorderPoint > 0 ? (
                        <span className={totalQty <= reorderPoint ? 'text-yellow-600 dark:text-yellow-400 font-bold' : 'text-surface-400'}>
                          {fmt(reorderPoint, 0)}
                        </span>
                      ) : <span className="text-surface-300 dark:text-surface-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-surface-600 dark:text-surface-300">${fmt(p.avgCost, 4)}</td>
                    <td className="px-3 py-2 text-right font-mono text-surface-600 dark:text-surface-300">${fmt(totalValue, 2)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded-md text-xs font-medium border ${VAL_COLORS[p.valuationMethod] || 'bg-surface-100 dark:bg-surface-700 text-surface-500 border-surface-200 dark:border-surface-600'}`}>
                        {VAL_LABELS[p.valuationMethod] || p.valuationMethod}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        <span className={`text-xs ${status.cls}`}>{status.label}</span>
                      </div>
                      {reorderPoint > 0 && (
                        <div className="w-16 h-1 bg-surface-200 dark:bg-surface-700 rounded-full mt-1">
                          <div
                            className={`h-1 rounded-full transition-all ${totalQty <= reorderPoint ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(100, reorderPoint > 0 ? (totalQty / (reorderPoint * 2)) * 100 : 100)}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setSelectedProductId(p.id); setShowMovModal(true); }}
                          title="Movimiento"
                          className="bg-green-100 dark:bg-green-600/20 hover:bg-green-200 dark:hover:bg-green-600/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded text-xs transition-colors">
                          ↕
                        </button>
                        <Link to={`/inventory/products/${p.id}`} title="Ver detalle"
                          className="bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 px-1.5 py-0.5 rounded text-xs transition-colors">
                          →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showMovModal && selectedProductId && (
        <QuickMovementModal
          productId={selectedProductId}
          onClose={() => { setShowMovModal(false); setSelectedProductId(null); }}
          onSaved={load}
        />
      )}

      <BarcodeScanner
        open={scannerOpen}
        onScan={handleScan}
        onClose={() => setScannerOpen(false)}
        title="Buscar producto por código"
        subtitle="Escanea un barcode o QR — abre el detalle del producto"
      />
    </div>
  );
}
