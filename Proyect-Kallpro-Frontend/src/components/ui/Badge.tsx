import { ReactNode } from 'react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'brand';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

const variantMap: Record<BadgeVariant, string> = {
  success: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  warning: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  error:   'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  info:    'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  neutral: 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300',
  brand:   'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300',
};

const dotMap: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error:   'bg-red-500',
  info:    'bg-blue-500',
  neutral: 'bg-surface-400',
  brand:   'bg-brand-500',
};

const sizeMap: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export default function Badge({ children, variant = 'neutral', size = 'sm', dot = false, className = '' }: BadgeProps) {
  return (
    <span className={[
      'inline-flex items-center gap-1.5 rounded-full font-medium',
      variantMap[variant],
      sizeMap[size],
      className,
    ].join(' ')}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotMap[variant]}`} />}
      {children}
    </span>
  );
}
