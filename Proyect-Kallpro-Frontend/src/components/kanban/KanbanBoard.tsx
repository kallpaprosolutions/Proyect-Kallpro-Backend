import React from 'react';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Tablero kanban genérico reutilizable (extraído del Pipeline CRM).
 *
 * A diferencia del Pipeline, cada columna es un `useDroppable` explícito: soltar sobre una
 * columna vacía (sin tarjetas) también funciona — en el Pipeline original solo las tarjetas
 * eran droppables, así que una columna vacía no podía recibir nada.
 *
 * `column.droppable === false` deshabilita el drop en esa columna (para estados derivados
 * automáticamente por el backend, o que exigen un formulario en vez de un simple cambio de
 * estado — no todas las transiciones de negocio deben simplificarse a un drag).
 */
export interface KanbanColumnDef {
  id: string;
  label: string;
  color?: string;
  droppable?: boolean;
  hint?: string; // tooltip para columnas no-droppable, explica por qué
}

interface KanbanBoardProps<T> {
  columns: KanbanColumnDef[];
  items: T[];
  getId: (item: T) => string;
  getColumnId: (item: T) => string;
  renderCard: (item: T, isDragging: boolean) => React.ReactNode;
  onMove: (item: T, toColumnId: string) => void;
  renderColumnFooter?: (columnId: string, items: T[]) => React.ReactNode;
  emptyLabel?: string;
}

function SortableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function KanbanColumn<T>({
  column, items, getId, renderCard, renderColumnFooter, emptyLabel,
}: {
  column: KanbanColumnDef;
  items: T[];
  getId: (item: T) => string;
  renderCard: (item: T, isDragging: boolean) => React.ReactNode;
  renderColumnFooter?: (columnId: string, items: T[]) => React.ReactNode;
  emptyLabel?: string;
}) {
  const droppable = column.droppable !== false;
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled: !droppable });

  return (
    <div
      className={`flex flex-col min-w-72 w-72 rounded-xl border transition-colors ${
        isOver && droppable
          ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-700'
          : 'bg-surface-100 dark:bg-surface-800/60 border-surface-200 dark:border-surface-700'
      }`}
      title={!droppable ? column.hint : undefined}
    >
      <div className="p-3 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-surface-700 dark:text-surface-200 flex items-center gap-1">
            {column.label}
            {!droppable && <span className="text-surface-400" title={column.hint}>🔒</span>}
          </span>
          <span className="text-xs bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300 px-2 py-0.5 rounded-full font-medium">
            {items.length}
          </span>
        </div>
        {renderColumnFooter && <div className="text-xs text-surface-400">{renderColumnFooter(column.id, items)}</div>}
      </div>
      <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex-1 p-2 space-y-2 min-h-24 overflow-y-auto max-h-[70vh]">
          {items.map((item) => (
            <SortableCard key={getId(item)} id={getId(item)}>
              {renderCard(item, false)}
            </SortableCard>
          ))}
          {items.length === 0 && (
            <div className="text-center py-6 text-xs text-surface-400">{emptyLabel ?? 'Sin elementos'}</div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function KanbanBoard<T>({
  columns, items, getId, getColumnId, renderCard, onMove, renderColumnFooter, emptyLabel,
}: KanbanBoardProps<T>) {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const columnIds = React.useMemo(() => new Set(columns.map((c) => c.id)), [columns]);
  const droppableColumnIds = React.useMemo(
    () => new Set(columns.filter((c) => c.droppable !== false).map((c) => c.id)),
    [columns],
  );

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const item = items.find((it) => getId(it) === String(active.id));
    if (!item) return;

    const overId = String(over.id);
    // over.id puede ser el id de una columna (drop directo) o el id de otra tarjeta
    // (se toma la columna de esa tarjeta como destino).
    let targetColumnId: string;
    if (columnIds.has(overId)) {
      targetColumnId = overId;
    } else {
      const overItem = items.find((it) => getId(it) === overId);
      if (!overItem) return;
      targetColumnId = getColumnId(overItem);
    }

    const currentColumnId = getColumnId(item);
    if (targetColumnId === currentColumnId) return;
    if (!droppableColumnIds.has(targetColumnId)) return;

    onMove(item, targetColumnId);
  };

  const activeItem = items.find((it) => getId(it) === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            items={items.filter((it) => getColumnId(it) === column.id)}
            getId={getId}
            renderCard={renderCard}
            renderColumnFooter={renderColumnFooter}
            emptyLabel={emptyLabel}
          />
        ))}
      </div>
      <DragOverlay>
        {activeItem ? renderCard(activeItem, true) : null}
      </DragOverlay>
    </DndContext>
  );
}
