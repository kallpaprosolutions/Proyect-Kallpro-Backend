# Prompts para Recrear — KallpaPro
> Prompts Markdown para que Claude recree cada módulo desde cero.
> Usar en orden. Cada prompt asume que el anterior ya fue completado.

---

## PROMPT 0 — Entorno Docker + Node.js

```
Configura el entorno de desarrollo para KallpaPro en Windows 11.

Stack:
- Node.js 20 LTS
- Docker Desktop con PostgreSQL 15
- Backend: Express + TypeScript en C:\Proyect-Kallpro\Proyect-Kallpro-Backend
- Frontend: React + Vite en C:\Proyect-Kallpro\Proyect-Kallpro-Frontend

Pasos a ejecutar en PowerShell:
1. Desactivar PostgreSQL local: Stop-Service -Name "postgresql*" -Force
2. Crear contenedor Docker: docker run --name kallpapro-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=kallpapro -p 5432:5432 -d postgres:15
3. Crear backend: mkdir Proyect-Kallpro-Backend && cd Proyect-Kallpro-Backend && npm init -y
4. Instalar dependencias backend: npm install express cors dotenv @prisma/client bcryptjs jsonwebtoken zod multer pdf-parse@1.1.1 xml2js node-cron winston
5. Instalar dev deps: npm install --save-dev typescript ts-node nodemon @types/node @types/express @types/cors @types/bcryptjs @types/jsonwebtoken @types/multer @types/pdf-parse @types/xml2js prisma
6. Crear tsconfig.json (target ES2020, module CommonJS, outDir dist, rootDir src, strict true, esModuleInterop true)
7. Crear .env con: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/kallpapro, JWT_SECRET=kallpapro_super_secret_jwt_key_2024_development, JWT_REFRESH_SECRET=kallpapro_super_secret_refresh_key_2024_development, PORT=5000
8. Inicializar Prisma: npx prisma init
9. Crear frontend: npm create vite@latest Proyect-Kallpro-Frontend -- --template react-ts && cd Proyect-Kallpro-Frontend && npm install
10. Instalar deps frontend: npm install react-router-dom zustand axios @tanstack/react-query zod && npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p
11. Configurar vite.config.ts con proxy /api → localhost:5000
```

---

## PROMPT 1 — Schema Base de Datos

```
Crea el schema Prisma completo para KallpaPro ERP multi-tenant.

Modelos requeridos (25 tablas):

TENANTS:
- Company: id, name, email?, phone?, industry?
- User: id, companyId (FK), email (UNIQUE), passwordHash, firstName?, lastName?, role (default USER), isActive, lastLoginAt?

INVENTARIO:
- Category: id, companyId, name, description?, parentId? (auto-referencia)
- Warehouse: id, companyId, name, code?, address?, isDefault (bool), isActive
- Product: id, companyId, sku?, barcode?, name, description?, categoryId?, unit (default UNIDAD), salePrice Decimal(12,2), avgCost Decimal(12,4), minStock Decimal(12,4), maxStock?, isActive, type (default PRODUCT), lastMovementAt?
- ProductStock: productId+warehouseId UNIQUE, quantity Decimal(12,4), reserved Decimal(12,4)
- InventoryMovement: id, companyId, productId, warehouseId, type (IN/OUT/ADJUSTMENT_IN/ADJUSTMENT_OUT), quantity, unitCost, totalCost, avgCostAfter, stockAfter, reference?, notes?, createdBy?

COMPRAS:
- Supplier: id, companyId, name, ruc?, email?, phone?, address?, city?, country?, paymentTerms?, isActive
- PurchaseOrder: id, companyId, supplierId, poNumber (UNIQUE), status (default DRAFT), totalAmount, deliveryDate?, notes?
- POItem: id, poId, productId?, quantity (Int), unitPrice, lineTotal, receivedQuantity (default 0)

FINANCIERO:
- Invoice: id, companyId, number (UNIQUE), type (SALES/PURCHASE), status (default DRAFT), totalAmount, paidAmount (default 0), issueDate, dueDate?, notes?
- InvoiceItem: id, invoiceId, description, quantity (Int), unitPrice, lineTotal
- SubscriptionPlan: id, name (UNIQUE), priceMonthly, description?, features, maxUsers?, maxProducts?
- Subscription: id, companyId (UNIQUE FK), planId, status (default TRIAL), billingEmail?, startDate, renewalDate?, trialEndsAt?, cancelledAt?
- BillingHistory: id, companyId, subscriptionId (FK), amount, status, paymentProvider?, transactionId?, invoiceDate, dueDate?, paidDate?

SRI ECUADOR:
- SriDocument: id, companyId, status (PENDING_REVIEW|CONFIRMED|REJECTED), tipoDocumento, claveAcceso, rucEmisor, razonSocialEmisor, nombreComercial?, dirEmisor?, contribuyenteEspecial?, obligadoContabilidad (bool), tipoIdComprador?, idComprador?, razonSocialComprador?, dirComprador?, estab?, ptoEmi?, secuencial?, numeroDoc?, fechaEmision, fechaAutorizacion?, ambiente?, subtotal0-8-12-15-NoObj-Exento-Descuento-ICE-IVA-IRBPNR-Propina Decimals(12,2), total Decimal(12,2), formaPago?, valorFormaPago?, retencionRenta?, retencionIva?, parseConfidence Int?, parseWarnings String?, fileType?, rawJson Json?, observaciones?, supplierId? (FK), purchaseOrderId? (FK). @@unique([companyId, claveAcceso])
- SriDocumentItem: id, documentId, linea Int, codPrincipal, codAuxiliar?, descripcion, detAdicional?, cantidad Decimal(12,4), precioUnitario Decimal(12,4), descuento Decimal(12,2), precioTotal Decimal(12,2), codigoTarifa, tarifaIva Decimal(5,2), valorIva Decimal(12,2), tipoItem (PRODUCTO|SERVICIO), productId? (FK)
- SriRetention: id, documentId, tipo (RENTA|IVA), codigo, descripcion, baseImponible, porcentaje, valor
- IvaTariff: id, codigo (UNIQUE), descripcion, porcentaje Decimal(5,2), activo, vigenciaDesde, vigenciaHasta?
- RetentionCatalog: id, tipo (RENTA|IVA), codigo (UNIQUE), descripcion, porcentaje Decimal(5,2), activo, aplicaA (BIENES|SERVICIOS|AMBOS)

AUDITORÍA:
- AuditLog: id, companyId, userId?, action, entityType, entityId?, changes?, ipAddress?

Todas las tablas usan UUID como ID. Todas las tablas de empresa tienen companyId con @@index([companyId]).
```

---

## PROMPT 2 — Backend Módulo Auth

```
Crea el módulo de autenticación JWT para KallpaPro.

Archivos a crear:
1. src/types/index.ts — interface AuthPayload { userId, companyId, email, role }
2. src/middleware/auth.middleware.ts — exporta `authMiddleware`, verifica Bearer JWT, asigna req.user
3. src/services/auth.service.ts:
   - registerUser(): crea Company + User en secuencia (no transacción), rol ADMIN, bcrypt.hash(12)
   - loginUser(): bcrypt.compare → genera accessToken (15m) + refreshToken (7d)
   - verifyToken() / verifyRefreshToken()
4. src/controllers/auth.controller.ts — maneja errores EMAIL_EXISTS, INVALID_CREDENTIALS
5. src/routes/auth.routes.ts — POST /register, POST /login, POST /refresh, GET /me
6. src/index.ts — Express app, CORS, JSON, rutas /api/auth

JWT_SECRET y JWT_REFRESH_SECRET vienen del .env.
```

---

## PROMPT 3 — Backend Módulo Inventario

```
Crea el módulo de inventario para KallpaPro.

Archivos a crear:
1. src/services/inventory.service.ts con funciones:
   - getCategories(companyId), createCategory(companyId, data)
   - getWarehouses(companyId), createWarehouse(companyId, data) [primera = isDefault]
   - getProducts(companyId) [include category, stocks.warehouse], createProduct(), updateProduct()
   - registerMovement(companyId, data) [usa prisma.$transaction]:
     * tipo IN/ADJUSTMENT_IN: nuevo promedio = (stock*costo + qty*nuevoCosto) / (stock+qty)
     * tipo OUT/ADJUSTMENT_OUT: solo resta stock, costo no cambia, lanza INSUFFICIENT_STOCK si no hay
     * Upsert ProductStock + Update Product.avgCost dentro de la transacción
   - getKardex(productId, companyId, warehouseId?)
   - getInventoryKPIs(companyId): totalProducts, totalValue, lowStockCount, zeroStockCount
2. src/controllers/inventory.controller.ts
3. src/routes/inventory.routes.ts [todas las rutas con authMiddleware]

Rutas:
GET /api/inventory/categories, POST /api/inventory/categories
GET /api/inventory/warehouses, POST /api/inventory/warehouses
GET /api/inventory/products, POST /api/inventory/products
GET /api/inventory/products/:id, PATCH /api/inventory/products/:id
POST /api/inventory/movements
GET /api/inventory/products/:id/kardex
GET /api/inventory/kpis
```

---

## PROMPT 4 — Backend Módulo Compras

```
Crea el módulo de compras para KallpaPro.

Archivos a crear:
1. src/services/purchases.service.ts:
   - getSuppliers, createSupplier, updateSupplier
   - getPurchaseOrders, getPurchaseOrderById, createPurchaseOrder [poNumber auto: OC-0001]
   - updatePOStatus(id, companyId, status)
   - receivePurchaseOrder(id, companyId, warehouseId, userId):
     * Para cada POItem con productId: llamar registerMovement(IN, quantity, unitPrice, ref=poNumber)
     * Actualizar receivedQuantity en cada POItem
     * Cambiar status OC a RECEIVED
2. src/controllers/purchases.controller.ts
3. src/routes/purchases.routes.ts

Rutas:
GET/POST /api/purchases/suppliers
PATCH /api/purchases/suppliers/:id
GET/POST /api/purchases
GET /api/purchases/:id
PATCH /api/purchases/:id/status
POST /api/purchases/:id/receive [body: { warehouseId }]
```

---

## PROMPT 5 — Backend Módulo Financiero

```
Crea el módulo financiero para KallpaPro.

Archivos a crear:
1. src/services/financial.service.ts:
   - getInvoices(companyId, type?), getInvoiceById
   - createInvoice(companyId, data): prefijo FAC (SALES) o OCP (PURCHASE), auto-número
   - updateInvoiceStatus(id, companyId, status, paidAmount?)
   - getFinancialKPIs(companyId): totalSales, accountsReceivable, totalPurchases, accountsPayable, overdueReceivable, overduePayable, netCashFlow
2. src/controllers/financial.controller.ts
3. src/routes/financial.routes.ts

Rutas:
GET /api/financial/invoices?type=SALES|PURCHASE
POST /api/financial/invoices
GET /api/financial/invoices/:id
PATCH /api/financial/invoices/:id/status
GET /api/financial/kpis
```

---

## PROMPT 6 — Backend Módulo SRI Ecuador

```
Crea el módulo de procesamiento de facturas electrónicas SRI Ecuador para KallpaPro.

Parte A — Parser (src/services/sri-parser.service.ts):
- Usar pdf-parse@1.1.1 con require() (no import) — v2.x da error "not a function"
- Función nextNumber(label, maxChars=80): busca label en texto, luego primer decimal dentro de maxChars
  → resuelve el problema del layout two-column de los RIDE PDF
- parseClaveAcceso(clave): decodifica los 49 dígitos → fecha/tipo/RUC/ambiente/estab/ptoEmi/secuencial
- parsePdf(buffer): extrae RUC con regex /R\.U\.C\.[\s:]+(\d{13})/, usa nextNumber para totales
- parseXml(buffer): xml2js, nodo raíz variable (factura/notaCredito/etc.), mapeo codigoPorcentaje a tarifa IVA

Parte B — Servicio (src/services/sri-document.service.ts):
- uploadSriDocument(): parse → check duplicate @@unique[companyId,claveAcceso] → find supplier by RUC → findMatchingPO → create SriDocument+Items
- findMatchingPO(): busca OC SENT/PARTIAL/DRAFT del mismo proveedor, confidence ±1%=95 ±5%=80 ±10%=65 ±20%=50 else=40
- confirmSriDocument(): para cada item tipoItem=PRODUCTO con productId → registerMovement(IN), actualizar OC status
- deleteSriDocument(): bloquea si CONFIRMED
- rejectSriDocument, getSriDocuments, getSriDocumentById, updateSriDocument
- getSriKpis: count by status, totalCompras, totalIVACreditoFiscal
- getIvaTariffs, getRetentionCatalog

Parte C — Rutas (src/routes/sri-document.routes.ts):
- multer memoryStorage, 10MB, PDF+XML only
- POST /upload (multer.single('file')), GET /, GET /kpis, GET /catalogs
- GET/:id, PATCH/:id, POST/:id/confirm, POST/:id/reject, DELETE/:id
- TODAS con authMiddleware (import { authMiddleware } from '../middleware/auth.middleware')

Parte D — Seed (prisma/seed-tax.ts):
- 6 tarifas IVA: 0%, 8%, 12%, 15%, NO_OBJETO, EXENTO
- 30 retenciones IR (códigos 303-3491) + 12 retenciones IVA (códigos 721-734)
```

---

## PROMPT 7 — Frontend Completo

```
Crea el frontend React+TypeScript+Vite para KallpaPro.

Stack: React 18, TypeScript, Vite (puerto 3000), Tailwind CSS dark mode, React Router v6, Zustand, Axios.

Tema visual: dark mode → bg-gray-950 (fondo), bg-gray-900 (cards), text-white, acentos cyan-400/600.

Archivos a crear:

1. src/api/client.ts:
   - axios.create({ baseURL: '/api' })
   - Interceptor REQUEST: agrega localStorage.getItem('accessToken') como Bearer
   - Interceptor RESPONSE: si 401, intenta refresh con localStorage.getItem('refreshToken'), si falla → redirige /login

2. src/store/auth.store.ts (Zustand):
   - user, accessToken (init desde localStorage)
   - setAuth(user, accessToken, refreshToken), logout(), isAuthenticated()

3. src/api/auth.ts, inventory.ts, purchases.ts, financial.ts, sriDocuments.ts
   (funciones que llaman a client con los endpoints de cada módulo)

4. src/App.tsx: React Router v6 con ProtectedRoute (verifica isAuthenticated())
   Rutas: /login, /register, /dashboard, /inventory/*, /purchases/*, /financial/*, /sri/*

5. Páginas:
   - Login.tsx, Register.tsx
   - Dashboard.tsx: tarjetas de módulos (Inventario/Compras/Financiero activos, Ventas/Logística pendientes)
   - inventory/: InventoryPage, NewProductPage, ProductDetailPage, WarehousesPage, CategoriesPage
   - purchases/: PurchasesPage, SuppliersPage, NewOrderPage, OrderDetailPage
   - financial/: FinancialPage (con botón a /sri), NewInvoicePage, InvoiceDetailPage
   - financial/SriDocumentsPage: drag & drop upload, KPIs, tabla con filtros por status, botón eliminar
   - financial/SriDocumentReviewPage: paneles emisor/comprobante/totales, tabla ítems editable (tipoItem + mapeo producto), match OC con confidence, botones confirmar/rechazar/eliminar
```

---

## PROMPT 8 — Migración a PC nueva

```
Migra KallpaPro a este nuevo PC. El proyecto ya existe en GitHub/USB en:
  Backend: [ruta o repo]
  Frontend: [ruta o repo]

Pasos:
1. Stop-Service -Name "postgresql*" -Force (evitar conflicto puerto 5432)
2. Crear contenedor DB: docker run --name kallpapro-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=kallpapro -p 5432:5432 -d postgres:15
3. En Backend:
   - Crear/verificar .env (ver 11-CREDENCIALES-Y-CONEXIONES.md)
   - npm install
   - npx prisma migrate deploy (NO migrate dev, no modifica migraciones)
   - npx ts-node --project tsconfig.json prisma/seed-tax.ts
4. En Frontend:
   - Crear .env con VITE_API_URL=http://localhost:5000/api
   - npm install
5. Iniciar:
   - Terminal 1: docker start kallpapro-db
   - Terminal 2: cd Backend && npm run dev
   - Terminal 3: cd Frontend && npm run dev
6. Verificar: http://localhost:3000 → Login con admin@gmail.com / 12345678
```
