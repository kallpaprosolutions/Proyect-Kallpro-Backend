import React, { useState } from 'react';

interface AIApprovalCardProps {
  messageId: string;
  conversationId: string;
  agentCode?: string;
  preview: string;
  reasoning?: string;
  onApprove: (messageId: string) => void;
  onReject: (messageId: string) => void;
  onEdit?: (messageId: string, newText: string) => void;
}

const AGENT_NAMES: Record<string, string> = {
  router: 'Router IA',
  sdr: 'Sofía SDR',
  researcher: 'Iván Researcher',
  copywriter: 'Camila Copywriter',
  closer: 'Andrés Closer',
  success: 'Lucía Success',
};

export const AIApprovalCard: React.FC<AIApprovalCardProps> = ({
  messageId,
  agentCode,
  preview,
  reasoning,
  onApprove,
  onReject,
  onEdit,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(preview);

  const agentName = agentCode ? AGENT_NAMES[agentCode] ?? agentCode : 'Agente IA';

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🤖</span>
        <div>
          <p className="text-xs font-semibold text-amber-700">{agentName} · Requiere aprobación</p>
          {reasoning && (
            <p className="text-xs text-amber-600 mt-0.5">{reasoning}</p>
          )}
        </div>
      </div>

      {isEditing ? (
        <textarea
          value={editedText}
          onChange={e => setEditedText(e.target.value)}
          className="w-full text-sm border border-amber-300 rounded-lg p-2.5 bg-white resize-none h-24 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      ) : (
        <p className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-amber-200">
          {preview}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => {
            if (isEditing && onEdit) {
              onEdit(messageId, editedText);
              setIsEditing(false);
            } else {
              onApprove(messageId);
            }
          }}
          className="flex-1 bg-emerald-600 text-white text-sm py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
        >
          {isEditing ? '✅ Aprobar con edición' : '✅ Aprobar'}
        </button>
        {!isEditing && onEdit && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 bg-white border border-amber-300 text-amber-700 text-sm py-2 rounded-lg font-medium hover:bg-amber-100 transition-colors"
          >
            ✏️
          </button>
        )}
        {isEditing && (
          <button
            onClick={() => { setIsEditing(false); setEditedText(preview); }}
            className="px-3 bg-white border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ✕
          </button>
        )}
        <button
          onClick={() => onReject(messageId)}
          className="px-3 bg-white border border-red-200 text-red-600 text-sm py-2 rounded-lg font-medium hover:bg-red-50 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default AIApprovalCard;
