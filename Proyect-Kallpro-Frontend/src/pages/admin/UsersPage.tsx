import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';
import { useAuthStore } from '../../store/auth.store';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../hooks/useConfirm';
import { User } from 'lucide-react';

const ROLES = [
  { value: 'ADMIN',              label: 'Administrador',       color: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' },
  { value: 'GERENTE',            label: 'Gerente General',     color: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400' },
  { value: 'GERENTE_VENTAS',     label: 'Gerente de Ventas',   color: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' },
  { value: 'SUPERVISOR_VENTAS',  label: 'Supervisor Ventas',   color: 'bg-blue-100 dark:bg-blue-400/20 text-blue-600 dark:text-blue-300' },
  { value: 'FUERZA_VENTAS',      label: 'Fuerza de Ventas',    color: 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400' },
  { value: 'JEFE_BODEGA',        label: 'Jefe de Bodega',      color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' },
  { value: 'ASISTENTE_BODEGA',   label: 'Asistente Bodega',    color: 'bg-emerald-100 dark:bg-emerald-400/20 text-emerald-600 dark:text-emerald-300' },
  { value: 'BODEGUERO',          label: 'Bodeguero',           color: 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400' },
  { value: 'CONTADOR',           label: 'Contador',            color: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' },
  { value: 'ASISTENTE_CONTABLE', label: 'Asistente Contable',  color: 'bg-yellow-100 dark:bg-yellow-400/20 text-yellow-600 dark:text-yellow-300' },
  { value: 'TRIBUTARIO',         label: 'Especialista Tributario', color: 'bg-lime-100 dark:bg-lime-500/20 text-lime-700 dark:text-lime-400' },
  { value: 'AUDITOR',            label: 'Auditor',             color: 'bg-slate-200 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300' },
  { value: 'JEFE_COMPRAS',       label: 'Jefe de Compras',     color: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400' },
  { value: 'ASISTENTE_COMPRAS',  label: 'Asistente Compras',   color: 'bg-orange-100 dark:bg-orange-400/20 text-orange-600 dark:text-orange-300' },
  { value: 'TESORERIA',          label: 'Tesorería',           color: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400' },
  { value: 'ANALISTA',           label: 'Analista Financiero', color: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400' },
  { value: 'ASISTENTE',          label: 'Asistente General',   color: 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400' },
  { value: 'TTHH',               label: 'Talento Humano',      color: 'bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-400' },
];

const getRoleInfo = (role: string) => ROLES.find((r) => r.value === role) || { label: role, color: 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400' };

const EMPTY_FORM = { email: '', password: '', firstName: '', lastName: '', role: 'BODEGUERO' };

export default function UsersPage() {
  const [users, setUsers]     = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [roleEditing, setRoleEditing] = useState<string | null>(null);
  const [tempRole, setTempRole] = useState('');
  const [saving, setSaving]   = useState(false);
  const currentUser = useAuthStore((s) => s.user);

  const load = () => adminApi.listUsers().then((r) => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(''); setCreating(true);
    try {
      await adminApi.createUser(form);
      setForm(EMPTY_FORM);
      setShowCreate(false);
      load();
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Error al crear usuario');
    } finally { setCreating(false); }
  };

  const toast = useToast();
  const confirmAction = useConfirm();

  const handleRoleChange = async (userId: string) => {
    setSaving(true);
    try {
      await adminApi.updateRole(userId, tempRole);
      setRoleEditing(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al actualizar rol');
    } finally { setSaving(false); }
  };

  const handleToggle = async (userId: string, name: string, isActive: boolean) => {
    const ok = await confirmAction({
      title: isActive ? 'Desactivar usuario' : 'Activar usuario',
      message: `¿${isActive ? 'Desactivar' : 'Activar'} al usuario "${name}"?`,
      variant: isActive ? 'danger' : 'default',
    });
    if (!ok) return;
    try {
      await adminApi.toggleUser(userId);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
            <User className="w-5 h-5 text-brand-600 dark:text-brand-400" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Usuarios</h1>
            <p className="text-sm text-surface-500">{users.length} usuarios registrados</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Nuevo Usuario
        </button>
      </div>

      <div className="space-y-6">
        {/* Roles Reference */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft p-4">
          <p className="text-xs text-surface-500 mb-3 font-medium uppercase tracking-wide">Roles disponibles</p>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <span key={r.value} className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.color}`}>{r.label}</span>
            ))}
          </div>
        </div>

        {/* Crear usuario */}
        {showCreate && (
          <form onSubmit={handleCreate} className="bg-white dark:bg-surface-800 rounded-xl border border-brand-200 dark:border-brand-800 shadow-soft p-6 space-y-4">
            <h2 className="font-semibold text-brand-600 dark:text-brand-400">Nuevo Usuario</h2>
            {createError && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">{createError}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Nombre</label>
                <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Juan" />
              </div>
              <div>
                <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Apellido</label>
                <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Pérez" />
              </div>
              <div>
                <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Email *</label>
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="usuario@empresa.com" />
              </div>
              <div>
                <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Contraseña *</label>
                <input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-surface-600 dark:text-surface-400 mb-1">Rol *</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={creating}
                className="bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                {creating ? 'Creando...' : '✓ Crear Usuario'}
              </button>
              <button type="button" onClick={() => { setShowCreate(false); setCreateError(''); }}
                className="px-5 py-2 rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white text-sm transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Lista usuarios */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700">
            <h2 className="font-semibold text-surface-900 dark:text-white">Usuarios de la empresa</h2>
          </div>
          {users.length === 0 ? (
            <p className="text-center py-8 text-surface-500">No hay usuarios.</p>
          ) : users.map((u) => {
            const roleInfo = getRoleInfo(u.role);
            const isMe = u.id === currentUser?.id;
            return (
              <div key={u.id} className={`border-b border-surface-100 dark:border-surface-700 px-5 py-4 ${!u.isActive ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center text-sm font-bold text-surface-600 dark:text-surface-300">
                      {(u.firstName?.[0] || u.email[0]).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-surface-900 dark:text-white">
                          {u.firstName || ''} {u.lastName || ''}
                          {(!u.firstName && !u.lastName) ? u.email.split('@')[0] : ''}
                        </p>
                        {isMe && <span className="text-xs bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-400 px-1.5 py-0.5 rounded-full">Tú</span>}
                        {!u.isActive && <span className="text-xs bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded-full">Inactivo</span>}
                      </div>
                      <p className="text-xs text-surface-500">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Rol */}
                    {roleEditing === u.id ? (
                      <div className="flex items-center gap-2">
                        <select value={tempRole} onChange={(e) => setTempRole(e.target.value)}
                          className="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500">
                          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <button onClick={() => handleRoleChange(u.id)} disabled={saving}
                          className="text-xs px-2 py-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg disabled:opacity-50">
                          {saving ? '...' : '✓'}
                        </button>
                        <button onClick={() => setRoleEditing(null)}
                          className="text-xs px-2 py-1 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-400 rounded-lg">
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80 ${roleInfo.color}`}
                        onClick={() => { if (!isMe) { setRoleEditing(u.id); setTempRole(u.role); } }}
                        title={isMe ? 'No puedes cambiar tu propio rol' : 'Clic para cambiar rol'}>
                        {roleInfo.label}
                      </span>
                    )}

                    {/* Toggle activo */}
                    {!isMe && (
                      <button onClick={() => handleToggle(u.id, `${u.firstName} ${u.lastName}`.trim() || u.email, u.isActive)}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                          u.isActive
                            ? 'bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400'
                            : 'bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 text-green-600 dark:text-green-400'
                        }`}>
                        {u.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-1 flex gap-4 text-xs text-surface-500 ml-12">
                  <span>Creado: {new Date(u.createdAt).toLocaleDateString('es')}</span>
                  {u.lastLoginAt && <span>Último acceso: {new Date(u.lastLoginAt).toLocaleDateString('es')}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
