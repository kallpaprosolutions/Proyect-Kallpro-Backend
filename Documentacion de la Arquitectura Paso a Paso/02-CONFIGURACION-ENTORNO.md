# Configuración del Entorno — KallpaPro
> Guía completa para instalar y correr KallpaPro desde cero en Windows

---

## Prerrequisitos

| Software | Versión mínima | Descarga |
|---------|---------------|---------|
| Node.js | 20.x LTS | https://nodejs.org |
| Docker Desktop | 4.x | https://docker.com/products/docker-desktop |
| Git | 2.x | https://git-scm.com |
| VS Code | Última | https://code.visualstudio.com |

**Verificar instalaciones:**
```powershell
node --version    # v20.x.x
npm --version     # 10.x.x
docker --version  # Docker version 24.x.x
```

---

## PASO 1 — Habilitar ejecución de scripts en PowerShell

Solo la primera vez. Abrir PowerShell como Administrador:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## PASO 2 — Desactivar PostgreSQL local (evita conflicto con Docker)

```powershell
# Detener ahora
Stop-Service -Name "postgresql*" -Force

# Desactivar inicio automático (permanente)
Set-Service -Name "postgresql*" -StartupType Disabled
```

---

## PASO 3 — Crear base de datos en Docker

Abrir Docker Desktop, esperar que esté corriendo, luego:

```powershell
docker run --name kallpapro-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=kallpapro -p 5432:5432 -d postgres:15
```

Verificar que está corriendo:
```powershell
docker ps
# Debe mostrar: kallpapro-db   postgres:15   0.0.0.0:5432->5432/tcp
```

---

## PASO 4 — Crear carpetas del proyecto

```powershell
mkdir "C:\Proyect-Kallpro"
cd "C:\Proyect-Kallpro"
```

---

## PASO 5 — Crear el Backend

```powershell
mkdir Proyect-Kallpro-Backend
cd Proyect-Kallpro-Backend
npm init -y
```

### Instalar dependencias backend:
```powershell
npm install express cors dotenv @prisma/client bcryptjs jsonwebtoken zod multer pdf-parse@1.1.1 xml2js node-cron winston

npm install --save-dev typescript ts-node nodemon @types/node @types/express @types/cors @types/bcryptjs @types/jsonwebtoken @types/multer @types/pdf-parse @types/xml2js prisma jest @types/jest ts-jest supertest @types/supertest eslint prettier
```

### Crear tsconfig.json:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"],
  "ts-node": {
    "transpileOnly": true,
    "esm": false
  }
}
```

### Crear package.json scripts:
```json
"scripts": {
  "dev": "nodemon --exec ts-node src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "db:migrate": "prisma migrate dev",
  "db:deploy": "prisma migrate deploy",
  "db:seed": "ts-node prisma/seeds/index.ts",
  "db:studio": "prisma studio",
  "db:reset": "prisma migrate reset"
}
```

### Crear .env:
```env
NODE_ENV=development
PORT=5000
API_URL=http://localhost:5000
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/kallpapro
JWT_SECRET=kallpapro_super_secret_jwt_key_2024_development
JWT_REFRESH_SECRET=kallpapro_super_secret_refresh_key_2024_development
JWT_EXPIRATION=2h
JWT_REFRESH_EXPIRATION=7d
SENDGRID_API_KEY=your_sendgrid_key
SENDER_EMAIL=noreply@kallpapro.com
FRONTEND_URL=http://localhost:3000
LOG_LEVEL=debug
```

### Inicializar Prisma:
```powershell
npx prisma init
```

Luego copiar el schema.prisma completo (ver `03-BASE-DE-DATOS.md`)

### Correr migraciones:
```powershell
npx prisma migrate dev --name init
```

### Correr seed de catálogos tributarios:
```powershell
npx ts-node --project tsconfig.json prisma/seed-tax.ts
```

---

## PASO 6 — Crear el Frontend

```powershell
cd ..
npm create vite@latest Proyect-Kallpro-Frontend -- --template react-ts
cd Proyect-Kallpro-Frontend
npm install
```

### Instalar dependencias frontend:
```powershell
npm install react-router-dom zustand axios @tanstack/react-query zod
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Crear .env:
```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=KallpaPro
VITE_APP_VERSION=0.1.0
```

### Configurar Vite proxy (vite.config.ts):
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
```

---

## PASO 7 — Arrancar el sistema (3 terminales)

**Terminal 1 — Base de datos:**
```powershell
Stop-Service -Name "postgresql*" -Force
docker start kallpapro-db
```

**Terminal 2 — Backend:**
```powershell
cd "...\Proyect-Kallpro-Backend"
npm run dev
# Debe mostrar: KallpaPro Backend running on port 5000
```

**Terminal 3 — Frontend:**
```powershell
cd "...\Proyect-Kallpro-Frontend"
npm run dev
# Debe mostrar: Local: http://localhost:3000/
```

Abrir navegador: `http://localhost:3000`

---

## Comandos útiles de Prisma

```powershell
# Ver BD visualmente
npx prisma studio

# Crear nueva migración
npx prisma migrate dev --name nombre_de_la_migracion

# Aplicar migraciones en producción
npx prisma migrate deploy

# Resetear BD (borra todo y re-aplica)
npx prisma migrate reset

# Regenerar cliente Prisma
npx prisma generate
```

---

## Si hay errores al iniciar

Ver `13-ERRORES-Y-SOLUCIONES.md`
