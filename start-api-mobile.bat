@echo off
setlocal

set "PHP_EXE=C:\xampp\php\php.exe"
set "API_DIR=%~dp0apps\api"
set "SYNC_SCRIPT=%~dp0scripts\sync-mobile-api-url.ps1"

if not exist "%PHP_EXE%" (
  echo No se encontro PHP en "%PHP_EXE%".
  echo Instala XAMPP o corrige la ruta PHP_EXE dentro de este archivo.
  pause
  exit /b 1
)

cd /d "%API_DIR%"
echo Iniciando CharBook API para telefono en http://0.0.0.0:8000
echo.
echo IPs detectadas en esta PC:
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /C:"IPv4"') do echo   http://%%A:8000
echo.
if exist "%SYNC_SCRIPT%" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SYNC_SCRIPT%"
  echo.
)
echo Si cambias de red, vuelve a iniciar este archivo para sincronizar EXPO_PUBLIC_API_URL.
echo.
"%PHP_EXE%" artisan serve --host=0.0.0.0 --port=8000

pause
