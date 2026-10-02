import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { uxApi } from '../../api/ux';
import { tourSteps } from '../../lib/roleHome';

/**
 * Recorrido guiado por rol (propuesta 09): al primer ingreso con un rol (o al cambiar de rol)
 * resalta 3-4 elementos de la pantalla de Inicio. Se marca como visto en el servidor por rol,
 * así no reaparece en otro dispositivo; se puede repetir desde el menú del usuario.
 */
export default function OnboardingTour() {
  const { user } = useAuthStore();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Memoizado: antes se recalculaba (con un array nuevo) en cada render, lo que le daba una
  // identidad nueva a `step` en cada render y hacía que `measure` (useCallback con dep [step])
  // también cambiara de identidad siempre — el useLayoutEffect de abajo volvía a dispararse en
  // cada render, llamaba a setRect con un objeto nuevo, forzaba otro render, y así en loop
  // infinito ("Maximum update depth exceeded"). Se recalcula solo cuando cambia el rol o se abre
  // el tour (momento en que el DOM de Inicio ya está montado), no en cada render.
  const steps = useMemo(
    () => tourSteps(user?.role).filter((s) => typeof document !== 'undefined' && document.querySelector(`[data-tour="${s.target}"]`)),
    [user?.role, open],
  );
  const step = steps[i];

  // Primer ingreso con este rol → abrir (solo en Inicio, donde viven los elementos señalados).
  useEffect(() => {
    if (!user?.role || pathname !== '/') return;
    let cancelled = false;
    uxApi.prefs().then((r) => { if (!cancelled && !r.data.onboardingDone.includes(user.role)) { setI(0); setOpen(true); } }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.role, pathname]);

  useEffect(() => {
    const reopen = () => { setI(0); setOpen(true); };
    window.addEventListener('kallpa:open-tour', reopen);
    return () => window.removeEventListener('kallpa:open-tour', reopen);
  }, []);

  const measure = useCallback(() => {
    const el = step ? document.querySelector(`[data-tour="${step.target}"]`) : null;
    if (el) { el.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); setRect(el.getBoundingClientRect()); } else setRect(null);
  }, [step]);
  useLayoutEffect(() => { if (open) measure(); }, [open, measure]);
  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', measure);
    const t = setTimeout(measure, 350); // tras el scroll suave
    return () => { window.removeEventListener('resize', measure); clearTimeout(t); };
  }, [open, measure]);

  const finish = () => { setOpen(false); uxApi.onboardingDone().catch(() => {}); };

  if (!open || !step) return null;
  const pad = 6;
  const box = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  const below = !box || box.top + box.height + 180 < window.innerHeight;
  const cardTop = box ? (below ? box.top + box.height + 10 : Math.max(10, box.top - 190)) : window.innerHeight / 2 - 90;
  const cardLeft = box ? Math.min(Math.max(12, box.left), window.innerWidth - 332) : window.innerWidth / 2 - 160;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-label="Recorrido guiado">
      {box ? (
        <div className="absolute rounded-xl ring-4 ring-brand-400 pointer-events-none transition-all duration-300"
          style={{ ...box, boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)' }} />
      ) : <div className="absolute inset-0 bg-slate-900/55" />}
      <div className="absolute w-[320px] max-w-[calc(100vw-24px)] bg-white dark:bg-surface-800 rounded-xl shadow-xl p-4 space-y-2" style={{ top: cardTop, left: cardLeft }}>
        <p className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide">Paso {i + 1} de {steps.length}</p>
        <h3 className="font-semibold text-surface-900 dark:text-white">{step.title}</h3>
        <p className="text-sm text-surface-600 dark:text-surface-300">{step.body}</p>
        <div className="flex justify-between items-center pt-1">
          <button type="button" onClick={finish} className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300">Omitir</button>
          <div className="flex gap-2">
            {i > 0 && <button type="button" onClick={() => setI(i - 1)} className="px-3 py-1.5 text-sm rounded-lg text-surface-600 dark:text-surface-300">Atrás</button>}
            {i < steps.length - 1
              ? <button type="button" onClick={() => setI(i + 1)} className="px-3 py-1.5 text-sm rounded-lg bg-brand-500 text-white">Siguiente</button>
              : <button type="button" onClick={finish} className="px-3 py-1.5 text-sm rounded-lg bg-brand-500 text-white">Entendido</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
