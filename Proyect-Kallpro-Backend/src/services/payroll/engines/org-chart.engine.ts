export interface OrgEmployeeRef {
  id: string;
  managerId?: string | null;
}

/**
 * El organigrama visual permite arrastrar cualquier tarjeta sobre cualquier otra para
 * reasignar jefe directo, así que este es el único punto que evita que un jefe termine
 * reportando (directa o indirectamente) a su propio subordinado.
 */
export function wouldCreateCycle(employees: OrgEmployeeRef[], employeeId: string, newManagerId: string): boolean {
  if (employeeId === newManagerId) return true;
  const byId = new Map(employees.map((e) => [e.id, e]));
  const visited = new Set<string>();
  let currentId: string | null | undefined = newManagerId;
  while (currentId) {
    if (currentId === employeeId) return true;
    if (visited.has(currentId)) return false; // ciclo preexistente ajeno a este cambio
    visited.add(currentId);
    currentId = byId.get(currentId)?.managerId ?? null;
  }
  return false;
}
