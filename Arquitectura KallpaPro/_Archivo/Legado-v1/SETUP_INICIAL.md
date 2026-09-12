# 🚀 SETUP INICIAL - KallpaPro

## ANTES DE EMPEZAR

✅ Verificar que tienes instalado:
```bash
node --version        # v20 o superior
npm --version         # v10 o superior
git --version         # Cualquier versión reciente
docker --version      # Docker desktop instalado
code --version        # VS Code (recomendado)
```

---

## PASO 1: CREAR REPOSITORIOS EN GITHUB

### 1.1 Crear repos
```bash
# Ve a github.com y crea dos repos públicos:
- KallpaPro-Frontend
- KallpaPro-Backend

# Configurar en tu PC:
mkdir ~/projects
cd ~/projects

# Clone repos (usaremos para inicializar)
git clone https://github.com/TU_USUARIO/KallpaPro-Frontend.git
git clone https://github.com/TU_USUARIO/KallpaPro-Backend.git
```

---

## PASO 2: SETUP BACKEND

### 2.1 Inicializar proyecto
```bash
cd KallpaPro-Backend

# Crear estructura base
mkdir -p src/{config,middleware,routes,controllers,services,validators,types,utils,queue,jobs}
mkdir -p prisma/{migrations,seeds}
mkdir -p tests/{unit,integration,fixtures}
mkdir -p docs
touch .env.example
```

### 2.2 Crear package.json
```bash
npm init -y

# Instalar dependencias principales
npm install express typescript dotenv cors bcryptjs jsonwebtoken
npm install @prisma/client
npm install winston node-cron
npm install zod

# Dev dependencies
npm install -D @types/express @types/node @types/bcryptjs @types/jsonwebtoken
npm install -D ts-node nodemon jest @types/jest ts-jest
npm install -D @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint prettier
```

### 2.3 Configurar TypeScript
```bash
npx tsc --init

# Actualizar tsconfig.json:
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src"],
  "exclude": ["node_modules", "tests"]
}
```

### 2.4 Actualizar package.json scripts
```json
{
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write \"src/**/*.ts\"",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:seed": "ts-node prisma/seeds/index.ts",
    "db:reset": "prisma migrate reset"
  }
}
```

### 2.5 Configurar Prisma
```bash
npm install -D prisma

# Inicializar Prisma
npx prisma init

# El archivo .env se crea automáticamente
# Actualizar DATABASE_URL en .env:
DATABASE_URL="postgresql://user:password@localhost:5432/kallpapro"
```

### 2.6 Crear .env.example
```bash
cat > .env.example << 'EOF'
# Server
NODE_ENV=development
PORT=5000
API_URL=http://localhost:5000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/kallpapro

# JWT
JWT_SECRET=your_super_secret_jwt_key_min_32_chars_long_here
JWT_REFRESH_SECRET=your_super_secret_refresh_key_min_32_chars
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Email (SendGrid)
SENDGRID_API_KEY=your_sendgrid_key
SENDER_EMAIL=noreply@kallpapro.com

# Pagos
UNO_API_KEY=your_uno_key
UNO_API_SECRET=your_uno_secret
KUSKI_API_KEY=your_kuski_key

# Storage (Cloudinary)
CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_secret

# Frontend URL (para CORS)
FRONTEND_URL=http://localhost:3000
EOF
```

### 2.7 Crear archivos iniciales
```bash
# src/index.ts
cat > src/index.ts << 'EOF'
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
EOF

# src/config/environment.ts
cat > src/config/environment.ts << 'EOF'
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRATION: z.string().default('15m'),
  SENDGRID_API_KEY: z.string().optional(),
  FRONTEND_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
EOF
```

---

## PASO 3: SETUP FRONTEND

### 3.1 Inicializar proyecto Vite + React
```bash
cd KallpaPro-Frontend

# Crear con Vite
npm create vite@latest . -- --template react-ts

# Instalar dependencias
npm install

# Dependencias adicionales
npm install react-router-dom axios react-query zustand
npm install tailwindcss postcss autoprefixer
npm install shadcn-ui

# Configurar Tailwind
npx tailwindcss init -p

# Dev dependencies
npm install -D @types/react @types/react-dom typescript
npm install -D @typescript-eslint/eslint-plugin prettier eslint
```

### 3.2 Crear estructura de carpetas
```bash
mkdir -p src/{types,services,hooks,store,components/{common,forms,tables,charts},pages/{auth,dashboard,inventory,purchases,logistics,financials,sales,settings},layouts,routes,utils,contexts,styles}
mkdir -p tests/{unit,integration,mocks}
```

### 3.3 Configurar .env.example
```bash
cat > .env.example << 'EOF'
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=KallpaPro
VITE_APP_VERSION=0.1.0
EOF
```

### 3.4 Actualizar package.json scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint src --ext ts,tsx",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

---

## PASO 4: SETUP BASE DE DATOS

### 4.1 Crear docker-compose.yml
```bash
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: kallpapro_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: kallpapro
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: kallpapro_pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@kallpapro.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres

volumes:
  postgres_data:

networks:
  default:
    name: kallpapro_network
EOF

# Iniciar PostgreSQL
docker-compose up -d

# Esperar a que PostgreSQL esté listo
sleep 10

# Verificar conexión
docker-compose exec postgres psql -U postgres -d kallpapro -c "SELECT 1;"
```

### 4.2 Crear primera migración (schema base)
```bash
cd KallpaPro-Backend

# Crear prisma/schema.prisma con content base:
cat > prisma/schema.prisma << 'EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Models
model Company {
  id        String    @id @default(uuid())
  name      String
  email     String?
  phone     String?
  industry  String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  
  users          User[]
  products       Product[]
  purchaseOrders PurchaseOrder[]
  invoices       Invoice[]
  
  @@map("companies")
}

model User {
  id        String   @id @default(uuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  email     String   @unique
  passwordHash String
  firstName String?
  lastName  String?
  role      String   @default("USER")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("users")
  @@index([companyId])
}

model Product {
  id        String   @id @default(uuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  sku       String?  @unique
  name      String
  price     Decimal  @db.Decimal(12, 2)
  cost      Decimal? @db.Decimal(12, 2)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("products")
  @@index([companyId])
}

model PurchaseOrder {
  id        String   @id @default(uuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  poNumber  String   @unique
  status    String   @default("DRAFT")
  total     Decimal  @db.Decimal(12, 2)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("purchase_orders")
  @@index([companyId])
}

model Invoice {
  id        String   @id @default(uuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  number    String   @unique
  amount    Decimal  @db.Decimal(12, 2)
  status    String   @default("DRAFT")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("invoices")
  @@index([companyId])
}
EOF

# Crear migración
npx prisma migrate dev --name init

# Seed inicial (opcional)
npx prisma db seed
```

---

## PASO 5: TESTS

### 5.1 Backend - Jest setup
```bash
npm install -D jest @types/jest ts-jest supertest

# Crear jest.config.js
cat > jest.config.js << 'EOF'
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
};
EOF
```

### 5.2 Frontend - Vitest setup (Vite ya incluye)
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

---

## PASO 6: VERIFICAR SETUP

### 6.1 Backend
```bash
cd KallpaPro-Backend

# Test conexión DB
npm run db:migrate

# Iniciar servidor
npm run dev

# En otra terminal, test health check
curl http://localhost:5000/health
# Debería retornar: {"status":"ok","timestamp":"2024-..."}
```

### 6.2 Frontend
```bash
cd KallpaPro-Frontend

# Iniciar dev server
npm run dev

# Abre http://localhost:5173 en navegador
```

---

## PASO 7: GIT SETUP

### 7.1 Backend
```bash
cd KallpaPro-Backend

# Crear .gitignore
cat > .gitignore << 'EOF'
node_modules
.env
.env.local
dist
*.log
.DS_Store
.vscode/*
!.vscode/settings.json
coverage
.prisma
EOF

# Commit inicial
git add .
git commit -m "chore: initial backend setup with Express, TypeScript, Prisma"
git push origin main
```

### 7.2 Frontend
```bash
cd KallpaPro-Frontend

# Crear .gitignore (Vite ya lo hace)

# Commit inicial
git add .
git commit -m "chore: initial frontend setup with React, Vite, TypeScript"
git push origin main
```

---

## 🎉 ¡LISTO!

Tu proyecto está configurado. Ahora tienes:

✅ Backend: Express + TypeScript + Prisma
✅ Frontend: React + Vite + TypeScript
✅ Base de datos: PostgreSQL en Docker
✅ Git ready: ambos repos sincronizados
✅ Dev servers: prontos para comenzar

### Próximos pasos:
1. Comenzar Semana 1 (Auth)
2. Crear modelos de BD (Prisma schema)
3. Endpoints básicos de autenticación
4. Componentes de login/registro

---

## TROUBLESHOOTING

### Error: "Cannot find module 'prisma'"
```bash
cd backend
npm install @prisma/client
```

### Error: "DATABASE_URL not found"
```bash
# Verificar .env existe en backend/
ls -la .env

# Si no existe:
cp .env.example .env
# Actualizar DATABASE_URL
```

### PostgreSQL no arranca
```bash
# Verificar Docker
docker ps

# Ver logs
docker logs kallpapro_postgres

# Reset (¡BORRA DATOS!)
docker-compose down -v
docker-compose up -d postgres
```

### Puerto 5000 en uso
```bash
# Cambiar en backend .env:
PORT=5001

# O matar proceso:
lsof -i :5000
kill -9 <PID>
```

---

## 📚 REFERENCIAS

- [Express Docs](https://expressjs.com/)
- [Prisma Docs](https://www.prisma.io/docs/)
- [React Docs](https://react.dev/)
- [TypeScript Docs](https://www.typescriptlang.org/docs/)

¿Preguntas? Abre un issue en GitHub 🚀
