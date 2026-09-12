import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useTheme } from '../../hooks/useTheme';
import AppSwitcher from './AppSwitcher';
import {
  Menu,
  Search,
  LayoutGrid,
  Sun,
  Moon,
  ChevronDown,
  LogOut,
} from 'lucide-react';

interface NavbarProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

export default function Navbar({ onToggleSidebar }: NavbarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggle: toggleTheme } = useTheme();
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U';
  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Usuario';

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-14 z-40 flex items-center px-3 gap-2
        bg-brand-900 dark:bg-surface-900 border-b border-brand-800 dark:border-surface-700 shadow-sm">

        {/* Hamburger */}
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" strokeWidth={2} />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shadow-sm shadow-brand-500/30">
            <span className="text-white font-black text-sm leading-none">K</span>
          </div>
          <span className="text-white font-bold text-base tracking-tight hidden sm:block">
            Kallpa<span className="text-brand-300 font-extrabold">Pro</span>
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Búsqueda global (Ctrl+K) */}
        <button
          onClick={() => window.dispatchEvent(new Event('kallpa:open-search'))}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 hover:text-white/90 transition-colors text-sm"
          aria-label="Búsqueda global"
          title="Buscar (Ctrl+K)"
        >
          <Search className="w-4 h-4" strokeWidth={2} />
          <span className="hidden md:block">Buscar…</span>
          <kbd className="hidden md:block text-[10px] px-1.5 py-0.5 rounded border border-white/20 text-white/50 font-mono">Ctrl K</kbd>
        </button>
        <button
          onClick={() => window.dispatchEvent(new Event('kallpa:open-search'))}
          className="sm:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Búsqueda global"
        >
          <Search className="w-5 h-5" strokeWidth={2} />
        </button>

        {/* App Switcher (waffle) */}
        <button
          onClick={() => setAppSwitcherOpen(true)}
          className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Cambiar módulo"
          title="Módulos"
        >
          <LayoutGrid className="w-5 h-5" strokeWidth={1.8} />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          {theme === 'dark'
            ? <Sun className="w-5 h-5" strokeWidth={2} />
            : <Moon className="w-5 h-5" strokeWidth={2} />
          }
        </button>

        {/* User avatar + menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(o => !o)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center ring-2 ring-white/20">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <span className="text-white/80 text-sm font-medium hidden md:block truncate max-w-[120px]">
              {displayName}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-white/50 hidden md:block" strokeWidth={2.5} />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-surface-800 rounded-xl shadow-lg border border-surface-200 dark:border-surface-700 py-1 z-20 fade-in">
                <div className="px-4 py-2.5 border-b border-surface-100 dark:border-surface-700">
                  <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{displayName}</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2.5"
                >
                  <LogOut className="w-4 h-4" strokeWidth={2} />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {appSwitcherOpen && <AppSwitcher onClose={() => setAppSwitcherOpen(false)} />}
    </>
  );
}
