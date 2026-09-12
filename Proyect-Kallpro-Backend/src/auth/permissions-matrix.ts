/**
 * "Mis permisos": traduce las reglas CASL de un rol a una matriz legible en español para
 * mostrarla en el perfil del usuario. Se deriva de ROLE_RULES (única fuente de verdad), así
 * que nunca se desincroniza del enforcement real. Puro, sin BD.
 */
import { Action, Subject, ROLE_RULES, ROLE_CATALOG } from './roles';

export const ACTION_LABELS: Record<Action, string> = {
  manage: 'Control total',
  create: 'Crear',
  read: 'Ver',
  update: 'Editar',
  delete: 'Eliminar',
  approve: 'Aprobar',
  receive: 'Recibir mercadería',
  pay: 'Pagar / cobrar',
  post: 'Contabilizar',
  configure: 'Configurar',
};

export const SUBJECT_LABELS: Record<Subject, string> = {
  Inventory: 'Inventario',
  StorageLocation: 'Ubicaciones de bodega',
  Production: 'Producción',
  Purchase: 'Compras / OC',
  Requisition: 'Requisiciones',
  Supplier: 'Proveedores',
  Accounting: 'Contabilidad',
  Journal: 'Asientos contables',
  Finance: 'Finanzas / facturación',
  Budget: 'Presupuesto',
  Payment: 'Pagos y cobros (CxP/CxC)',
  Customer: 'Clientes',
  Sales: 'Ventas',
  CRM: 'CRM',
  Logistics: 'Logística',
  Report: 'Reportes',
  User: 'Usuarios',
  CompanySettings: 'Ajustes de empresa',
  ApprovalMatrix: 'Matriz de aprobación',
  HR: 'Talento humano',
  all: 'Todo el sistema',
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS) as Action[];
const ALL_SUBJECTS = (Object.keys(SUBJECT_LABELS) as Subject[]).filter((s) => s !== 'all');

export interface PermissionRow {
  subject: Subject;
  label: string;
  actions: Array<{ action: Action; label: string }>;
}

export function buildPermissionMatrix(role: string): { role: string; roleLabel: string; description: string; fullAccess: boolean; rows: PermissionRow[] } {
  const meta = ROLE_CATALOG.find((r) => r.key === role) ?? ROLE_CATALOG.find((r) => r.key === 'USER')!;
  const rules = ROLE_RULES[role] ?? ROLE_RULES.USER;

  const granted = new Map<Subject, Set<Action>>();
  const add = (subject: Subject, action: Action) => {
    if (!granted.has(subject)) granted.set(subject, new Set());
    granted.get(subject)!.add(action);
  };

  let fullAccess = false;
  for (const [actions, subjects] of rules) {
    const actionList = ([] as Action[]).concat(actions as Action | Action[]);
    const subjectList = ([] as Subject[]).concat(subjects as Subject | Subject[]);
    for (const subject of subjectList) {
      const targets = subject === 'all' ? ALL_SUBJECTS : [subject];
      for (const action of actionList) {
        const expanded = action === 'manage' ? ALL_ACTIONS.filter((a) => a !== 'manage') : [action];
        if (subject === 'all' && action === 'manage') fullAccess = true;
        for (const t of targets) for (const a of expanded) add(t, a);
      }
    }
  }

  const rows: PermissionRow[] = ALL_SUBJECTS
    .filter((s) => granted.has(s))
    .map((s) => ({
      subject: s,
      label: SUBJECT_LABELS[s],
      actions: ALL_ACTIONS.filter((a) => a !== 'manage' && granted.get(s)!.has(a)).map((a) => ({ action: a, label: ACTION_LABELS[a] })),
    }));

  return { role: meta.key, roleLabel: meta.label, description: meta.description, fullAccess, rows };
}
