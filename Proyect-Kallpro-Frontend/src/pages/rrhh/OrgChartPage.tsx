import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core';
import { payrollApi } from '../../api/payroll';
import { useToast } from '../../components/ui/Toast';
import { buildOrgForest, departmentColor, OrgEmployee, OrgNode } from '../../lib/orgChartTree';

const CATEGORY_DOT: Record<string, string> = {
  JEFATURA: 'ring-purple-400', ASISTENTE: 'ring-blue-400', SERVICIOS: 'ring-teal-400',
};

const initials = (e: OrgEmployee) => `${e.firstName[0] ?? ''}${e.lastName[0] ?? ''}`.toUpperCase();

function EmployeeCard({ employee, dragging = false, editable = false }: { employee: OrgEmployee; dragging?: boolean; editable?: boolean }) {
  return (
    <div className={`w-52 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft px-3 py-2.5 select-none ${dragging ? 'opacity-90 shadow-lg rotate-1' : ''} ${editable ? 'cursor-grab active:cursor-grabbing' : ''}`}>
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${departmentColor(employee.departmentId)}`} title={employee.department?.name ?? 'Sin departamento'} />
        <div className={`w-8 h-8 rounded-full bg-surface-100 dark:bg-surface-700 flex items-center justify-center text-[11px] font-semibold text-surface-600 dark:text-surface-200 ring-2 ${CATEGORY_DOT[employee.category ?? ''] ?? 'ring-surface-300'} flex-shrink-0`}>
          {initials(employee)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{employee.firstName} {employee.lastName}</p>
          <p className="text-xs text-surface-500 truncate">{employee.position}</p>
        </div>
      </div>
    </div>
  );
}

function TreeNode({ node, collapsed, onToggle, invalidTargets, editable }: {
  node: OrgNode;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  invalidTargets: Set<string>;
  editable: boolean;
}) {
  const { children, employee } = node;
  const id = employee.id;
  const isCollapsed = collapsed.has(id);
  const hasChildren = children.length > 0 && !isCollapsed;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: `emp:${employee.id}`, disabled: !editable });
  const disabled = !editable || invalidTargets.has(employee.id);
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `emp:${employee.id}`, disabled });

  return (
    <div className="flex flex-col items-center">
      <div
        ref={(el) => { setDragRef(el); setDropRef(el); }}
        {...listeners}
        {...attributes}
        className={`relative rounded-xl transition-all ${isOver && !disabled ? 'ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-surface-900' : ''} ${isDragging ? 'opacity-30' : ''}`}
      >
        <EmployeeCard employee={employee} editable={editable} />
        {node.children.length > 0 && (
          <button
            onClick={() => onToggle(id)}
            className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-surface-200 dark:bg-surface-600 text-surface-700 dark:text-surface-200 text-xs leading-5 font-bold hover:bg-brand-500 hover:text-white z-10 print:hidden"
            title={isCollapsed ? 'Expandir equipo' : 'Colapsar equipo'}
          >
            {isCollapsed ? '+' : '−'}
          </button>
        )}
      </div>

      {hasChildren && (
        <>
          <div className="w-px h-6 bg-surface-300 dark:bg-surface-600" />
          <div className="flex">
            {children.map((child, i) => (
              <div key={child.employee.id} className="relative flex flex-col items-center px-4">
                <div
                  className="absolute top-0 h-px bg-surface-300 dark:bg-surface-600"
                  style={{
                    left: i === 0 ? '50%' : 0,
                    right: i === children.length - 1 ? '50%' : 0,
                  }}
                />
                <div className="w-px h-6 bg-surface-300 dark:bg-surface-600" />
                <TreeNode node={child} collapsed={collapsed} onToggle={onToggle} invalidTargets={invalidTargets} editable={editable} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RootDropZone({ active }: { active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'ROOT', disabled: !active });
  if (!active) return null;
  return (
    <div
      ref={setNodeRef}
      className={`mx-auto mb-6 w-64 text-center text-xs font-medium rounded-lg border-2 border-dashed px-4 py-3 transition-colors ${
        isOver ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600' : 'border-surface-300 dark:border-surface-600 text-surface-400'
      }`}
    >
      ⬆ Suelta aquí para quitar el jefe directo (nivel superior)
    </div>
  );
}

/** Devuelve el propio empleado y todos sus descendientes — no pueden ser un destino válido de drop. */
function collectDescendants(employees: OrgEmployee[], rootId: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const e of employees) {
    if (!e.managerId) continue;
    childrenOf.set(e.managerId, [...(childrenOf.get(e.managerId) ?? []), e.id]);
  }
  const result = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const child of childrenOf.get(cur) ?? []) {
      if (!result.has(child)) { result.add(child); stack.push(child); }
    }
  }
  return result;
}

export default function OrgChartPage() {
  const toast = useToast();
  const [saved, setSaved] = useState<OrgEmployee[]>([]);
  const [draft, setDraft] = useState<OrgEmployee[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    payrollApi.getOrgChart()
      .then((res) => { setSaved(res.data.employees); setCanEdit(!!res.data.canEdit); })
      .catch(() => toast.error('Error al cargar el organigrama'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const employees = editing ? draft : saved;
  const forest = useMemo(() => buildOrgForest(employees), [employees]);
  const departments = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((e) => { if (e.departmentId && e.department) map.set(e.departmentId, e.department.name); });
    return Array.from(map.entries());
  }, [employees]);

  const dirtyIds = useMemo(() => {
    if (!editing) return [];
    const byId = new Map(saved.map((e) => [e.id, e.managerId ?? null]));
    return draft.filter((e) => byId.get(e.id) !== (e.managerId ?? null)).map((e) => e.id);
  }, [editing, draft, saved]);

  const draggingEmployeeId = activeId?.replace('emp:', '') ?? null;
  const invalidTargets = useMemo(
    () => (draggingEmployeeId ? collectDescendants(employees, draggingEmployeeId) : new Set<string>()),
    [draggingEmployeeId, employees],
  );
  const activeEmployee = employees.find((e) => e.id === draggingEmployeeId) ?? null;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const employeeId = String(active.id).replace('emp:', '');

    let newManagerId: string | null;
    if (over.id === 'ROOT') {
      newManagerId = null;
    } else {
      newManagerId = String(over.id).replace('emp:', '');
      if (newManagerId === employeeId) return;
    }

    setDraft((prev) => {
      const current = prev.find((emp) => emp.id === employeeId);
      if (!current || (current.managerId ?? null) === newManagerId) return prev;
      return prev.map((emp) => (emp.id === employeeId ? { ...emp, managerId: newManagerId } : emp));
    });
  };

  const startEdit = () => { setDraft(saved); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setDraft(saved); };

  const save = async () => {
    if (dirtyIds.length === 0) { setEditing(false); return; }
    setSaving(true);
    const results = await Promise.allSettled(
      dirtyIds.map((id) => payrollApi.reassignManager(id, draft.find((e) => e.id === id)!.managerId ?? null)),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    setSaving(false);
    if (failed > 0) {
      toast.error(`${failed} de ${dirtyIds.length} cambios no se pudieron guardar (revisa jerarquías circulares)`);
    } else {
      toast.success('Organigrama actualizado');
      setEditing(false);
    }
    load();
  };

  const print = () => window.print();

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🗂️</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Organigrama</h1>
            <p className="text-sm text-surface-500">
              {editing ? 'Modo edición: arrastra una tarjeta sobre otra y presiona Guardar' : canEdit ? 'Presiona Editar para reorganizar' : 'Solo lectura'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={print} className="text-sm px-4 py-2 border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700">
            🖨️ Imprimir
          </button>
          {!editing && (
            <Link to="/nomina/empleados" className="text-sm px-4 py-2 border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700">
              🧑‍💼 Empleados
            </Link>
          )}
          {canEdit && !editing && (
            <button onClick={startEdit} className="text-sm px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium">
              ✏️ Editar
            </button>
          )}
          {editing && (
            <>
              <button onClick={cancelEdit} disabled={saving} className="text-sm px-4 py-2 border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={save} disabled={saving} className="text-sm px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">
                {saving ? 'Guardando…' : `💾 Guardar${dirtyIds.length ? ` (${dirtyIds.length})` : ''}`}
              </button>
            </>
          )}
        </div>
      </div>

      {departments.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6 text-xs text-surface-500 print:hidden">
          {departments.map(([id, name]) => (
            <span key={id} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${departmentColor(id)}`} />
              {name}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-14"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>
      ) : employees.length === 0 ? (
        <div className="text-center py-14 text-surface-400 text-sm">Sin empleados registrados todavía.</div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <RootDropZone active={editing && !!activeId && employees.find((e) => e.id === draggingEmployeeId)?.managerId != null} />
          <div className="overflow-x-auto pb-8">
            <div className="flex justify-center gap-10 min-w-max px-4">
              {forest.map((node) => (
                <TreeNode key={node.employee.id} node={node} collapsed={collapsed} onToggle={(id) => {
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    next.has(id) ? next.delete(id) : next.add(id);
                    return next;
                  });
                }} invalidTargets={invalidTargets} editable={editing} />
              ))}
            </div>
          </div>
          <DragOverlay>{activeEmployee ? <EmployeeCard employee={activeEmployee} dragging editable /> : null}</DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
