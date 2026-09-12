import { ReactNode, useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react';

interface CollapsiblePanelProps {
  id: string;
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  defaultOpen?: boolean;
}

export default function CollapsiblePanel({ id, title, icon: Icon, children, defaultOpen = true }: CollapsiblePanelProps) {
  const storageKey = `kp-panel-${id}`;
  const [open, setOpen] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === '1' : defaultOpen;
  });
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    localStorage.setItem(storageKey, open ? '1' : '0');
  }, [open, storageKey]);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [children]);

  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 shadow-soft overflow-hidden mb-4 animate-fade-in-up">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
      >
        {Icon && <Icon className="w-4 h-4 text-brand-500 flex-shrink-0" />}
        <span className="text-sm font-semibold text-surface-900 dark:text-white flex-1">{title}</span>
        <Chevron className="w-4 h-4 text-surface-400" />
      </button>
      <div
        className="transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden"
        style={{ maxHeight: open ? (height ?? 2000) : 0, opacity: open ? 1 : 0 }}
      >
        <div ref={contentRef} className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}
