import api from './client';

export interface PriceListItem {
  id: string;
  productId: string;
  unitPrice: number;
  minQuantity: number;
  product?: { id: string; name: string; sku?: string; salePrice?: number };
}
export interface PriceList {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  items?: PriceListItem[];
  _count?: { items: number };
}
export interface ResolvedPrice {
  unitPrice: number;
  source: 'PRICE_LIST' | 'PRODUCT_BASE';
  priceListId: string | null;
  priceListName: string | null;
}

export const priceListsApi = {
  list: () => api.get<PriceList[]>('/price-lists'),
  get: (id: string) => api.get<PriceList>(`/price-lists/${id}`),
  create: (data: { name: string; startDate: string; endDate?: string | null; isActive?: boolean }) =>
    api.post<PriceList>('/price-lists', data),
  update: (id: string, data: Partial<{ name: string; startDate: string; endDate: string | null; isActive: boolean }>) =>
    api.put<PriceList>(`/price-lists/${id}`, data),
  remove: (id: string) => api.delete(`/price-lists/${id}`),
  upsertItem: (id: string, data: { productId: string; unitPrice: number; minQuantity?: number }) =>
    api.post<PriceListItem>(`/price-lists/${id}/items`, data),
  removeItem: (itemId: string) => api.delete(`/price-lists/items/${itemId}`),
  resolve: (productId: string, quantity: number) =>
    api.get<ResolvedPrice>(`/price-lists/resolve`, { params: { productId, quantity } }),
  discountCap: () => api.get<{ cap: number; role: string }>(`/price-lists/discount-cap`),
};
