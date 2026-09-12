import { ReactNode, useEffect, useMemo } from 'react';
import { AbilityProvider as CaslAbilityProvider } from '@casl/react';
import client from '../api/client';
import { useAuthStore } from '../store/auth.store';
import { buildAbility } from '../lib/ability';

/**
 * Provee la habilidad CASL a toda la app.
 * Obtiene las reglas del backend (/auth/me) — fuente de verdad — y las cachea.
 */
export function AbilityProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  const rules = useAuthStore((s) => s.rules);
  const setRules = useAuthStore((s) => s.setRules);

  useEffect(() => {
    if (!token) return;
    client.get('/auth/me')
      .then((r) => { if (Array.isArray(r.data?.rules)) setRules(r.data.rules); })
      .catch(() => { /* token inválido — el interceptor maneja el 401 */ });
  }, [token, setRules]);

  const ability = useMemo(() => buildAbility(rules), [rules]);

  return <CaslAbilityProvider value={ability}>{children}</CaslAbilityProvider>;
}
