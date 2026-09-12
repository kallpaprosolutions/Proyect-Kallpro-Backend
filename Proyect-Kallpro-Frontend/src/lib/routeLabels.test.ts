import { describe, it, expect } from 'vitest';
import { ROUTE_LABELS } from './routeLabels';

/**
 * El breadcrumb usa este mapa; si falta una ruta se muestra el segmento crudo
 * en inglés (ej. "Adjustments"). Verifica que las rutas principales tengan label.
 */
describe('ROUTE_LABELS', () => {
  const rutasPrincipales = [
    '/',
    '/inventory',
    '/inventory/warehouses',
    '/inventory/categories',
    '/inventory/quick-entry',
    '/inventory/adjustments',
    '/inventario/valorizacion',
    '/contabilidad',
    '/purchases',
    '/compras',
    '/sales',
    '/sales/price-lists',
    '/sales/quotations',
    '/ventas/rapida',
    '/logistica',
    '/finanzas',
    '/settings',
    '/settings/empresa',
    '/settings/security',
  ];

  it.each(rutasPrincipales)('tiene label para %s', (ruta) => {
    expect(ROUTE_LABELS[ruta], `falta label para ${ruta}`).toBeTruthy();
  });

  it('todos los labels están en español (sin claves crudas en MAYÚSCULAS_CON_GUIONES)', () => {
    for (const [ruta, label] of Object.entries(ROUTE_LABELS)) {
      expect(label, `label vacío para ${ruta}`).toBeTruthy();
      expect(label).not.toMatch(/^[A-Z_]{4,}$/);
    }
  });
});
