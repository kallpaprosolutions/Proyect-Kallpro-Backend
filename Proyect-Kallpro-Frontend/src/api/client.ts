import axios from 'axios';

const client = axios.create({ baseURL: '/api', timeout: 8000 });

// ── Traducción de códigos de error del backend a mensajes amigables (DeepSeek #5) ──
const errorMessages: Record<string, string> = {
  NO_PRICE_AVAILABLE: 'El producto no tiene precio en la lista vigente ni precio base.',
  PRODUCT_NOT_FOUND: 'Producto no encontrado.',
  PRICE_LIST_NOT_FOUND: 'Lista de precios no encontrada.',
  SESSION_EXPIRED: 'Tu sesión expiró por inactividad. Vuelve a iniciar sesión.',
  SESSION_REVOKED: 'Esta sesión fue cerrada. Vuelve a iniciar sesión.',
  CHALLENGE_INVALID: 'La verificación expiró. Vuelve a iniciar sesión.',
  '2FA_INVALID_CODE': 'Código incorrecto.',
  '2FA_ALREADY_ENABLED': 'El 2FA ya está activo.',
  '2FA_NOT_ENABLED': 'El 2FA no está activo.',
  CREDIT_LIMIT_EXCEEDED: 'El pedido excede el límite de crédito del cliente.',
};

/** Devuelve un mensaje amigable a partir de un error de Axios (traduce códigos conocidos). */
export function getErrorMessage(err: any, fallback = 'Ocurrió un error inesperado'): string {
  const raw: string = err?.response?.data?.error ?? err?.message ?? '';
  if (!raw) return fallback;
  // El backend a veces devuelve "CODE:extra:info" → tomar el prefijo del código.
  const code = raw.split(':')[0];
  return errorMessages[code] ?? raw; // si ya es texto legible, se muestra tal cual
}

// Agrega el token a cada request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Refresh con rotación: el backend revoca la sesión vieja y devuelve un par NUEVO
// (access + refresh). Una sola promesa compartida evita rotaciones concurrentes que se
// invalidarían entre sí cuando varios requests reciben 401 a la vez.
let refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('NO_REFRESH');
  const { data } = await axios.post('/api/auth/refresh', { refreshToken });
  localStorage.setItem('accessToken', data.accessToken);
  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken); // rotación
  return data.accessToken;
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        if (!refreshPromise) refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
        const newToken = await refreshPromise;
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
