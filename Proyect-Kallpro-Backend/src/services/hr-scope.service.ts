import { prisma } from '../lib/prisma';

const HR_FULL_ACCESS_ROLES = ['TTHH', 'ADMIN'];

export function hasFullHrAccess(role: string): boolean {
  return HR_FULL_ACCESS_ROLES.includes(role);
}

/**
 * Resuelve qué `employeeId`s puede ver un usuario en el calendario:
 *  - TTHH/ADMIN: todos (null = sin filtro).
 *  - Jefatura: su propio registro + el de sus reportes directos.
 *  - Colaborador: solo el propio.
 * Devuelve `null` cuando no debe filtrarse (ve todo) o un array de ids (puede ser vacío
 * si el usuario no tiene `Employee` vinculado).
 */
export async function resolveVisibleEmployeeIds(companyId: string, userId: string, role: string): Promise<string[] | null> {
  if (hasFullHrAccess(role)) return null;

  const me = await prisma.employee.findFirst({
    where: { companyId, userId },
    include: { directReports: { select: { id: true } } },
  });
  if (!me) return [];
  return [me.id, ...me.directReports.map((r) => r.id)];
}

/** El `Employee.id` vinculado al usuario actual (propio registro), o null si no tiene uno. */
export async function getOwnEmployeeId(companyId: string, userId: string): Promise<string | null> {
  const me = await prisma.employee.findFirst({ where: { companyId, userId }, select: { id: true } });
  return me?.id ?? null;
}
