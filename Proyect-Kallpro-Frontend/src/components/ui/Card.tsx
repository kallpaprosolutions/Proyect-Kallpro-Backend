import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const paddingMap = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' };

export default function Card({ children, className = '', padding = 'md', hover = false }: CardProps) {
  return (
    <div
      className={[
        'bg-white dark:bg-surface-800',
        'rounded-xl border border-surface-200 dark:border-surface-700',
        'shadow-soft',
        paddingMap[padding],
        hover ? 'hover:shadow-card-hover transition-shadow cursor-pointer' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
