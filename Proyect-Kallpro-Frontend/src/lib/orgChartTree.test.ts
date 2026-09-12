import { describe, it, expect } from 'vitest';
import { buildOrgForest, OrgEmployee } from './orgChartTree';

const emp = (id: string, managerId: string | null, firstName = id): OrgEmployee => ({
  id, managerId, firstName, lastName: 'Z', position: 'Cargo',
});

describe('buildOrgForest', () => {
  it('arma un solo árbol cuando hay una única raíz', () => {
    const employees = [emp('ceo', null), emp('vp', 'ceo'), emp('lead', 'vp')];
    const forest = buildOrgForest(employees);
    expect(forest).toHaveLength(1);
    expect(forest[0].employee.id).toBe('ceo');
    expect(forest[0].children[0].employee.id).toBe('vp');
    expect(forest[0].children[0].children[0].employee.id).toBe('lead');
  });

  it('trata como raíz a un empleado cuyo jefe no existe en la lista', () => {
    const employees = [emp('a', 'jefe-inactivo'), emp('b', null)];
    const forest = buildOrgForest(employees);
    expect(forest.map((n) => n.employee.id).sort()).toEqual(['a', 'b']);
  });

  it('agrupa varios hijos bajo el mismo jefe y los ordena por nombre', () => {
    const employees = [emp('ceo', null), emp('zoe', 'ceo', 'Zoe'), emp('ana', 'ceo', 'Ana')];
    const forest = buildOrgForest(employees);
    expect(forest[0].children.map((n) => n.employee.firstName)).toEqual(['Ana', 'Zoe']);
  });

  it('no entra en loop infinito ante un ciclo preexistente en los datos', () => {
    const employees = [emp('a', 'b'), emp('b', 'a')];
    expect(() => buildOrgForest(employees)).not.toThrow();
  });
});
