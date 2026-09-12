import client from './client';

export const sriApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return client.post('/sri/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: (status?: string) =>
    client.get('/sri', { params: status ? { status } : {} }),
  get: (id: string) => client.get(`/sri/${id}`),
  journalPreview: (id: string) => client.get(`/sri/${id}/journal-preview`),
  update: (id: string, data: any) => client.patch(`/sri/${id}`, data),
  confirm: (id: string, opts?: { override?: boolean; overrideReason?: string }) =>
    client.post(`/sri/${id}/confirm`, opts ?? {}),
  reject: (id: string, motivo?: string) => client.post(`/sri/${id}/reject`, { motivo }),
  delete: (id: string) => client.delete(`/sri/${id}`),
  payables: () => client.get('/sri/payables'),
  pay: (id: string, paid = true) => client.post(`/sri/${id}/pay`, { paid }),
  kpis: () => client.get('/sri/kpis'),
  catalogs: () => client.get('/sri/catalogs'),
  /** Ingreso manual o asistido por IA (sin PDF/XML) — factura, nota de crédito o nota de débito. */
  createManual: (data: any) => client.post('/sri/manual', data),
};
