# Credenciales y Conexiones — KallpaPro
> GUARDAR EN LUGAR SEGURO. No subir a repositorios públicos.

---

## Base de Datos PostgreSQL (Docker)

| Campo | Valor |
|-------|-------|
| Host | 127.0.0.1 |
| Puerto | 5432 |
| Base de datos | kallpapro |
| Usuario | postgres |
| Contraseña | postgres |
| Nombre contenedor Docker | kallpapro-db |

**String de conexión completa:**
```
postgresql://postgres:postgres@127.0.0.1:5432/kallpapro
```

**Comando para crear el contenedor desde cero:**
```powershell
docker run --name kallpapro-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=kallpapro -p 5432:5432 -d postgres:15
```

---

## Usuario de prueba KallpaPro ERP

| Campo | Valor |
|-------|-------|
| Email | admin@gmail.com |
| Contraseña | 12345678 |
| Rol | ADMIN |
| Empresa | La que se registró al crear la cuenta |

---

## JWT Secrets (desarrollo)

| Variable | Valor |
|----------|-------|
| JWT_SECRET | kallpapro_super_secret_jwt_key_2024_development |
| JWT_REFRESH_SECRET | kallpapro_super_secret_refresh_key_2024_development |
| JWT_EXPIRATION | 2h |
| JWT_REFRESH_EXPIRATION | 7d |

> En producción cambiar por strings aleatorios de 64+ caracteres.

---

## URLs del sistema (desarrollo local)

| Servicio | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000/api |
| Health check | http://localhost:5000/health |
| Prisma Studio (BD visual) | http://localhost:5555 |

---

## Archivo .env completo — Backend

```env
# Server
NODE_ENV=development
PORT=5000
API_URL=http://localhost:5000

# Database
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/kallpapro

# JWT
JWT_SECRET=kallpapro_super_secret_jwt_key_2024_development
JWT_REFRESH_SECRET=kallpapro_super_secret_refresh_key_2024_development
JWT_EXPIRATION=2h
JWT_REFRESH_EXPIRATION=7d

# Email (SendGrid — configurar en producción)
SENDGRID_API_KEY=your_sendgrid_key
SENDER_EMAIL=noreply@kallpapro.com

# Frontend URL (para CORS)
FRONTEND_URL=http://localhost:3000

# Logging
LOG_LEVEL=debug
```

**Ruta:** `Proyect-Kallpro-Backend\.env`

---

## Archivo .env completo — Frontend

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=KallpaPro
VITE_APP_VERSION=0.1.0
```

**Ruta:** `Proyect-Kallpro-Frontend\.env`

---

## Docker — Gestión del contenedor

```powershell
# Crear (primera vez)
docker run --name kallpapro-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=kallpapro -p 5432:5432 -d postgres:15

# Iniciar (si ya existe)
docker start kallpapro-db

# Detener
docker stop kallpapro-db

# Ver estado
docker ps

# Ver logs
docker logs kallpapro-db
```

---

## Problema: PostgreSQL local vs Docker

Windows instala PostgreSQL 18 localmente y ocupa el puerto 5432, bloqueando Docker.

**Solución temporal (cada reinicio):**
```powershell
Stop-Service -Name "postgresql*" -Force
```

**Solución permanente (una sola vez):**
```powershell
Set-Service -Name "postgresql*" -StartupType Disabled
```
