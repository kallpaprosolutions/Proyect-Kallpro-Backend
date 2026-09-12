import { wouldCreateCycle, OrgEmployeeRef } from '../src/services/payroll/engines/org-chart.engine';

describe('org-chart.engine — wouldCreateCycle', () => {
  // CEO(1) -> Gerente(2) -> Jefe(3) -> Asistente(4)
  const employees: OrgEmployeeRef[] = [
    { id: '1', managerId: null },
    { id: '2', managerId: '1' },
    { id: '3', managerId: '2' },
    { id: '4', managerId: '3' },
  ];

  it('rechaza que un empleado sea su propio jefe', () => {
    expect(wouldCreateCycle(employees, '2', '2')).toBe(true);
  });

  it('rechaza asignar como jefe a un subordinado directo', () => {
    // Gerente(2) no puede reportar a su propio subordinado directo Jefe(3)
    expect(wouldCreateCycle(employees, '2', '3')).toBe(true);
  });

  it('rechaza asignar como jefe a un subordinado indirecto (varios niveles)', () => {
    // CEO(1) no puede reportar al Asistente(4), que depende de él tres niveles abajo
    expect(wouldCreateCycle(employees, '1', '4')).toBe(true);
  });

  it('permite mover a un empleado bajo un jefe que no es su descendiente', () => {
    // Asistente(4) puede pasar a reportar directo al CEO(1)
    expect(wouldCreateCycle(employees, '4', '1')).toBe(false);
  });

  it('permite reasignar entre ramas sin relación', () => {
    const withBranch: OrgEmployeeRef[] = [...employees, { id: '5', managerId: '1' }];
    // Empleado(5) es hermano de Gerente(2), no hay relación ascendente/descendente con Jefe(3)
    expect(wouldCreateCycle(withBranch, '5', '3')).toBe(false);
  });

  it('no revienta ante un ciclo preexistente ajeno al cambio evaluado', () => {
    const broken: OrgEmployeeRef[] = [
      { id: 'a', managerId: 'b' },
      { id: 'b', managerId: 'a' },
      { id: 'c', managerId: null },
    ];
    expect(wouldCreateCycle(broken, 'c', 'a')).toBe(false);
  });
});
