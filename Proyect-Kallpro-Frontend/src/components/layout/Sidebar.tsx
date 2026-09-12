import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useCan } from '../../hooks/useCan';
import type { Subject } from '../../lib/ability';
import {
  Home,
  LayoutDashboard,
  Inbox,
  Target,
  Bot,
  TrendingUp,
  Users,
  Briefcase,
  Magnet,
  Settings,
  BookOpen,
  Landmark,
  FileText,
  Compass,
  ShoppingCart,
  ClipboardList,
  Factory,
  CheckCircle2,
  BarChart3,
  Zap,
  Package,
  Warehouse,
  ArrowLeftRight,
  Hash,
  Scale,
  Gem,
  Cog,
  ShoppingBag,
  FileSpreadsheet,
  Tag,
  Truck,
  Banknote,
  UserCog,
  Clock,
  LineChart,
  Microscope,
  User,
  Building2,
  Shield,
  ChevronDown,
  ArrowUpCircle,
  ArrowDownCircle,
  CalendarDays,
  Receipt,
  Network,
  Repeat,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  label: string;
  route: string;
  icon: LucideIcon;
  subject?: Subject;
  /** Alternativa a `subject` cuando varios subjects distintos dan acceso (OR) — ej. Organigrama: Accounting (roles de nómina) o HR (TTHH) */
  anySubject?: Subject[];
  exact?: boolean;
  /** Sangría visual: submódulo agrupado bajo el ítem anterior (ej. Documentos SRI bajo Cuentas por Pagar) */
  indent?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { label: 'Inicio', route: '/', icon: Home },
    ],
  },
  {
    title: 'CRM',
    items: [
      { label: 'Panel CRM',       route: '/crm',          icon: LayoutDashboard, subject: 'CRM' },
      { label: 'Bandeja Entrada', route: '/crm/inbox',    icon: Inbox,           subject: 'CRM' },
      { label: 'Pipeline',        route: '/crm/pipeline', icon: Target,          subject: 'CRM' },
      { label: 'Agentes IA',      route: '/crm/agents',   icon: Bot,             subject: 'CRM' },
      { label: 'Pronóstico',      route: '/crm/forecast', icon: TrendingUp,      subject: 'CRM' },
      { label: 'Contactos',       route: '/crm/contacts', icon: Users,           subject: 'CRM' },
      { label: 'Oportunidades',   route: '/crm/deals',    icon: Briefcase,       subject: 'CRM' },
      { label: 'Leads',           route: '/crm/leads',    icon: Magnet,          subject: 'CRM' },
      { label: 'Configuración',   route: '/crm/config',   icon: Settings,        subject: 'CRM' },
    ],
  },
  {
    title: 'Finanzas',
    items: [
      { label: 'Contabilidad',        route: '/contabilidad',           icon: BookOpen,        subject: 'Accounting' },
      { label: 'Activos Fijos',       route: '/contabilidad/activos-fijos', icon: Landmark,    subject: 'Accounting', indent: true },
      { label: 'Cuentas por Pagar',   route: '/contabilidad?sub=cxp',   icon: ArrowUpCircle,   subject: 'Accounting' },
      { label: 'Documentos SRI',      route: '/sri',                    icon: FileText,        subject: 'Accounting', indent: true },
      { label: 'Facturación Recurrente', route: '/sri/recurrentes',     icon: Repeat,          subject: 'Accounting', indent: true },
      { label: 'Cuentas por Cobrar',  route: '/contabilidad?sub=cxc',   icon: ArrowDownCircle, subject: 'Accounting' },
      { label: 'Facturas',            route: '/financial/invoices',     icon: Receipt,         subject: 'Finance' },
      { label: 'Financiero',          route: '/finanzas',               icon: Briefcase,       subject: 'Finance' },
      { label: 'Tesorería',           route: '/tesoreria',              icon: Landmark,        subject: 'Finance' },
    ],
  },
  {
    title: 'Compras',
    items: [
      { label: 'Flujo de Compras', route: '/compras', exact: true,   icon: Compass,       subject: 'Purchase' },
      { label: 'Órdenes',          route: '/compras/ordenes',        icon: ShoppingCart,   subject: 'Purchase' },
      { label: 'Requisiciones',    route: '/purchases/requisitions', icon: ClipboardList,  subject: 'Requisition' },
      { label: 'Proveedores',      route: '/purchases/suppliers',    icon: Factory,        subject: 'Supplier' },
      { label: 'Aprobaciones',     route: '/approvals',              icon: CheckCircle2,   subject: 'Purchase' },
      { label: 'Analytics',        route: '/purchases/analytics',    icon: BarChart3,      subject: 'Purchase' },
    ],
  },
  {
    title: 'Inventario',
    items: [
      { label: 'Entrada Rápida',  route: '/inventory/quick-entry',    icon: Zap,              subject: 'Inventory' },
      { label: 'Productos',       route: '/inventory',                icon: Package,          subject: 'Inventory' },
      { label: 'Almacenes',       route: '/inventory/warehouses',     icon: Warehouse,        subject: 'Inventory' },
      { label: 'Transferencias',  route: '/inventory/transfers',      icon: ArrowLeftRight,   subject: 'Inventory' },
      { label: 'Conteo Físico',   route: '/inventory/physical-count', icon: Hash,             subject: 'Inventory' },
      { label: 'Ajustes',         route: '/inventory/adjustments',    icon: Scale,            subject: 'Inventory' },
      { label: 'Valorización',    route: '/inventario/valorizacion',  icon: Gem,              subject: 'Inventory' },
      { label: 'Analytics',       route: '/inventory/analytics',      icon: BarChart3,        subject: 'Inventory' },
    ],
  },
  {
    title: 'Producción',
    items: [
      { label: 'Órdenes', route: '/production', icon: Cog, subject: 'Production' },
    ],
  },
  {
    title: 'Ventas',
    items: [
      { label: 'Pedidos',          route: '/sales',                  icon: ShoppingBag,     subject: 'Sales' },
      { label: 'Cotizaciones',     route: '/sales?tab=quotations',   icon: FileSpreadsheet, subject: 'Sales' },
      { label: 'Clientes',         route: '/sales/customers',        icon: Users,           subject: 'Customer' },
      { label: 'Listas de Precios', route: '/sales/price-lists',     icon: Tag,             subject: 'Sales' },
    ],
  },
  {
    title: 'Logística',
    items: [
      { label: 'Envíos', route: '/logistica', icon: Truck, subject: 'Logistics' },
    ],
  },
  {
    title: 'Nómina',
    items: [
      { label: 'Rol de Pagos', route: '/nomina', exact: true,  icon: Banknote, subject: 'Accounting' },
      { label: 'Empleados',    route: '/nomina/empleados',     icon: UserCog,  subject: 'Accounting' },
      { label: 'Organigrama',  route: '/nomina/organigrama',   icon: Network,  anySubject: ['Accounting', 'HR'] },
      { label: 'Asistencia',   route: '/nomina/asistencia',    icon: Clock,    subject: 'Accounting' },
      { label: 'Calendario',   route: '/nomina/calendario',    icon: CalendarDays },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { label: 'Reportes',       route: '/reports',          icon: LineChart,  subject: 'Report' },
      { label: 'Investigación',  route: '/research',         icon: Microscope, subject: 'Report' },
      { label: 'Usuarios',       route: '/admin/users',      icon: User,       subject: 'User' },
      { label: 'Config. Empresa',route: '/settings/empresa', icon: Building2,  subject: 'CompanySettings' },
      { label: 'Seguridad',      route: '/settings/security', icon: Shield },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
}

const GROUPS_STORAGE_KEY = 'kp-sidebar-collapsed-groups';

function loadCollapsedGroups(): Set<string> {
  try {
    const raw = localStorage.getItem(GROUPS_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const location = useLocation();
  const { can } = useCan();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(loadCollapsedGroups);

  const toggleGroup = (title: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const isActive = (route: string, exact?: boolean) => {
    if (route === '/') return location.pathname === '/';
    const [path, query] = route.split('?');
    if (query) return location.pathname === path && location.search.includes(query);
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(route);
  };

  const visibleGroups = NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.anySubject) return item.anySubject.some((s) => can('read', s));
        return !item.subject || can('read', item.subject);
      }),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={`
        fixed left-0 top-14 bottom-0 z-30 flex flex-col
        bg-white dark:bg-surface-800
        border-r border-surface-200 dark:border-surface-700
        sidebar-transition overflow-hidden
        ${collapsed ? 'w-16' : 'w-60'}
      `}
    >
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {visibleGroups.map(group => {
          const groupOpen = collapsed || !collapsedGroups.has(group.title);
          return (
          <div key={group.title}>
            {!collapsed && (
              <button
                type="button"
                onClick={() => toggleGroup(group.title)}
                className="w-full flex items-center justify-between px-2 mb-1.5 group/heading"
              >
                <span className="text-[10px] font-semibold uppercase tracking-widest text-surface-400 dark:text-surface-500 group-hover/heading:text-surface-600 dark:group-hover/heading:text-surface-300">
                  {group.title}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-surface-400 dark:text-surface-500 transition-transform duration-200 ${groupOpen ? '' : '-rotate-90'}`}
                  strokeWidth={2}
                />
              </button>
            )}
            {collapsed && (
              <div className="mx-auto w-6 border-t border-surface-200 dark:border-surface-700 mb-2" />
            )}
            {groupOpen && (
            <ul className="space-y-0.5">
              {group.items.map(item => {
                const active = isActive(item.route, item.exact);
                const Icon = item.icon;
                return (
                  <li key={item.route}>
                    <NavLink
                      to={item.route}
                      end={item.route === '/'}
                      className={() =>
                        [
                          'group flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-150',
                          collapsed ? 'justify-center px-0 py-2.5' : 'px-2.5 py-2',
                          !collapsed && item.indent ? 'ml-3 pl-2 border-l border-surface-200 dark:border-surface-700' : '',
                          active
                            ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 shadow-sm shadow-brand-500/5'
                            : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700/60 hover:text-surface-900 dark:hover:text-white',
                        ].join(' ')
                      }
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon
                        className={[
                          'flex-shrink-0 transition-colors duration-150',
                          collapsed ? 'w-5 h-5' : item.indent ? 'w-4 h-4' : 'w-[18px] h-[18px]',
                          active
                            ? 'text-brand-600 dark:text-brand-400'
                            : 'text-surface-400 dark:text-surface-500 group-hover:text-surface-600 dark:group-hover:text-surface-300',
                        ].join(' ')}
                        strokeWidth={active ? 2.2 : 1.8}
                      />
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                      {!collapsed && active && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
            )}
          </div>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-700">
          <p className="text-[10px] text-surface-400 dark:text-surface-500">
            KallpaPro ERP v2.0
          </p>
        </div>
      )}
    </aside>
  );
}
