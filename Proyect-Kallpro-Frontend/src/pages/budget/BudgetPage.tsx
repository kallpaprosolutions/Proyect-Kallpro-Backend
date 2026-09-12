import { useEffect, useState } from 'react';
import { budgetApi } from '../../api/budget';
import { useToast } from '../../components/ui/Toast';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function ProgressBar({ percent, status }: { percent: number; status: string }) {
  const color = status === 'EXCEEDED' ? 'bg-red-500' : status === 'CRITICAL' ? 'bg-red-400' : status === 'WARNING' ? 'bg-yellow-400' : 'bg-green-500';
  return (
    <div className="w-full bg-surface-100 dark:bg-surface-700 rounded-full h-2 mt-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

export default function BudgetPage() {
  const toast = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [form, setForm] = useState({ departmentId: '', budgetAmount: '', notes: '' });
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      budgetApi.getSummary(year, month),
      budgetApi.getDepartments(),
    ]).then(([s, d]) => {
      setSummary(s.data);
      setDepartments(d.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [year, month]);

  const totalBudget = summary.reduce((s, b) => s + b.budgetAmount, 0);
  const totalConsumed = summary.reduce((s, b) => s + b.consumed, 0);
  const totalRemaining = totalBudget - totalConsumed;

  const handleSaveBudget = async () => {
    if (!form.budgetAmount) return;
    setSaving(true);
    try {
      await budgetApi.upsertBudget({
        departmentId: form.departmentId || undefined,
        year, month,
        budgetAmount: parseFloat(form.budgetAmount),
        notes: form.notes,
      });
      setForm({ departmentId: '', budgetAmount: '', notes: '' });
      setShowForm(false);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al guardar presupuesto');
    } finally { setSaving(false); }
  };

  const handleSaveDept = async () => {
    if (!deptForm.name) return;
    setSaving(true);
    try {
      await budgetApi.createDepartment(deptForm);
      setDeptForm({ name: '', code: '' });
      setShowDeptForm(false);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al crear departamento');
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">💰</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Presupuesto</h1>
            <p className="text-sm text-surface-500">Control de presupuesto por departamento</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowDeptForm(!showDeptForm)}
            className="border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700 px-4 py-2 rounded-lg text-sm transition-colors">
            + Departamento
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            + Asignar Presupuesto
          </button>
        </div>
      </div>

      {/* Selector de mes */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI cards totales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-surface-800 rounded-xl p-5 border border-surface-200 dark:border-surface-700 shadow-soft">
          <p className="text-surface-500 text-sm">Presupuesto Total del Mes</p>
          <p className="text-2xl font-bold mt-1 text-surface-900 dark:text-white">${totalBudget.toLocaleString('es', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white dark:bg-surface-800 rounded-xl p-5 border border-surface-200 dark:border-surface-700 shadow-soft">
          <p className="text-surface-500 text-sm">Consumido</p>
          <p className="text-2xl font-bold mt-1 text-yellow-600 dark:text-yellow-400">${totalConsumed.toLocaleString('es', { minimumFractionDigits: 2 })}</p>
          {totalBudget > 0 && (
            <p className="text-xs text-surface-500 mt-1">{Math.round((totalConsumed / totalBudget) * 100)}% del total</p>
          )}
        </div>
        <div className={`bg-white dark:bg-surface-800 rounded-xl p-5 border shadow-soft ${totalRemaining < 0 ? 'border-red-300 dark:border-red-700' : 'border-surface-200 dark:border-surface-700'}`}>
          <p className="text-surface-500 text-sm">Disponible</p>
          <p className={`text-2xl font-bold mt-1 ${totalRemaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            ${totalRemaining.toLocaleString('es', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Formulario nuevo departamento */}
      {showDeptForm && (
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-4 mb-4">
          <h3 className="font-medium text-surface-700 dark:text-surface-300 mb-3">Nuevo Departamento</h3>
          <div className="flex gap-3">
            <input value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
              placeholder="Nombre del departamento *"
              className="flex-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <input value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
              placeholder="Código (opcional)"
              className="w-36 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <button onClick={handleSaveDept} disabled={saving}
              className="bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 px-4 py-2 rounded-lg text-sm">Guardar</button>
            <button onClick={() => setShowDeptForm(false)} className="border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 px-4 py-2 rounded-lg text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {/* Formulario asignar presupuesto */}
      {showForm && (
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-brand-200 dark:border-brand-700 shadow-soft p-4 mb-4">
          <h3 className="font-medium text-surface-700 dark:text-surface-300 mb-3">Asignar Presupuesto — {MONTHS[month-1]} {year}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-surface-600 dark:text-surface-400">Departamento</label>
              <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                className="w-full mt-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">General (sin departamento)</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-surface-600 dark:text-surface-400">Monto Presupuestado *</label>
              <input type="number" min="0" step="0.01" value={form.budgetAmount}
                onChange={(e) => setForm({ ...form, budgetAmount: e.target.value })}
                className="w-full mt-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs text-surface-600 dark:text-surface-400">Notas</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full mt-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleSaveBudget} disabled={saving}
              className="bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 px-4 py-2 rounded-lg text-sm">
              Guardar Presupuesto
            </button>
            <button onClick={() => setShowForm(false)} className="border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 px-4 py-2 rounded-lg text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {/* Cards por departamento */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : summary.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft">
          <p className="text-surface-500 text-lg mb-2">No hay presupuestos para {MONTHS[month-1]} {year}</p>
          <p className="text-surface-400 text-sm">Usa el botón "Asignar Presupuesto" para configurar los presupuestos del mes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.map((b) => (
            <div key={b.id} className={`bg-white dark:bg-surface-800 rounded-xl border shadow-soft p-5 ${
              b.status === 'EXCEEDED' ? 'border-red-300 dark:border-red-700' :
              b.status === 'CRITICAL' ? 'border-red-200 dark:border-red-700/50' :
              b.status === 'WARNING' ? 'border-yellow-200 dark:border-yellow-700/50' : 'border-surface-200 dark:border-surface-700'}`}>
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-surface-900 dark:text-white">{b.departmentName}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  b.status === 'EXCEEDED' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' :
                  b.status === 'CRITICAL' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' :
                  b.status === 'WARNING' ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                }`}>{b.percentUsed}%</span>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-surface-500">Consumido</span>
                  <span className="font-mono text-surface-900 dark:text-white">${b.consumed.toLocaleString('es', { minimumFractionDigits: 2 })}</span>
                </div>
                <ProgressBar percent={b.percentUsed} status={b.status} />
                <div className="flex justify-between text-xs text-surface-400 mt-1">
                  <span>$0</span>
                  <span>${b.budgetAmount.toLocaleString('es', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700 flex justify-between text-sm">
                <span className="text-surface-500">Disponible</span>
                <span className={`font-bold ${b.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  ${b.remaining.toLocaleString('es', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {b.status === 'EXCEEDED' && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded p-2">
                  ⚠ Presupuesto excedido. Nuevas compras requieren aprobación de Gerencia.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
