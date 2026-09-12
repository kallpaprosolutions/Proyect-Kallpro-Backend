# Módulo Auth — KallpaPro
> JWT multi-tenant. Access token 15min + Refresh token 7 días.

---

## Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | /api/auth/register | Registrar empresa + admin | No |
| POST | /api/auth/login | Login, devuelve tokens | No |
| POST | /api/auth/refresh | Renovar access token | No |
| GET | /api/auth/me | Datos del usuario autenticado | Sí |

---

## Flujo de Registro

```
POST /api/auth/register
Body: { companyName, email, password, firstName, lastName }

1. Verifica email no existe → lanza EMAIL_EXISTS si ya hay usuario
2. bcrypt.hash(password, 12) → genera passwordHash
3. prisma.company.create({ name: companyName, email })
4. prisma.user.create({ email, passwordHash, firstName, lastName, role: 'ADMIN', companyId })
5. Devuelve { user, company }
```

**Nota**: El primer usuario de la empresa siempre recibe rol `ADMIN`. No se crean tokens en el registro — el usuario debe hacer login después.

---

## Flujo de Login

```
POST /api/auth/login
Body: { email, password }

1. prisma.user.findUnique({ email, include: { company: true } })
2. Si no existe → INVALID_CREDENTIALS
3. bcrypt.compare(password, user.passwordHash) → verifica
4. Si !user.isActive → ACCOUNT_DISABLED
5. Genera payload: { userId, companyId, email, role }
6. jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' }) → accessToken
7. jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' }) → refreshToken
8. Actualiza lastLoginAt
9. Devuelve { accessToken, refreshToken, user: { id, email, firstName, lastName, role, company } }
```

---

## Flujo de Refresh

```
POST /api/auth/refresh
Body: { refreshToken }

1. jwt.verify(refreshToken, JWT_REFRESH_SECRET)
2. Extrae payload (userId, companyId, email, role)
3. Genera nuevo accessToken con expiresIn: '15m'
4. Devuelve { accessToken }
```

---

## Middleware de Autenticación

Archivo: `src/middleware/auth.middleware.ts`

Exporta: `authMiddleware`

```typescript
// Aplicado en todas las rutas protegidas:
router.use(authMiddleware)

// El middleware:
1. Extrae "Authorization: Bearer <token>" del header
2. jwt.verify(token, JWT_SECRET) → payload
3. Asigna req.user = payload  (userId, companyId, email, role)
4. Si falla → 401 Unauthorized
```

**Importante**: El export se llama `authMiddleware`, NO `authenticate`. Usar el nombre incorrecto da el error `Router.use() requires a middleware function`.

---

## AuthPayload (TypeScript)

```typescript
// src/types/index.ts
interface AuthPayload {
  userId: string;
  companyId: string;
  email: string;
  role: string;
}

// Extender Express Request:
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}
```

---

## Auto-refresh en Frontend

Archivo: `src/api/client.ts`

```typescript
// Interceptor de respuesta — detecta 401 y renueva token
axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const store = useAuthStore.getState();
      try {
        const { data } = await axios.post('/api/auth/refresh', {
          refreshToken: store.refreshToken,
        });
        store.setTokens(data.accessToken, store.refreshToken!);
        error.config.headers['Authorization'] = `Bearer ${data.accessToken}`;
        return axiosInstance(error.config);
      } catch {
        store.logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

---

## Zustand Auth Store

Archivo: `src/store/auth.store.ts`

```typescript
interface AuthStore {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setAuth: (tokens, user) => void;
  setTokens: (access, refresh) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

// Persiste en localStorage:
// - 'auth_access_token'
// - 'auth_refresh_token'
// - 'auth_user'
```

---

## Credenciales de prueba

| Campo | Valor |
|-------|-------|
| Email | admin@gmail.com |
| Contraseña | 12345678 |
| Rol | ADMIN |

---

## Variables de entorno requeridas

```env
JWT_SECRET=kallpapro_super_secret_jwt_key_2024_development
JWT_REFRESH_SECRET=kallpapro_super_secret_refresh_key_2024_development
JWT_EXPIRATION=2h
JWT_REFRESH_EXPIRATION=7d
```

> **Nota importante**: El código en `auth.service.ts` usa `'15m'` hardcodeado para el access token (no lee `JWT_EXPIRATION`). En producción cambiar a variable de entorno.

---

## Archivos del módulo

```
Backend:
  src/routes/auth.routes.ts
  src/controllers/auth.controller.ts
  src/services/auth.service.ts
  src/middleware/auth.middleware.ts
  src/types/index.ts

Frontend:
  src/api/auth.ts
  src/api/client.ts
  src/store/auth.store.ts
  src/pages/Login.tsx
  src/pages/Register.tsx
```
