/**
 * Participación de utilidades (15%): toma los trabajadores de la empresa que tuvieron
 * relación laboral en el año (activos o salidos dentro del año) con sus cargas familiares
 * ya registradas en la ficha (`Employee.familyBurdens`) y aplica el motor puro.
 */
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { PAYROLL_EC } from '../../data/payrollEcuador';
import { computeUtilidades } from './engines/utilidades.engine';

export async function calculateUtilidades(companyId: string, year: number, utilidadLiquida: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw AppError.badRequest('Año inválido', 'VALIDATION_ERROR');
  if (!(utilidadLiquida >= 0)) throw AppError.badRequest('La utilidad líquida debe ser un número mayor o igual a cero', 'VALIDATION_ERROR');

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
  const employees = await prisma.employee.findMany({
    where: { companyId, hireDate: { lte: yearEnd }, OR: [{ terminationDate: null }, { terminationDate: { gte: yearStart } }] },
    select: { id: true, firstName: true, lastName: true, hireDate: true, terminationDate: true, familyBurdens: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  return computeUtilidades({
    year, utilidadLiquida, sbu: PAYROLL_EC.SBU,
    workers: employees.map((e) => ({ employeeId: e.id, name: `${e.firstName} ${e.lastName}`, hireDate: e.hireDate, terminationDate: e.terminationDate, familyBurdens: e.familyBurdens })),
  });
}
