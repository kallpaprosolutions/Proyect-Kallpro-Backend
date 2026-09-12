import React from 'react';

interface LeadScoreGaugeProps {
  score: number;
  bant?: {
    budget?: number;
    authority?: number;
    need?: number;
    timeline?: number;
  };
  size?: 'sm' | 'md' | 'lg';
}

export const LeadScoreGauge: React.FC<LeadScoreGaugeProps> = ({ score, bant, size = 'md' }) => {
  const getColor = (s: number) => s >= 70 ? '#10b981' : s >= 40 ? '#f59e0b' : '#ef4444';
  const getLabel = (s: number) => s >= 70 ? 'Calificado' : s >= 40 ? 'Potencial' : 'Frío';

  const color = getColor(score);
  const label = getLabel(score);

  const radius = size === 'sm' ? 28 : size === 'lg' ? 48 : 38;
  const stroke = size === 'sm' ? 5 : size === 'lg' ? 8 : 6;
  const svgSize = (radius + stroke) * 2 + 8;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * (score / 100);
  const fontSize = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;

  const BANT_LABELS = ['Budget', 'Authority', 'Need', 'Timeline'];
  const bantValues = bant ? [bant.budget ?? 0, bant.authority ?? 0, bant.need ?? 0, bant.timeline ?? 0] : null;

  return (
    <div className="flex items-center gap-4">
      {/* Gauge */}
      <div className="flex flex-col items-center">
        <svg width={svgSize} height={svgSize} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={stroke}
          />
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${filled} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: 'all 0.5s ease' }}
          />
        </svg>
        <div className="relative -mt-10 flex flex-col items-center">
          <span className="font-black" style={{ fontSize, color }}>{score}</span>
          <span className="text-xs font-medium" style={{ color }}>{label}</span>
        </div>
      </div>

      {/* BANT breakdown */}
      {bantValues && (
        <div className="flex-1 space-y-1">
          {BANT_LABELS.map((lbl, i) => (
            <div key={lbl} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-16">{lbl}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: `${bantValues[i]}%`, backgroundColor: getColor(bantValues[i]) }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600 w-7 text-right">{bantValues[i]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LeadScoreGauge;
