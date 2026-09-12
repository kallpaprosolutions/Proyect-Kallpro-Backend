import { ReactNode } from 'react';

interface Step {
  key: string;
  label: string;
  icon?: ReactNode;
}

interface Props {
  steps: Step[];
  currentIndex: number;
  onStepClick?: (i: number) => void;
  errorIndex?: number;
}

export default function Stepper({ steps, currentIndex, onStepClick, errorIndex }: Props) {
  return (
    <div className="flex items-center">
      {steps.map((step, i) => {
        const isError = errorIndex === i;
        const done = i < currentIndex && !isError;
        const active = i === currentIndex && !isError;
        const future = i > currentIndex && !isError;
        const clickable = onStepClick && (done || active);

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div
              className={`flex flex-col items-center gap-2 min-w-0 ${clickable ? 'cursor-pointer' : ''}`}
              onClick={() => clickable && onStepClick!(i)}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold transition-all flex-shrink-0 ${
                isError ? 'bg-red-500 text-white shadow-md' :
                done ? 'bg-green-500 text-white shadow-md' :
                active ? 'bg-brand-500 text-white ring-4 ring-brand-200 dark:ring-brand-900 animate-pulse' :
                'bg-surface-100 dark:bg-surface-700 text-surface-400'
              }`}>
                {isError ? '!' : done ? '✓' : step.icon || (i + 1)}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${
                isError ? 'text-red-600 dark:text-red-400' :
                done ? 'text-green-600 dark:text-green-400' :
                active ? 'text-brand-600 dark:text-brand-400' :
                'text-surface-400'
              }`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 transition-colors ${
                future ? 'bg-surface-200 dark:bg-surface-700' : 'bg-green-500'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
