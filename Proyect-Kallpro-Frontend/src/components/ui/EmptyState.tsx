import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';

/** Estado vacío consistente: icono + mensaje + CTA opcional. */
export default function EmptyState({ icon, title, hint, ctaText, ctaTo, children }: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  ctaText?: string;
  ctaTo?: string;
  children?: ReactNode;
}) {
  return (
    <div className="text-center py-10 px-4">
      <div className="flex justify-center mb-3 text-surface-400 dark:text-surface-500">
        {icon ?? <Inbox className="w-10 h-10" />}
      </div>
      <p className="text-surface-700 dark:text-surface-200 font-medium">{title}</p>
      {hint && <p className="text-sm text-surface-400 mt-1">{hint}</p>}
      {ctaText && ctaTo && (
        <Link to={ctaTo} className="inline-block mt-4 text-sm px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors">
          {ctaText}
        </Link>
      )}
      {children}
    </div>
  );
}
