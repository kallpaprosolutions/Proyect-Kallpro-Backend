import { useAbility } from '@casl/react';
import { AppAbility, Action, Subject } from '../lib/ability';

/**
 * Hook de permisos basado en CASL (sincronizado con el backend).
 *
 * Uso:
 *   const { can } = useCan();
 *   can('approve', 'Purchase')   → boolean
 *   can('read', 'Accounting')    → boolean
 */
export function useCan() {
  const ability = useAbility<AppAbility>();
  return {
    ability,
    can: (action: Action, subject: Subject) => ability.can(action, subject),
    cannot: (action: Action, subject: Subject) => ability.cannot(action, subject),
  };
}
