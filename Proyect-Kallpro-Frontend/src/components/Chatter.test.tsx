import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Chatter from './Chatter';
import { getMessages, postMessage, getFollowers, follow, ChatterMessage } from '../api/chatter';

vi.mock('../api/chatter', () => ({
  getMessages: vi.fn(),
  postMessage: vi.fn(),
  getFollowers: vi.fn(),
  follow: vi.fn(),
  unfollow: vi.fn(),
}));

const msg = (id: string, userName: string, body: string, overrides: Partial<ChatterMessage> = {}): ChatterMessage => ({
  id, userName, body, userId: 'u1', createdAt: '2026-07-10T15:30:00Z',
  kind: 'MESSAGE', logField: null, logFrom: null, logTo: null, ...overrides,
});

describe('Chatter (hilo de mensajes del documento)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMessages).mockResolvedValue([]);
    vi.mocked(getFollowers).mockResolvedValue({ followers: [], followingMe: false });
  });

  it('muestra el estado vacío en español', async () => {
    render(<Chatter entityType="PURCHASE_ORDER" entityId="po1" />);
    expect(await screen.findByText(/Sin mensajes todavía/)).toBeInTheDocument();
  });

  it('lista los mensajes con autor y cuerpo', async () => {
    vi.mocked(getMessages).mockResolvedValue([
      msg('m1', 'Ana Torres', 'Revisar el anticipo con el proveedor'),
      msg('m2', 'Luis Vega', 'Anticipo confirmado ✔'),
    ]);
    render(<Chatter entityType="PURCHASE_ORDER" entityId="po1" />);
    expect(await screen.findByText('Ana Torres')).toBeInTheDocument();
    expect(screen.getByText('Revisar el anticipo con el proveedor')).toBeInTheDocument();
    expect(screen.getByText('Luis Vega')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('publica un mensaje y lo agrega al hilo', async () => {
    vi.mocked(postMessage).mockResolvedValue(msg('m9', 'Admin KallpaPro', 'Hola equipo'));
    render(<Chatter entityType="INVOICE" entityId="inv1" />);
    const input = await screen.findByPlaceholderText(/Escribe un mensaje/);
    fireEvent.change(input, { target: { value: 'Hola equipo' } });
    fireEvent.click(screen.getByText('Enviar'));
    expect(await screen.findByText('Hola equipo')).toBeInTheDocument();
    expect(postMessage).toHaveBeenCalledWith('INVOICE', 'inv1', 'Hola equipo', 'MESSAGE');
    expect((input as HTMLTextAreaElement).value).toBe('');
  });

  it('Enter envía el mensaje (Shift+Enter no)', async () => {
    vi.mocked(postMessage).mockResolvedValue(msg('m9', 'Admin', 'Con enter'));
    render(<Chatter entityType="REQUISITION" entityId="req1" />);
    const input = await screen.findByPlaceholderText(/Escribe un mensaje/);
    fireEvent.change(input, { target: { value: 'Con enter' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(postMessage).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(postMessage).toHaveBeenCalledWith('REQUISITION', 'req1', 'Con enter', 'MESSAGE'));
  });

  it('el botón Enviar está deshabilitado con el borrador vacío', async () => {
    render(<Chatter entityType="SALES_ORDER" entityId="so1" />);
    const btn = await screen.findByText('Enviar');
    expect(btn).toBeDisabled();
  });

  it('muestra error si el envío falla', async () => {
    vi.mocked(postMessage).mockRejectedValue(new Error('fail'));
    render(<Chatter entityType="INVOICE" entityId="inv1" />);
    const input = await screen.findByPlaceholderText(/Escribe un mensaje/);
    fireEvent.change(input, { target: { value: 'algo' } });
    fireEvent.click(screen.getByText('Enviar'));
    expect(await screen.findByText(/No se pudo enviar/)).toBeInTheDocument();
  });

  it('publica una nota interna cuando se elige ese modo', async () => {
    vi.mocked(postMessage).mockResolvedValue(msg('m9', 'Admin', 'Ojo con el proveedor', { kind: 'NOTE' }));
    render(<Chatter entityType="INVOICE" entityId="inv1" />);
    fireEvent.click(await screen.findByText('📝 Nota interna'));
    const input = await screen.findByPlaceholderText(/Nota interna…/);
    fireEvent.change(input, { target: { value: 'Ojo con el proveedor' } });
    fireEvent.click(screen.getByText('Enviar'));
    await waitFor(() => expect(postMessage).toHaveBeenCalledWith('INVOICE', 'inv1', 'Ojo con el proveedor', 'NOTE'));
    expect(await screen.findByText('Nota interna')).toBeInTheDocument();
  });

  it('renderiza una entrada de log de cambio de estado con las etiquetas provistas', async () => {
    vi.mocked(getMessages).mockResolvedValue([
      msg('m1', 'Ana Torres', '', { kind: 'LOG', logField: 'STATUS', logFrom: 'PENDING_L1', logTo: 'PENDING_L2' }),
    ]);
    render(<Chatter entityType="REQUISITION" entityId="req1" statusLabels={{ PENDING_L1: 'Pendiente L1', PENDING_L2: 'Pendiente L2' }} />);
    expect(await screen.findByText(/cambió el estado/)).toBeInTheDocument();
    expect(screen.getByText('Pendiente L1 → Pendiente L2')).toBeInTheDocument();
  });

  it('sin statusLabels, el log de cambio muestra el código crudo', async () => {
    vi.mocked(getMessages).mockResolvedValue([
      msg('m1', 'Ana Torres', '', { kind: 'LOG', logField: 'STATUS', logFrom: 'DRAFT', logTo: 'CONFIRMED' }),
    ]);
    render(<Chatter entityType="SALES_ORDER" entityId="so1" />);
    expect(await screen.findByText('DRAFT → CONFIRMED')).toBeInTheDocument();
  });

  it('permite seguir y dejar de seguir el documento', async () => {
    vi.mocked(getFollowers)
      .mockResolvedValueOnce({ followers: [], followingMe: false })
      .mockResolvedValueOnce({ followers: [{ userId: 'u1', userName: 'Admin KallpaPro' }], followingMe: true });
    render(<Chatter entityType="PURCHASE_ORDER" entityId="po1" />);
    const btn = await screen.findByText('+ Seguir');
    fireEvent.click(btn);
    await waitFor(() => expect(follow).toHaveBeenCalledWith('PURCHASE_ORDER', 'po1'));
    expect(await screen.findByText('✓ Siguiendo')).toBeInTheDocument();
  });
});
