# 🎨 KallpaPro Frontend

Frontend moderno de la plataforma B2B SaaS **KallpaPro** para gestión integral de PYMEs.

## Stack Tecnológico

- **Framework**: React 18.x
- **Build Tool**: Vite
- **Lenguaje**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand + React Query
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Validación**: Zod

## Características

- ✅ Interfaz moderna y responsiva
- ✅ Autenticación segura con JWT
- ✅ Módulos para: Inventario, Compras, Logística, Financiero, Ventas
- ✅ Dashboards y reportes
- ✅ Real-time updates (WebSocket ready)
- ✅ Offline-first con Service Workers

## Setup Local

### Requisitos

```bash
node --version  # v18+
npm --version   # v9+
```

### Instalación

1. **Clonar e instalar dependencias**
```bash
cd Proyect-Kallpro-Frontend
npm install
```

2. **Configurar ambiente**
```bash
cp .env.example .env
```

3. **Iniciar servidor de desarrollo**
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

4. **(Opcional) Build para producción**
```bash
npm run build
npm run preview
```

## Estructura de Carpetas

```
src/
├── types/           # TypeScript types
├── services/        # API clients
├── hooks/          # Custom React hooks
├── store/          # Zustand stores
├── components/     # Componentes reutilizables
├── pages/          # Páginas completas
├── layouts/        # Layouts
├── routes/         # Rutas
├── utils/          # Funciones útiles
├── contexts/       # React contexts
└── styles/         # CSS global

tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
└── mocks/         # Mock data
```

## Módulos Implementados

### Fase 1 (Semanas 3-6)
- [ ] Inventario - Gestión de productos y stock
- [ ] Compras - Órdenes de compra

### Fase 2 (Semanas 7-12)
- [ ] Logística - Seguimiento de envíos
- [ ] Financiero - Facturas y reportes
- [ ] Ventas - CRM y oportunidades

### Fase 3 (Semana 13)
- [ ] Polish, testing, optimización

## Componentes Principales

### Auth
- LoginPage
- RegisterPage
- ForgotPasswordPage
- ProtectedRoute

### Inventory
- ProductListPage
- CreateProductPage
- EditProductPage
- StockMovementsPage
- AlertsPage

### Purchases
- PurchaseOrderListPage
- CreateOrderPage
- SuppliersPage
- ApprovalsPage

## Testing

```bash
# Unit tests
npm test

# UI mode
npm run test:ui

# Coverage
npm test -- --coverage
```

## Styling

El proyecto usa **Tailwind CSS** para styling. Configuración en `tailwind.config.js`.

### Componentes reutilizables
- Button, Card, Modal, Alert, Badge, etc.
- Localizados en `src/components/common/`

## Deployment

Ver [DEPLOYMENT.md](./docs/DEPLOYMENT.md)

## Contribuir

1. Crea una rama: `git checkout -b feature/tu-feature`
2. Haz commit: `git commit -m "feat: descripción"`
3. Push: `git push origin feature/tu-feature`
4. Abre un PR

## Licencia

MIT

## Soporte

Para dudas o bugs, abre un issue en GitHub.

---

**Roadmap**: 3 meses para v1.0 con interface completa para 5 módulos
