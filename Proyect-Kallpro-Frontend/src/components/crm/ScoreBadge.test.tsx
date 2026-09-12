import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScoreBadge from './ScoreBadge';

describe('ScoreBadge', () => {
  it('muestra el puntaje y el grado', () => {
    render(<ScoreBadge score={82} grade="A" />);
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('traduce el puntaje a ciclo de vida usando los umbrales de la empresa', () => {
    // 72 está entre MQL (50) y SQL (75): debe leerse MQL, no SQL.
    const { rerender } = render(<ScoreBadge score={72} thresholds={{ mql: 50, sql: 75 }} />);
    expect(screen.getByText('MQL')).toBeInTheDocument();

    rerender(<ScoreBadge score={80} thresholds={{ mql: 50, sql: 75 }} />);
    expect(screen.getByText('SQL')).toBeInTheDocument();

    rerender(<ScoreBadge score={20} thresholds={{ mql: 50, sql: 75 }} />);
    expect(screen.getByText('Lead')).toBeInTheDocument();
  });

  it('sin umbrales no inventa una etiqueta de ciclo de vida', () => {
    render(<ScoreBadge score={72} />);
    expect(screen.queryByText('MQL')).not.toBeInTheDocument();
    expect(screen.queryByText('SQL')).not.toBeInTheDocument();
  });

  it('expone el puntaje a lectores de pantalla', () => {
    render(<ScoreBadge score={45} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '45');
    expect(bar).toHaveAccessibleName('Puntaje del lead: 45 de 100');
  });

  it('muestra la temperatura con su etiqueta en español', () => {
    render(<ScoreBadge score={90} temperature="hot" />);
    expect(screen.getByTitle('Caliente')).toBeInTheDocument();
  });
});
