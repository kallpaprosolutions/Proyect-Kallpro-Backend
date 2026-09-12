import { useEffect, useRef } from 'react';

/**
 * Hook para detectar input de scanners USB tipo "keyboard wedge".
 * Los scanners físicos escriben caracteres muy rápido (~10ms entre teclas vs ~150ms humano)
 * y terminan con Enter. Capturamos ese patrón globalmente.
 *
 * Uso:
 *   useBarcodeShortcut((code) => {
 *     // se llamó con el código escaneado
 *   });
 */

interface Options {
  enabled?: boolean;
  minLength?: number;   // ignorar inputs cortos
  maxInterval?: number; // ms entre teclas para considerar "scanner"
}

export function useBarcodeShortcut(
  onScan: (code: string) => void,
  { enabled = true, minLength = 4, maxInterval = 50 }: Options = {}
) {
  const bufferRef = useRef('');
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      // Si está en un input/textarea de tipo texto, no interceptar (deja escribir)
      // EXCEPTO si el patrón es de scanner (rápido)
      const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      const now = performance.now();
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (e.key === 'Enter') {
        const code = bufferRef.current;
        bufferRef.current = '';
        if (code.length >= minLength) {
          // Solo dispara si el último delta fue rápido (es scanner)
          if (delta < maxInterval * 4) {
            e.preventDefault();
            e.stopPropagation();
            onScan(code);
          }
        }
        return;
      }

      // Reset buffer si pasó mucho tiempo (input humano)
      if (delta > maxInterval) {
        bufferRef.current = '';
      }

      // Solo capturar caracteres imprimibles
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        // Si está en un input humano, no acumular (sería molesto)
        if (inField && delta > maxInterval) {
          bufferRef.current = '';
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, minLength, maxInterval, onScan]);
}
