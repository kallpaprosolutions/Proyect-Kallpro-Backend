import { useNavigate } from 'react-router-dom';
import {
  Home,
  LayoutDashboard,
  Briefcase,
  ShoppingCart,
  Package,
  Cog,
  ShoppingBag,
  BookOpen,
  ClipboardList,
  LineChart,
  Microscope,
  UserCog,
  X,
  type LucideIcon,
} from 'lucide-react';

interface AppModule {
  label: string;
  route: string;
  icon: LucideIcon;
  color: string;
}

const MODULES: AppModule[] = [
  { label: 'Dashboard',    route: '/',                    icon: Home,           color: 'bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300' },
  { label: 'CRM',          route: '/crm',                 icon: LayoutDashboard,color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300' },
  { label: 'Finanzas',     route: '/financial/executive', icon: Briefcase,      color: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300' },
  { label: 'Compras',      route: '/purchases',           icon: ShoppingCart,   color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300' },
  { label: 'Inventario',   route: '/inventory',           icon: Package,        color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300' },
  { label: 'Producción',   route: '/production',          icon: Cog,            color: 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300' },
  { label: 'Ventas',       route: '/sales',               icon: ShoppingBag,    color: 'bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-300' },
  { label: 'Contabilidad', route: '/contabilidad',        icon: BookOpen,       color: 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-300' },
  { label: 'Presupuesto',  route: '/budget',              icon: ClipboardList,  color: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300' },
  { label: 'Reportes',     route: '/reports',             icon: LineChart,      color: 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300' },
  { label: 'Investigación',route: '/research',            icon: Microscope,     color: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300' },
  { label: 'Gerencial',    route: '/gerencial',           icon: UserCog,        color: 'bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300' },
];

interface AppSwitcherProps {
  onClose: () => void;
}

export default function AppSwitcher({ onClose }: AppSwitcherProps) {
  const navigate = useNavigate();

  const handleNav = (route: string) => {
    navigate(route);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" />

      <div
        className="relative bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700 p-6 w-[480px] max-w-[95vw] fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-surface-900 dark:text-white">
            Módulos KallpaPro
          </h2>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors p-1 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {MODULES.map(mod => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.route}
                onClick={() => handleNav(mod.route)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-700 transition-all group"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${mod.color} group-hover:scale-105 transition-transform`}>
                  <Icon className="w-6 h-6" strokeWidth={1.8} />
                </div>
                <span className="text-xs font-medium text-surface-600 dark:text-surface-300 group-hover:text-surface-900 dark:group-hover:text-white text-center leading-tight">
                  {mod.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
