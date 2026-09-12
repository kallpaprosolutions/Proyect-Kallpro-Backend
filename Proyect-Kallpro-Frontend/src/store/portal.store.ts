import { create } from 'zustand';

interface PortalSupplier {
  id: string;
  name: string;
  email: string;
  companyId: string;
}

interface PortalState {
  supplier: PortalSupplier | null;
  token: string | null;
  setAuth: (supplier: PortalSupplier, token: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const usePortalStore = create<PortalState>((set, get) => ({
  supplier: null,
  token: localStorage.getItem('portalToken'),

  setAuth: (supplier, token) => {
    localStorage.setItem('portalToken', token);
    set({ supplier, token });
  },

  logout: () => {
    localStorage.removeItem('portalToken');
    set({ supplier: null, token: null });
  },

  isAuthenticated: () => !!get().token,
}));
