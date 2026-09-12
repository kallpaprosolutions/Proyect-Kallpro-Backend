@echo off
chcp 65001 > nul
title KallpaPro - Detener
color 0C

set "ROOT=%~dp0"

echo.
echo  ============================================
echo       KallpaPro ERP  --  Deteniendo...
echo  ============================================
echo.

:: ── 1. Cerrar ventana Frontend ───────────────
echo  [1/4]  Cerrando Frontend...
taskkill /FI "WINDOWTITLE eq KALLPAPRO-FRONTEND*" /F > nul 2>&1
echo         OK
echo.

:: ── 2. Cerrar ventana Backend ────────────────
echo  [2/4]  Cerrando Backend...
taskkill /FI "WINDOWTITLE eq KALLPAPRO-BACKEND*" /F > nul 2>&1
echo         OK
echo.

:: ── 3. Cerrar Ollama ─────────────────────────
echo  [3/4]  Cerrando Ollama AI...
taskkill /FI "WINDOWTITLE eq KALLPAPRO-OLLAMA*" /F > nul 2>&1
taskkill /F /IM ollama.exe > nul 2>&1
echo         OK
echo.

:: ── 4. Detener base de datos (SIN borrar datos) ──
echo  [4/4]  Deteniendo base de datos...
cd /D "%ROOT%"
docker compose stop postgres > nul 2>&1
if %errorlevel% neq 0 docker stop kallpapro-db > nul 2>&1
echo         OK - kallpapro-db detenido
echo         DATOS GUARDADOS en volumen postgres_data
echo.

echo  ============================================
echo   KallpaPro detenido. Datos de BD conservados.
echo  ============================================
echo.
echo   NOTA: Los datos NO se borran al detener.
echo   El contenedor de Docker queda detenido (no se elimina).
echo   Para borrar TODOS los datos (reset total):
echo     docker compose down -v   (IRREVERSIBLE)
echo.
echo   Para volver a iniciar: ejecuta "INICIAR KallpaPro.bat"
echo.
pause
