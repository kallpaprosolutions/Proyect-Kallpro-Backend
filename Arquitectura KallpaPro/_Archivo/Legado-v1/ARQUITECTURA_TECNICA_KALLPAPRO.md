# 🏗️ ARQUITECTURA TÉCNICA - KallpaPro

## 1. VISIÓN GENERAL DEL PROYECTO

**KallpaPro** es una plataforma B2B SaaS enfocada en asesorías para PYMEs, que integra 5 módulos operacionales con un modelo de suscripción flexible.

### Objetivos Técnicos:
- Escalabilidad horizontal para múltiples empresas (multi-tenancy)
- Seguridad empresarial (autenticación, autorización, cifrado)
- Modularidad: agregar/actualizar módulos sin impactar otros
- Performance: respuesta <200ms en operaciones críticas
- Disponibilidad: 99.9% uptime

---

## 2. STACK TECNOLÓGICO

### Frontend
```
React 18.x
├── TypeScript (type-safety)
├── React Query (state management + API caching)
├── Tailwind CSS (styling)
├── shadcn/ui (component library)
├── React Router v6 (routing)
├── Zustand (global state para auth/user)
└── Recharts (gráficos/dashboards)
```

### Backend
```
Node.js 20.x + Express.js
├── TypeScript
├── Prisma ORM (database abstraction)
├── JWT + refresh tokens (auth)
├── Winston (logging)
├── Joi/Zod (validation)
├── node-cron (scheduled tasks)
└── Socket.io (real-time notifications)
```

### Base de Datos
```
PostgreSQL 15.x
├── Multi-tenancy via tenant_id
├── Row Level Security (RLS)
├── UUID como primary keys
├── Soft deletes (is_deleted boolean)
└── Audit tables para compliance
```

### Infraestructura
```
Deployment
├── Docker (containerización)
├── Docker Compose (desarrollo)
├── AWS/Vercel (hosting opcionales)
├── GitHub Actions (CI/CD)
└── Environment-based configs (.env)

APIs Externas
├── Pasarelas de pago: Uno, Kuski
├── SendGrid (emails)
└── Cloudinary (file storage)
```

---

## 3. ARQUITECTURA DE CAPAS

```
┌─────────────────────────────────────────┐
│        Frontend (React SPA)               │
│  Components → Pages → Hooks → Services  │
└────────────────┬────────────────────────┘
                 │ (REST API + WebSocket)
┌────────────────▼────────────────────────┐
│      Backend (Node.js/Express)           │
│  Routes → Controllers → Services → DB   │
│              │                            │
│      Middleware Layer                    │
│  (Auth, Validation, Error Handling)     │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│    PostgreSQL Database                   │
│  (Tables, Views, RLS Policies)          │
└─────────────────────────────────────────┘
```

---

## 4. ESTRUCTURA DE MÓDULOS

### Módulo 1: INVENTARIO (Fase 1)
**Responsabilidades:**
- Registro de productos/servicios
- Gestión de stock
- Categorización
- Alertas de stock bajo

**Tablas BD:**
- `products` - catálogo
- `inventory_movements` - entradas/salidas
- `stock_alerts` - alertas configurables
- `product_categories` - categorización

---

### Módulo 2: LOGÍSTICA (Fase 2)
**Responsabilidades:**
- Seguimiento de pedidos
- Gestión de proveedores
- Rutas de envío
- Tracking en tiempo real

**Tablas BD:**
- `suppliers` - información de proveedores
- `shipments` - envíos
- `shipping_routes` - rutas
- `tracking_events` - historial de movimiento

---

### Módulo 3: COMPRAS (Fase 1.5)
**Responsabilidades:**
- Órdenes de compra
- Solicitudes de presupuesto (RFQ)
- Aprobaciones
- Historial de compras

**Tablas BD:**
- `purchase_orders` - órdenes
- `purchase_items` - ítems por orden
- `rfq_requests` - solicitudes de presupuesto
- `purchase_approvals` - flujo de aprobación

---

### Módulo 4: FINANCIERO (Fase 2.5)
**Responsabilidades:**
- Facturación
- Cuentas por cobrar/pagar
- Reportes financieros
- Conciliación bancaria

**Tablas BD:**
- `invoices` - facturas
- `invoice_items` - ítems de factura
- `accounts_receivable` - CxC
- `accounts_payable` - CxP
- `financial_reports` - reportes generados
- `bank_transactions` - movimientos bancarios

---

### Módulo 5: VENTAS (Fase 3)
**Responsabilidades:**
- Pipeline de ventas
- Gestión de clientes (CRM básico)
- Cotizaciones
- Reportes de ventas

**Tablas BD:**
- `customers` - clientes
- `sales_opportunities` - oportunidades
- `quotes` - cotizaciones
- `sales_orders` - órdenes de venta
- `sales_metrics` - métricas/KPIs

---

## 5. MODELO DE AUTENTICACIÓN & AUTORIZACIÓN

### Flujo de Autenticación
```
1. Usuario ingresa email/password
2. Backend valida contra tabla users
3. Si es válido → genera JWT (acceso + refresh)
4. Frontend almacena tokens en memory (acceso) + httpOnly cookie (refresh)
5. Cada request incluye Authorization: Bearer {token}
6. Middleware valida JWT
```

### Estructura de Roles y Permisos
```
ROLES (enum):
- ADMIN (superusuario de la empresa)
- MANAGER (gestor de módulo)
- USER (usuario estándar)
- VIEWER (solo lectura)

PERMISOS (granulares por módulo):
- inventory.view / .create / .edit / .delete
- logistics.view / .create / .edit / .delete
- purchases.view / .approve / .reject
- financials.view / .export
- sales.view / .manage
```

### Multi-tenancy
```
- Cada usuario pertenece a una EMPRESA (tenant)
- Cada query filtra automáticamente por tenant_id
- Row Level Security (RLS) en PostgreSQL como segunda capa
- Imposible acceder datos de otro tenant aunque hagas SQL injection
```

---

## 6. SISTEMA DE SUSCRIPCIÓN

### Modelos de Suscripción
```
PLAN_STARTER ($29/mes)
├── Inventario: ✓ (máx 5000 productos)
├── Compras: ✓ (máx 200 OC/mes)
├── Logística: ✗
├── Financiero: ✗
├── Ventas: ✗
└── Usuarios: 3

PLAN_PROFESSIONAL ($99/mes)
├── Inventario: ✓ (ilimitado)
├── Compras: ✓ (ilimitado)
├── Logística: ✓ (básico)
├── Financiero: ✓ (lectura)
├── Ventas: ✓ (básico)
└── Usuarios: 10

PLAN_ENTERPRISE (custom)
├── Todos los módulos ilimitados
├── Usuarios: ilimitados
├── Soporte: dedicado
└── Integraciones: custom
```

### Tablas de Suscripción
```
- subscriptions (id, empresa_id, plan, status, fecha_inicio, fecha_fin)
- subscription_features (suscripcion_id, feature, enabled)
- billing_history (empresa_id, monto, fecha, status, pasarela_pago)
- payment_methods (empresa_id, tipo, token_encriptado)
```

---

## 7. INTEGRACIONES DE PAGO

### Flujo de Pago
```
1. Usuario selecciona plan
2. Redirige a formulario de pago (iframe de pasarela)
3. Usuario ingresa tarjeta
4. Webhook recibe confirmación de pago
5. Sistema actualiza subscription status
6. Usuario obtiene acceso inmediato
```

### Pasarelas Soportadas
```
UNO (locales)
├── Endpoint: /api/payments/uno/create-order
├── Webhook: POST /api/webhooks/uno
└── Datos: monto, descripción, email cliente

KUSKI (locales/internacionales)
├── Endpoint: /api/payments/kuski/create-order
├── Webhook: POST /api/webhooks/kuski
└── Datos: monto, descripción, email cliente
```

---

## 8. SEGURIDAD

### Medidas Implementadas
```
✓ HTTPS obligatorio
✓ JWT con expiración (acceso 15min, refresh 7días)
✓ Hashing de passwords: bcrypt (salt rounds: 12)
✓ CORS configurado (origins whitelist)
✓ Rate limiting: 100 req/min por IP
✓ SQL Injection: Prisma ORM parameterizado
✓ XSS: React escapa contenido por defecto
✓ CSRF: Tokens en headers (no cookies para API)
✓ Audit logs: cada acción crítica se registra
✓ Encriptación de datos sensibles (pagos, documentos)
✓ RLS en PostgreSQL (row-level security)
✓ Secrets en variables de entorno
```

---

## 9. ESTRUCTURA DE ENDPOINTS

### Autenticación
```
POST   /api/auth/register          - Registro de usuario
POST   /api/auth/login             - Login
POST   /api/auth/refresh-token     - Renovar JWT
POST   /api/auth/logout            - Logout
POST   /api/auth/forgot-password   - Recuperar contraseña
POST   /api/auth/reset-password    - Resetear contraseña
```

### Subscripción & Facturación
```
GET    /api/subscriptions/plans    - Listar planes
POST   /api/subscriptions/select   - Seleccionar plan
GET    /api/subscriptions/current  - Ver suscripción actual
GET    /api/billing/history        - Historial de pagos
POST   /api/payments/{provider}/create - Crear orden de pago
```

### Inventario
```
GET    /api/inventory/products              - Listar productos
POST   /api/inventory/products              - Crear producto
PUT    /api/inventory/products/:id          - Actualizar producto
DELETE /api/inventory/products/:id          - Eliminar producto
GET    /api/inventory/stock/:productId      - Stock actual
POST   /api/inventory/movements             - Registrar movimiento
GET    /api/inventory/alerts                - Alertas de stock
```

### Compras
```
GET    /api/purchases/orders                - Listar OC
POST   /api/purchases/orders                - Crear OC
PUT    /api/purchases/orders/:id            - Actualizar OC
POST   /api/purchases/orders/:id/approve    - Aprobar OC
GET    /api/purchases/suppliers             - Listar proveedores
POST   /api/purchases/rfq                   - Solicitar presupuesto
```

### Logística
```
GET    /api/logistics/shipments             - Listar envíos
POST   /api/logistics/shipments             - Crear envío
GET    /api/logistics/shipments/:id/track   - Rastrear envío
GET    /api/logistics/suppliers             - Listar proveedores logísticos
```

### Financiero
```
GET    /api/financials/invoices             - Listar facturas
POST   /api/financials/invoices             - Crear factura
GET    /api/financials/reports              - Reportes (balance, P&L)
GET    /api/financials/accounts-receivable  - CxC
GET    /api/financials/accounts-payable     - CxP
```

### Ventas
```
GET    /api/sales/customers                 - Listar clientes
POST   /api/sales/customers                 - Crear cliente
GET    /api/sales/opportunities             - Pipeline
POST   /api/sales/opportunities             - Crear oportunidad
GET    /api/sales/quotes                    - Listar cotizaciones
POST   /api/sales/quotes                    - Crear cotización
```

---

## 10. FLUJO DE DATOS (Ejemplo: Crear Producto)

```
[Frontend]
  Usuario → Form completa → Click "Guardar"
              ↓
         onClick handler llama API client
              ↓
         POST /api/inventory/products
              ↓
[Backend]
  Express Router → inventoryRoutes
              ↓
  Middleware: authenticateToken (JWT válido?)
              ↓
  Middleware: authorize (puede crear productos?)
              ↓
  Controller: createProduct
              ↓
  Service: validateProduct → Zod schema
              ↓
  Service: checkQuota (¿limitado en plan?)
              ↓
  Prisma ORM: create producto en BD
              ↓
  Audit Log: registra creación
              ↓
  Response: {id, nombre, precio, ...}
              ↓
[Frontend]
  React Query actualiza cache
              ↓
  UI refresca lista de productos
              ↓
  Toast: "Producto creado"
```

---

## 11. CONSIDERACIONES DE PERFORMANCE

### Caching
```
Frontend:
- React Query con staleTime: 5min
- LocalStorage para user profile
- Service Workers para offline mode

Backend:
- Redis cache (opcional) para datos frecuentes
- Database connection pooling (Pool de 20 conexiones)
- Índices en: tenant_id, user_id, created_at
```

### Optimizaciones
```
- Pagination: máximo 50 registros por página
- Lazy loading en tablas grandes
- Índices compuestos en queries frecuentes
- Query analysis: EXPLAIN ANALYZE
- CDN para archivos estáticos
```

---

## 12. TESTING

### Frontend
```
Jest + React Testing Library
- Unit tests: componentes
- Integration tests: flujos completos
- E2E: Cypress (login, crear inventario, etc)
```

### Backend
```
Jest + Supertest
- Unit tests: services
- Integration tests: endpoints con BD real
- Load testing: Artillery
```

---

## 13. DEPLOYMENT

### Development
```
docker-compose up
- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- PostgreSQL: localhost:5432
```

### Production
```
Option A: AWS
- Frontend: CloudFront + S3
- Backend: EC2 + RDS PostgreSQL
- Pagos: APIs officialesde pasarelas

Option B: Vercel + Render
- Frontend: Vercel
- Backend: Render
- BD: Render PostgreSQL
```

---

## 14. MONITOREO Y LOGS

```
Backend Logging:
- Winston: niveles (error, warn, info, debug)
- Contexto: userId, tenantId, requestId
- Rotación diaria: logs/app-YYYY-MM-DD.log

Uptime Monitoring:
- Sentry (error tracking)
- Better Stack (logs aggregation)
- Grafana (métricas)

Alertas:
- Error rate > 5% → Slack notification
- Respuesta > 1s → log y análisis
- Downtime → incident management
```

---

## 15. ROADMAP 3 MESES

### SEMANA 1-2: SETUP INICIAL
- [ ] Configurar repo con estructura base
- [ ] Setup BD local (PostgreSQL + migrations)
- [ ] Autenticación básica (registro/login)
- [ ] Deploy inicial a staging

### FASE 1 (SEMANA 3-6): INVENTARIO + COMPRAS
- [ ] Módulo Inventario completo
- [ ] Módulo Compras completo
- [ ] Integración de ambos
- [ ] Testing unitario

### FASE 1.5 (SEMANA 7-8): SUBSCRIPCIÓN
- [ ] Modelo de planes
- [ ] Integración Uno
- [ ] Integración Kuski
- [ ] Webhooks de pago

### FASE 2 (SEMANA 9-12): LOGÍSTICA + FINANCIERO
- [ ] Módulo Logística
- [ ] Módulo Financiero
- [ ] Reportes básicos
- [ ] E2E testing

### FASE 3 (SEMANA 13+): VENTAS + PULISH
- [ ] Módulo Ventas
- [ ] CRM básico
- [ ] Optimizaciones performance
- [ ] Deploy a producción

---

## 16. DEFINICIÓN DE LISTO (Definition of Done)

Cada módulo está LISTO cuando:
- ✓ Backend: endpoints funcionan, validación, error handling
- ✓ Frontend: UI responsiva, accesibilidad, formularios validados
- ✓ BD: migrations, índices, RLS políticas
- ✓ Tests: cobertura > 80%
- ✓ Documentación: README, API docs (Swagger)
- ✓ Security: revisión de código, no hardcoded secrets
- ✓ Performance: < 200ms response time

---

## PRÓXIMOS PASOS

1. ✅ Revisar arquitectura (¿cambios?, ¿preguntas?)
2. ⏳ Crear estructura de carpetas
3. ⏳ Inicializar repos (frontend + backend)
4. ⏳ Setup base de datos
5. ⏳ Crear componentes de auth
