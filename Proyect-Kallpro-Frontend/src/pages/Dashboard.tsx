import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useCan } from '../hooks/useCan';
import type { Subject } from '../lib/ability';
import MyActivitiesWidget from '../components/MyActivitiesWidget';
import {
  Compass, Package, ShoppingBag, Truck, BookOpen, Briefcase, Banknote, Landmark,
  LayoutDashboard, Cog, FileText, LineChart, Microscope, User, Building2,
  ArrowRight, type LucideIcon,
} from 'lucide-react';

interface ModuleCard {
  name: string;
  description: string;
  path: string;
  icon: LucideIcon;
  subject?: Subject;
  tint: string;
  iconColor: string;
}

const MODULES: ModuleCard[] = [
  { name: 'Compras',        description: 'Requisición, comparativo, aprobación y recepción', path: '/compras',          icon: Compass,         subject: 'Purchase',        tint: 'bg-violet-50 dark:bg-violet-900/20',   iconColor: 'text-violet-600 dark:text-violet-400' },
  { name: 'Inventario',     description: 'Productos, multibodega, kardex y ajustes',         path: '/inventory',        icon: Package,         subject: 'Inventory',       tint: 'bg-amber-50 dark:bg-amber-900/20',     iconColor: 'text-amber-600 dark:text-amber-400' },
  { name: 'Ventas',         description: 'POS, cotizaciones, clientes y cartera',            path: '/sales',            icon: ShoppingBag,     subject: 'Sales',           tint: 'bg-pink-50 dark:bg-pink-900/20',       iconColor: 'text-pink-600 dark:text-pink-400' },
  { name: 'Logística',      description: 'Tracking de envíos de ventas y compras',           path: '/logistica',        icon: Truck,           subject: 'Logistics',       tint: 'bg-sky-50 dark:bg-sky-900/20',         iconColor: 'text-sky-600 dark:text-sky-400' },
  { name: 'Contabilidad',   description: 'Mayor, asientos, flujo de efectivo e impuestos',   path: '/contabilidad',     icon: BookOpen,        subject: 'Accounting',      tint: 'bg-cyan-50 dark:bg-cyan-900/20',       iconColor: 'text-cyan-600 dark:text-cyan-400' },
  { name: 'Financiero',     description: 'Cartera, pagos, presupuestos y flujo de caja',     path: '/finanzas',         icon: Briefcase,       subject: 'Finance',         tint: 'bg-emerald-50 dark:bg-emerald-900/20', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  { name: 'Nómina',         description: 'Empleados, rol de pagos, IESS, décimos y asistencia', path: '/nomina',        icon: Banknote,        subject: 'Accounting',      tint: 'bg-lime-50 dark:bg-lime-900/20',       iconColor: 'text-lime-600 dark:text-lime-400' },
  { name: 'Tesorería',      description: 'Bancos, pagos, cobros, SWIFT y flujo de caja',     path: '/tesoreria',        icon: Landmark,        subject: 'Finance',         tint: 'bg-orange-50 dark:bg-orange-900/20',   iconColor: 'text-orange-600 dark:text-orange-400' },
  { name: 'CRM',            description: 'Pipeline, contactos, oportunidades y agentes',     path: '/crm',              icon: LayoutDashboard, subject: 'CRM',             tint: 'bg-fuchsia-50 dark:bg-fuchsia-900/20', iconColor: 'text-fuchsia-600 dark:text-fuchsia-400' },
  { name: 'Producción',     description: 'Órdenes de producción y listas de materiales',     path: '/production',       icon: Cog,             subject: 'Production',      tint: 'bg-slate-100 dark:bg-slate-800/40',    iconColor: 'text-slate-600 dark:text-slate-400' },
  { name: 'Documentos SRI', description: 'Recepción, 3-way match y validación tributaria',   path: '/sri',              icon: FileText,        subject: 'Accounting',      tint: 'bg-indigo-50 dark:bg-indigo-900/20',   iconColor: 'text-indigo-600 dark:text-indigo-400' },
  { name: 'Reportes',       description: 'Exportaciones Excel/PDF y tableros',               path: '/reports',          icon: LineChart,       subject: 'Report',          tint: 'bg-teal-50 dark:bg-teal-900/20',       iconColor: 'text-teal-600 dark:text-teal-400' },
  { name: 'Investigación',  description: 'Análisis de mercado e inteligencia de negocio',    path: '/research',         icon: Microscope,      subject: 'Report',          tint: 'bg-purple-50 dark:bg-purple-900/20',   iconColor: 'text-purple-600 dark:text-purple-400' },
  { name: 'Usuarios',       description: 'Gestión de usuarios y roles del sistema',          path: '/admin/users',      icon: User,            subject: 'User',            tint: 'bg-rose-50 dark:bg-rose-900/20',       iconColor: 'text-rose-600 dark:text-rose-400' },
  { name: 'Configuración',  description: 'Empresa, IA, compras, documentos y aprobaciones',  path: '/settings/empresa', icon: Building2,       subject: 'CompanySettings', tint: 'bg-surface-100 dark:bg-surface-700/40',iconColor: 'text-surface-600 dark:text-surface-400' },
];

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export default function Dashboard() {
  const { user } = useAuthStore();
  const { can } = useCan();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const firstName = user?.firstName ?? user?.email?.split('@')[0] ?? 'Usuario';
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const time = now.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateRaw = `${WEEKDAYS[now.getDay()]}, ${now.getDate()} de ${now.toLocaleDateString('es-EC', { month: 'long' })} de ${now.getFullYear()}`;
  const dateStr = dateRaw.charAt(0).toUpperCase() + dateRaw.slice(1);

  const modules = MODULES.filter((m) => !m.subject || can('read', m.subject));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Cabecera — Saludo + reloj */}
      <div className="relative overflow-hidden rounded-2xl border border-surface-200 dark:border-surface-700 bg-gradient-to-br from-brand-500/10 via-surface-50 to-surface-50 dark:from-brand-500/10 dark:via-surface-800 dark:to-surface-800 px-6 py-5">
        <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-brand-500/8 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-brand-400/6 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
              {greeting}, <span className="text-brand-500">{firstName}</span>
            </h1>
            <p className="text-surface-500 dark:text-surface-400 mt-0.5 text-sm">
              {user?.company?.name ?? 'KallpaPro ERP'} · {dateStr}
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-3xl font-bold tracking-tight text-surface-900 dark:text-white tabular-nums leading-none">
              {time}
            </div>
            <div className="flex items-center justify-end gap-1.5 mt-1 text-[11px] text-brand-600 dark:text-brand-400 font-medium">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-500" />
              </span>
              En vivo
            </div>
          </div>
        </div>
      </div>

      <MyActivitiesWidget />

      {/* Módulos del negocio */}
      <section>
        <h2 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide mb-3 px-1">
          Módulos del negocio
        </h2>
        {modules.length === 0 ? (
          <div className="text-center py-16 text-surface-400">No tienes módulos asignados. Contacta al administrador.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {modules.map((mod, i) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.path}
                  to={mod.path}
                  className="group flex items-center gap-3.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover hover:border-brand-300 dark:hover:border-brand-600 animate-fade-in-up"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${mod.tint} shrink-0`}>
                    <Icon className={`w-5 h-5 ${mod.iconColor}`} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm text-surface-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {mod.name}
                    </h3>
                    <p className="text-xs text-surface-500 mt-0.5 leading-snug line-clamp-1">{mod.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-surface-300 dark:text-surface-600 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" strokeWidth={2} />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
