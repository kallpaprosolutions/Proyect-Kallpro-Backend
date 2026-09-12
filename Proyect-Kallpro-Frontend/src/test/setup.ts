import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Desmonta los componentes después de cada test para evitar fugas entre casos.
afterEach(() => {
  cleanup();
});

// Polyfill de ResizeObserver para jsdom (lo requiere cmdk — búsqueda global A1).
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Polyfill de scrollIntoView (cmdk lo usa al navegar con teclado).
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Polyfill de document.elementFromPoint (react-big-calendar lo usa en su lógica
// de selección/drag-and-drop del calendario de TTHH; jsdom no lo implementa).
if (typeof document !== 'undefined' && !document.elementFromPoint) {
  document.elementFromPoint = () => null;
}
