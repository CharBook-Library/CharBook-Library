# Entorno loadtest concurrente (Windows / XAMPP)

Segunda instancia de **Apache** (aislada de XAMPP) que sirve la API en
`127.0.0.1:8001` con `APP_ENV=loadtest` → base **charbook_loadtest**. Reemplaza a
`artisan serve` (monoproceso) para poder medir concurrencia real.

## Por qué Apache mod_php y no las otras opciones

| Opción | Veredicto en esta máquina |
|---|---|
| `PHP_CLI_SERVER_WORKERS` | **No funciona en Windows** (probado: serializa, 1 solo PID). |
| Nginx + PHP-FPM | PHP-FPM no existe en Windows; XAMPP no trae Nginx. |
| Laravel Octane | Requiere Swoole (no-Windows) o RoadRunner (binario a instalar → no permitido). |
| **Apache mod_php (XAMPP)** | **Elegido**: ya instalado, multihilo real (ThreadsPerChild), 0 software nuevo. |

## Decisiones clave (todas medidas, no supuestas)

- **Config cacheada a ruta aislada** (`APP_CONFIG_CACHE=storage/app/private/loadtest/apache/config-loadtest.php`).
  mod_php es multihilo en un proceso y la carga de `.env` en runtime NO es
  thread-safe → sin esto, ~2 % de peticiones caían al default `sqlite`. Cachear
  la config elimina el parseo de `.env` por petición. NO toca el
  `bootstrap/cache/config.php` de la app normal.
- **opcache OFF**: en SHM da `VirtualProtect() failed [87]` (riesgo bajo carga);
  `file_cache_only` resultó más lento que sin opcache. OFF = estable. En
  producción Linux se usaría opcache SHM (aún más rápido).
- **Solo loopback** (`Listen 127.0.0.1:8001`), logs/PID/config en
  `storage/app/private/loadtest/` (ignorado por Git, ACL restringida).

## Comandos exactos

Todo desde `C:\Projects\CharBook Library\apps\api`.

### 1) (Re)generar la config cacheada aislada — solo si cambió .env.loadtest
```powershell
$env:APP_CONFIG_CACHE='storage/app/private/loadtest/apache/config-loadtest.php'
& "C:\xampp\php\php.exe" artisan --env=loadtest config:cache
Remove-Item Env:\APP_CONFIG_CACHE
```

### 2) Arrancar la API loadtest concurrente en 8001
```powershell
$env:APP_ENV='loadtest'
$env:APP_CONFIG_CACHE='storage/app/private/loadtest/apache/config-loadtest.php'
& "C:\xampp\apache\bin\httpd.exe" -f "C:\Projects\CharBook Library\apps\api\deploy\windows-loadtest\httpd-loadtest.conf"
```
Verificar: `Invoke-WebRequest http://127.0.0.1:8001/api/health` → `{"ok":true,...,"db":"ok"}`.

### 3) Worker loadtest — NO es necesario para smoke/light/100
Los escenarios son de solo lectura (GET) y no encolan jobs. Solo si una futura
prueba dispara jobs:
```powershell
$env:APP_ENV='loadtest'
& "C:\xampp\php\php.exe" artisan --env=loadtest queue:work --stop-when-empty
```

### 4) Ejecutar pruebas k6 (tokens desde storage/app/private/loadtest/tokens.json)
```powershell
& "C:\Program Files\k6\k6.exe" run tests/load/smoke.js
& "C:\Program Files\k6\k6.exe" run tests/load/light.js
# 100 usuarios (solo con autorización explícita):
& "C:\Program Files\k6\k6.exe" run tests/load/load100.js
```

### 5) Detener SOLO la API loadtest (no toca la API normal de 8000, que es php.exe)
```powershell
& "C:\xampp\apache\bin\httpd.exe" -f "C:\Projects\CharBook Library\apps\api\deploy\windows-loadtest\httpd-loadtest.conf" -k shutdown
# si queda algún httpd: taskkill /IM httpd.exe /F   (la API normal es php.exe, no httpd)
```

### 6) Limpiar datos loadtest — SOLO con autorización
```powershell
& "C:\xampp\php\php.exe" artisan --env=loadtest charbook:loadtest-clean --force --confirm=CLEAN_CHARBOOK_LOADTEST
```

## Seguridad / aislamiento
- Nunca toca la base normal `charbook`; guardas en `charbook:loadtest-check`.
- `tokens.json` y `config-loadtest.php` contienen secretos → ACL solo
  propietario/SYSTEM/Administradores, y están en zona ignorada por Git.
- No usa Google/Stripe/correo/R2/IA/Meilisearch externo (mail=array, scout=collection).
