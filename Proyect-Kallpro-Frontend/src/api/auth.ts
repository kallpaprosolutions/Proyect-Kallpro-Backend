import client from './client';
const api = client;

export interface RegisterData {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface Session {
  id: string;
  ip: string | null;
  userAgent: string | null;
  lastActivityAt: string;
  expiresAt: string;
  createdAt: string;
  current: boolean;
}

export const authApi = {
  register: (data: RegisterData) => api.post('/auth/register', data),
  login: (data: LoginData) => api.post('/auth/login', data),
  verify2FA: (challengeToken: string, code: string) => api.post('/auth/login/2fa', { challengeToken, code }),
  me: () => api.get('/auth/me'),

  // 2FA — enrolamiento/gestión
  get2FAStatus: () => api.get<{ enabled: boolean }>('/auth/2fa/status'),
  pending2FA: () => api.get<{ pending: boolean; otpauthUrl?: string; qrDataUrl?: string; secret?: string }>('/auth/2fa/pending'),
  enroll2FA: () => api.post<{ otpauthUrl: string; qrDataUrl: string; secret: string }>('/auth/2fa/enroll'),
  confirm2FA: (code: string) => api.post<{ enabled: boolean }>('/auth/2fa/confirm', { code }),
  disable2FA: (code: string) => api.post<{ enabled: boolean }>('/auth/2fa/disable', { code }),

  // "Mis permisos": matriz legible derivada de las reglas CASL del rol
  getMyPermissions: () => api.get<{ role: string; roleLabel: string; description: string; fullAccess: boolean; rows: Array<{ subject: string; label: string; actions: Array<{ action: string; label: string }> }> }>('/auth/me/permissions'),

  // Sesiones
  getSessions: () => api.get<Session[]>('/auth/sessions'),
  revokeSession: (id: string) => api.delete(`/auth/sessions/${id}`),
};
