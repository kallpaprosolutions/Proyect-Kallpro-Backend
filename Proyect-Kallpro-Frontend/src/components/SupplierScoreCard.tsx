interface Score {
  priceScore: number;
  deliveryScore: number;
  qualityScore: number;
  complianceScore: number;
  totalScore: number;
  recordsCount: number;
}

interface Props {
  score: Score;
  compact?: boolean;
}

function ScoreCircle({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 20;
  const circ   = 2 * Math.PI * radius;
  const fill   = (value / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={radius} fill="none" stroke="#374151" strokeWidth="5" />
        <circle
          cx="26" cy="26" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 26 26)"
        />
        <text x="26" y="31" textAnchor="middle" fontSize="11" fontWeight="bold" fill="white">
          {Math.round(value)}
        </text>
      </svg>
      <span className="text-xs text-gray-500 text-center leading-tight">{label}</span>
    </div>
  );
}

function scoreColor(val: number) {
  if (val >= 75) return '#22c55e'; // green
  if (val >= 50) return '#eab308'; // yellow
  return '#ef4444';                // red
}

function scoreBadge(val: number) {
  if (val >= 75) return 'bg-green-900/40 text-green-400 border-green-800';
  if (val >= 50) return 'bg-yellow-900/40 text-yellow-400 border-yellow-800';
  return 'bg-red-900/40 text-red-400 border-red-800';
}

export default function SupplierScoreCard({ score, compact = false }: Props) {
  const total = Math.round(score.totalScore);

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${scoreBadge(total)}`}>
        ★ {total}
        {score.recordsCount === 0 && <span className="opacity-60 ml-1">(nuevo)</span>}
      </span>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-gray-500 uppercase">Score General</p>
          <p className={`text-3xl font-bold mt-0.5 ${total >= 75 ? 'text-green-400' : total >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {total}
            <span className="text-base font-normal text-gray-500">/100</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Registros</p>
          <p className="text-lg font-bold text-white">{score.recordsCount}</p>
          {score.recordsCount === 0 && (
            <p className="text-xs text-gray-600">sin historial</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <ScoreCircle value={score.priceScore}      label="Precio"     color={scoreColor(score.priceScore)} />
        <ScoreCircle value={score.deliveryScore}   label="Entrega"    color={scoreColor(score.deliveryScore)} />
        <ScoreCircle value={score.qualityScore}    label="Calidad"    color={scoreColor(score.qualityScore)} />
        <ScoreCircle value={score.complianceScore} label="Compliance" color={scoreColor(score.complianceScore)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
        <div className="flex justify-between text-gray-400">
          <span>Peso precio:</span><span>30%</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Peso entrega:</span><span>25%</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Peso calidad:</span><span>25%</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Peso compliance:</span><span>20%</span>
        </div>
      </div>
    </div>
  );
}
