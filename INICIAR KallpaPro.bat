@echo off
chcp 65001 > nul
title KallpaPro Launcher
color 0B

:: Carpeta donde esta este .bat (raiz del proyecto) - sin rutas fijas
set "ROOT=%~dp0"
set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"

echo.
echo  ============================================
echo       KallpaPro ERP  --  Iniciando...
echo  ============================================
echo.

:: ===========================================================
::  [1/6]  Docker Desktop (arrancarlo si no esta corriendo)
:: ===========================================================
echo  [1/6]  Verificando Docker Desktop...
docker info >nul 2>&1
if %errorlevel% equ 0 goto DOCKER_OK

echo         Docker no responde. Iniciando Docker Desktop...
if exist "%DOCKER_EXE%" (
    start "" "%DOCKER_EXE%"
) else (
    echo         No se encontro "Docker Desktop.exe". Abrelo manualmente y reintenta.
)
echo         Esperando a que el motor de Docker arranque (puede tardar ~1 min)...
set /a dtry=0
:WAIT_DOCKER
timeout /t 5 /nobreak >nul
docker info >nul 2>&1
if %errorlevel% equ 0 goto DOCKER_OK
set /a dtry+=1
if %dtry% lss 36 (
    echo            ...esperando motor Docker [%dtry%/36]
    goto WAIT_DOCKER
)
echo         ERROR: Docker no inicio tras ~3 minutos.
pause
exit /b
:DOCKER_OK
echo         OK - Docker operativo
echo.

:: ===========================================================
::  [2/6]  Base de datos (Postgres con volumen persistente)
:: ===========================================================
echo  [2/6]  Base de datos (Docker + volumen persistente)...
cd /D "%ROOT%"
:: Arranca el contenedor existente por nombre (evita el conflicto de "port already
:: allocated" que ocurre si compose intenta crear uno nuevo). Si no existe aun, lo crea.
docker start kallpapro-db >nul 2>&1
if %errorlevel% neq 0 docker compose up -d postgres >nul 2>&1
echo         OK - kallpapro-db en puerto 5433 (datos protegidos: volumen postgres_data)
echo.

:: ===========================================================
::  [3/6]  Esperar a que Postgres acepte conexiones
:: ===========================================================
echo  [3/6]  Esperando que Postgres este listo...
set /a ptry=0
:WAIT_PG
docker exec kallpapro-db pg_isready -U postgres >nul 2>&1
if %errorlevel% equ 0 goto PG_OK
timeout /t 2 /nobreak >nul
set /a ptry+=1
if %ptry% lss 15 goto WAIT_PG
echo         AVISO: Postgres tardo en responder; se continua de todos modos.
:PG_OK
echo         OK - Postgres aceptando conexiones
echo.

:: ===========================================================
::  [4/6]  Aplicar migraciones pendientes de Prisma
:: ===========================================================
echo  [4/6]  Aplicando migraciones de base de datos (Prisma)...
pushd "%ROOT%Proyect-Kallpro-Backend"
call npx prisma migrate deploy
popd
echo         OK - esquema de BD actualizado
echo.

:: ===========================================================
::  [5/6]  Backend (puerto 5001)
:: ===========================================================
echo  [5/6]  Backend  (puerto 5001)...
start "KALLPAPRO-BACKEND" powershell -NoExit -Command ^
    "Write-Host '--- KallpaPro BACKEND (puerto 5001) ---' -ForegroundColor Cyan; ^
     Set-Location '%ROOT%Proyect-Kallpro-Backend'; ^
     npm run dev"
echo         Ventana Backend abierta. Esperando que responda...
set /a btry=0
:WAIT_BACK
timeout /t 3 /nobreak >nul
curl -s -o nul http://localhost:5001/health
if %errorlevel% equ 0 goto BACK_OK
set /a btry+=1
if %btry% lss 20 goto WAIT_BACK
echo         AVISO: el backend tardo en responder; se continua.
:BACK_OK
echo         OK - backend arriba en http://localhost:5001
echo.

:: ===========================================================
::  [6/6]  Frontend (puerto 3001)
:: ===========================================================
echo  [6/6]  Frontend (puerto 3001)...
start "KALLPAPRO-FRONTEND" powershell -NoExit -Command ^
    "Write-Host '--- KallpaPro FRONTEND (puerto 3001) ---' -ForegroundColor Green; ^
     Set-Location '%ROOT%Proyect-Kallpro-Frontend'; ^
     npm run dev"
echo         OK - ventana Frontend abierta
echo.

:: ===========================================================
::  Ollama (IA) NO se arranca automaticamente.
::  La IA se activa/desactiva desde Configuracion > Empresa > Inteligencia Artificial.
::  Para usarla, abre Ollama manualmente ("ollama serve") y activala en la app.
:: ===========================================================
echo  [i]    Ollama (IA) NO se inicia: actívalo en Configuración cuando lo necesites.
echo.

:: ===========================================================
::  Abrir navegador
:: ===========================================================
echo  Esperando que el frontend compile...
timeout /t 8 /nobreak >nul
start http://localhost:3001/login

echo.
echo  ============================================
echo   KallpaPro iniciado correctamente!
echo  ============================================
echo.
echo   App:         http://localhost:3001/login
echo   Backend:     http://localhost:5001
echo   Email:       admin@gmail.com
echo   Contrasena:  12345678
echo.
echo   DB persistente: docker volume ls (ver postgres_data)
echo   Para detener:   ejecuta "PARAR KallpaPro.bat"
echo.
echo  ============================================
echo.
pause
