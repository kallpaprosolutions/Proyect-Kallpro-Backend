# 📅 PLAN DE IMPLEMENTACIÓN - 3 MESES

## VISIÓN GENERAL

Desarrollo modular de **KallpaPro** en 13 semanas (3 meses), con entregables incrementales y testing continuo.

```
SEMANA 1-2   │ SETUP INICIAL
SEMANA 3-4   │ FASE 1A: INVENTARIO (MVP)
SEMANA 5-6   │ FASE 1B: COMPRAS (Integrado con Inventario)
SEMANA 7-8   │ FASE 2A: SUBSCRIPCIÓN & PAGOS
SEMANA 9-10  │ FASE 2B: LOGÍSTICA
SEMANA 11-12 │ FASE 3: FINANCIERO & VENTAS (Básico)
SEMANA 13    │ PULISH, TESTING E2E, OPTIMIZACIÓN
```

---

## 📍 SEMANA 1-2: SETUP INICIAL

### Objetivo
Tener la estructura base lista: repos, DB local, auth funcionando, deploy en staging.

### Tareas

#### Semana 1 - Infraestructura
- [ ] Crear GitHub repos (frontend, backend)
- [ ] Configurar structure de carpetas (según ESTRUCTURA_PROYECTO.md)
- [ ] Crear .env.example files
- [ ] Configurar docker-compose.yml
  - PostgreSQL 15
  - Seed inicial
  - Volúmenes persistentes
- [ ] Configurar linting (ESLint, Prettier)
- [ ] Setup CI/CD básico (GitHub Actions)

**Archivos a crear:**
```
frontend/
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── .env.example
└── package.json

backend/
├── tsconfig.json
├── .env.example
├── package.json
└── prisma/
    └── schema.prisma (esquema base)

docker-compose.yml
.gitignore
```

#### Semana 1 - Backend Inicial
- [ ] Express server básico
- [ ] Prisma setup + PostgreSQL connection
- [ ] Winston logger setup
- [ ] Error handler middleware
- [ ] CORS configuration

**Archivos:**
```
backend/src/
├── index.ts (express server)
├── config/
│   ├── database.ts
│   ├── environment.ts
│   └── cors.ts
├── middleware/
│   ├── errorHandler.ts
│   └── logging.ts
└── types/
    └── express.d.ts
```

#### Semana 2 - Autenticación
- [ ] Database schema: users, companies, roles, permissions
- [ ] Auth routes: register, login
- [ ] JWT token generation + refresh tokens
- [ ] Password hashing (bcrypt)
- [ ] Auth middleware (verificar JWT)
- [ ] Sendgrid setup para emails
- [ ] Forgot password + reset password flow

**DB Schema:**
```sql
-- companies (tenants)
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(100),
  subscription_plan VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'USER',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- roles (para RLS)
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT
);

-- permissions
CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  module VARCHAR(50) NOT NULL, -- 'inventory', 'purchases', etc
  action VARCHAR(50) NOT NULL, -- 'view', 'create', 'edit', 'delete'
  description TEXT
);

-- audit_logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action VARCHAR(100),
  entity_type VARCHAR(50),
  entity_id VARCHAR(255),
  changes JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Archivos Backend:**
```
backend/src/
├── routes/
│   └── auth.routes.ts
├── controllers/
│   └── auth.controller.ts
├── services/
│   ├── auth.service.ts
│   ├── token.service.ts
│   └── email.service.ts
├── validators/
│   └── auth.validator.ts
└── middleware/
    └── auth.ts

prisma/
├── schema.prisma (users, companies, roles)
└── migrations/
    └── 001_init
```

#### Semana 2 - Frontend Inicial
- [ ] React + Vite setup
- [ ] React Router structure
- [ ] Tailwind + shadcn/ui setup
- [ ] Auth pages (Login, Register, ForgotPassword)
- [ ] Protected routes
- [ ] Zustand auth store
- [ ] API service layer (axios)

**Archivos Frontend:**
```
frontend/src/
├── pages/
│   └── auth/
│       ├── LoginPage.tsx
│       ├── RegisterPage.tsx
│       └── ForgotPasswordPage.tsx
├── components/
│   ├── forms/
│   │   └── LoginForm.tsx
│   └── common/
│       └── ProtectedRoute.tsx
├── services/
│   ├── api.ts (axios instance)
│   └── auth.service.ts
├── store/
│   └── authStore.ts
├── types/
│   ├── auth.ts
│   └── api.ts
└── App.tsx
```

### Entregable
✅ Usuario puede registrarse → recibe email → resetea password → login → ve dashboard vacío

### KPIs
- Auth tests: >85% coverage
- Performance: login < 500ms
- Deploy a staging funcional

---

## 🔵 SEMANA 3-4: FASE 1A - INVENTARIO (MVP)

### Objetivo
Módulo de Inventario 100% funcional: CRUD productos, movimientos de stock, alertas.

#### DB Schema
```sql
-- productos
CREATE TABLE products (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  sku VARCHAR(100) UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(12,2),
  cost DECIMAL(12,2),
  category_id UUID,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- categorías
CREATE TABLE product_categories (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT
);

-- stock
CREATE TABLE inventory (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_on_hand INT DEFAULT 0,
  quantity_reserved INT DEFAULT 0,
  reorder_point INT,
  reorder_quantity INT,
  warehouse_location VARCHAR(100),
  last_updated TIMESTAMP DEFAULT NOW()
);

-- movimientos
CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  type VARCHAR(50), -- 'IN', 'OUT', 'ADJUSTMENT', 'RETURN'
  quantity INT NOT NULL,
  reference VARCHAR(100), -- PO number, order number, etc
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- alertas
CREATE TABLE stock_alerts (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  alert_type VARCHAR(50), -- 'LOW_STOCK', 'OVERSTOCK'
  threshold INT,
  is_active BOOLEAN,
  created_at TIMESTAMP
);
```

#### Backend Tasks (Semana 3)
- [ ] Crear inventory.routes.ts
- [ ] CRUD controllers (products)
  - GET /api/inventory/products
  - POST /api/inventory/products
  - PUT /api/inventory/products/:id
  - DELETE /api/inventory/products/:id
- [ ] Stock service
  - GET /api/inventory/stock/:productId
  - POST /api/inventory/movements (registrar movimiento)
  - GET /api/inventory/movements (historial)
- [ ] Validaciones (Zod)
  - Crear producto: name, sku, price, cost
  - Movimiento: quantity, type, reference
- [ ] Tests unitarios para services

**Archivos:**
```
backend/src/
├── routes/
│   └── inventory.routes.ts
├── controllers/
│   └── inventory/
│       ├── product.controller.ts
│       ├── stock.controller.ts
│       └── movement.controller.ts
├── services/
│   └── inventory/
│       ├── product.service.ts
│       ├── stock.service.ts
│       └── movement.service.ts
├── validators/
│   └── inventory.validator.ts

prisma/
└── migrations/
    └── 002_inventory
```

#### Frontend Tasks (Semana 3)
- [ ] Inventory layout + sidebar integration
- [ ] Products list page (tabla con paginación)
  - GET /api/inventory/products
  - Tabla sorteable, filtrable
- [ ] Create product modal/form
- [ ] Edit product modal
- [ ] Delete product (soft delete)
- [ ] Stock movements page
- [ ] Alerts page

**Archivos:**
```
frontend/src/
├── pages/
│   └── inventory/
│       ├── ProductListPage.tsx
│       ├── CreateProductPage.tsx
│       ├── EditProductPage.tsx
│       ├── StockMovementsPage.tsx
│       └── AlertsPage.tsx
├── components/
│   ├── tables/
│   │   └── ProductTable.tsx
│   └── forms/
│       ├── ProductForm.tsx
│       └── MovementForm.tsx
├── services/
│   └── inventory.service.ts
└── hooks/
    └── useInventory.ts
```

#### Semana 4 - Completar Inventario
- [ ] Stock alerts cron job
- [ ] Reportes de inventario básicos
- [ ] Excel export (productos + movimientos)
- [ ] Integración con Compras (reservar stock al crear OC)
- [ ] E2E tests
- [ ] Performance: listar 10k productos < 300ms

### Entregable
✅ Inventario completo:
- Crear/editar/eliminar productos
- Ver stock en tiempo real
- Registrar entradas/salidas
- Ver historial de movimientos
- Alertas de stock bajo

### KPIs
- Tests: >80% coverage
- UI responsive (mobile + desktop)
- Performance: < 300ms en listar productos
- 0 SQL errors, 0 security issues

---

## 🟠 SEMANA 5-6: FASE 1B - COMPRAS

### Objetivo
Módulo de Compras integrado con Inventario: OC, proveedores, aprobaciones.

#### DB Schema
```sql
-- proveedores
CREATE TABLE suppliers (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  payment_terms VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE
);

-- órdenes de compra
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  po_number VARCHAR(100) UNIQUE,
  status VARCHAR(50), -- 'DRAFT', 'SUBMITTED', 'APPROVED', 'RECEIVED', 'CANCELLED'
  total_amount DECIMAL(12,2),
  delivery_date DATE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- ítems de OC
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2),
  line_total DECIMAL(12,2),
  received_quantity INT DEFAULT 0
);

-- aprobaciones
CREATE TABLE purchase_approvals (
  id UUID PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
  approver_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(50), -- 'PENDING', 'APPROVED', 'REJECTED'
  notes TEXT,
  decision_date TIMESTAMP
);

-- RFQ (solicitudes de presupuesto)
CREATE TABLE rfq_requests (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  description TEXT,
  quantity INT,
  created_at TIMESTAMP
);
```

#### Backend Tasks
- [ ] Suppliers CRUD
- [ ] Purchase Orders CRUD
- [ ] Status workflow (DRAFT → SUBMITTED → APPROVED → RECEIVED)
- [ ] Approval workflow
  - Obtener aprobadores según monto (config por empresa)
  - Notificaciones por email
- [ ] Validaciones
  - Monto mínimo de OC
  - Validar supplier válido
  - Prevent duplicadas
- [ ] Integración Inventario
  - Al recibir OC → aumentar stock automáticamente
  - Respetar cantidad ordenada vs recibida
- [ ] Tests

#### Frontend Tasks
- [ ] Suppliers page (list, create, edit)
- [ ] Purchase Orders list (con status badge)
- [ ] Create/Edit PO (multi-item form)
- [ ] Approval workflow UI
  - Si soy aprobador → veo lista de OC por aprobar
  - Botones aprobar/rechazar
- [ ] Integration con Inventario
  - Ver stock disponible al crear OC
  - Auto-completar info de productos

### Entregable
✅ Compras completo:
- Gestionar proveedores
- Crear órdenes de compra
- Flujo de aprobación
- Recibir productos → actualizar stock
- Historial de compras

---

## 💜 SEMANA 7-8: FASE 2A - SUBSCRIPCIÓN & PAGOS

### Objetivo
Sistema de suscripción + integración de pasarelas de pago (Uno, Kuski).

#### DB Schema
```sql
-- planes
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY,
  name VARCHAR(100), -- 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'
  price_monthly DECIMAL(10,2),
  description TEXT,
  features JSONB, -- {inventory: true, purchases: true, ...}
  max_users INT,
  max_products INT,
  is_active BOOLEAN
);

-- suscripciones
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(50), -- 'TRIAL', 'ACTIVE', 'PAUSED', 'CANCELLED'
  billing_email VARCHAR(255),
  start_date DATE,
  renewal_date DATE,
  trial_ends_at TIMESTAMP,
  cancelled_at TIMESTAMP
);

-- historial de facturación
CREATE TABLE billing_history (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  subscription_id UUID NOT NULL,
  amount DECIMAL(10,2),
  status VARCHAR(50), -- 'PENDING', 'PAID', 'FAILED'
  payment_method_id UUID,
  payment_provider VARCHAR(50), -- 'UNO', 'KUSKI'
  transaction_id VARCHAR(255),
  invoice_date TIMESTAMP,
  due_date TIMESTAMP,
  paid_date TIMESTAMP
);

-- métodos de pago
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  type VARCHAR(50), -- 'CARD', 'BANK_TRANSFER'
  last_four_digits VARCHAR(4),
  expiry_date VARCHAR(7), -- MM/YY
  is_default BOOLEAN,
  token_encrypted VARCHAR(500), -- Token de pasarela cifrado
  created_at TIMESTAMP
);
```

#### Backend Tasks
- [ ] Subscription routes
  - GET /api/subscriptions/plans
  - GET /api/subscriptions/current
  - POST /api/subscriptions/select-plan
- [ ] Payment routes
  - POST /api/payments/uno/create-order
  - POST /api/payments/kuski/create-order
- [ ] Webhook handlers
  - POST /api/webhooks/uno
  - POST /api/webhooks/kuski
- [ ] Payment service
  - Validar suscripción activa antes de permitir funcionalidad
  - Feature gate (si plan no incluye módulo → bloquear)
- [ ] Billing service
  - Generar facturas automáticas
  - Enviar recordatorios 7 días antes de renovación
  - Auto-renovación (si payment method válido)
- [ ] Cron jobs
  - Check renovaciones diarias
  - Generar facturas
- [ ] Tests

#### Frontend Tasks
- [ ] Pricing page (mostrar planes)
- [ ] Checkout flow
  - Seleccionar plan
  - Ingresar info de pago (en iframe de pasarela)
  - Confirmación
- [ ] Subscription management page
  - Ver plan actual
  - Cambiar plan (upgrade/downgrade)
  - Cancelar suscripción
- [ ] Billing history
  - Listar facturas
  - Descargar PDF
- [ ] Feature gates
  - Si módulo no está en plan → mostrar "upgrade required"
- [ ] Payment method management

### Entregable
✅ Suscripción y pagos funcionando:
- Usuarios pueden seleccionar plan
- Pagar con Uno o Kuski
- Auto-renovación
- Feature gating por plan

---

## 🚚 SEMANA 9-10: FASE 2B - LOGÍSTICA

### Objetivo
Módulo de Logística: seguimiento, proveedores logísticos, tracking en tiempo real.

#### DB Schema
```sql
-- proveedores logísticos
CREATE TABLE logistics_providers (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  name VARCHAR(255),
  api_key_encrypted VARCHAR(500),
  api_endpoint VARCHAR(255),
  type VARCHAR(50), -- 'COURIER', 'FREIGHT', 'INTERNATIONAL'
  is_active BOOLEAN
);

-- envíos
CREATE TABLE shipments (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  reference VARCHAR(100), -- OC number o sales order
  provider_id UUID REFERENCES logistics_providers(id),
  tracking_number VARCHAR(100) UNIQUE,
  origin_address TEXT,
  destination_address TEXT,
  status VARCHAR(50), -- 'PENDING', 'IN_TRANSIT', 'DELIVERED', 'FAILED'
  estimated_delivery DATE,
  actual_delivery_date DATE,
  weight DECIMAL(10,2),
  value DECIMAL(12,2),
  created_at TIMESTAMP
);

-- eventos de tracking
CREATE TABLE tracking_events (
  id UUID PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES shipments(id),
  status VARCHAR(50),
  location VARCHAR(255),
  timestamp TIMESTAMP,
  notes TEXT
);

-- rutas
CREATE TABLE shipping_routes (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  name VARCHAR(100),
  origin VARCHAR(100),
  destination VARCHAR(100),
  avg_days INT,
  cost DECIMAL(10,2),
  provider_id UUID
);
```

#### Backend Tasks
- [ ] Logistics routes
  - CRUD proveedores logísticos
  - CRUD envíos
  - GET /api/logistics/shipments/:id/track
- [ ] Tracking service
  - Llamar APIs de proveedores (Uno, Kuski, etc)
  - Actualizar status automáticamente
  - Webhook para notificaciones de cambios
- [ ] Alertas
  - Retraso en entrega
  - Problema de entrega
- [ ] Reportes
  - Tiempos de entrega promedio
  - Cost analysis
- [ ] Tests

#### Frontend Tasks
- [ ] Logistics page (dashboard)
- [ ] Shipments list
  - Status badges
  - Filtros por proveedor, estado
- [ ] Tracking detail page
  - Mapa interactivo (Mapbox)
  - Timeline de eventos
  - Información de contacto del proveedor
- [ ] Routes management
- [ ] Real-time updates (WebSocket)

### Entregable
✅ Logística completo:
- Crear envíos
- Ver tracking en tiempo real
- Historial de movimientos
- Alertas de retrasos

---

## 💰 SEMANA 11-12: FASE 3 - FINANCIERO & VENTAS (BÁSICO)

### Objetivo
Módulos Financiero y Ventas: facturas, reportes, CRM básico.

#### Financiero

**DB Schema:**
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  invoice_number VARCHAR(100) UNIQUE,
  customer_id UUID,
  supplier_id UUID,
  type VARCHAR(50), -- 'SALES', 'PURCHASE'
  status VARCHAR(50), -- 'DRAFT', 'SENT', 'PAID', 'OVERDUE'
  issue_date DATE,
  due_date DATE,
  total_amount DECIMAL(12,2),
  paid_amount DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP
);

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  description VARCHAR(255),
  quantity INT,
  unit_price DECIMAL(12,2),
  line_total DECIMAL(12,2)
);

CREATE TABLE accounts_receivable (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  customer_id UUID,
  invoice_id UUID,
  amount DECIMAL(12,2),
  due_date DATE,
  payment_date DATE
);

CREATE TABLE accounts_payable (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  supplier_id UUID,
  invoice_id UUID,
  amount DECIMAL(12,2),
  due_date DATE,
  payment_date DATE
);

CREATE TABLE financial_reports (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  report_type VARCHAR(50), -- 'INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW'
  period_start DATE,
  period_end DATE,
  data JSONB,
  created_at TIMESTAMP
);
```

**Backend Tasks:**
- [ ] Invoice CRUD
- [ ] Generate reports
  - Ventas por mes
  - Cuentas por cobrar/pagar
  - Balance básico
- [ ] Auto-generate invoices desde sales orders
- [ ] Payment tracking
- [ ] Cron: generar reportes mensuales
- [ ] Tests

**Frontend Tasks:**
- [ ] Invoices list (filtros por estado)
- [ ] Create/edit invoice
- [ ] PDF export
- [ ] Reports dashboard
  - Gráficos de ventas
  - CxC vs CxP
  - Flujo de caja
- [ ] Accounts management

#### Ventas

**DB Schema:**
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  industry VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE sales_opportunities (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  customer_id UUID,
  name VARCHAR(255),
  amount DECIMAL(12,2),
  stage VARCHAR(50), -- 'LEAD', 'PROSPECT', 'QUALIFIED', 'PROPOSAL', 'CLOSED_WON'
  probability INT, -- 0-100
  expected_close_date DATE,
  owner_id UUID
);

CREATE TABLE quotes (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  customer_id UUID,
  quote_number VARCHAR(100) UNIQUE,
  status VARCHAR(50), -- 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'
  amount DECIMAL(12,2),
  valid_until DATE
);

CREATE TABLE sales_orders (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  customer_id UUID,
  so_number VARCHAR(100) UNIQUE,
  status VARCHAR(50), -- 'DRAFT', 'PENDING', 'SHIPPED', 'DELIVERED'
  total_amount DECIMAL(12,2),
  created_at TIMESTAMP
);
```

**Backend Tasks:**
- [ ] CRM routes
  - CRUD customers
  - CRUD opportunities
  - CRUD quotes
- [ ] Sales service
  - Listar opportunities por stage
  - Cálcular revenue forecast
- [ ] Quote generation (similar a invoices)
- [ ] Tests

**Frontend Tasks:**
- [ ] Customers list
- [ ] Sales pipeline (Kanban view)
  - Arrastra oportunidad entre stages
- [ ] Customer detail page
  - Historial de quotes/orders
  - Notas
- [ ] Create quote
  - Auto-generar desde productos
- [ ] Sales metrics
  - Revenue por mes
  - Conversion funnel
- [ ] Forecasting

### Entregable
✅ Financiero + Ventas básico:
- Crear/editar facturas
- Ver reportes financieros
- Gestionar clientes
- Pipeline de ventas
- Cotizaciones

---

## 🎯 SEMANA 13: PULISH, TESTING & OPTIMIZACIÓN

### Objetivo
Hacer la app ready para producción.

#### Tasks
- [ ] E2E testing completo
  - Registro usuario
  - Crear producto
  - Crear OC
  - Hacer pago
  - Ver reportes
- [ ] Performance
  - Audit PageSpeed Insights
  - Optimizar imágenes
  - Lazy loading de módulos
  - Database query analysis
- [ ] Security
  - Penetration testing básico
  - Validar no hay hardcoded secrets
  - SSL/HTTPS configurado
- [ ] Documentation
  - README actualizado
  - API docs (Swagger)
  - User guide PDF
  - Developer guide
- [ ] Bug fixes
  - Revisar closed issues
  - Fix critical bugs
- [ ] Deploy a producción
  - AWS/Vercel setup
  - Database backup
  - CI/CD pipeline
  - Monitoring setup (Sentry, Better Stack)

### Entregable
✅ KallpaPro v1.0 en producción
- Todos los módulos funcionando
- Tests > 75% coverage
- Documentación completa
- 99.9% uptime

---

## 📊 HITOS Y REVISIONES

```
Fin Semana 2:  Auth + setup ✓
Fin Semana 4:  Inventario MVP ✓
Fin Semana 6:  Compras + Inventario integrados ✓
Fin Semana 8:  Subscripción + Pagos ✓
Fin Semana 10: Logística ✓
Fin Semana 12: Financiero + Ventas ✓
Fin Semana 13: v1.0 en producción ✓
```

---

## 🛑 CRITERIOS DE ACEPTACIÓN

Cada módulo es **LISTO** cuando:

✅ **Backend**
- [ ] Endpoints documentados (Swagger)
- [ ] Validación de inputs
- [ ] Error handling
- [ ] Auth + Authorization
- [ ] Audit logging
- [ ] Tests: >80% coverage
- [ ] Query optimization
- [ ] Rate limiting

✅ **Frontend**
- [ ] UI responsiva (mobile + desktop)
- [ ] Accesibilidad WCAG 2.1 AA
- [ ] Formularios con validación
- [ ] Loading states
- [ ] Error messages claros
- [ ] Tests: >75% coverage
- [ ] Performance: < 300ms load time

✅ **Base de Datos**
- [ ] Migrations creadas
- [ ] Índices en queries frecuentes
- [ ] RLS policies configuradas
- [ ] Soft deletes para audit
- [ ] Backup strategy

✅ **Documentación**
- [ ] README
- [ ] API docs
- [ ] Schema documentation
- [ ] Deployment guide

---

## 🚀 PRÓXIMOS PASOS INMEDIATOS

1. ✅ Revisar plan (¿cambios?, ¿preguntas?)
2. ⏳ Crear repos en GitHub
3. ⏳ Comenzar Semana 1: Setup inicial
4. ⏳ Daily standups: qué hiciste, qué harás, blockers

¿Estás listo para comenzar? 🎉
