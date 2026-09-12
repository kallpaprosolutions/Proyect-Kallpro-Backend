import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { payrollApi, EmployeePayload } from '../../api/payroll';
import { useToast } from '../../components/ui/Toast';

const money = (n: number) => `$${Number(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORY_META: Record<string, { label: string; cls: string }> = {
  JEFATURA:  { label: 'Jefatura',  cls: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300' },
  ASISTENTE: { label: 'Asistente', cls: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' },
  SERVICIOS: { label: 'Servicios', cls: 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300' },
};

const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-xs text-surface-500 mb-1';

interface FormState extends EmployeePayload { id?: string }

const EMPTY: FormState = {
  cedula: '', firstName: '', lastName: '', email: '', phone: '',
  departmentId: '', position: '', category: 'ASISTENTE',
  baseSalary: 482, hireDate: new Date().toISOString().slice(0, 10),
  monthlyThirteenth: false, monthlyFourteenth: false, reserveFundsToIESS: false,
  familyBurdens: 0, projectedPersonalExpenses: 0, bankAccount: '', managerId: '', userId: '',
};

export default function EmployeesPage() {
  const toast = useToast();
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [linkableUsers, setLinkableUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([payrollApi.getEmployees(true), payrollApi.getDepartments(), payrollApi.getConfig(), payrollApi.getLinkableUsers()])
      .then(([e, d, c, u]) => { setEmployees(e.data); setDepartments(d.data); setConfig(c.data); setLinkableUsers(u.data); })
      .catch(() => toast.error('Error al cargar empleados'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => {
    let list = employees;
    if (catFilter) list = list.filter((e) => e.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.cedula.includes(q) || (e.position || '').toLowerCase().includes(q));
    }
    return list;
  }, [employees, search, catFilter]);

  const startEdit = (e: any) => {
    setForm({
      id: e.id, cedula: e.cedula, firstName: e.firstName, lastName: e.lastName,
      email: e.email || '', phone: e.phone || '', departmentId: e.departmentId || '',
      position: e.position, category: e.category, baseSalary: Number(e.baseSalary),
      hireDate: e.hireDate.slice(0, 10),
      monthlyThirteenth: e.monthlyThirteenth, monthlyFourteenth: e.monthlyFourteenth,
      reserveFundsToIESS: e.reserveFundsToIESS,
      familyBurdens: e.familyBurdens, projectedPersonalExpenses: Number(e.projectedPersonalExpenses),
      bankAccount: e.bankAccount || '', managerId: e.managerId || '', userId: e.userId || '',
    });
    setShowForm(true);
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, departmentId: form.departmentId || null, managerId: form.managerId || null, userId: form.userId || null, baseSalary: Number(form.baseSalary), familyBurdens: Number(form.familyBurdens), projectedPersonalExpenses: Number(form.projectedPersonalExpenses) };
      if (form.id) {
        await payrollApi.updateEmployee(form.id, payload);
        toast.success('Empleado actualizado');
      } else {
        await payrollApi.createEmployee(payload);
        toast.success('Empleado registrado');
      }
      setShowForm(false); setForm(EMPTY); load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'No se pudo guardar');
    } finally { setSaving(false); }
  };

  const toggleActive = async (e: any) => {
    try {
      await payrollApi.updateEmployee(e.id, { isActive: !e.isActive });
      toast.success(e.isActive ? 'Empleado desactivado' : 'Empleado reactivado');
      load();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'No se pudo actualizar'); }
  };

  const sbu = config?.SBU ?? 482;

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🧑‍💼</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Empleados</h1>
            <p className="text-sm text-surface-500">
              {employees.filter((e) => e.isActive).length} {employees.filter((e) => e.isActive).length === 1 ? 'activo' : 'activos'} · SBU {new Date().getFullYear()}: {money(sbu)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/nomina" className="text-sm px-4 py-2 border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700">💵 Rol de Pagos</Link>
          <button onClick={() => { setForm(EMPTY); setShowForm((v) => !v); }}
            className="text-sm px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium">
            + Nuevo Empleado
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-5 mb-6 space-y-4">
          <h3 className="font-semibold text-surface-900 dark:text-white">{form.id ? 'Editar empleado' : 'Nuevo empleado'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Cédula *</label><input required value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Nombres *</label><input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Apellidos *</label><input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Teléfono</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Cuenta bancaria</label><input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} className={inputCls} /></div>
            <div>
              <label className={labelCls}>Departamento</label>
              <select value={form.departmentId ?? ''} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className={inputCls}>
                <option value="">Sin departamento</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Cargo *</label><input required value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className={inputCls} placeholder="Ej. Jefe de Bodega" /></div>
            <div>
              <label className={labelCls}>Jefe directo</label>
              <select value={form.managerId ?? ''} onChange={(e) => setForm({ ...form, managerId: e.target.value })} className={inputCls}>
                <option value="">Sin jefe (aprueba TTHH directamente)</option>
                {employees.filter((e) => e.id !== form.id).map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Usuario del sistema</label>
              <select value={form.userId ?? ''} onChange={(e) => setForm({ ...form, userId: e.target.value })} className={inputCls}>
                <option value="">Sin vincular</option>
                {linkableUsers.filter((u) => !u.linkedEmployeeId || u.linkedEmployeeId === form.id).map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} · {u.email}</option>
                ))}
              </select>
              <p className="text-xs text-surface-400 mt-1">Vincula la cuenta con la que este empleado inicia sesión (para el calendario de TTHH).</p>
            </div>
            <div>
              <label className={labelCls}>Categoría *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as any })} className={inputCls}>
                <option value="JEFATURA">Jefatura</option>
                <option value="ASISTENTE">Asistente</option>
                <option value="SERVICIOS">Servicios</option>
              </select>
            </div>
            <div><label className={labelCls}>Sueldo mensual * (mín. SBU {money(sbu)})</label><input required type="number" step="0.01" min={sbu} value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) })} className={inputCls} /></div>
            <div><label className={labelCls}>Fecha de ingreso *</label><input required type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Cargas familiares</label><input type="number" min="0" max="15" value={form.familyBurdens} onChange={(e) => setForm({ ...form, familyBurdens: Number(e.target.value) })} className={inputCls} /></div>
            <div><label className={labelCls}>Gastos personales proyectados (anual, para rebaja de IR)</label><input type="number" step="0.01" min="0" value={form.projectedPersonalExpenses} onChange={(e) => setForm({ ...form, projectedPersonalExpenses: Number(e.target.value) })} className={inputCls} /></div>
          </div>
          <div className="flex flex-wrap gap-5 text-sm text-surface-700 dark:text-surface-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.monthlyThirteenth} onChange={(e) => setForm({ ...form, monthlyThirteenth: e.target.checked })} />
              Décimo tercero mensualizado
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.monthlyFourteenth} onChange={(e) => setForm({ ...form, monthlyFourteenth: e.target.checked })} />
              Décimo cuarto mensualizado
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.reserveFundsToIESS} onChange={(e) => setForm({ ...form, reserveFundsToIESS: e.target.checked })} />
              Fondos de reserva acumulados en el IESS
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY); }} className="px-4 py-2 text-sm border border-surface-300 dark:border-surface-600 rounded-lg text-surface-600 dark:text-surface-300">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
              {saving ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Registrar empleado'}
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Buscar por nombre, cédula o cargo…" className={`${inputCls} max-w-xs`} />
        {['', 'JEFATURA', 'ASISTENTE', 'SERVICIOS'].map((c) => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${catFilter === c ? 'bg-brand-500 text-white' : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300'}`}>
            {c === '' ? 'Todos' : CATEGORY_META[c].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-14"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-900/50 text-surface-500 text-xs uppercase">
                <th className="text-left px-4 py-2.5">Empleado</th>
                <th className="text-left px-4 py-2.5">Cargo</th>
                <th className="text-center px-4 py-2.5">Categoría</th>
                <th className="text-left px-4 py-2.5">Departamento</th>
                <th className="text-right px-4 py-2.5">Sueldo</th>
                <th className="text-center px-4 py-2.5">Ingreso</th>
                <th className="text-center px-4 py-2.5">Beneficios</th>
                <th className="text-right px-4 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-surface-400">Sin empleados registrados. Crea el primero con “+ Nuevo Empleado”.</td></tr>
              )}
              {filtered.map((e) => {
                const cat = CATEGORY_META[e.category] ?? { label: e.category, cls: 'bg-surface-100 text-surface-600' };
                return (
                  <tr key={e.id} className={`hover:bg-surface-50 dark:hover:bg-surface-700/30 ${!e.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-surface-800 dark:text-white">{e.firstName} {e.lastName}</p>
                      <p className="text-xs text-surface-400">{e.cedula}{e.email ? ` · ${e.email}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-300">
                      {e.position}
                      {e.manager && <p className="text-xs text-surface-400">Jefe: {e.manager.firstName} {e.manager.lastName}</p>}
                    </td>
                    <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.cls}`}>{cat.label}</span></td>
                    <td className="px-4 py-3 text-surface-500">{e.department?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-surface-800 dark:text-white">{money(Number(e.baseSalary))}</td>
                    {/* La fecha se guarda a medianoche UTC; sin timeZone UTC se mostraría el día anterior (UTC-5) */}
                    <td className="px-4 py-3 text-center text-surface-500 text-xs">{new Date(e.hireDate).toLocaleDateString('es', { timeZone: 'UTC' })}</td>
                    <td className="px-4 py-3 text-center text-xs text-surface-500">
                      {e.monthlyThirteenth ? 'XIII mens. ' : ''}{e.monthlyFourteenth ? 'XIV mens. ' : ''}{e.reserveFundsToIESS ? 'FR→IESS' : ''}
                      {!e.monthlyThirteenth && !e.monthlyFourteenth && !e.reserveFundsToIESS ? 'Acumulados' : ''}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => startEdit(e)} className="text-xs px-3 py-1 rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600 mr-2">✏ Editar</button>
                      <button onClick={() => toggleActive(e)} className={`text-xs px-3 py-1 rounded-lg border ${e.isActive ? 'border-red-200 dark:border-red-700 text-red-600 dark:text-red-400' : 'border-green-200 dark:border-green-700 text-green-600 dark:text-green-400'}`}>
                        {e.isActive ? 'Desactivar' : 'Reactivar'}
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
  );
}
