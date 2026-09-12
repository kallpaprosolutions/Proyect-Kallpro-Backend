import { useEffect, useState } from 'react';
import { companyApi } from '../api/company';

/**
 * ¿Está habilitado el escáner de códigos con cámara? (ErpConfig.inventory.enableCameraScanner)
 *
 * Deshabilitado por defecto: en algunos equipos Windows el proceso del navegador retiene
 * la webcam a nivel de SO aunque el código libere los tracks, bloqueando otras apps.
 * Se activa/desactiva desde Configuración → Empresa → Inventario.
 *
 * Cachea el resultado a nivel de módulo para no repetir la petición en cada página.
 */
let cached: boolean | null = null;

export function invalidateCameraScannerCache() {
  cached = null;
}

export function useCameraScannerEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(cached ?? false);

  useEffect(() => {
    if (cached !== null) { setEnabled(cached); return; }
    let alive = true;
    companyApi.getSettings()
      .then((r) => {
        cached = r.data.settings?.inventory?.enableCameraScanner ?? false;
        if (alive) setEnabled(cached);
      })
      .catch(() => { /* sin permiso o error → se queda deshabilitado */ });
    return () => { alive = false; };
  }, []);

  return enabled;
}
