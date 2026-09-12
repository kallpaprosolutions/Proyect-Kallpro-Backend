import { useNavigate } from 'react-router-dom';

interface Props {
  fallback?: string;     // ruta a la que ir si no hay historial
  label?: string;
  className?: string;
}

export default function BackButton({ fallback = '/', label = 'Volver', className = '' }: Props) {
  const navigate = useNavigate();

  function handleClick() {
    // Si hay historial, retroceder; si no, ir al fallback
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:border-surface-400 dark:hover:border-surface-500 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors ${className}`}
    >
      <span>←</span>
      <span>{label}</span>
    </button>
  );
}
