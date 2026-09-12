import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { crmApi } from '../../api/crm';
import { useCrmStore } from '../../store/crm.store';
import { DealCard } from '../../components/crm/DealCard';

const STAGES = [
  { id: 'LEAD', label: '🌱 Lead', color: '#6b7280' },
  { id: 'QUALIFIED', label: '✅ Calificado', color: '#3b82f6' },
  { id: 'PROPOSAL', label: '📄 Propuesta', color: '#8b5cf6' },
  { id: 'NEGOTIATION', label: '🤝 Negociación', color: '#f59e0b' },
  { id: 'WON', label: '🏆 Ganado', color: '#10b981' },
  { id: 'LOST', label: '❌ Perdido', color: '#ef4444' },
];

function SortableDealCard({ deal }: { deal: any }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DealCard deal={deal} isDragging={isDragging} />
    </div>
  );
}

function KanbanColumn({ stage, deals }: { stage: typeof STAGES[0]; deals: any[] }) {
  const totalValue = deals.reduce((s, d) => s + Number(d.amountUsd ?? d.value ?? 0), 0);
  return (
    <div className="flex flex-col min-w-64 w-64 bg-surface-100 dark:bg-surface-800/60 rounded-xl border border-surface-200 dark:border-surface-700">
      <div className="p-3 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-surface-700 dark:text-surface-200">{stage.label}</span>
          <span className="text-xs bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300 px-2 py-0.5 rounded-full font-medium">{deals.length}</span>
        </div>
        <p className="text-xs text-surface-400">${(totalValue / 1000).toFixed(0)}K total</p>
      </div>
      <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-2 space-y-2 min-h-20 overflow-y-auto max-h-screen">
          {deals.map(deal => (
            <SortableDealCard key={deal.id} deal={deal} />
          ))}
          {deals.length === 0 && (
            <div className="text-center py-6 text-xs text-gray-400">Sin deals</div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function PipelineView() {
  const queryClient = useQueryClient();
  const { deals, setDeals, optimisticDealMove, revertDealMove } = useCrmStore();
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['crm-deals-pipeline'],
    queryFn: () => crmApi.listDeals({ limit: 200 }).then(r => r.data.deals),
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (data) setDeals(data);
  }, [data, setDeals]);

  const stageMutation = useMutation({
    mutationFn: ({ dealId, stage }: { dealId: string; stage: string }) =>
      crmApi.updateDealStage(dealId, stage),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-deals-pipeline'] }),
    onError: (_, { dealId }) => {
      const original = data?.find((d: any) => d.id === dealId);
      if (original) revertDealMove(dealId, original.stage);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const dealId = String(active.id);
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    // Determine target stage from over.id (could be a deal or a column)
    const overDeal = deals.find(d => d.id === String(over.id));
    const newStage = overDeal ? overDeal.stage : String(over.id);

    if (newStage === deal.stage || !STAGES.find(s => s.id === newStage)) return;

    optimisticDealMove(dealId, newStage);
    stageMutation.mutate({ dealId, stage: newStage });
  };

  const activeDeal = deals.find(d => d.id === activeId);

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🎯</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Pipeline de Ventas</h1>
            <p className="text-sm text-surface-500">{deals.length} deals · Arrastra para mover entre etapas</p>
          </div>
        </div>
      </div>

      <div className="-mx-6 px-6 pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map(stage => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                deals={deals.filter(d => d.stage === stage.id)}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDeal && <DealCard deal={activeDeal} isDragging />}
          </DragOverlay>
        </DndContext>
        </div>
    </div>
  );
}
