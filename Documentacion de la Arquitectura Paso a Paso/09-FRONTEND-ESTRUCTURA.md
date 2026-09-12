# Frontend — Estructura — KallpaPro
> React 18 + TypeScript + Vite + Tailwind CSS + Zustand + Axios

---

## Stack Frontend

| Librería | Versión | Uso |
|---------|---------|-----|
| React | 18.x | UI framework |
| TypeScript | 5.x | Tipado estático |
| Vite | 5.x | Build tool + dev server en puerto 3000 |
| React Router v6 | 6.x | Routing SPA |
| Zustand | 4.x | Estado global (solo auth) |
| Axios | 1.x | HTTP client |
| Tailwind CSS | 3.x | Estilos utilitarios |
| Zod | 3.x | Validación de formularios |

---

## Estructura de carpetas

```
src/
├── api/               ← módulos Axios por dominio
│   ├── client.ts      ← instancia Axios base con interceptores
│   ├── auth.ts
│   ├── inventory.ts
│   ├── purchases.ts
│   ├── financial.ts
│   └── sriDocuments.ts
├── store/
│   └── auth.store.ts  ← Zustand: tokens + user
├── pages/
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── Dashboard.tsx
│   ├── inventory/
│   │   ├── InventoryPage.tsx
│   │   ├── NewProductPage.tsx
│   │   ├── ProductDetailPage.tsx
│   │   ├── WarehousesPage.tsx
│   │   └── CategoriesPage.tsx
│   ├── purchases/
│   │   ├── PurchasesPage.tsx
│   │   ├── SuppliersPage.tsx
│   │   ├── NewOrderPage.tsx
│   │   └── OrderDetailPage.tsx
│   └── financial/
│       ├── FinancialPage.tsx
│       ├── NewInvoicePage.tsx
│       ├── InvoiceDetailPage.tsx
│       ├── SriDocumentsPage.tsx
│       └── SriDocumentReviewPage.tsx
├── App.tsx            ← React Router + rutas
├── main.tsx
└── index.css          ← Tailwind directives
```

---

## App.tsx — Rutas completas

```typescript
// Rutas públicas (sin autenticación):
/login    → Login.tsx
/register → Register.tsx

// Rutas protegidas (requieren JWT válido):
/dashboard                    → Dashboard.tsx
/inventory                    → InventoryPage.tsx
/inventory/products/new       → NewProductPage.tsx
/inventory/products/:id       → ProductDetailPage.tsx
/inventory/warehouses         → WarehousesPage.tsx
/inventory/categories         → CategoriesPage.tsx
/purchases                    → PurchasesPage.tsx
/purchases/suppliers          → SuppliersPage.tsx
/purchases/new                → NewOrderPage.tsx
/purchases/:id                → OrderDetailPage.tsx
/financial                    → FinancialPage.tsx
/financial/invoices/new       → NewInvoicePage.tsx
/financial/invoices/:id       → InvoiceDetailPage.tsx
/sri                          → SriDocumentsPage.tsx
/sri/:id                      → SriDocumentReviewPage.tsx
/                             → redirect a /login
```

---

## ProtectedRoute

```typescript
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}
```

`isAuthenticated()` devuelve `!!accessToken` — si hay token en Zustand (que lee desde localStorage al iniciar), se considera autenticado.

---

## Cliente Axios (src/api/client.ts)

```typescript
const client = axios.create({ baseURL: '/api' });
// baseURL '/api' → Vite proxy redirige a http://localhost:5000/api

// Interceptor REQUEST: agrega token JWT
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor RESPONSE: auto-refresh si 401
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken });
          localStorage.setItem('accessToken', data.accessToken);
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return client(error.config);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

---

## Zustand Auth Store (src/store/auth.store.ts)

```typescript
interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user, accessToken, refreshToken) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

// localStorage keys:
// 'accessToken'   → JWT access token
// 'refreshToken'  → JWT refresh token
// user no se persiste en localStorage (solo en memoria Zustand)
```

**Inicialización**: al cargar la app, Zustand lee `accessToken` de localStorage. Si existe, el usuario está "autenticado" hasta que expire y el interceptor no pueda renovarlo.

---

## Proxy Vite (vite.config.ts)

```typescript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true,
    },
  },
},
```

Todo request a `/api/*` → redirigido a `http://localhost:5000/api/*`.

---

## Tema visual

El sistema usa dark mode con Tailwind:

```
Fondo principal: bg-gray-950
Cards/panels:    bg-gray-900
Inputs/borders:  bg-gray-800
Texto primario:  text-white
Texto secundario: text-gray-400
Acentos:         cyan-400 / cyan-600
Éxito:           green-400
Error/danger:    red-400
Warning:         yellow-400
```

---

## .env Frontend

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=KallpaPro
VITE_APP_VERSION=0.1.0
```

> Nota: el cliente Axios usa `baseURL: '/api'` (sin VITE_API_URL) para aprovechar el proxy Vite. VITE_API_URL se usa en otros lugares del UI.
