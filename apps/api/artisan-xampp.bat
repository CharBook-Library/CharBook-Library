@echo off
setlocal

set "PHP_EXE=C:\xampp\php\php.exe"

if not exist "%PHP_EXE%" (
  echo No se encontro PHP en "%PHP_EXE%".
  echo Corrige PHP_EXE dentro de este archivo o instala XAMPP.
  exit /b 1
)

"%PHP_EXE%" artisan %*
