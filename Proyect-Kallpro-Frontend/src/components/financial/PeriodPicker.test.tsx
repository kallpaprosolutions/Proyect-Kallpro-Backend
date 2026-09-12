import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PeriodPicker from './PeriodPicker';

describe('PeriodPicker (selector de período estilo Odoo)', () => {
  it('muestra el mes y año en español', () => {
    render(<PeriodPicker value="2026-07" onChange={() => {}} />);
    expect(screen.getByText(/Julio 2026/)).toBeInTheDocument();
  });

  it('las flechas navegan al mes anterior y siguiente', () => {
    const onChange = vi.fn();
    render(<PeriodPicker value="2026-07" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Mes anterior'));
    expect(onChange).toHaveBeenCalledWith('2026-06');
    fireEvent.click(screen.getByLabelText('Mes siguiente'));
    expect(onChange).toHaveBeenCalledWith('2026-08');
  });

  it('cruza el año hacia atrás (enero → diciembre anterior)', () => {
    const onChange = vi.fn();
    render(<PeriodPicker value="2026-01" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Mes anterior'));
    expect(onChange).toHaveBeenCalledWith('2025-12');
  });

  it('abre el popover y permite elegir un mes del grid', () => {
    const onChange = vi.fn();
    render(<PeriodPicker value="2026-07" onChange={onChange} />);
    fireEvent.click(screen.getByText(/Julio 2026/));
    fireEvent.click(screen.getByText('Mar'));
    expect(onChange).toHaveBeenCalledWith('2026-03');
  });

  it('navega de año dentro del popover antes de elegir', () => {
    const onChange = vi.fn();
    render(<PeriodPicker value="2026-07" onChange={onChange} />);
    fireEvent.click(screen.getByText(/Julio 2026/));
    fireEvent.click(screen.getByText('2026').parentElement!.querySelectorAll('button')[0]); // ‹ año
    fireEvent.click(screen.getByText('Ene'));
    expect(onChange).toHaveBeenCalledWith('2025-01');
  });
});
