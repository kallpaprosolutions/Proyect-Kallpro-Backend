import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSmartButtons, SmartButton, SmartButtonEntity } from '../api/smartButtons';

// ============================================================
// SMART BUTTONS (mejora A4 — patrón Odoo)
// ============================================================
// Fila de botones-contador arriba del detalle de un documento (OC, pedido,
// factura): asientos, pagos, envíos, facturas, retenciones, NC vinculados.
// Clic → despliega la lista de documentos; cada item navega a su detalle.

interface SmartButtonsProps {
  entityType: SmartButtonEntity;
  entityId: string;
  /** Se puede pasar para refrescar los contadores cuando el documento cambie (p.ej. tras pagar). */
  refreshKey?: unknown;
}

export default function SmartButtons({ entityType, entityId, refreshKey }: SmartButtonsProps) {
  const navigate = useNavigate();
  const [buttons, setButtons] = useState<SmartButton[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getSmartButtons(entityType, entityId)
      .then(b => { if (!cancelled) setButtons(b); })
      .catch(() => { if (!cancelled) setButtons([]); });
    return () => { cancelled = true; };
  }, [entityType, entityId, refreshKey]);

  // Cierra el dropdown al hacer clic fuera
  useEffect(() => {
    if (!openKey) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpenKey(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [openKey]);

  if (buttons.length === 0) return null;

  const go = (route: string) => {
    setOpenKey(null);
    navigate(route);
  };

  return (
    <div ref={containerRef} className="flex gap-2 flex-wrap mb-4">
      {buttons.map(btn => (
        <div key={btn.key} className="relative">
          <button
            onClick={() => setOpenKey(openKey === btn.key ? null : btn.key)}
            disabled={btn.count === 0}
            title={btn.count === 0 ? `Sin ${btn.label.toLowerCase()} vinculados` : `Ver ${btn.label.toLowerCase()}`}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors ${
              btn.count === 0
                ? 'border-surface-200 dark:border-surface-700 text-surface-400 dark:text-surface-500 opacity-60 cursor-default'
                : 'border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-200 hover:border-brand-300 dark:hover:border-brand-600 hover:bg-brand-50/50 dark:hover:bg-brand-900/20 shadow-soft'
            }`}
          >
            <span>{btn.icon}</span>
            <span className={`font-bold ${btn.count > 0 ? 'text-brand-600 dark:text-brand-400' : ''}`}>{btn.count}</span>
            <span className="font-medium">{btn.label}</span>
          </button>

          {openKey === btn.key && btn.count > 0 && (
            <div className="absolute left-0 top-full mt-1 w-80 max-w-[90vw] bg-white dark:bg-surface-800 rounded-xl shadow-lg border border-surface-200 dark:border-surface-700 py-1.5 z-30 fade-in">
              {btn.route && (
                <button
                  onClick={() => go(btn.route!)}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 border-b border-surface-100 dark:border-surface-700"
                >
                  Ver todos en {btn.label.toLowerCase()} →
                </button>
              )}
              {btn.items.map(item => {
                const content = (
                  <>
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-100 truncate">{item.title}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400 truncate">{item.subtitle}</p>
                  </>
                );
                return item.route ? (
                  <button
                    key={item.id}
                    onClick={() => go(item.route!)}
                    className="w-full text-left px-4 py-2 hover:bg-surface-50 dark:hover:bg-surface-700/40 transition-colors"
                  >
                    {content}
                  </button>
                ) : (
                  <div key={item.id} className="px-4 py-2">
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
