import { createMongoAbility, MongoAbility, RawRuleOf } from '@casl/ability';

// Debe coincidir con el backend (src/auth/roles.ts)
export type Action =
  | 'manage' | 'create' | 'read' | 'update' | 'delete'
  | 'approve' | 'receive' | 'pay' | 'post' | 'configure';

export type Subject =
  | 'Inventory' | 'StorageLocation' | 'Production'
  | 'Purchase' | 'Requisition' | 'Supplier'
  | 'Accounting' | 'Journal' | 'Finance' | 'Budget' | 'Payment'
  | 'Customer' | 'Sales' | 'CRM' | 'Logistics'
  | 'Report' | 'User' | 'CompanySettings' | 'ApprovalMatrix'
  | 'HR'
  | 'all';

export type AppAbility = MongoAbility<[Action, Subject]>;

/** Reconstruye la habilidad a partir de las reglas crudas del backend. */
export function buildAbility(rules: RawRuleOf<AppAbility>[] = []): AppAbility {
  return createMongoAbility<AppAbility>(rules);
}

// Re-export de la API de CASL React (provider/Can/useAbility con contexto interno)
export { Can, useAbility } from '@casl/react';
