import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requisitionsApi } from '../../api/requisitions';
import { budgetApi } from '../../api/budget';
import { inventoryApi } from '../../api/inventory';
import { CRITERIA_CATALOG, DEFAULT_CRITERIA, getCriterionDef, type Criterion } from '../../data/scoringCriteria';
import { useToast } from '../../components/ui/Toast';

const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

interface Item {
  description: string;
  productId: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
  notes: string;
}

export default function NewRequisitionPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [neededBy, setNeededBy] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [budgetInfo, setBudgetInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([
    { description: '', productId: '', quantity: 1, unit: 'UNIDAD', estimatedCost: 0, notes: '' },
  ]);
  const [criteria, setCriteria] = useState<Criterion[]>(DEFAULT_CRITERIA);

  const weightSum = criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0);
  const toggleCriterion = (key: string) => setCriteria((prev) => {
    if (prev.some((c) => c.key === key)) return prev.filter((c) => c.key !== key);
    const def = getCriterionDef(key)!;
    return [...prev, { key, label: def.label, weight: 0, direction: def.direction }];
  });
  const setWeight = (key: string, weight: number) => setCriteria((prev) => prev.map((c) => c.key === key ? { ...c, weight } : c));

  useEffect(() => {
    Promise.all([
      budgetApi.getDepartments(),
      inventoryApi.getProducts(),
    ]).then(([depts, prods]) => {
      setDepartments(depts.data);
      setProducts(prods.data);
    });
  }, []);

  const totalEstimated = items.reduce((s, i) => s + i.quantity * i.estimatedCost, 0);

  useEffect(() => {
    if (departmentId && totalEstimated > 0) {
      budgetApi.checkBudget(departmentId, totalEstimated)
        .then((r) => setBudgetInfo(r.data))
        .catch(() => setBudgetInfo(null));
    } else {
      setBudgetInfo(null);
    }
  }, [departmentId, totalEstimated]);

  const addItem = () => setItems([...items, { description: '', productId: '', quantity: 1, unit: 'UNIDAD', estimatedCost: 0, notes: '' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof Item, value: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    if (field === 'productId' && value) {
      const p = products.find((p) => p.id === value);
      if (p) { newItems[idx].description = p.name; newItems[idx].unit = p.unit; newItems[idx].estimatedCost = Number(p.avgCost) || 0; }
    }
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || items.some((i) => !i.description)) return;
    setLoading(true);
    try {
      const { data } = await requisitionsApi.create({
        title, notes, priority, departmentId: departmentId || undefined,
        neededBy: neededBy || undefined,
        scoringCriteria: Math.abs(weightSum - 100) < 0.01 ? criteria : undefined,
        items: items.map((i) => ({
          description: i.description,
          productId: i.productId || undefined,
          quantity: i.quantity,
          unit: i.unit,
          estimatedCost: i.estimatedCost,
          notes: i.notes,
        })),
      });
      navigate(`/purchases/requisitions/${data.requisition.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al crear la requisición');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">📋</div>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Nueva Requisición</h1>
          <p className="text-sm text-surface-500">Solicita materiales o servicios para aprobación</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Encabezado */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-6 space-y-4 shadow-soft">
          <h2 className="font-semibold text-surface-800 dark:text-white">Información General</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Título de la Requisición *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required
                className={inputCls} placeholder="Ej: Materiales eléctricos planta norte" />
            </div>
            <div>
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Departamento</label>
              <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={inputCls}>
                <option value="">Sin departamento</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Prioridad</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
                <option value="LOW">Baja</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Se necesita para (opcional)</label>
              <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Observaciones</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className={`${inputCls} resize-none`} />
            </div>
          </div>
        </div>

        {/* Alert de presupuesto */}
        {budgetInfo && (
          <div className={`rounded-xl border p-4 text-sm ${budgetInfo.available
            ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'}`}>
            {budgetInfo.available ? (
              <p>✓ Presupuesto disponible: <strong>${budgetInfo.remaining.toLocaleString('es', { minimumFractionDigits: 2 })}</strong> restante de ${budgetInfo.budget.toLocaleString('es', { minimumFractionDigits: 2 })}</p>
            ) : (
              <p>⚠ <strong>Excede presupuesto.</strong> Disponible: ${budgetInfo.remaining.toLocaleString('es', { minimumFractionDigits: 2 })}. Esta requisición requerirá aprobación de Gerencia (Nivel 3).</p>
            )}
          </div>
        )}

        {/* Ítems */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-6 shadow-soft">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-surface-800 dark:text-white">Ítems Solicitados</h2>
            <button type="button" onClick={addItem}
              className="bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-300 px-3 py-1.5 rounded-lg text-sm transition-colors">
              + Agregar ítem
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="bg-surface-50 dark:bg-surface-900/50 rounded-lg p-4 border border-surface-200 dark:border-surface-700">
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12 md:col-span-4">
                    <label className="block text-xs text-surface-500 mb-1">Descripción *</label>
                    <input value={item.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)} required
                      className={inputCls} placeholder="Descripción del material" />
                  </div>
                  <div className="col-span-12 md:col-span-3">
                    <label className="block text-xs text-surface-500 mb-1">Producto ERP (opcional)</label>
                    <select value={item.productId} onChange={(e) => updateItem(idx, 'productId', e.target.value)} className={inputCls}>
                      <option value="">Buscar producto...</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku ?? 'sin SKU'})</option>)}
                    </select>
                  </div>
                  <div className="col-span-4 md:col-span-1">
                    <label className="block text-xs text-surface-500 mb-1">Cantidad</label>
                    <input type="number" min="0.01" step="0.01" value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 1)}
                      className={inputCls} />
                  </div>
                  <div className="col-span-4 md:col-span-1">
                    <label className="block text-xs text-surface-500 mb-1">Unidad</label>
                    <input value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} className={inputCls} />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <label className="block text-xs text-surface-500 mb-1">Costo Estimado</label>
                    <input type="number" min="0" step="0.01" value={item.estimatedCost}
                      onChange={(e) => updateItem(idx, 'estimatedCost', parseFloat(e.target.value) || 0)}
                      className={inputCls} />
                  </div>
                  <div className="col-span-12 md:col-span-1 flex items-end">
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)}
                        className="w-full bg-red-50 dark:bg-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-2 py-2 text-sm transition-colors">✕</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <div className="bg-surface-50 dark:bg-surface-900/50 rounded-lg px-6 py-3 border border-surface-200 dark:border-surface-700">
              <span className="text-surface-500 text-sm">Total Estimado: </span>
              <span className="text-surface-900 dark:text-white font-bold text-lg ml-2">
                ${totalEstimated.toLocaleString('es', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Criterios de evaluación (pesos) — competencia entre proveedores */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-6 shadow-soft">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <h2 className="font-semibold text-surface-800 dark:text-white">Criterios de evaluación (pesos)</h2>
              <p className="text-xs text-surface-500">Define cómo competirán los proveedores en el comparativo. Los pesos deben sumar 100%.</p>
            </div>
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${Math.abs(weightSum - 100) < 0.01 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'}`}>
              Suma: {weightSum}%
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {CRITERIA_CATALOG.map((def) => {
              const active = criteria.some((c) => c.key === def.key);
              return (
                <button key={def.key} type="button" onClick={() => toggleCriterion(def.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${active
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-surface-50 dark:bg-surface-900/50 text-surface-600 dark:text-surface-300 border-surface-200 dark:border-surface-700 hover:border-brand-400'}`}>
                  {def.icon} {def.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2.5">
            {criteria.map((c) => {
              const def = getCriterionDef(c.key);
              return (
                <div key={c.key} className="flex items-center gap-3">
                  <div className="w-44 flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
                    <span>{def?.icon}</span><span className="truncate">{c.label}</span>
                  </div>
                  <input type="range" min={0} max={100} step={5} value={c.weight}
                    onChange={(e) => setWeight(c.key, Number(e.target.value))} className="flex-1 accent-brand-500" />
                  <span className="text-sm font-semibold text-surface-700 dark:text-surface-200 w-12 text-right">{c.weight}%</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-surface-400 mt-3">Si la suma no es 100%, la requisición se crea sin pesos (podrás definirlos en el comparativo).</p>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate('/purchases/requisitions')}
            className="border border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600 px-6 py-2 rounded-lg text-sm font-medium text-surface-600 dark:text-surface-300 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
            {loading ? 'Enviando...' : '📋 Enviar a Aprobación'}
          </button>
        </div>
      </form>
    </div>
  );
}
