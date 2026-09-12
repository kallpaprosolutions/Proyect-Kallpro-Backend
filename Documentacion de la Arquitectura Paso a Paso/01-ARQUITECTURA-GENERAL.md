# Arquitectura General — KallpaPro

---

## Diagrama de la arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUARIO (Browser)                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP / localhost:3000
┌─────────────────────────▼───────────────────────────────────────┐
│                    FRONTEND (React + Vite)                      │
│  Puerto: 3000                                                   │
│                                                                 │
│  src/pages/          → 15 páginas React                        │
│  src/api/            → 6 módulos Axios                         │
│  src/store/          → Zustand (auth global)                   │
│  src/App.tsx         → React Router v6 (16+ rutas)             │
│                                                                 │
│  Proxy Vite: /api → localhost:5000/api                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │ REST API / JSON
                          │ Authorization: Bearer <JWT>
┌─────────────────────────▼───────────────────────────────────────┐
│                    BACKEND (Express + TypeScript)               │
│  Puerto: 5000                                                   │
│                                                                 │
│  src/routes/         → 5 routers Express                       │
│  src/controllers/    → 5 controladores                         │
│  src/services/       → 6 servicios (lógica de negocio)         │
│  src/middleware/     → auth.middleware.ts (verifica JWT)        │
│                                                                 │
│  Rutas registradas:                                             │
│    /api/auth         → autenticación                           │
│    /api/inventory    → inventario                              │
│    /api/purchases    → compras                                 │
│    /api/financial    → financiero                              │
│    /api/sri          → documentos SRI Ecuador                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Prisma ORM
┌─────────────────────────▼───────────────────────────────────────┐
│               PostgreSQL 15 (Docker: kallpapro-db)             │
│  Puerto: 5432                                                   │
│  BD: kallpapro                                                  │
│  Usuario: postgres / Contraseña: postgres                       │
│  25 tablas (modelos Prisma)                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Patrón de Request

```
Browser → Axios (con JWT) → Vite Proxy → Express Route
       → authMiddleware (verifica token, extrae companyId)
       → Controller (parsea req, llama service)
       → Service (lógica de negocio + Prisma)
       → PostgreSQL
       → Response JSON al browser
```

---

## Multi-tenancy

Cada empresa es un **tenant aislado**. Todas las tablas tienen `companyId`.

```typescript
// Ejemplo: getProducts solo devuelve productos de la empresa autenticada
prisma.product.findMany({ where: { companyId: req.user.companyId } })
```

El `companyId` viene del JWT token, extraído por `authMiddleware`.

---

## Autenticación JWT

```
Login → bcrypt.compare(password, hash)
     → JWT access token (expira en 2h)
     → JWT refresh token (expira en 7d)
     → Guardados en localStorage del browser

Request → Authorization: Bearer <accessToken>
       → authMiddleware verifica con JWT_SECRET
       → Si 401: Axios interceptor renueva con refreshToken
       → Si refresh falla: redirige a /login
```

---

## Módulos del sistema

| Módulo | Estado | Ruta | Puerto |
|--------|--------|------|--------|
| Autenticación | ✅ Activo | /api/auth | - |
| Inventario | ✅ Activo | /api/inventory | /inventory |
| Compras | ✅ Activo | /api/purchases | /purchases |
| Financiero | ✅ Activo | /api/financial | /financial |
| SRI Ecuador | ✅ Activo | /api/sri | /sri |
| Ventas | ⏳ Pendiente | /api/sales | /sales |
| Logística | ⏳ Pendiente | /api/logistics | /logistics |

---

## Patrón de archivos por módulo

Cada módulo sigue exactamente esta estructura:

```
Backend:
  src/routes/[modulo].routes.ts       → define endpoints, aplica middleware
  src/controllers/[modulo].controller.ts → extrae req, llama service, devuelve res
  src/services/[modulo].service.ts    → lógica de negocio, queries Prisma

Frontend:
  src/api/[modulo].ts                 → funciones Axios para cada endpoint
  src/pages/[modulo]/[Pagina].tsx     → componente React que usa la API
```

---

## Motor de Costo Promedio Ponderado (Inventario)

Cada vez que entra mercancía, el costo promedio se recalcula:

```
Nuevo Promedio = (stock_actual × costo_actual + cantidad_nueva × costo_nuevo)
                 ────────────────────────────────────────────────────────────
                          (stock_actual + cantidad_nueva)
```

Implementado en: `src/services/inventory.service.ts` → función `registerMovement()`

---

## Flujo de Documentos SRI Ecuador

```
Upload PDF/XML
     ↓
Parser SRI (pdf-parse o xml2js)
     ↓
Decodifica clave de acceso (49 dígitos)
     ↓
Extrae: emisor, receptor, totales, ítems
     ↓
Busca proveedor por RUC en la BD
     ↓
Busca OC pendiente (mismo proveedor + monto ±5%)
     ↓
Crea SriDocument con status: PENDING_REVIEW
     ↓
Usuario revisa en /sri/:id
     ↓
Usuario confirma → genera movimientos IN en inventario
                 → actualiza status OC → RECEIVED/PARTIAL
```

---

## Estructura de la clave de acceso SRI (49 dígitos)

```
1  0  0  4  2  0  2  5 | 0  1 | 1  7  9  1  8  6  0  8  2  9  0  0  1 | 2 | 0  1  3 | 0  0  1 | 0  0  0  0  0  1  3  0  5 | 0  0  0  0  0  0  1  1 | 1 | 2
[   fecha ddmmaaaa   ] [tipo] [         RUC (13 dígitos)            ] [amb][estab][pto] [  secuencial (9 dígitos) ] [ código numérico (8) ] [em][dv]

tipo: 01=Factura, 04=NotaCredito, 05=NotaDebito, 07=Retencion
amb:  1=Pruebas, 2=Producción
em:   1=Normal, 2=Contingencia
dv:   Dígito verificador (Módulo 11)
```
