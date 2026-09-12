import client from './client';

/** Descarga un blob y lanza el diálogo de guardado del navegador */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const reportsApi = {
  // Excel
  inventoryExcel: async () => {
    const r = await client.get('/reports/inventory/excel', { responseType: 'blob' });
    downloadBlob(r.data, 'inventario.xlsx');
  },
  purchasesExcel: async (from?: string, to?: string) => {
    const r = await client.get('/reports/purchases/excel', { params: { from, to }, responseType: 'blob' });
    downloadBlob(r.data, 'compras.xlsx');
  },
  salesExcel: async (from?: string, to?: string) => {
    const r = await client.get('/reports/sales/excel', { params: { from, to }, responseType: 'blob' });
    downloadBlob(r.data, 'ventas.xlsx');
  },
  suppliersExcel: async () => {
    const r = await client.get('/reports/suppliers/excel', { responseType: 'blob' });
    downloadBlob(r.data, 'proveedores.xlsx');
  },
  glExcel: async (from?: string, to?: string) => {
    const r = await client.get('/reports/gl/excel', { params: { from, to }, responseType: 'blob' });
    downloadBlob(r.data, 'asientos-gl.xlsx');
  },
  productionExcel: async (from?: string, to?: string) => {
    const r = await client.get('/reports/production/excel', { params: { from, to }, responseType: 'blob' });
    downloadBlob(r.data, 'produccion.xlsx');
  },

  // PDF — se descargan vía axios para que viajen con el token (Bearer en header);
  // abrir la URL directa con window.open no incluye el token → "No token provided".
  poPdf: async (id: string, label?: string) => {
    const r = await client.get(`/reports/po/${id}/pdf`, { responseType: 'blob' });
    downloadBlob(r.data, `${label ?? `orden-compra-${id}`}.pdf`);
  },
  requisitionPdf: async (id: string, label?: string) => {
    const r = await client.get(`/reports/requisition/${id}/pdf`, { responseType: 'blob' });
    downloadBlob(r.data, `${label ?? `requisicion-${id}`}.pdf`);
  },
  salesInvoicePdf: async (id: string, label?: string) => {
    const r = await client.get(`/reports/sales-invoice/${id}/pdf`, { responseType: 'blob' });
    downloadBlob(r.data, `${label ?? `factura-${id}`}.pdf`);
  },
  creditNotePdf: async (id: string, label?: string) => {
    const r = await client.get(`/reports/credit-note/${id}/pdf`, { responseType: 'blob' });
    downloadBlob(r.data, `${label ?? `nota-credito-${id}`}.pdf`);
  },
  debitNotePdf: async (id: string, label?: string) => {
    const r = await client.get(`/reports/debit-note/${id}/pdf`, { responseType: 'blob' });
    downloadBlob(r.data, `${label ?? `nota-debito-${id}`}.pdf`);
  },
  deliveryGuidePdf: async (id: string, label?: string) => {
    const r = await client.get(`/reports/delivery-guide/${id}/pdf`, { responseType: 'blob' });
    downloadBlob(r.data, `${label ?? `guia-remision-${id}`}.pdf`);
  },
};
