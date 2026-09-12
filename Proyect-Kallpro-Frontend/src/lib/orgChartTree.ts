export interface OrgEmployee {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  category?: string;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
  managerId?: string | null;
  isActive?: boolean;
}

export interface OrgNode {
  employee: OrgEmployee;
  children: OrgNode[];
}

const sortByName = (a: OrgEmployee, b: OrgEmployee) =>
  `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);

/**
 * Arma el bosque de árboles del organigrama a partir de la lista plana de empleados.
 * Un empleado sin managerId, o cuyo jefe no está en la lista (ej. desactivado), se
 * trata como raíz — así el árbol siempre se puede dibujar aunque falte un eslabón.
 */
export function buildOrgForest(employees: OrgEmployee[]): OrgNode[] {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const childrenMap = new Map<string, OrgEmployee[]>();
  const roots: OrgEmployee[] = [];

  for (const e of employees) {
    if (!e.managerId || !byId.has(e.managerId)) {
      roots.push(e);
    } else {
      const list = childrenMap.get(e.managerId) ?? [];
      list.push(e);
      childrenMap.set(e.managerId, list);
    }
  }

  // ancestry evita un loop infinito si llegaran datos con un ciclo preexistente
  const buildNode = (e: OrgEmployee, ancestry: Set<string>): OrgNode => {
    const kids = (childrenMap.get(e.id) ?? []).filter((c) => !ancestry.has(c.id));
    const nextAncestry = new Set(ancestry).add(e.id);
    return { employee: e, children: kids.sort(sortByName).map((c) => buildNode(c, nextAncestry)) };
  };

  return roots.sort(sortByName).map((e) => buildNode(e, new Set([e.id])));
}

const PALETTE = [
  'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-teal-500',
  'bg-pink-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-rose-500',
];

/** Color determinístico por departamento (mismo id → mismo color siempre). */
export function departmentColor(departmentId?: string | null): string {
  if (!departmentId) return 'bg-surface-400';
  let hash = 0;
  for (let i = 0; i < departmentId.length; i++) hash = (hash * 31 + departmentId.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
