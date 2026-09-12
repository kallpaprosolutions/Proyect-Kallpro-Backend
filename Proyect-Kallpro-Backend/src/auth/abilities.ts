import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { Action, Subject, ROLE_RULES } from './roles';

export type AppAbility = MongoAbility<[Action, Subject]>;

/** Construye la habilidad CASL para un rol dado. */
export function defineAbilitiesFor(role: string): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  const rules = ROLE_RULES[role] ?? ROLE_RULES.USER;
  for (const [actions, subjects] of rules) {
    can(actions as any, subjects as any);
  }

  return build();
}

/**
 * Reglas crudas (serializables) para enviar al frontend.
 * El frontend reconstruye la habilidad con createMongoAbility(rules).
 * Single source of truth: el catálogo vive solo en el backend.
 */
export function packedRulesFor(role: string) {
  return defineAbilitiesFor(role).rules;
}
