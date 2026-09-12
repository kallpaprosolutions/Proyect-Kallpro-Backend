# Errores y Soluciones — KallpaPro
> Todos los errores encontrados durante el desarrollo y cómo se resolvieron.

---

## Error 1: Router.use() requires a middleware function

**Síntoma:**
```
Error: Router.use() requires a middleware function but got a Object
```

**Causa:**
En `sri-document.routes.ts` se importó `authenticate` como middleware:
```typescript
import { authenticate } from '../middleware/auth.middleware'; // ← NO existe
```

**Solución:**
El export correcto del middleware se llama `authMiddleware`:
```typescript
import { authMiddleware } from '../middleware/auth.middleware'; // ← correcto
router.use(authMiddleware);
```

**Regla general:** Verificar siempre el nombre exacto del export en el archivo del middleware.

---

## Error 2: pdfParse is not a function

**Síntoma:**
```
TypeError: pdfParse is not a function
```

**Causa:**
`pdf-parse` versión 2.x exporta un objeto con clases, no una función directamente:
```typescript
import pdfParse from 'pdf-parse'; // en v2.x → pdfParse es un objeto, no función
await pdfParse(buffer); // TypeError
```

**Solución:**
Instalar la versión 1.1.1 que exporta directamente una función:
```powershell
npm uninstall pdf-parse
npm install pdf-parse@1.1.1
npm install --save-dev @types/pdf-parse
```

Y usar require en lugar de import (evita problemas ESM):
```typescript
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;
```

---

## Error 3: pdf-parse no se pudo cargar correctamente

**Síntoma:**
```
Error: pdf-parse no se pudo cargar correctamente. Verifica la instalación.
```

**Causa:**
El código tenía un try/catch al importar pdf-parse con fallback:
```typescript
let pdfParseModule: any = null;
try {
  pdfParseModule = require('pdf-parse');
  // Con v2.x, el módulo carga pero no es callable
} catch (e) {
  // ...
}
```

El módulo cargaba correctamente pero `typeof pdfParseModule !== 'function'` era true con v2.x.

**Solución:**
Igual que Error 2 — instalar v1.1.1. Eliminar el try/catch defensivo y usar directamente:
```typescript
const pdfParse = require('pdf-parse');
```

---

## Error 4: Subtotal e IVA muestran $0.00 al parsear PDF

**Síntoma:**
El documento SRI se importa exitosamente pero los campos financieros muestran cero:
- SUBTOTAL 15%: $0.00
- IVA 15%: $0.00
- VALOR TOTAL: $0.00

**Causa:**
Los RIDE PDF tienen layout de DOS COLUMNAS. `pdf-parse` extrae el texto secuencialmente, separando las etiquetas de sus valores en líneas distintas:
```
Texto extraído del PDF:
"...SUBTOTAL 15%\nDESCUENTO\nSUBTOTAL 0%\n4,590.20\n0.00\n0.00\n..."
```
El regex `SUBTOTAL 15%\s+([\d.]+)` no encontraba el número porque no estaba en la misma línea.

**Solución:**
Función `nextNumber()` que busca el siguiente número decimal a partir de la posición del label:
```typescript
const nextNumber = (label: string, maxChars = 80): number => {
  const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const idx = t.search(re);
  if (idx === -1) return 0;
  const slice = t.substring(idx + label.length, idx + label.length + maxChars);
  const m = slice.match(/([\d,]+\.\d{2})/);
  return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
};

const subtotal15 = nextNumber('SUBTOTAL 15%');
const iva = nextNumber('IVA 15%');
const total = nextNumber('VALOR TOTAL');
```

---

## Error 5: Documento duplicado al re-testear

**Síntoma:**
```
Error: Documento duplicado. Clave de acceso ya registrada (ID: 6cbe9052-df76-47dd-a687-8ef820ef453d)
```

**Causa:**
El schema tiene `@@unique([companyId, claveAcceso])` — no se puede importar el mismo PDF dos veces para la misma empresa. Durante testing se necesitaba re-importar el mismo archivo.

**Solución inmediata (limpiar BD directamente):**
```powershell
cd "...Proyect-Kallpro-Backend"
npx ts-node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.sriDocument.delete({ where: { id: '6cbe9052-df76-47dd-a687-8ef820ef453d' } })
  .then(() => { console.log('deleted'); p.\$disconnect(); });
"
```

**Solución permanente (en la app):**
Agregar botón de eliminar para documentos no confirmados (ver `SriDocumentsPage.tsx` y `SriDocumentReviewPage.tsx`). Endpoint: `DELETE /api/sri/:id` (bloqueado si status === 'CONFIRMED').

---

## Error 6: Docker No such container

**Síntoma:**
```powershell
docker start kallpapro-db
# Error response from daemon: No such container: kallpapro-db
```

**Causa:**
Docker Desktop fue reinstalado o los datos del contenedor se perdieron. Los contenedores Docker son efímeros — al reinstalar Docker Desktop se pierden.

**Solución:**
Crear el contenedor desde cero:
```powershell
docker run --name kallpapro-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=kallpapro -p 5432:5432 -d postgres:15
```

Luego aplicar migraciones (los datos se perdieron):
```powershell
cd "...Proyect-Kallpro-Backend"
npx prisma migrate deploy
npx ts-node --project tsconfig.json prisma/seed-tax.ts
```

---

## Error 7: Password authentication failed for user "postgres"

**Síntoma:**
```
error: password authentication failed for user "postgres"
```
O bien:
```
connection refused to localhost:5432
```

**Causa:**
Windows tiene PostgreSQL 17/18 instalado localmente y ocupa el puerto 5432. Docker intenta usar el mismo puerto pero el contenedor no puede enlazarlo, o bien el backend conecta al PostgreSQL local (que tiene diferente contraseña o no tiene la BD `kallpapro`).

**Solución temporal (cada vez que reinicies el PC):**
```powershell
Stop-Service -Name "postgresql*" -Force
docker start kallpapro-db
```

**Solución permanente (una sola vez):**
```powershell
Set-Service -Name "postgresql*" -StartupType Disabled
```

**Verificar que Docker está usando el puerto:**
```powershell
docker ps
# Debe mostrar: 0.0.0.0:5432->5432/tcp
```

---

## Error 8: ESM vs CommonJS conflict

**Síntoma:**
```
SyntaxError: Cannot use import statement in a module
```
O:
```
Error [ERR_REQUIRE_ESM]: require() of ES Module not supported
```

**Causa:**
Algunas dependencias (especialmente versiones modernas) usan ES Modules, pero el proyecto backend usa CommonJS (`"module": "CommonJS"` en tsconfig).

**Solución:**
En `tsconfig.json`:
```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "ts-node": {
    "transpileOnly": true,
    "esm": false
  }
}
```

Para imports problemáticos, usar `require()` en lugar de `import`:
```typescript
const pdfParse = require('pdf-parse');
const xml2js = require('xml2js');
```

---

## Error 9: Token expira a los 15 minutos

**Síntoma:**
El usuario es redirigido al login cada 15 minutos aunque el refresh token sigue válido.

**Causa:**
`auth.service.ts` tiene el access token hardcodeado a `'15m'` (no lee `JWT_EXPIRATION` del .env). El interceptor de Axios debería renovarlo automáticamente, pero si hay algún error en el refresh, se cierra la sesión.

**Diagnóstico:**
Verificar en el navegador → DevTools → Network → buscar request a `/api/auth/refresh` cuando expire el token. Si da 401, el refresh token también expiró o es inválido.

**Solución:**
Si persiste el problema, cambiar en `auth.service.ts`:
```typescript
expiresIn: '2h' // en lugar de '15m'
```

---

## Error 10: Prisma migration drift

**Síntoma:**
```
Error: The migration `XXXXX_init` failed to apply cleanly to the shadow database.
```

**Causa:**
Cambios manuales en la BD o migraciones aplicadas de forma inconsistente.

**Solución (resetear completamente):**
```powershell
npx prisma migrate reset
# ¡BORRA TODOS LOS DATOS!
# Luego volver a sembrar:
npx ts-node --project tsconfig.json prisma/seed-tax.ts
```

---

## Checklist al instalar en PC nueva

```
[ ] Docker Desktop instalado y corriendo
[ ] Contenedor kallpapro-db creado (docker run ...)
[ ] PostgreSQL local desactivado (o usando puerto diferente)
[ ] docker ps muestra kallpapro-db en 0.0.0.0:5432
[ ] npm install completado en backend
[ ] .env creado en backend (ver 11-CREDENCIALES-Y-CONEXIONES.md)
[ ] npx prisma migrate deploy exitoso
[ ] npx ts-node prisma/seed-tax.ts exitoso
[ ] npm install completado en frontend
[ ] .env creado en frontend
[ ] npm run dev en backend → puerto 5000
[ ] npm run dev en frontend → puerto 3000
[ ] http://localhost:3000 carga correctamente
[ ] Login con admin@gmail.com / 12345678
```
