import { create } from 'zustand';

interface Deal {
  id: string;
  title: string;
  stage: string;
  value: number;
  contactId: string;
  crmCompanyId?: string;
  contact?: { firstName: string; lastName?: string };
  crmCompany?: { name: string };
  probability?: number;
  updatedAt?: string;
}

interface Conversation {
  id: string;
  contactId: string;
  channel: string;
  status: string;
  contact?: { firstName: string; lastName?: string; phone?: string };
  messages?: any[];
}

interface AgentStatus {
  code: string;
  isRunning: boolean;
  lastRun?: string;
}

interface CrmState {
  // Pipeline
  deals: Deal[];
  setDeals: (deals: Deal[]) => void;
  optimisticDealMove: (dealId: string, newStage: string) => void;
  revertDealMove: (dealId: string, oldStage: string) => void;
  updateDeal: (dealId: string, updates: Partial<Deal>) => void;

  // Inbox
  conversations: Conversation[];
  setConversations: (conversations: Conversation[]) => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;

  // Agents
  agentStatuses: Record<string, AgentStatus>;
  setAgentStatus: (code: string, status: Partial<AgentStatus>) => void;

  // Pipeline view
  pipelineView: 'kanban' | 'list';
  setPipelineView: (view: 'kanban' | 'list') => void;

  // Global loading
  isLoading: boolean;
  setLoading: (v: boolean) => void;
}

export const useCrmStore = create<CrmState>((set, _get) => ({
  // Pipeline
  deals: [],
  setDeals: (deals) => set({ deals }),
  optimisticDealMove: (dealId, newStage) => {
    set(state => ({
      deals: state.deals.map(d => d.id === dealId ? { ...d, stage: newStage } : d),
    }));
  },
  revertDealMove: (dealId, oldStage) => {
    set(state => ({
      deals: state.deals.map(d => d.id === dealId ? { ...d, stage: oldStage } : d),
    }));
  },
  updateDeal: (dealId, updates) => {
    set(state => ({
      deals: state.deals.map(d => d.id === dealId ? { ...d, ...updates } : d),
    }));
  },

  // Inbox
  conversations: [],
  setConversations: (conversations) => set({ conversations }),
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),

  // Agents
  agentStatuses: {},
  setAgentStatus: (code, status) =>
    set(state => ({
      agentStatuses: {
        ...state.agentStatuses,
        [code]: { ...state.agentStatuses[code], code, ...status },
      },
    })),

  // Pipeline view
  pipelineView: 'kanban',
  setPipelineView: (view) => set({ pipelineView: view }),

  // Loading
  isLoading: false,
  setLoading: (v) => set({ isLoading: v }),
}));
