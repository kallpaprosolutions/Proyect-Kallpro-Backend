# 🚀 KallpaPro

**Plataforma B2B SaaS para gestión integral de PYMEs**

Solución empresarial modular que integra 5 módulos clave: Inventario, Compras, Logística, Financiero y Ventas.

## 📊 Visión General

KallpaPro es una suite de software empresarial diseñada específicamente para pequeñas y medianas empresas (PYMEs) que necesitan gestionar sus operaciones de forma integral. La plataforma ofrece un modelo de suscripción flexible con diferentes niveles de acceso a módulos.

### Características Principales

- ✅ **Multi-tenancy**: Soporta múltiples empresas con aislamiento de datos
- ✅ **Modular**: Cada módulo puede habilitarse según el plan de suscripción
- ✅ **Escalable**: Arquitectura preparada para crecer
- ✅ **Seguro**: Autenticación JWT, autorización por roles, auditoría
- ✅ **Integraciones**: Pasarelas de pago (Uno, Kuski), email, almacenamiento
- ✅ **Real-time**: WebSocket ready para notificaciones en vivo

## 🏗️ Estructura del Proyecto

```
Proyect-Kallpro/
├── Proyect-Kallpro-Backend/     # API REST + lógica de negocio
├── Proyect-Kallpro-Frontend/    # Interfaz React + Vite
├── docker-compose.yml            # Orquestación local
└── .claude/launch.json           # Configuración de servidores dev
```

## 🛠️ Stack Tecnológico

### Backend
- **Runtime**: Node.js 20.x
- **Framework**: Express.js
- **Lenguaje**: TypeScript
- **Base de Datos**: PostgreSQL 15
- **ORM**: Prisma
- **Auth**: JWT
- **Validación**: Zod

### Frontend
- **Framework**: React 18.x
- **Build**: Vite
- **Lenguaje**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand + React Query
- **Routing**: React Router v6

### Infraestructura
- **Containerización**: Docker + Docker Compose
- **CI/CD**: GitHub Actions (ready)
- **Deployment**: AWS/Vercel (ready)

## 📦 Módulos

| Módulo | Fase | Status | Descripción |
|--------|------|--------|-------------|
| **Inventario** | 1 | 🔄 En desarrollo | Gestión de productos, stock, alertas |
| **Compras** | 1.5 | 🔄 En desarrollo | Órdenes de compra, proveedores, aprobaciones |
| **Logística** | 2 | ⏳ Próximo | Seguimiento de envíos, rutas, tracking |
| **Financiero** | 2.5 | ⏳ Próximo | Facturas, cuentas por cobrar/pagar, reportes |
| **Ventas** | 3 | ⏳ Próximo | CRM, oportunidades, cotizaciones |

## 🚀 Quick Start

### Requisitos

```bash
node >= 20.x
npm >= 10.x
docker
docker-compose
```

### Setup Local (5 minutos)

#### 1. Clonar y navegar

```bash
cd Proyect-Kallpro
```

#### 2. Iniciar PostgreSQL

```bash
docker-compose up postgres -d

# Verificar que está listo
docker-compose logs postgres
```

#### 3. Backend

```bash
cd Proyect-Kallpro-Backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Migrations
npm run db:migrate

# Iniciar servidor
npm run dev

# Verificar: http://localhost:5000/health
```

#### 4. Frontend (en otra terminal)

```bash
cd Proyect-Kallpro-Frontend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Iniciar servidor
npm run dev

# Abre: http://localhost:3000
```

## 📅 Roadmap (13 semanas)

### ✅ Semana 1-2: Setup
- [x] Estructura base de proyectos
- [x] Autenticación básica
- [x] Base de datos configurada
- [ ] Deploy a staging

### 🔄 Semana 3-6: Fase 1 (Inventario + Compras)
- [ ] Módulo Inventario MVP
- [ ] Módulo Compras
- [ ] Integración entre módulos

### 🔄 Semana 7-8: Fase 1.5 (Subscripción)
- [ ] Modelos de planes
- [ ] Integración Uno
- [ ] Integración Kuski
- [ ] Webhooks de pago

### 📅 Semana 9-10: Fase 2 (Logística)
- [ ] Módulo Logística completo
- [ ] Tracking en tiempo real

### 📅 Semana 11-12: Fase 3 (Financiero + Ventas)
- [ ] Módulo Financiero
- [ ] Módulo Ventas
- [ ] Reportes

### 🎯 Semana 13: Launch
- [ ] Testing E2E
- [ ] Optimización
- [ ] Deploy a producción

## 📚 Documentación

- [ARQUITECTURA_TECNICA.md](./ARQUITECTURA_TECNICA_KALLPAPRO.md) - Diseño técnico detallado
- [ESTRUCTURA_PROYECTO.md](./ESTRUCTURA_PROYECTO.md) - Organización de carpetas
- [PLAN_IMPLEMENTACION_3MESES.md](./PLAN_IMPLEMENTACION_3MESES.md) - Desglose por semana
- [SETUP_INICIAL.md](./SETUP_INICIAL.md) - Guía paso a paso
- Backend README: [Proyect-Kallpro-Backend/README.md](./Proyect-Kallpro-Backend/README.md)
- Frontend README: [Proyect-Kallpro-Frontend/README.md](./Proyect-Kallpro-Frontend/README.md)

## 🔐 Seguridad

- ✅ HTTPS obligatorio (producción)
- ✅ JWT con refresh tokens
- ✅ Hashing seguro de passwords (bcrypt)
- ✅ CORS configurado
- ✅ Rate limiting
- ✅ SQL Injection prevention (Prisma ORM)
- ✅ XSS protection (React escapes)
- ✅ Row Level Security (PostgreSQL)
- ✅ Audit logging

## 🧪 Testing

```bash
# Backend
cd Proyect-Kallpro-Backend
npm test

# Frontend
cd Proyect-Kallpro-Frontend
npm test
```

## 📊 Monitoring & Logs

- **Backend**: Winston logger
- **Errores**: Sentry (ready)
- **Logs**: Better Stack (ready)
- **Métricas**: Grafana (ready)

## 🤝 Contribuir

1. Crea una rama: `git checkout -b feature/nombre`
2. Haz cambios y commit: `git commit -m "feat: descripción"`
3. Push: `git push origin feature/nombre`
4. Abre un Pull Request

## 📝 Licencia

MIT

## 👥 Equipo

**KallpaPro Solutions**
- Usuario GitHub: @kallpaprosolutions
- Email: info@kallpaprosolutions.com

## 🆘 Soporte

- 📧 Email: support@kallpapro.com
- 💬 Issues: GitHub Issues
- 📖 Docs: Ver carpeta `docs/`

---

**v0.1.0** - Inicialización del proyecto | Roadmap: 3 meses para v1.0
