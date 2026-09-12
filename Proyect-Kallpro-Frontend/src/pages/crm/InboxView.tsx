import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmApi } from '../../api/crm';
import { useCrmStore } from '../../store/crm.store';
import { AIApprovalCard } from '../../components/crm/AIApprovalCard';
import { LeadScoreGauge } from '../../components/crm/LeadScoreGauge';

const CHANNEL_ICONS: Record<string, string> = {
  WHATSAPP: '💚',
  TELEGRAM: '💙',
  GMAIL: '🔴',
  INTERNAL: '⚪',
  PHONE: '📞',
};

function MessageBubble({ msg }: { msg: any }) {
  const isOutbound = msg.direction === 'outbound' || msg.direction === 'OUTBOUND';
  const channelIcon = CHANNEL_ICONS[msg.channel?.toUpperCase()] ?? '⚪';

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-xs md:max-w-md rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
          isOutbound
            ? msg.isAI
              ? 'bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100'
              : 'bg-brand-500 text-white'
            : 'bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 text-surface-800 dark:text-white'
        }`}
      >
        {msg.isAI && (
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">🤖 {msg.agentCode ?? 'IA'}</p>
        )}
        <p className="leading-relaxed">{msg.body}</p>
        <div className={`flex items-center gap-1 mt-1 ${isOutbound && !msg.isAI ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs">{channelIcon}</span>
          <span className={`text-xs ${isOutbound && !msg.isAI ? 'text-brand-200' : 'text-surface-400'}`}>
            {new Date(msg.sentAt ?? msg.createdAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {msg.requiresApproval && <span className="text-xs text-amber-500">⏳</span>}
        </div>
      </div>
    </div>
  );
}

export default function InboxView() {
  const queryClient = useQueryClient();
  const { activeConversationId, setActiveConversationId } = useCrmStore();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: convList } = useQuery({
    queryKey: ['crm-conversations'],
    queryFn: () => crmApi.listConversations({ limit: 50 }).then(r => r.data.conversations),
    refetchInterval: 10000,
  });

  const { data: thread } = useQuery({
    queryKey: ['crm-thread', activeConversationId],
    queryFn: () => crmApi.getThread(activeConversationId!).then(r => r.data),
    enabled: !!activeConversationId,
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) => crmApi.addMessage(activeConversationId!, body, 'OUTBOUND', 'INTERNAL'),
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['crm-thread', activeConversationId] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (messageId: string) => crmApi.approveMessage(activeConversationId!, messageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-thread', activeConversationId] }),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages]);

  const pendingMessages = thread?.messages?.filter((m: any) => m.requiresApproval) ?? [];
  const contact = thread?.contact;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px - 48px)' }}>
      {/* Mini header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-lg">📥</div>
        <div>
          <h1 className="text-lg font-semibold text-surface-900 dark:text-white">Bandeja de Entrada</h1>
          <p className="text-xs text-surface-500">{convList?.length ?? 0} conversaciones activas</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 shadow-soft">
        {/* Left: Conversation list */}
        <div className="w-72 border-r border-surface-200 dark:border-surface-700 overflow-y-auto shrink-0">
          {convList?.map((conv: any) => (
            <div
              key={conv.id}
              onClick={() => setActiveConversationId(conv.id)}
              className={`p-3.5 border-b border-surface-100 dark:border-surface-700 cursor-pointer transition-colors ${
                activeConversationId === conv.id
                  ? 'bg-brand-50 dark:bg-brand-900/20 border-l-2 border-l-brand-500'
                  : 'hover:bg-surface-50 dark:hover:bg-surface-700/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">{CHANNEL_ICONS[conv.channel] ?? '⚪'}</span>
                  <div>
                    <p className="text-sm font-semibold text-surface-800 dark:text-white leading-tight">
                      {conv.contact?.firstName} {conv.contact?.lastName ?? ''}
                    </p>
                    <p className="text-xs text-surface-400">{conv.contact?.phoneE164 ?? conv.contact?.phone}</p>
                  </div>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  conv.status === 'OPEN' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300' :
                  conv.status === 'PENDING' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300' :
                  'bg-surface-100 dark:bg-surface-700 text-surface-500'
                }`}>
                  {conv.status}
                </span>
              </div>
              {conv.messages?.[0] && (
                <p className="text-xs text-surface-500 mt-1.5 truncate">{conv.messages[0].body}</p>
              )}
            </div>
          ))}
          {(!convList || convList.length === 0) && (
            <div className="p-6 text-center text-surface-400 text-sm">Sin conversaciones</div>
          )}
        </div>

        {/* Center: Thread */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeConversationId && thread ? (
            <>
              {/* Thread header */}
              <div className="border-b border-surface-200 dark:border-surface-700 px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-300 font-bold text-sm">
                  {contact?.firstName?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="font-semibold text-surface-800 dark:text-white text-sm">
                    {contact?.firstName} {contact?.lastName ?? ''}
                  </p>
                  <p className="text-xs text-surface-500">{contact?.crmCompany?.legalName ?? contact?.crmCompany?.name}</p>
                </div>
              </div>

              {/* Pending approvals */}
              {pendingMessages.length > 0 && (
                <div className="px-4 py-3 space-y-2 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">⏳ {pendingMessages.length} mensaje(s) pendiente(s)</p>
                  {pendingMessages.map((msg: any) => (
                    <AIApprovalCard
                      key={msg.id}
                      messageId={msg.id}
                      conversationId={activeConversationId}
                      agentCode={msg.agentCode}
                      preview={msg.body}
                      onApprove={(id) => approveMutation.mutate(id)}
                      onReject={(_id) => {}}
                    />
                  ))}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 bg-surface-50 dark:bg-surface-900/30">
                {thread.messages?.map((msg: any) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-surface-200 dark:border-surface-700 p-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && newMessage.trim() && sendMutation.mutate(newMessage)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    onClick={() => newMessage.trim() && sendMutation.mutate(newMessage)}
                    disabled={!newMessage.trim() || sendMutation.isPending}
                    className="px-4 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
                  >
                    ➤
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-surface-400">
              <div className="text-center">
                <p className="text-4xl mb-2">💬</p>
                <p className="text-sm">Selecciona una conversación</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Contact panel */}
        {contact && (
          <div className="w-64 border-l border-surface-200 dark:border-surface-700 overflow-y-auto shrink-0 p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-surface-700 dark:text-surface-300 text-xs uppercase tracking-wide mb-2">👤 Perfil</h3>
              <p className="text-sm font-bold text-surface-900 dark:text-white">{contact.firstName} {contact.lastName ?? ''}</p>
              {contact.title && <p className="text-xs text-surface-500">{contact.title}</p>}
              {contact.email && <p className="text-xs text-surface-400 mt-1">{contact.email}</p>}
              {contact.phoneE164 && <p className="text-xs text-surface-400">{contact.phoneE164}</p>}
            </div>

            {contact.crmCompany && (
              <div>
                <h3 className="font-semibold text-surface-700 dark:text-surface-300 text-xs uppercase tracking-wide mb-2">🏢 Empresa</h3>
                <p className="text-sm font-medium text-surface-700 dark:text-surface-200">{contact.crmCompany.legalName ?? contact.crmCompany.name}</p>
                {contact.crmCompany.industry && <p className="text-xs text-surface-400">{contact.crmCompany.industry}</p>}
              </div>
            )}

            {contact.leadScores?.[0] && (
              <div>
                <h3 className="font-semibold text-surface-700 dark:text-surface-300 text-xs uppercase tracking-wide mb-2">🎯 Lead Score</h3>
                <LeadScoreGauge
                  score={contact.leadScores[0].totalScore ?? 0}
                  bant={{
                    budget: contact.leadScores[0].budgetScore ?? 0,
                    authority: contact.leadScores[0].authorityScore ?? 0,
                    need: contact.leadScores[0].needScore ?? 0,
                    timeline: contact.leadScores[0].timelineScore ?? 0,
                  }}
                  size="sm"
                />
              </div>
            )}

            {contact.deals?.length > 0 && (
              <div>
                <h3 className="font-semibold text-surface-700 dark:text-surface-300 text-xs uppercase tracking-wide mb-2">💼 Deals</h3>
                {contact.deals.map((d: any) => (
                  <div key={d.id} className="text-xs border border-surface-200 dark:border-surface-700 rounded-lg p-2 mb-1.5 bg-surface-50 dark:bg-surface-700/50">
                    <p className="font-medium text-surface-700 dark:text-surface-200">{d.name ?? d.title}</p>
                    <p className="text-surface-500">${Number(d.amountUsd ?? d.value ?? 0).toLocaleString()} · {d.stage}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
