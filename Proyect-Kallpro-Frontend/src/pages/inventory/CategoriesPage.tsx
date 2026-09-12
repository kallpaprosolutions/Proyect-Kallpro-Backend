import { useEffect, useState } from 'react';
import { inventoryApi } from '../../api/inventory';
import { useToast } from '../../components/ui/Toast';

const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

export default function CategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts]     = useState<any[]>([]);
  const [form, setForm]   = useState({ name: '', description: '' });
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editForm, setEditForm]     = useState({ name: '', description: '' });
  const [reclassify, setReclassify] = useState<{ productId: string; categoryId: string } | null>(null);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);

  const load = async () => {
    const [cats, prods] = await Promise.all([inventoryApi.getCategories(), inventoryApi.getProducts()]);
    setCategories(cats.data);
    setProducts(prods.data);
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await inventoryApi.createCategory({ name: form.name, description: form.description || undefined });
      setForm({ name: '', description: '' });
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear categoría');
    } finally { setLoading(false); }
  };

  const startEdit = (c: any) => {
    setEditingId(c.id);
    setEditForm({ name: c.name, description: c.description || '' });
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    try {
      await inventoryApi.updateCategory(id, { name: editForm.name, description: editForm.description || undefined });
      setEditingId(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al actualizar');
    } finally { setSaving(false); }
  };

  const handleReclassify = async () => {
    if (!reclassify) return;
    setSaving(true);
    try {
      await inventoryApi.reclassifyProduct(reclassify.productId, reclassify.categoryId);
      setReclassify(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al reclasificar');
    } finally { setSaving(false); }
  };

  const countByCategory = (catId: string) => products.filter((p) => p.categoryId === catId).length;
  const uncategorized = products.filter((p) => !p.categoryId);

  return (
    <div className="max-w-3xl">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🏷</div>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Categorías</h1>
          <p className="text-sm text-surface-500">{categories.length} categorías registradas</p>
        </div>
      </div>

      {/* Reclassify modal */}
      {reclassify && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl p-6 w-full max-w-md shadow-2xl fade-in">
            <h3 className="font-bold text-lg text-surface-900 dark:text-white mb-4">🔄 Reclasificar Producto</h3>
            <p className="text-sm text-surface-500 mb-4">
              Producto: <span className="text-surface-800 dark:text-white font-medium">{products.find(p => p.id === reclassify.productId)?.name}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Nueva categoría</label>
              <select value={reclassify.categoryId}
                onChange={(e) => setReclassify({ ...reclassify, categoryId: e.target.value })}
                className={inputCls}>
                <option value="">Sin categoría</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={handleReclassify} disabled={saving || !reclassify.categoryId}
                className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
                {saving ? 'Guardando...' : '✓ Reclasificar'}
              </button>
              <button onClick={() => setReclassify(null)}
                className="flex-1 py-2 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-300 rounded-xl text-sm transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Create form */}
        <form onSubmit={handleCreate} className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-6 space-y-4 shadow-soft">
          <h2 className="font-semibold text-lg text-surface-800 dark:text-white">Nueva Categoría</h2>
          {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Nombre *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls} placeholder="Ej: Electrónica, Muebles..." />
            </div>
            <div>
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Descripción</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputCls} placeholder="Descripción opcional" />
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
            {loading ? 'Guardando...' : '+ Crear Categoría'}
          </button>
        </form>

        {/* Category list */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden shadow-soft">
          <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700">
            <h2 className="font-semibold text-surface-800 dark:text-white">Categorías y sus productos</h2>
          </div>
          {categories.length === 0 ? (
            <p className="text-center py-8 text-surface-400">No hay categorías. Crea la primera arriba.</p>
          ) : categories.map((c) => (
            <div key={c.id} className="border-b border-surface-100 dark:border-surface-700 last:border-b-0">
              {editingId === c.id ? (
                <div className="px-5 py-4 space-y-3 bg-surface-50 dark:bg-surface-700/30">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-surface-500 mb-1">Nombre *</label>
                      <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-600 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-surface-500 mb-1">Descripción</label>
                      <input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-600 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(c.id)} disabled={saving}
                      className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-lg disabled:opacity-50 transition-colors">
                      {saving ? 'Guardando...' : '✓ Guardar'}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="px-4 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 text-sm rounded-lg transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-4 hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-surface-800 dark:text-white">{c.name}</p>
                      {c.description && <p className="text-sm text-surface-500 mt-0.5">{c.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-surface-500 bg-surface-100 dark:bg-surface-700 px-2 py-0.5 rounded-full">
                        {countByCategory(c.id)} {countByCategory(c.id) === 1 ? 'producto' : 'productos'}
                      </span>
                      <button onClick={() => startEdit(c)}
                        className="text-xs px-3 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 rounded-lg transition-colors">
                        ✏ Editar
                      </button>
                    </div>
                  </div>
                  {products.filter(p => p.categoryId === c.id).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {products.filter(p => p.categoryId === c.id).map(p => (
                        <button key={p.id} onClick={() => setReclassify({ productId: p.id, categoryId: c.id })}
                          className="text-xs bg-surface-100 dark:bg-surface-700 hover:bg-brand-50 dark:hover:bg-brand-900/30 text-surface-500 hover:text-brand-600 dark:hover:text-brand-400 px-2 py-0.5 rounded-lg transition-colors"
                          title="Click para reclasificar">
                          {p.name} ↗
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Uncategorized */}
        {uncategorized.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-xl p-5">
            <h3 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-3">⚠️ Productos sin categoría ({uncategorized.length})</h3>
            <div className="flex flex-wrap gap-1.5">
              {uncategorized.map(p => (
                <button key={p.id} onClick={() => setReclassify({ productId: p.id, categoryId: categories[0]?.id || '' })}
                  className="text-xs bg-yellow-100 dark:bg-yellow-900/40 hover:bg-yellow-200 dark:hover:bg-yellow-900/60 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-lg transition-colors">
                  {p.name} — Asignar categoría
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
