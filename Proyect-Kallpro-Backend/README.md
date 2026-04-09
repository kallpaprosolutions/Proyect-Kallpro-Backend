# 🚀 KallpaPro Backend

Backend de la plataforma B2B SaaS **KallpaPro** para gestión integral de PYMEs.

## Stack Tecnológico

- **Runtime**: Node.js 20.x
- **Framework**: Express.js
- **Lenguaje**: TypeScript
- **Base de Datos**: PostgreSQL 15
- **ORM**: Prisma
- **Autenticación**: JWT (jsonwebtoken)
- **Validación**: Zod
- **Logging**: Winston

## Módulos

1. **Inventario** - Gestión de productos y stock
2. **Compras** - Órdenes de compra y proveedores
3. **Logística** - Seguimiento y envíos
4. **Financiero** - Facturas y reportes
5. **Ventas** - CRM y oportunidades

## Setup Local

### Requisitos

```bash
node --version  # v20+
npm --version   # v10+
docker --version  # Para PostgreSQL
```

### Instalación

1. **Clonar y instalar dependencias**
```bash
cd Proyect-Kallpro-Backend
npm install
```

2. **Configurar ambiente**
```bash
cp .env.example .env
# Editar .env con tus valores
```

3. **Iniciar PostgreSQL**
```bash
docker-compose up postgres -d
```

4. **Migrations de BD**
```bash
npm run db:migrate
```

5. **Iniciar servidor**
```bash
npm run dev
```

El servidor correrá en `http://localhost:5000`

## Estructura de Carpetas

```
src/
├── config/          # Configuraciones
├── middleware/      # Middlewares Express
├── routes/          # Rutas API
├── controllers/     # Controladores
├── services/        # Lógica de negocio
├── validators/      # Schemas Zod
├── types/          # TypeScript types
├── utils/          # Funciones utilitarias
├── queue/          # Job queue
└── jobs/           # Cron jobs

prisma/
├── schema.prisma   # Schema de BD
├── migrations/     # Historial de migraciones
└── seeds/          # Datos iniciales
```

## API Endpoints

Ver documentación completa en [API.md](./docs/API.md) (por generar)

### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh-token` - Renovar JWT
- `POST /api/auth/logout` - Logout

### Inventario (Fase 1)
- `GET /api/inventory/products` - Listar productos
- `POST /api/inventory/products` - Crear producto
- `PUT /api/inventory/products/:id` - Actualizar
- `DELETE /api/inventory/products/:id` - Eliminar

### Compras (Fase 1.5)
- `GET /api/purchases/orders` - Listar OC
- `POST /api/purchases/orders` - Crear OC
- `POST /api/purchases/orders/:id/approve` - Aprobar OC

## Testing

```bash
# Unit tests
npm test

# Watch mode
npm test:watch

# Coverage
npm test -- --coverage
```

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

**Roadmap**: 3 meses para v1.0 con 5 módulos completos
