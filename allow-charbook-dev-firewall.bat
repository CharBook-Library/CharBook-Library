@echo off
setlocal

net session >nul 2>&1
if not "%ERRORLEVEL%"=="0" (
  echo Ejecuta este archivo como administrador.
  echo Click derecho ^> Ejecutar como administrador.
  pause
  exit /b 1
)

echo Abriendo puertos de desarrollo para CharBook...

netsh advfirewall firewall add rule name="CharBook API dev (8000)" dir=in action=allow protocol=TCP localport=8000 >nul
netsh advfirewall firewall add rule name="CharBook Web dev (3000)" dir=in action=allow protocol=TCP localport=3000 >nul
netsh advfirewall firewall add rule name="CharBook Expo Metro dev (8081)" dir=in action=allow protocol=TCP localport=8081 >nul

echo Listo. Puertos permitidos: 8000, 3000, 8081.
pause
