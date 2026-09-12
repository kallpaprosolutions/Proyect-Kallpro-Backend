import React, { useCallback, useState } from 'react';

interface DCFSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  description?: string;
  onChange: (value: number) => void;
}

export const DCFSlider: React.FC<DCFSliderProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit = '%',
  description,
  onChange,
}) => {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>();

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setLocalValue(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 300);
  }, [onChange]);

  const pct = ((localValue - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
          {localValue.toFixed(step < 1 ? 1 : 0)}{unit}
        </span>
      </div>

      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localValue}
          onChange={handleChange}
          className="w-full h-2 appearance-none bg-gray-200 rounded-full outline-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500
            [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:hover:bg-blue-600"
          style={{
            background: `linear-gradient(to right, #3b82f6 ${pct}%, #e5e7eb ${pct}%)`,
          }}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">{min}{unit}</span>
          <span className="text-xs text-gray-400">{max}{unit}</span>
        </div>
      </div>

      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
    </div>
  );
};

export default DCFSlider;
