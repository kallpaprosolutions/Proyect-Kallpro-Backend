import { useMemo } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  strokeWidth?: number;
  className?: string;
}

export default function Sparkline({
  data,
  width = 80,
  height = 28,
  color = '#06b6d4',
  fillOpacity = 0.15,
  strokeWidth = 1.5,
  className = '',
}: SparklineProps) {
  const path = useMemo(() => {
    if (!data.length) return { line: '', area: '' };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pad = 2;
    const w = width - pad * 2;
    const h = height - pad * 2;

    const points = data.map((v, i) => ({
      x: pad + (i / Math.max(data.length - 1, 1)) * w,
      y: pad + h - ((v - min) / range) * h,
    }));

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${points[points.length - 1].x.toFixed(1)},${height} L${points[0].x.toFixed(1)},${height} Z`;

    return { line, area };
  }, [data, width, height]);

  if (!data.length) return null;

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      <path d={path.area} fill={color} opacity={fillOpacity} />
      <path d={path.line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
