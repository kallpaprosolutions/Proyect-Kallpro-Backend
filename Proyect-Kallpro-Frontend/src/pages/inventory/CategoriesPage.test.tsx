import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CategoriesPage from './CategoriesPage';
import { inventoryApi } from '../../api/inventory';
import { ToastProvider } from '../../components/ui/Toast';

vi.mock('../../api/inventory', () => ({
  inventoryApi: {
    getCategories: vi.fn(),
    getProducts: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    reclassifyProduct: vi.fn(),
  },
}));

const categories = [
  { id: 'c1', name: 'Cómputo', description: 'Equipos' },
  { id: 'c2', name: 'Muebles', description: null },
];
const products = [
  { id: 'p1', name: 'Laptop', categoryId: 'c1' },
  { id: 'p2', name: 'Disco', categoryId: 'c1' },
  { id: 'p3', name: 'Silla', categoryId: 'c2' },
  { id: 'p4', name: 'Tornillo', categoryId: null },
];

describe('CategoriesPage', () => {
  beforeEach(() => {
    vi.mocked(inventoryApi.getCategories).mockResolvedValue({ data: categories } as any);
    vi.mocked(inventoryApi.getProducts).mockResolvedValue({ data: products } as any);
  });

  it('pluraliza el conteo de productos ("1 producto" vs "2 productos")', async () => {
    render(<ToastProvider><CategoriesPage /></ToastProvider>);
    expect(await screen.findByText('2 productos')).toBeInTheDocument();
    expect(screen.getByText('1 producto')).toBeInTheDocument(); // regresión: decía "1 productos"
  });

  it('lista los productos sin categoría en su sección de aviso', async () => {
    render(<ToastProvider><CategoriesPage /></ToastProvider>);
    await screen.findByText('2 productos');
    expect(screen.getByText(/Productos sin categoría \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Tornillo/)).toBeInTheDocument();
  });
});
