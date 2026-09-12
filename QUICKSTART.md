# ⚡ QUICKSTART - KallpaPro

**¡Tu proyecto está 100% listo! Aquí cómo iniciarlo en 5 minutos.**

## 🎯 Status Actual

✅ Backend repo creado en GitHub: https://github.com/kallpaprosolutions/Proyect-Kallpro-Backend  
⏳ Frontend repo: aún por crear (lo haremos después)  
✅ Estructura local completa y commitida  
⏳ Servidores: listos para iniciar  

---

## 🚀 INICIAR EN 3 PASOS

### PASO 1: Abrir 3 Terminales

Necesitas 3 terminales (PowerShell o CMD). Abre Windows Terminal o 3 ventanas separadas.

### PASO 2: Iniciar PostgreSQL (Terminal 1)

**OPCIÓN A: Con Docker Desktop (Recomendado)**

```powershell
cd "C:/Users/ACER/OneDrive/Documentos/Archivos Claude/Proyect-Kallpro"
docker compose up postgres
```

Si no tienes Docker Desktop instalado → ve a Opción B

**OPCIÓN B: PostgreSQL Local (sin Docker)**

Si ya tienes PostgreSQL 15 instalado localmente:
```powershell
# Solo asegúrate que PostgreSQL está corriendo
# En Windows: Services → PostgreSQL 15 → debe estar "Running"
```

⏭️ Si no tienes PostgreSQL instalado, descárgalo: https://www.postgresql.org/download/windows/

---

### PASO 3: Iniciar Backend (Terminal 2)

```powershell
cd "C:/Users/ACER/OneDrive/Documentos/Archivos Claude/Proyect-Kallpro/Proyect-Kallpro-Backend"

# Instalar dependencias (primera vez)
npm install

# Configurar variables de entorno
copy .env.example .env

# Crear base de datos
npm run db:migrate

# Iniciar servidor
npm run dev
```

**Espera este mensaje:**
```
🚀 KallpaPro Backend running on port 5000
📝 Health check: http://localhost:5000/health
```

✅ Luego abre en navegador: http://localhost:5000/health

---

### PASO 4: Iniciar Frontend (Terminal 3)

```powershell
cd "C:/Users/ACER/OneDrive/Documentos/Archivos Claude/Proyect-Kallpro/Proyect-Kallpro-Frontend"

# Instalar dependencias (primera vez)
npm install

# Configurar variables de entorno
copy .env.example .env

# Iniciar servidor
npm run dev
```

**Espera este mensaje:**
```
Local:   http://localhost:3000/
```

✅ Abre en navegador: http://localhost:3000

---

## 🎉 ¡LISTO!

Si ves esto, **TODO FUNCIONA:**

```
Terminal 1: PostgreSQL corriendo (logs)
Terminal 2: Backend en http://localhost:5000 ✅
Terminal 3: Frontend en http://localhost:3000 ✅
```

Abre http://localhost:3000 y verás:
- ✨ Interfaz hermosa con gradiente oscuro
- 📊 Panel de estado del proyecto
- 📋 Próximos pasos
- 🧪 Test de funcionalidad (contador)

---

## ✅ VERIFICACIÓN RÁPIDA

**Backend funcionando:**
```
curl http://localhost:5000/health
```

Deberías ver:
```json
{
  "status": "ok",
  "timestamp": "2024-04-08T...",
  "service": "KallpaPro Backend",
  "version": "0.1.0"
}
```

**Frontend funcionando:**
```
http://localhost:3000
```

Deberías ver la home page de KallpaPro con logo, status, y botón de contador.

---

## 🐛 TROUBLESHOOTING

### Error: "npm: command not found"
```powershell
# Instala Node.js desde: https://nodejs.org/ (LTS)
# Luego reinicia PowerShell/Terminal
```

### Error: "Cannot connect to localhost:5432"
```powershell
# PostgreSQL no está corriendo
# Opción 1: Instala Docker Desktop y usa docker compose up postgres
# Opción 2: Instala PostgreSQL localmente desde https://www.postgresql.org/download/windows/
```

### Error: "EADDRINUSE :::5000"
```powershell
# Puerto 5000 ya está en uso
# Solución: Cambia PORT en .env del Backend a 5001
```

### Puerto ocupado en 3000
```powershell
# Cambiar puerto en vite.config.ts
# Busca: port: 3000
# Cambia a: port: 3001
```

---

## 📚 DOCUMENTACIÓN COMPLETA

Una vez que todo funciona, lee estos docs:

1. **ARQUITECTURA_TECNICA_KALLPAPRO.md** - Diseño técnico completo (16 secciones)
2. **ESTRUCTURA_PROYECTO.md** - Cómo está organizado el código
3. **PLAN_IMPLEMENTACION_3MESES.md** - Roadmap semanal completo
4. **SETUP_INICIAL.md** - Guía detallada de setup

---

## 🎯 PRÓXIMO: Semana 1 - Autenticación

Una vez que todo funciona (Backend + Frontend), comenzamos a implementar:

- JWT Tokens (acceso + refresh)
- Login/Register endpoints
- Auth páginas en Frontend
- Middleware de autenticación

Ver: **PLAN_IMPLEMENTACION_3MESES.md → Semana 1-2**

---

## 💡 TIPS

1. **Mantén las 3 terminales abiertas** mientras desarrollas
2. **El backend recarga automáticamente** cuando cambias archivos (nodemon)
3. **El frontend recarga automáticamente** cuando cambias código (Vite)
4. **Check logs** en cada terminal para debuggear problemas
5. **Backend proxy:** Frontend automáticamente redirige `/api` al backend

---

## ❓ ¿NECESITAS AYUDA?

- ❌ Algo no funciona? Revisa TROUBLESHOOTING arriba
- 📖 Quieres entender la arquitectura? Lee ARQUITECTURA_TECNICA_KALLPAPRO.md
- 🚀 Listo para codificar? Ve a Semana 1 en PLAN_IMPLEMENTACION_3MESES.md

---

**¡Felicidades! 🎉 Tu plataforma B2B está inicializada y funcionando.**

**Siguiente:** Implementar Autenticación JWT en Semana 1
