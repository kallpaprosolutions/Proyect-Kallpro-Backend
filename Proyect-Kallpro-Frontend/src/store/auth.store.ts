import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  company: { id: string; name: string };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  rules: any[]; // reglas CASL del backend
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setRules: (rules: any[]) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } })(),
  accessToken: localStorage.getItem('accessToken'),
  rules: (() => { try { return JSON.parse(localStorage.getItem('rules') || '[]'); } catch { return []; } })(),

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, accessToken });
  },

  setRules: (rules) => {
    localStorage.setItem('rules', JSON.stringify(rules));
    set({ rules });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('rules');
    set({ user: null, accessToken: null, rules: [] });
  },

  isAuthenticated: () => !!get().accessToken,
}));
