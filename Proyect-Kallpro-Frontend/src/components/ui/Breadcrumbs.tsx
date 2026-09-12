import { Link, useLocation } from 'react-router-dom';
import { buildBreadcrumbs } from '../../lib/routeLabels';

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const crumbs = buildBreadcrumbs(pathname);
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm mb-4 text-surface-500 dark:text-surface-400 flex-wrap">
      <Link to="/" className="hover:text-brand-500 dark:hover:text-brand-400 transition-colors flex items-center gap-1">
        <span>🏠</span>
        <span className="hidden sm:inline">Inicio</span>
      </Link>
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={c.to} className="flex items-center gap-1.5">
            <span className="text-surface-300 dark:text-surface-600">/</span>
            {isLast ? (
              <span className="font-medium text-surface-800 dark:text-white truncate max-w-[200px]">{c.label}</span>
            ) : (
              <Link to={c.to} className="hover:text-brand-500 dark:hover:text-brand-400 transition-colors">{c.label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
