import api from './client';

export interface FixedAssetCategoryInfo {
  key: string;
  label: string;
  accountCode: string;
  defaultUsefulLifeYears: number;
}

export interface FixedAsset {
  id: string;
  assetNumber: string;
  name: string;
  category: string;
  accountCode: string;
  acquisitionDate: string;
  acquisitionCost: number;
  residualValue: number;
  usefulLifeYears: number;
  accumulatedDepreciation: number;
  lastDepreciatedPeriod: string | null;
  status: 'ACTIVE' | 'FULLY_DEPRECIATED' | 'DISPOSED';
  disposedAt: string | null;
  disposalNote: string | null;
  supplierId: string | null;
  supplier: { id: string; name: string } | null;
  notes: string | null;
  createdAt: string;
}

export interface FixedAssetInput {
  name: string;
  category: string;
  acquisitionDate: string;
  acquisitionCost: number;
  residualValue: number;
  usefulLifeYears: number;
  supplierId?: string | null;
  notes?: string;
}

export interface GenerateDepreciationResult {
  generated: Array<{ assetId: string; assetNumber: string; name: string; amount: number; entryId: string }>;
  skipped: Array<{ assetId: string; name: string; reason: string }>;
}

export const fixedAssetsApi = {
  categories: () => api.get<FixedAssetCategoryInfo[]>('/financial/fixed-assets/categories'),
  list: () => api.get<FixedAsset[]>('/financial/fixed-assets'),
  get: (id: string) => api.get<FixedAsset & { depreciationEntries: Array<{ id: string; entryNumber: string; entryDate: string; totalDebit: number; description: string }> }>(`/financial/fixed-assets/${id}`),
  create: (data: FixedAssetInput) => api.post<FixedAsset>('/financial/fixed-assets', data),
  update: (id: string, data: Partial<Pick<FixedAssetInput, 'name' | 'residualValue' | 'usefulLifeYears' | 'notes'>>) =>
    api.put<FixedAsset>(`/financial/fixed-assets/${id}`, data),
  dispose: (id: string, note: string) => api.post<FixedAsset>(`/financial/fixed-assets/${id}/dispose`, { note }),
  generateDue: () => api.post<GenerateDepreciationResult>('/financial/fixed-assets/generate-due'),
};
