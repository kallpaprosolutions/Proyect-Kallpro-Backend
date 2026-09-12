import { useState } from 'react';
import PageHeader from '../../../components/ui/PageHeader';
import StagesTab from './StagesTab';
import ScoringTab from './ScoringTab';
import FormsTab from './FormsTab';
import AssignmentTab from './AssignmentTab';
import AgentsTab from './AgentsTab';
import { Target, BarChart3, FileText, Shuffle, Bot, Settings } from 'lucide-react';

const TABS = [
  { id: 'stages', label: 'Etapas', icon: <Target className="w-4 h-4" />, help: 'Probabilidad y categoría de pronóstico por etapa' },
  { id: 'scoring', label: 'Puntaje de leads', icon: <BarChart3 className="w-4 h-4" />, help: 'Reglas de perfil, interacción y penalización' },
  { id: 'forms', label: 'Formularios', icon: <FileText className="w-4 h-4" />, help: 'Captura desde tu sitio web' },
  { id: 'assignment', label: 'Asignación', icon: <Shuffle className="w-4 h-4" />, help: 'A quién le llega cada lead' },
  { id: 'agents', label: 'Agentes IA', icon: <Bot className="w-4 h-4" />, help: 'Instrucciones, modelo y autonomía' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function CrmSettingsPage() {
  const [tab, setTab] = useState<TabId>('stages');
  const active = TABS.find(t => t.id === tab)!;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Configuración del CRM"
        subtitle={active.help}
        icon={<Settings className="w-5 h-5" />}
      />

      <div
        role="tablist"
        aria-label="Secciones de configuración del CRM"
        className="flex flex-wrap gap-1 mb-6 border-b border-surface-200 dark:border-surface-700"
      >
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={[
              'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors -mb-px border-b-2',
              tab === t.id
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200',
            ].join(' ')}
          >
            <span className="inline-flex items-center gap-1.5">{t.icon}{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'stages' && <StagesTab />}
      {tab === 'scoring' && <ScoringTab />}
      {tab === 'forms' && <FormsTab />}
      {tab === 'assignment' && <AssignmentTab />}
      {tab === 'agents' && <AgentsTab />}
    </div>
  );
}
