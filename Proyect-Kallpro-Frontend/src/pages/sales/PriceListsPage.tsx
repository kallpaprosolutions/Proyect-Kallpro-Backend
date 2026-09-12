import { useEffect, useState } from 'react';
import { priceListsApi, PriceList } from '../../api/priceLists';
import { inventoryApi } from '../../api/inventory';
import { getErrorMessage } from '../../api/client';
import { useConfirm } from '../../hooks/useConfirm';

export default function PriceListsPage() {
  const confirmAction = useConfirm();
  const [lists, setLists] = useState<PriceList[]>([]);
  const [selected, setSelected] = useState<PriceList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', isActive: true });

  async function loadLists() {
    const { data } = await priceListsApi.list();
    setLists(data);
  }

  useEffect(() => {
    priceListsApi.list()
      .then((l) => setLists(l.data))
      .catch(() => setError('No se pudieron cargar los datos'))
      .finally(() => setLoading(false));
  }, []);

  async function openList(id: string) {
    const { data } = await priceListsApi.get(id);
    setSelected(data);
  }

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await priceListsApi.create({
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate || null,
        isActive: form.isActive,
      });
      setCreating(false);
      setForm({ name: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', isActive: true });
      await loadLists();
      openList(data.id);
    } catch (e: any) {
      setError(getErrorMessage(e, 'Error al crear la lista'));
    }
  }

  async function toggleActive(l: PriceList) {
    await priceListsApi.update(l.id, { isActive: !l.isActive });
    await loadLists();
    if (selected?.id === l.id) openList(l.id);
  }

  async function removeList(l: PriceList) {
    if (!await confirmAction({ title: 'Eliminar lista', message: `¿Eliminar la lista "${l.name}"?`, variant: 'danger' })) return;
    await priceListsApi.remove(l.id);
    if (selected?.id === l.id) setSelected(null);
    await loadLists();
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🏷️</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Listas de Precios</h1>
            <p className="text-sm text-surface-500">El precio de venta sale de la lista vigente, no se escribe a mano</p>
          </div>
        </div>
        <button onClick={() => setCreating(true)}
          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium">+ Nueva lista</button>
      </div>

      {error && <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4">{error}</p>}

      {creating && (
        <form onSubmit={createList} className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-5 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="text-xs text-surface-600 dark:text-surface-400 mb-1.5 block">NOMBRE *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Ej. Promo Junio"
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-surface-600 dark:text-surface-400 mb-1.5 block">VIGENTE DESDE *</label>
            <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} required
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-3 py-2.5 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-surface-600 dark:text-surface-400 mb-1.5 block">HASTA (opcional)</label>
            <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
              className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl px-3 py-2.5 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
          </div>
          <div className="md:col-span-4 flex gap-3 justify-end">
            <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 rounded-xl text-sm">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium">Crear</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Listas */}
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-200 dark:border-surface-700 font-semibold text-surface-900 dark:text-white text-sm">Listas ({lists.length})</div>
          {lists.length === 0 ? (
            <div className="py-12 text-center text-surface-400 text-sm">Aún no hay listas de precios</div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-700">
              {lists.map(l => (
                <div key={l.id} className={`px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-700/50 ${selected?.id === l.id ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''}`}
                  onClick={() => openList(l.id)}>
                  <div>
                    <p className="text-sm font-medium text-surface-900 dark:text-white flex items-center gap-2">
                      {l.name}
                      {l.isActive
                        ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">VIGENTE</span>
                        : <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-500">INACTIVA</span>}
                    </p>
                    <p className="text-xs text-surface-500">{l.startDate?.slice(0, 10)} → {l.endDate ? l.endDate.slice(0, 10) : 'sin fin'} · {l._count?.items ?? 0} ítems</p>
                  </div>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => toggleActive(l)} className="text-xs text-surface-500 hover:text-brand-500">{l.isActive ? 'Desactivar' : 'Activar'}</button>
                    <button onClick={() => removeList(l)} className="text-xs text-surface-400 hover:text-red-500">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ítems de la lista seleccionada */}
        {selected
          ? <PriceListItemsPanel list={selected} onChanged={() => openList(selected.id)} />
          : <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl flex items-center justify-center text-surface-400 text-sm p-12">Selecciona una lista para gestionar sus precios</div>}
      </div>
    </div>
  );
}

function PriceListItemsPanel({ list, onChanged }: { list: PriceList; onChanged: () => void }) {
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [draft, setDraft] = useState<{ productId: string; name: string; unitPrice: string; minQuantity: string } | null>(null);
  const [error, setError] = useState('');

  // Búsqueda server-side con debounce (DeepSeek #8): escala a catálogos grandes sin
  // cargar todos los productos al inicio.
  useEffect(() => {
    if (!search.trim()) { setFiltered([]); return; }
    const t = setTimeout(() => {
      inventoryApi.searchProducts(search, 8).then(r => setFiltered(r.data)).catch(() => setFiltered([]));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  async function addItem() {
    if (!draft) return;
    setError('');
    const price = parseFloat(draft.unitPrice);
    const minQty = parseFloat(draft.minQuantity) || 1;
    if (!(price >= 0)) { setError('Precio inválido'); return; }
    try {
      await priceListsApi.upsertItem(list.id, { productId: draft.productId, unitPrice: price, minQuantity: minQty });
      setDraft(null);
      onChanged();
    } catch (e: any) {
      setError(getErrorMessage(e, 'Error al guardar el ítem'));
    }
  }

  async function removeItem(itemId: string) {
    await priceListsApi.removeItem(itemId);
    onChanged();
  }

  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
        <span className="font-semibold text-surface-900 dark:text-white text-sm">Precios · {list.name}</span>
      </div>

      {/* Combobox de productos (escala con catálogos grandes — mejora DeepSeek #1) */}
      <div className="px-5 py-3 border-b border-surface-200 dark:border-surface-700">
        <div className="relative">
          <input value={search} onChange={e => { setSearch(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)} onBlur={() => setTimeout(() => setShowResults(false), 200)}
            placeholder="Buscar producto por nombre o SKU…"
            className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:ring-2 focus:ring-brand-500 focus:outline-none" />
          {showResults && filtered.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg max-h-48 overflow-y-auto z-10 shadow-xl">
              {filtered.map(p => (
                <button key={p.id} type="button"
                  onMouseDown={() => { setDraft({ productId: p.id, name: p.name, unitPrice: String(Number(p.salePrice) || 0), minQuantity: '1' }); setSearch(''); setShowResults(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 flex justify-between">
                  <span>{p.name} {p.sku ? <span className="text-surface-400 text-xs">· {p.sku}</span> : null}</span>
                  <span className="text-surface-500 text-xs">base ${Number(p.salePrice).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {draft && (
          <div className="mt-3 flex items-end gap-2 bg-surface-50 dark:bg-surface-900/50 rounded-lg p-3">
            <div className="flex-1">
              <p className="text-xs text-surface-500 mb-1">{draft.name}</p>
              <div className="flex gap-2">
                <div>
                  <label className="text-[10px] text-surface-500 block">PRECIO</label>
                  <input type="number" step="0.01" min="0" value={draft.unitPrice} onChange={e => setDraft({ ...draft, unitPrice: e.target.value })}
                    className="w-24 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded px-2 py-1 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-surface-500 block">CANT. MÍN (volumen)</label>
                  <input type="number" step="0.01" min="1" value={draft.minQuantity} onChange={e => setDraft({ ...draft, minQuantity: e.target.value })}
                    className="w-28 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded px-2 py-1 text-sm text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                </div>
              </div>
            </div>
            <button onClick={addItem} className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm">Agregar</button>
            <button onClick={() => setDraft(null)} className="px-3 py-1.5 text-surface-500 text-sm">×</button>
          </div>
        )}
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      </div>

      {(list.items?.length ?? 0) === 0 ? (
        <div className="py-12 text-center text-surface-400 text-sm">Busca un producto arriba para asignarle precio</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase border-b border-surface-200 dark:border-surface-700">
              <th className="text-left px-4 py-2">Producto</th>
              <th className="text-right px-4 py-2 w-28">Precio</th>
              <th className="text-right px-4 py-2 w-28">Cant. mín</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
            {list.items!.map(it => (
              <tr key={it.id}>
                <td className="px-4 py-2 text-surface-900 dark:text-white">{it.product?.name ?? it.productId}</td>
                <td className="px-4 py-2 text-right font-mono text-green-600 dark:text-green-400">${Number(it.unitPrice).toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-surface-500">{Number(it.minQuantity)}</td>
                <td className="pr-3 py-2 text-center">
                  <button onClick={() => removeItem(it.id)} className="text-surface-400 hover:text-red-500 text-lg">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
