import { useEffect, useRef, useState } from 'react';

// ============================================================
// SELECTOR DE PERÍODO (Sprint 11 — patrón Odoo "jun 2026 ◄ ►")
// ============================================================
// Popover compacto y amigable: una fila para navegar el mes con flechas y un
// grid de meses para saltar directo. Devuelve el período como 'YYYY-MM'.
// Reemplaza el <input type="month"> por una UX de un clic como la de Odoo.

interface PeriodPickerProps {
  value: string; // 'YYYY-MM'
  onChange: (period: string) => void;
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTHS_LONG = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(value.split('-')[0]));
  const ref = useRef<HTMLDivElement>(null);

  const [vYear, vMonth] = value.split('-').map(Number);

  useEffect(() => { setYear(Number(value.split('-')[0])); }, [value, open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const label = `${MONTHS_LONG[vMonth - 1]} ${vYear}`;

  const shiftMonth = (delta: number) => {
    const d = new Date(vYear, vMonth - 1 + delta, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const pick = (m: number) => {
    onChange(`${year}-${String(m + 1).padStart(2, '0')}`);
    setOpen(false);
  };

  return (
    <div className="relative inline-flex items-center" ref={ref}>
      <button
        onClick={() => shiftMonth(-1)}
        className="p-1.5 rounded-l-lg border border-r-0 border-surface-200 dark:border-surface-700 text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-700"
        title="Mes anterior" aria-label="Mes anterior"
      >‹</button>
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-1.5 border-y border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-sm font-medium text-surface-900 dark:text-white min-w-[130px] hover:bg-surface-100 dark:hover:bg-surface-800"
      >
        📅 {label}
      </button>
      <button
        onClick={() => shiftMonth(1)}
        className="p-1.5 rounded-r-lg border border-l-0 border-surface-200 dark:border-surface-700 text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-700"
        title="Mes siguiente" aria-label="Mes siguiente"
      >›</button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-white dark:bg-surface-800 rounded-xl shadow-lg border border-surface-200 dark:border-surface-700 p-3 w-64 fade-in">
          {/* Navegación de año */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setYear((y) => y - 1)} className="p-1 rounded text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700">‹</button>
            <span className="font-semibold text-surface-900 dark:text-white">{year}</span>
            <button onClick={() => setYear((y) => y + 1)} className="p-1 rounded text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700">›</button>
          </div>
          {/* Grid de meses */}
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS_ES.map((m, i) => {
              const selected = year === vYear && i + 1 === vMonth;
              return (
                <button
                  key={m}
                  onClick={() => pick(i)}
                  className={`py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selected
                      ? 'bg-brand-500 text-white'
                      : 'text-surface-600 dark:text-surface-300 hover:bg-brand-50 dark:hover:bg-brand-900/30'
                  }`}
                >{m}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
