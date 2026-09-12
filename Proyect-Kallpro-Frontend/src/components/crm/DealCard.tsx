import React from 'react';

interface DealCardProps {
  deal: {
    id: string;
    name?: string;
    title?: string;
    amountUsd?: number;
    value?: number;
    stage: string;
    probability?: number;
    updatedAt?: string;
    contact?: { firstName: string; lastName?: string };
    crmCompany?: { legalName?: string; name?: string };
  };
  isDragging?: boolean;
  onClick?: (dealId: string) => void;
}

function getDaysStale(updatedAt?: string): number {
  if (!updatedAt) return 0;
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000);
}

function getTemperatureConfig(days: number) {
  if (days <= 3) return { label: '🔥 Hot', color: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-300' };
  if (days <= 10) return { label: '🌡️ Warm', color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-300' };
  return { label: '❄️ Cold', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300' };
}

export const DealCard: React.FC<DealCardProps> = ({ deal, isDragging, onClick }) => {
  const days = getDaysStale(deal.updatedAt);
  const temp = getTemperatureConfig(days);
  const rawValue = deal.amountUsd ?? deal.value ?? 0;
  const valueStr = rawValue >= 1000 ? `$${(rawValue / 1000).toFixed(0)}K` : `$${rawValue.toLocaleString()}`;
  const displayName = deal.name ?? deal.title ?? 'Sin nombre';
  const companyName = deal.crmCompany?.legalName ?? deal.crmCompany?.name;

  return (
    <div
      className={[
        'bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700',
        'p-3 cursor-grab shadow-soft hover:shadow-card transition-all',
        isDragging ? 'opacity-50 rotate-2 shadow-card-hover cursor-grabbing' : '',
      ].join(' ')}
      onClick={() => onClick?.(deal.id)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-surface-800 dark:text-white leading-tight line-clamp-2">{displayName}</h4>
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0 ${temp.color}`}>
          {temp.label}
        </span>
      </div>

      {companyName && (
        <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">🏢 {companyName}</p>
      )}
      {deal.contact && (
        <p className="text-xs text-surface-400 mb-2">
          👤 {deal.contact.firstName} {deal.contact.lastName ?? ''}
        </p>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-surface-100 dark:border-surface-700">
        <span className="text-sm font-bold text-surface-900 dark:text-white">{valueStr}</span>
        <div className="flex items-center gap-2">
          {deal.probability !== undefined && (
            <span className="text-xs text-surface-400">{deal.probability}%</span>
          )}
          <span className="text-xs text-surface-400">{days}d</span>
        </div>
      </div>
    </div>
  );
};

export default DealCard;
