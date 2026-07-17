@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "PHP_EXE=C:\xampp\php\php.exe"
set "API_DIR=%ROOT_DIR%apps\api"
set "WEB_DIR=%ROOT_DIR%apps\web"
set "MOBILE_DIR=C:\Projects\CharBookReact-main"
set "SYNC_SCRIPT=%ROOT_DIR%scripts\sync-mobile-api-url.ps1"

if not exist "%PHP_EXE%" (
  echo No se encontro PHP en "%PHP_EXE%".
  echo Corrige PHP_EXE dentro de este archivo o instala XAMPP.
  pause
  exit /b 1
)

if not exist "%API_DIR%\artisan" (
  echo No se encontro Laravel en "%API_DIR%".
  pause
  exit /b 1
)

if not exist "%WEB_DIR%\package.json" (
  echo No se encontro la app web en "%WEB_DIR%".
  pause
  exit /b 1
)

echo Iniciando CharBook Library en modo desarrollo...
echo.
echo API:    http://0.0.0.0:8000
echo Web:    http://localhost:3000
echo Expo:   %MOBILE_DIR%
echo.
echo IPs detectadas para telefono:
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /C:"IPv4"') do echo   http://%%A:8000
echo.

if exist "%SYNC_SCRIPT%" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SYNC_SCRIPT%"
  echo.
)

start "CharBook API" cmd /k "cd /d "%API_DIR%" && "%PHP_EXE%" artisan serve --host=0.0.0.0 --port=8000"
start "CharBook Web" cmd /k "cd /d "%WEB_DIR%" && npm run dev"

if exist "%MOBILE_DIR%\package.json" (
  start "CharBook Expo LAN" cmd /k "cd /d "%MOBILE_DIR%" && npm run start:lan"
) else (
  echo No se encontro la app movil en "%MOBILE_DIR%"; abre Expo manualmente si esta en otra carpeta.
)

echo.
echo Listo. Deja abiertas las ventanas de API, Web y Expo mientras pruebas.
pause
