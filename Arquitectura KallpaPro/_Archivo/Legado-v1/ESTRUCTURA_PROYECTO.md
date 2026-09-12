# 📁 ESTRUCTURA DE CARPETAS - KallpaPro

## Estructura General del Proyecto

```
KallpaPro/
├── README.md                          # Documentación principal
├── ARQUITECTURA_TECNICA.md            # Este documento
├── .gitignore
├── docker-compose.yml                 # Setup local desarrollo
│
├── frontend/                          # React SPA
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── vite.config.ts                 # Si usas Vite (recomendado)
│   ├── .env.example
│   │
│   ├── public/
│   │   ├── favicon.ico
│   │   └── logo.svg
│   │
│   ├── src/
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   ├── vite-env.d.ts
│   │   │
│   │   ├── types/                    # TypeScript types globales
│   │   │   ├── api.ts                # Response types
│   │   │   ├── models.ts             # Entidades (User, Product, etc)
│   │   │   ├── auth.ts               # Auth types
│   │   │   └── pagination.ts         # Tipos de paginación
│   │   │
│   │   ├── services/                 # API clients
│   │   │   ├── api.ts                # Axios/Fetch instance
│   │   │   ├── auth.service.ts
│   │   │   ├── inventory.service.ts
│   │   │   ├── purchases.service.ts
│   │   │   ├── logistics.service.ts
│   │   │   ├── financials.service.ts
│   │   │   ├── sales.service.ts
│   │   │   └── subscription.service.ts
│   │   │
│   │   ├── hooks/                    # React hooks reutilizables
│   │   │   ├── useAuth.ts            # Contexto auth
│   │   │   ├── useQuery.ts           # Wrapper de React Query
│   │   │   ├── useTenant.ts          # Tenant actual
│   │   │   ├── usePermission.ts      # Verificar permisos
│   │   │   ├── usePageTitle.ts       # Actualizar título
│   │   │   └── useForm.ts            # Form handling
│   │   │
│   │   ├── store/                    # Zustand stores (global state)
│   │   │   ├── authStore.ts          # User, token, permissions
│   │   │   ├── uiStore.ts            # Temas, sidebar toggle, etc
│   │   │   └── notificationStore.ts  # Toasts, modales
│   │   │
│   │   ├── components/               # Componentes reutilizables
│   │   │   ├── common/
│   │   │   │   ├── Navbar.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Spinner.tsx
│   │   │   │   ├── EmptyState.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Alert.tsx
│   │   │   │   └── Pagination.tsx
│   │   │   │
│   │   │   ├── forms/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── RegisterForm.tsx
│   │   │   │   ├── ForgotPasswordForm.tsx
│   │   │   │   └── ChangePasswordForm.tsx
│   │   │   │
│   │   │   ├── tables/
│   │   │   │   ├── DataTable.tsx     # Tabla genérica
│   │   │   │   ├── ProductTable.tsx
│   │   │   │   ├── OrderTable.tsx
│   │   │   │   └── InvoiceTable.tsx
│   │   │   │
│   │   │   └── charts/
│   │   │       ├── LineChart.tsx
│   │   │       ├── BarChart.tsx
│   │   │       └── PieChart.tsx
│   │   │
│   │   ├── pages/                    # Pages (layout completo)
│   │   │   ├── auth/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── RegisterPage.tsx
│   │   │   │   ├── ForgotPasswordPage.tsx
│   │   │   │   └── ResetPasswordPage.tsx
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── DashboardPage.tsx  # Home principal
│   │   │   │   ├── DashboardLayout.tsx
│   │   │   │   └── WelcomePage.tsx
│   │   │   │
│   │   │   ├── inventory/
│   │   │   │   ├── InventoryPage.tsx
│   │   │   │   ├── ProductListPage.tsx
│   │   │   │   ├── ProductDetailPage.tsx
│   │   │   │   ├── CreateProductPage.tsx
│   │   │   │   ├── EditProductPage.tsx
│   │   │   │   ├── StockMovementsPage.tsx
│   │   │   │   ├── AlertsPage.tsx
│   │   │   │   └── CategoriesPage.tsx
│   │   │   │
│   │   │   ├── purchases/
│   │   │   │   ├── PurchasesPage.tsx
│   │   │   │   ├── OrderListPage.tsx
│   │   │   │   ├── OrderDetailPage.tsx
│   │   │   │   ├── CreateOrderPage.tsx
│   │   │   │   ├── EditOrderPage.tsx
│   │   │   │   ├── SuppliersPage.tsx
│   │   │   │   ├── RFQPage.tsx
│   │   │   │   └── ApprovalsPage.tsx
│   │   │   │
│   │   │   ├── logistics/
│   │   │   │   ├── LogisticsPage.tsx
│   │   │   │   ├── ShipmentsPage.tsx
│   │   │   │   ├── ShipmentDetailPage.tsx
│   │   │   │   ├── TrackingPage.tsx
│   │   │   │   ├── SuppliersPage.tsx
│   │   │   │   └── RoutesPage.tsx
│   │   │   │
│   │   │   ├── financials/
│   │   │   │   ├── FinancialsPage.tsx
│   │   │   │   ├── InvoicesPage.tsx
│   │   │   │   ├── CreateInvoicePage.tsx
│   │   │   │   ├── ReportsPage.tsx
│   │   │   │   ├── AccountsReceivablePage.tsx
│   │   │   │   ├── AccountsPayablePage.tsx
│   │   │   │   └── BankingPage.tsx
│   │   │   │
│   │   │   ├── sales/
│   │   │   │   ├── SalesPage.tsx
│   │   │   │   ├── CustomersPage.tsx
│   │   │   │   ├── CustomerDetailPage.tsx
│   │   │   │   ├── OpportunitiesPage.tsx
│   │   │   │   ├── QuotesPage.tsx
│   │   │   │   ├── CreateQuotePage.tsx
│   │   │   │   ├── OrdersPage.tsx
│   │   │   │   └── MetricsPage.tsx
│   │   │   │
│   │   │   ├── settings/
│   │   │   │   ├── SettingsPage.tsx
│   │   │   │   ├── ProfilePage.tsx
│   │   │   │   ├── CompanyPage.tsx
│   │   │   │   ├── UsersPage.tsx
│   │   │   │   ├── RolesPage.tsx
│   │   │   │   ├── BillingPage.tsx
│   │   │   │   └── IntegrationPage.tsx
│   │   │   │
│   │   │   ├── subscription/
│   │   │   │   ├── PlansPage.tsx
│   │   │   │   ├── CheckoutPage.tsx
│   │   │   │   ├── BillingHistoryPage.tsx
│   │   │   │   └── SubscriptionPage.tsx
│   │   │   │
│   │   │   ├── NotFoundPage.tsx
│   │   │   └── ErrorPage.tsx
│   │   │
│   │   ├── layouts/
│   │   │   ├── AuthLayout.tsx        # Sin sidebar (login, register)
│   │   │   ├── AppLayout.tsx         # Con sidebar (main app)
│   │   │   └── BlankLayout.tsx       # Minimal
│   │   │
│   │   ├── routes/
│   │   │   ├── index.tsx             # Rutas principales
│   │   │   ├── ProtectedRoute.tsx    # Wrapper para rutas privadas
│   │   │   └── roleRoutes.ts         # Mapeo de roles → rutas
│   │   │
│   │   ├── utils/
│   │   │   ├── constants.ts          # Enums, constantes
│   │   │   ├── formatters.ts         # date, currency, etc
│   │   │   ├── validators.ts         # Email, teléfono, etc
│   │   │   ├── helpers.ts            # Funciones utility
│   │   │   ├── storage.ts            # LocalStorage helpers
│   │   │   └── errors.ts             # Error handling
│   │   │
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx
│   │   │   ├── TenantContext.tsx
│   │   │   └── ThemeContext.tsx
│   │   │
│   │   └── styles/
│   │       ├── globals.css
│   │       ├── variables.css
│   │       └── animations.css
│   │
│   └── tests/
│       ├── setup.ts
│       ├── mocks/
│       │   ├── handlers.ts           # MSW handlers
│       │   └── data.ts               # Mock data
│       │
│       ├── unit/
│       │   ├── utils/
│       │   ├── hooks/
│       │   └── services/
│       │
│       └── integration/
│           ├── auth/
│           ├── inventory/
│           └── purchases/
│
├── backend/                           # Node.js + Express
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── .env.production
│   │
│   ├── src/
│   │   ├── index.ts                  # Entry point
│   │   │
│   │   ├── config/
│   │   │   ├── database.ts           # Prisma + conexión
│   │   │   ├── environment.ts        # Variables de entorno validadas
│   │   │   ├── cors.ts               # CORS config
│   │   │   └── constants.ts          # Constantes globales
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.ts               # JWT verification
│   │   │   ├── authorization.ts      # Role/permission check
│   │   │   ├── errorHandler.ts       # Global error catching
│   │   │   ├── validation.ts         # Zod/Joi validation
│   │   │   ├── rateLimit.ts          # Rate limiting
│   │   │   ├── logging.ts            # Request logging
│   │   │   └── tenantMiddleware.ts   # Multi-tenancy isolation
│   │   │
│   │   ├── routes/
│   │   │   ├── index.ts              # Router principal
│   │   │   ├── auth.routes.ts
│   │   │   ├── users.routes.ts
│   │   │   ├── inventory.routes.ts
│   │   │   ├── purchases.routes.ts
│   │   │   ├── logistics.routes.ts
│   │   │   ├── financials.routes.ts
│   │   │   ├── sales.routes.ts
│   │   │   ├── subscriptions.routes.ts
│   │   │   ├── payments.routes.ts
│   │   │   └── webhooks.routes.ts
│   │   │
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── user.controller.ts
│   │   │   ├── inventory/
│   │   │   │   ├── product.controller.ts
│   │   │   │   ├── stock.controller.ts
│   │   │   │   ├── movement.controller.ts
│   │   │   │   ├── alert.controller.ts
│   │   │   │   └── category.controller.ts
│   │   │   │
│   │   │   ├── purchases/
│   │   │   │   ├── order.controller.ts
│   │   │   │   ├── supplier.controller.ts
│   │   │   │   ├── rfq.controller.ts
│   │   │   │   └── approval.controller.ts
│   │   │   │
│   │   │   ├── logistics/
│   │   │   │   ├── shipment.controller.ts
│   │   │   │   ├── tracking.controller.ts
│   │   │   │   └── supplier.controller.ts
│   │   │   │
│   │   │   ├── financials/
│   │   │   │   ├── invoice.controller.ts
│   │   │   │   ├── report.controller.ts
│   │   │   │   ├── accounts-receivable.controller.ts
│   │   │   │   ├── accounts-payable.controller.ts
│   │   │   │   └── banking.controller.ts
│   │   │   │
│   │   │   ├── sales/
│   │   │   │   ├── customer.controller.ts
│   │   │   │   ├── opportunity.controller.ts
│   │   │   │   ├── quote.controller.ts
│   │   │   │   ├── order.controller.ts
│   │   │   │   └── metrics.controller.ts
│   │   │   │
│   │   │   ├── subscription.controller.ts
│   │   │   ├── payment.controller.ts
│   │   │   └── webhook.controller.ts
│   │   │
│   │   ├── services/                 # Business logic
│   │   │   ├── auth.service.ts
│   │   │   ├── token.service.ts
│   │   │   ├── email.service.ts
│   │   │   ├── file.service.ts
│   │   │   ├── audit-log.service.ts
│   │   │   │
│   │   │   ├── inventory/
│   │   │   │   ├── product.service.ts
│   │   │   │   ├── stock.service.ts
│   │   │   │   ├── movement.service.ts
│   │   │   │   ├── alert.service.ts
│   │   │   │   └── category.service.ts
│   │   │   │
│   │   │   ├── purchases/
│   │   │   │   ├── order.service.ts
│   │   │   │   ├── supplier.service.ts
│   │   │   │   ├── rfq.service.ts
│   │   │   │   └── approval.service.ts
│   │   │   │
│   │   │   ├── logistics/
│   │   │   │   ├── shipment.service.ts
│   │   │   │   ├── tracking.service.ts
│   │   │   │   └── supplier.service.ts
│   │   │   │
│   │   │   ├── financials/
│   │   │   │   ├── invoice.service.ts
│   │   │   │   ├── report.service.ts
│   │   │   │   ├── accounts-receivable.service.ts
│   │   │   │   ├── accounts-payable.service.ts
│   │   │   │   └── banking.service.ts
│   │   │   │
│   │   │   ├── sales/
│   │   │   │   ├── customer.service.ts
│   │   │   │   ├── opportunity.service.ts
│   │   │   │   ├── quote.service.ts
│   │   │   │   ├── order.service.ts
│   │   │   │   └── metrics.service.ts
│   │   │   │
│   │   │   ├── subscription.service.ts
│   │   │   ├── payment.service.ts    # Lógica de pagos
│   │   │   └── payment-providers/   # Integraciones
│   │   │       ├── uno.provider.ts
│   │   │       └── kuski.provider.ts
│   │   │
│   │   ├── validators/               # Schemas Zod/Joi
│   │   │   ├── auth.validator.ts
│   │   │   ├── inventory.validator.ts
│   │   │   ├── purchases.validator.ts
│   │   │   ├── logistics.validator.ts
│   │   │   ├── financials.validator.ts
│   │   │   └── sales.validator.ts
│   │   │
│   │   ├── types/
│   │   │   ├── index.ts              # Tipos globales
│   │   │   ├── express.d.ts          # Extensiones Express
│   │   │   ├── models.ts             # Tipos de BD
│   │   │   └── errors.ts             # Error types
│   │   │
│   │   ├── utils/
│   │   │   ├── logger.ts             # Winston logger
│   │   │   ├── encryption.ts         # Bcrypt, crypto
│   │   │   ├── helpers.ts
│   │   │   ├── errors.ts             # Custom errors
│   │   │   ├── jwt.ts                # Token generation
│   │   │   └── formatters.ts         # Responses, dates
│   │   │
│   │   ├── queue/                    # Job queue (opcional)
│   │   │   ├── index.ts
│   │   │   └── jobs/
│   │   │       ├── send-email.job.ts
│   │   │       ├── generate-report.job.ts
│   │   │       └── invoice-reminder.job.ts
│   │   │
│   │   └── jobs/                     # Cron jobs
│   │       ├── cleanup.job.ts
│   │       ├── alert-stock.job.ts
│   │       ├── invoice-reminders.job.ts
│   │       └── subscription-renewal.job.ts
│   │
│   ├── prisma/
│   │   ├── schema.prisma             # Schema de BD completo
│   │   ├── migrations/
│   │   │   ├── migration_lock.toml
│   │   │   ├── 0001_init/            # Primera migración
│   │   │   ├── 0002_auth/
│   │   │   ├── 0003_inventory/
│   │   │   ├── 0004_purchases/
│   │   │   ├── 0005_logistics/
│   │   │   ├── 0006_financials/
│   │   │   └── 0007_sales/
│   │   │
│   │   └── seeds/
│   │       ├── index.ts              # Seed script
│   │       ├── companies.seed.ts
│   │       ├── users.seed.ts
│   │       ├── products.seed.ts
│   │       └── roles.seed.ts
│   │
│   └── tests/
│       ├── setup.ts
│       ├── fixtures/                 # Test data
│       │
│       ├── unit/
│       │   ├── services/
│       │   ├── utils/
│       │   └── validators/
│       │
│       └── integration/
│           ├── auth/
│           ├── inventory/
│           ├── purchases/
│           └── payments/
│
├── database/                          # Scripts y SQL
│   ├── init.sql                      # Script inicial (en desuso con Prisma)
│   ├── seeds/                        # Datos de prueba
│   │   ├── companies.sql
│   │   ├── users.sql
│   │   └── sample-data.sql
│   │
│   └── backups/                      # Backups manuales
│       └── .gitkeep
│
├── docs/                              # Documentación técnica
│   ├── SETUP.md                      # Guía setup inicial
│   ├── API.md                        # API documentation (generada por Swagger)
│   ├── DATABASE.md                   # Schema documentation
│   ├── DEPLOYMENT.md                 # Guía deploy
│   ├── TESTING.md                    # Testing strategy
│   ├── SECURITY.md                   # Security guidelines
│   ├── CONTRIBUTING.md               # Cómo contribuir
│   │
│   ├── guides/
│   │   ├── module-development.md     # Cómo crear un módulo
│   │   ├── adding-features.md        # Agregar features
│   │   ├── debugging.md              # Debugging tips
│   │   └── performance.md            # Performance tuning
│   │
│   └── diagrams/
│       ├── architecture.png
│       ├── database-er.png
│       └── flows/
│           ├── payment-flow.png
│           ├── auth-flow.png
│           └── inventory-flow.png
│
├── scripts/
│   ├── setup.sh                      # Setup inicial
│   ├── db-seed.sh                    # Llenar BD con datos
│   ├── db-reset.sh                   # Reset BD (desarrollo)
│   ├── migrate.sh                    # Correr migraciones
│   └── test.sh                       # Correr tests
│
├── .github/
│   ├── workflows/
│   │   ├── test.yml                  # Tests en cada PR
│   │   ├── lint.yml                  # Linting
│   │   └── deploy.yml                # Deploy a producción
│   │
│   └── ISSUE_TEMPLATE/
│       ├── feature.md
│       ├── bug.md
│       └── question.md
│
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json                       # Root package (workspaces)
```

---

## 📋 DESCRIPCIÓN DE DIRECTORIOS CLAVE

### `/frontend/src/components`
**Propósito:** Componentes React reutilizables (sin lógica de negocio)

**Convención de nomenclatura:**
- PascalCase: `ProductCard.tsx`, `DataTable.tsx`
- Props interface: `ProductCardProps`
- Ejemplo:
  ```tsx
  interface ProductCardProps {
    id: string;
    name: string;
    price: number;
    onEdit: (id: string) => void;
  }
  export const ProductCard: React.FC<ProductCardProps> = ({ id, name, price, onEdit }) => (...)
  ```

### `/frontend/src/pages`
**Propósito:** Páginas completas (layout + componentes)

**Estructura por módulo:**
```
pages/
├── inventory/
│   ├── InventoryPage.tsx    ← Wrapper/Router
│   ├── ProductListPage.tsx  ← Página específica
│   ├── CreateProductPage.tsx
│   └── EditProductPage.tsx
```

### `/backend/src/services`
**Propósito:** Lógica de negocio, independiente de HTTP

**Ejemplo:**
```typescript
// services/inventory/product.service.ts
export class ProductService {
  async createProduct(data: CreateProductDTO, tenantId: string) {
    // Validaciones
    // Cálculos
    // Operaciones de BD (vía Prisma)
    // Audit logging
    // Retorna datos, no Response HTTP
  }
}
```

### `/backend/src/controllers`
**Propósito:** Mapear requests HTTP → Services → Responses

**Ejemplo:**
```typescript
// controllers/inventory/product.controller.ts
export class ProductController {
  async create(req: AuthRequest, res: Response) {
    const data = req.body;
    const tenantId = req.user.tenantId;
    
    const product = await this.productService.createProduct(data, tenantId);
    res.status(201).json({ success: true, data: product });
  }
}
```

### `/backend/prisma/schema.prisma`
**Propósito:** Single source of truth para estructura de BD

**Ventajas de Prisma:**
- Schema + migrations + type generation (todo junto)
- No escribes SQL manual
- Type-safe queries
- Fácil cambiar de BD (PostgreSQL, MySQL, SQLite)

---

## 🔄 FLUJO DE UN REQUEST

```
[Frontend Component]
         │ onClick
         ▼
   [Service Call]
         │ POST /api/inventory/products
         ▼
[Backend Express Router]
         │
         ├─→ [JWT Middleware] ← ¿Token válido?
         │
         ├─→ [Authorization Middleware] ← ¿Tiene permiso?
         │
         ├─→ [Validation Middleware] ← ¿Datos válidos? (Zod)
         │
         ├─→ [Product Controller]
         │
         ├─→ [Product Service]
         │
         ├─→ [Prisma ORM]
         │
         ▼
    [PostgreSQL]
         │
         ├─→ [Audit Log Service] → INSERT en audit_logs
         │
         ▼
   [Response JSON]
         │
         ▼
[Frontend React Query]
         │
         ├─→ Actualiza cache
         ├─→ Re-renderiza componentes suscritos
         ├─→ Toast: "Producto creado"
         │
         ▼
    [User sees UI updated]
```

---

## 📦 DEPENDENCIAS PRINCIPALES

### Frontend
```json
{
  "react": "^18.0.0",
  "react-router-dom": "^6.0.0",
  "react-query": "^3.39.3",
  "zustand": "^4.3.0",
  "tailwindcss": "^3.0.0",
  "typescript": "^5.0.0",
  "axios": "^1.4.0",
  "zod": "^3.20.0"
}
```

### Backend
```json
{
  "express": "^4.18.0",
  "@prisma/client": "^5.0.0",
  "typescript": "^5.0.0",
  "jsonwebtoken": "^9.0.0",
  "bcryptjs": "^2.4.3",
  "zod": "^3.20.0",
  "winston": "^3.8.0",
  "node-cron": "^3.0.0",
  "dotenv": "^16.0.0"
}
```

---

## ⚙️ INICIALIZACIÓN RÁPIDA

```bash
# Clone
git clone <repo>

# Setup Frontend
cd frontend
npm install
cp .env.example .env
npm run dev   # http://localhost:3000

# Setup Backend (otra terminal)
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev   # http://localhost:5000

# Setup Base de datos (otra terminal)
docker-compose up postgres  # PostgreSQL en localhost:5432
```

---

## ✅ SIGUIENTE PASO

¿Comenzamos a crear la estructura de carpetas y archivos base?

Confirma y te doy los próximos pasos específicos 👇
