import { ReactNode } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import GlobalSearch from './GlobalSearch';
import Breadcrumbs from '../ui/Breadcrumbs';
import { useSidebar } from '../../hooks/useSidebar';
import { useTheme } from '../../hooks/useTheme';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { collapsed, toggle } = useSidebar();
  // Initialize theme on mount
  useTheme();

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 text-surface-900 dark:text-surface-50">
      {/* Fixed top navbar */}
      <Navbar onToggleSidebar={toggle} sidebarCollapsed={collapsed} />

      {/* Búsqueda global Ctrl+K (mejora A1) */}
      <GlobalSearch />

      {/* Fixed sidebar */}
      <Sidebar collapsed={collapsed} />

      {/* Main content — offset for navbar (top: 56px) and sidebar */}
      <main
        className="pt-14 min-h-screen transition-all duration-200"
        style={{ marginLeft: collapsed ? '64px' : '240px' }}
      >
        <div className="p-6">
          <Breadcrumbs />
          {children}
        </div>
      </main>
    </div>
  );
}
