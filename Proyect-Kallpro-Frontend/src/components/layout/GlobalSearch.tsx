import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { globalSearch, SearchResponse, SearchResultType } from '../../api/search';

// ============================================================
// BÚSQUEDA GLOBAL Ctrl+K (mejora A1 — patrón Odoo)
// ============================================================
// Paleta de comandos: menús estáticos del sistema + resultados federados
// del backend (/api/search). Se abre con Ctrl+K / Cmd+K desde cualquier pantalla.

interface MenuEntry {
  label: string;
  route: string;
  icon: string;
  keywords: string; // términos alternativos de búsqueda
}

const MENU_ENTRIES: MenuEntry[] = [
  { label: 'Inicio',                  route: '/',                        icon: '🏠', keywords: 'dashboard home panel' },
  { label: 'Inventario',              route: '/inventory',               icon: '📦', keywords: 'productos stock bodega' },
  { label: 'Valorización de inventario', route: '/inventario/valorizacion', icon: '💎', keywords: 'kardex costeo capas' },
  { label: 'Ajustes de inventario',   route: '/inventory/adjustments',   icon: '🧮', keywords: 'ajuste merma' },
  { label: 'Conteo físico',           route: '/inventory/physical-count', icon: '📋', keywords: 'inventario fisico conteo' },
  { label: 'Traslados entre bodegas', route: '/inventory/transfers',     icon: '🚚', keywords: 'transferencia bodega' },
  { label: 'Compras',                 route: '/compras',                 icon: '🛒', keywords: 'procurement adquisiciones' },
  { label: 'Órdenes de compra',       route: '/compras/ordenes',         icon: '📄', keywords: 'oc purchase order' },
  { label: 'Requisiciones',           route: '/purchases/requisitions',  icon: '📝', keywords: 'requisicion pedido interno' },
  { label: 'Proveedores',             route: '/purchases/suppliers',     icon: '🏭', keywords: 'supplier vendor' },
  { label: 'Aprobaciones',            route: '/approvals',               icon: '✅', keywords: 'aprobar bandeja pendientes' },
  { label: 'Ventas',                  route: '/sales',                   icon: '🎯', keywords: 'pedidos cotizaciones' },
  { label: 'Venta rápida (POS)',      route: '/ventas/rapida',           icon: '⚡', keywords: 'pos caja punto venta' },
  { label: 'Clientes',                route: '/sales/customers',         icon: '👥', keywords: 'customer cartera' },
  { label: 'Listas de precios',       route: '/sales/price-lists',       icon: '🏷️', keywords: 'precios tarifas' },
  { label: 'Logística',               route: '/logistica',               icon: '🚛', keywords: 'envios despachos tracking' },
  { label: 'Finanzas',                route: '/finanzas',                icon: '💰', keywords: 'financiero resultados ratios' },
  { label: 'Contabilidad',            route: '/contabilidad',            icon: '📒', keywords: 'diario mayor balanza asientos niif' },
  { label: 'Asientos contables',      route: '/financial/journal-entries', icon: '📖', keywords: 'diario journal ast' },
  { label: 'Documentos SRI',          route: '/sri',                     icon: '🧾', keywords: 'facturas compra electronica' },
  { label: 'Tesorería',               route: '/tesoreria',               icon: '🏦', keywords: 'bancos pagos cobros conciliacion flujo caja' },
  { label: 'Nómina',                  route: '/nomina',                  icon: '💵', keywords: 'rol pagos sueldos iess decimos' },
  { label: 'Empleados',               route: '/nomina/empleados',        icon: '🧑‍💼', keywords: 'rrhh personal' },
  { label: 'Asistencia biométrica',   route: '/nomina/asistencia',       icon: '⏰', keywords: 'horas extras biometrico reloj' },
  { label: 'Calendario de TTHH',      route: '/nomina/calendario',       icon: '🗓️', keywords: 'turnos horario agenda permisos vacaciones tthh rrhh' },
  { label: 'Producción',              route: '/production',              icon: '⚙️', keywords: 'manufactura bom ordenes' },
  { label: 'Reportes',                route: '/reports',                 icon: '📈', keywords: 'informes exportar' },
  { label: 'CRM',                     route: '/crm',                     icon: '📊', keywords: 'pipeline oportunidades contactos' },
  { label: 'Leads',                   route: '/crm/leads',               icon: '🧲', keywords: 'captura prospectos puntaje score formulario' },
  { label: 'Configuración del CRM',   route: '/crm/config',              icon: '⚙️', keywords: 'etapas scoring reglas formularios asignacion agentes' },
  { label: 'Presupuestos',            route: '/finanzas?tab=presupuesto', icon: '🗂️', keywords: 'budget departamento' },
  { label: 'Configuración de empresa', route: '/settings/empresa',       icon: '🏢', keywords: 'ajustes settings empresa' },
  { label: 'Seguridad',               route: '/settings/security',       icon: '🔐', keywords: '2fa sesiones password' },
];

const TYPE_ICONS: Record<SearchResultType, string> = {
  CUSTOMER: '👥', SUPPLIER: '🏭', PRODUCT: '📦',
  PURCHASE_ORDER: '📄', INVOICE: '🧾', SALES_ORDER: '🎯', REQUISITION: '📝',
};

/** Filtro simple sin acentos para las entradas de menú estáticas. */
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Atajo global Ctrl+K / Cmd+K + evento del botón de búsqueda del Navbar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('kallpa:open-search', onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('kallpa:open-search', onOpenEvent);
    };
  }, []);

  // Búsqueda federada con debounce (250 ms)
  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await globalSearch(query);
        setResults(data);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults(null);
  }, []);

  const go = (route: string) => {
    close();
    navigate(route);
  };

  if (!open) return null;

  const nq = normalize(query.trim());
  const menuMatches = nq.length === 0
    ? MENU_ENTRIES.slice(0, 8)
    : MENU_ENTRIES.filter(m => normalize(`${m.label} ${m.keywords}`).includes(nq)).slice(0, 6);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" onClick={close}>
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-[620px] max-w-[95vw] bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700 overflow-hidden fade-in"
        onClick={e => e.stopPropagation()}
      >
        <Command shouldFilter={false} label="Búsqueda global">
          <div className="flex items-center gap-2 px-4 border-b border-surface-200 dark:border-surface-700">
            <svg className="w-4 h-4 text-surface-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Command.Input
              value={query}
              onValueChange={setQuery}
              autoFocus
              placeholder="Buscar clientes, proveedores, productos, OC, facturas, menús…"
              className="w-full py-3.5 bg-transparent text-sm text-surface-900 dark:text-white placeholder-surface-400 outline-none"
            />
            <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-surface-300 dark:border-surface-600 text-surface-400 flex-shrink-0">ESC</kbd>
          </div>

          <Command.List className="max-h-[420px] overflow-y-auto p-2">
            {loading && (
              <div className="px-3 py-2 text-xs text-surface-400">Buscando…</div>
            )}

            {menuMatches.length > 0 && (
              <Command.Group
                heading="Menús"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-surface-400"
              >
                {menuMatches.map(m => (
                  <Command.Item
                    key={m.route}
                    value={`menu-${m.route}`}
                    onSelect={() => go(m.route)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm text-surface-700 dark:text-surface-200 data-[selected=true]:bg-brand-50 dark:data-[selected=true]:bg-brand-900/30 data-[selected=true]:text-brand-700 dark:data-[selected=true]:text-brand-300"
                  >
                    <span className="text-base">{m.icon}</span>
                    <span className="font-medium">{m.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results?.groups.map(group => (
              <Command.Group
                key={group.type}
                heading={group.label}
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-surface-400"
              >
                {group.results.map(r => (
                  <Command.Item
                    key={`${r.type}-${r.id}`}
                    value={`${r.type}-${r.id}`}
                    onSelect={() => go(r.route)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-brand-50 dark:data-[selected=true]:bg-brand-900/30"
                  >
                    <span className="text-base">{TYPE_ICONS[r.type]}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-100 truncate">{r.title}</p>
                      <p className="text-xs text-surface-500 dark:text-surface-400 truncate">{r.subtitle}</p>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}

            {!loading && query.trim().length >= 2 && (results?.total ?? 0) === 0 && menuMatches.length === 0 && (
              <Command.Empty className="px-3 py-6 text-center text-sm text-surface-400">
                Sin resultados para «{query}»
              </Command.Empty>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
