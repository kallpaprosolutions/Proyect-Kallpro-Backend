import client from './client';

export type SearchResultType =
  | 'CUSTOMER' | 'SUPPLIER' | 'PRODUCT'
  | 'PURCHASE_ORDER' | 'INVOICE' | 'SALES_ORDER' | 'REQUISITION';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  route: string;
}

export interface SearchResponse {
  query: string;
  groups: { type: SearchResultType; label: string; results: SearchResult[] }[];
  total: number;
}

/** Búsqueda global federada (Ctrl+K): clientes, proveedores, productos, OC, facturas, pedidos, requisiciones. */
export async function globalSearch(q: string): Promise<SearchResponse> {
  const { data } = await client.get<SearchResponse>('/search', { params: { q } });
  return data;
}
