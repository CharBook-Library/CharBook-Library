# Pruebas de carga aisladas de CharBook

Estos scripts solo aceptan `http://127.0.0.1` o `http://localhost`. Rechazan
dominios, producción, ngrok y cualquier URL HTTPS externa.

## Contrato de seguridad

Los comandos de carga se detienen antes de escribir si no se cumplen las tres
condiciones:

1. `APP_ENV=loadtest`.
2. Driver `pgsql`.
3. Base activa `charbook_loadtest`.

Además, el host debe ser local (`127.0.0.1`, `localhost` o `::1`) y `DB_URL`
debe quedar vacío para impedir que una URL sustituya silenciosamente esos datos.

También exigen correo `array`, filesystem `local`, Scout `collection` y
credenciales externas vacías. Nunca uses la configuración normal de CharBook.

## 1. Instalar k6 en Windows

Grafana documenta Winget o Chocolatey para Windows:

```powershell
winget install --id k6.k6 --exact
k6 version
```

Documentación oficial: <https://grafana.com/docs/learning-paths/run-first-k6-test/install-k6/>

## 2. Crear la base exclusiva

Abre PowerShell. El cliente local detectado está en PostgreSQL 18:

```powershell
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
& $psql -U postgres -d postgres -tAc "SELECT datname FROM pg_database WHERE datname = 'charbook_loadtest';"
```

Si el comando anterior no devuelve `charbook_loadtest`, créala. PostgreSQL
pedirá la contraseña local en la consola; no la escribas en este repositorio.

```powershell
& $psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE charbook_loadtest TEMPLATE template0;"
```

`CREATE DATABASE` requiere un rol con privilegio `CREATEDB` o superusuario:
<https://www.postgresql.org/docs/current/sql-createdatabase.html>

## 3. Crear la configuración local

Todos los comandos Artisan de esta guía se ejecutan desde la API:

```powershell
Set-Location "C:\Projects\CharBook Library\apps\api"
Copy-Item -LiteralPath .env.loadtest.example -Destination .env.loadtest
```

Edita solo `.env.loadtest` para poner la contraseña local de PostgreSQL. El
archivo está ignorado por Git. No agregues claves de Google, Stripe, correo,
R2, Meilisearch externo ni otros proveedores.

Genera una clave propia para este entorno:

```powershell
& "C:\xampp\php\php.exe" artisan --env=loadtest key:generate
```

## 4. Verificar antes de escribir

```powershell
& "C:\xampp\php\php.exe" artisan --env=loadtest charbook:loadtest-check
```

Debe mostrar únicamente:

- entorno `loadtest`;
- driver `pgsql`;
- host local y puerto;
- base `charbook_loadtest`;
- servicios externos deshabilitados.

Si falla, no ejecutes migraciones ni seeders.

## 5. Migrar de forma protegida

El comando vuelve a comprobar las tres guardas y pide confirmación:

```powershell
& "C:\xampp\php\php.exe" artisan --env=loadtest charbook:loadtest-migrate
```

Para automatización local consciente:

```powershell
& "C:\xampp\php\php.exe" artisan --env=loadtest charbook:loadtest-migrate --force --confirm=MIGRATE_CHARBOOK_LOADTEST
```

No uses `migrate:fresh`.

## 6. Generar datos

Prueba previa con 1,000 usuarios:

```powershell
& "C:\xampp\php\php.exe" artisan --env=loadtest charbook:loadtest-seed 1000
```

Conjunto completo de 10,000 usuarios:

```powershell
& "C:\xampp\php\php.exe" artisan --env=loadtest charbook:loadtest-seed 10000
```

Para automatización local sin pregunta interactiva:

```powershell
& "C:\xampp\php\php.exe" artisan --env=loadtest charbook:loadtest-seed 10000 --force --confirm=SEED_CHARBOOK_LOADTEST
```

El total de usuarios es el parámetro principal. Las demás cantidades se
calculan con límites seguros:

| Entidad | 1,000 usuarios | 10,000 usuarios |
|---|---:|---:|
| Autores | 25 | 100 |
| Libros | 100 | 500 |
| Categorías | 12 | 12 |
| Capítulos | 300 | 1,500 |
| Favoritos | 2,000 | 20,000 |
| Reseñas | 1,000 | 5,000 |
| Comentarios | 1,000 | 8,000 |
| Vistas únicas | 3,000 | 30,000 |
| Actividades | 1,000 | 10,000 |

También pueden ajustarse explícitamente sin cambiar código. Ejemplo:

```powershell
& "C:\xampp\php\php.exe" artisan --env=loadtest charbook:loadtest-seed 10000 --authors=150 --books=800 --categories=20 --favorites=30000 --reviews=8000 --comments=9000 --views=50000 --activities=9000
```

El comando valida máximos y unicidad posible antes de iniciar el seeder.

Los correos terminan en `@example.test`. El seeder inserta relaciones por
lotes de 1,000, no sincroniza Scout y no dispara notificaciones. Genera hasta
500 tokens Sanctum temporales en la ruta ignorada
`apps/api/storage/app/private/loadtest/tokens.json`; nunca imprime su contenido.

## 7. Iniciar la API loadtest

Terminal 1:

```powershell
Set-Location "C:\Projects\CharBook Library\apps\api"
& "C:\xampp\php\php.exe" artisan --env=loadtest serve --host=127.0.0.1 --port=8001
```

Terminal 2, para comprobar la cola y su heartbeat sin servicios externos:

```powershell
Set-Location "C:\Projects\CharBook Library\apps\api"
& "C:\xampp\php\php.exe" artisan --env=loadtest queue:work --sleep=1 --tries=1
```

No uses ngrok. Antes de k6 verifica `http://127.0.0.1:8001/api/health` y que
la respuesta indique `db: ok`.

## 8. Preparar k6

```powershell
Set-Location "C:\Projects\CharBook Library\tests\load"
$env:BASE_URL = "http://127.0.0.1:8001"
$env:K6_TOKENS_FILE = "C:/Projects/CharBook Library/apps/api/storage/app/private/loadtest/tokens.json"
$env:P95_MS = "1200"
```

## 9. Escenarios

Smoke permitido, 5 usuarios durante 20 segundos:

```powershell
k6 run .\smoke.js
```

Lectura pública, autenticada y mezcla de operaciones:

```powershell
k6 run .\public-reading.js
k6 run .\authenticated-reading.js
k6 run .\mixed.js
```

Errores esperados y límite real de login. Espera 60 segundos entre ambos para
que se reinicie la ventana del rate limiter:

```powershell
k6 run .\login-rate-limit.js
k6 run .\expected-errors.js
```

Escenarios preparados. No los ejecutes sin revisar primero recursos de la PC:

```powershell
k6 run .\light.js
k6 run .\normal.js
k6 run .\peak.js
k6 run .\stress.js
```

- `normal.js`: sube a 100 VUs.
- `peak.js`: sube de 200 a 300 VUs.
- `stress.js`: llega a 500 VUs.
- `expected-errors.js`: comprueba 401, 403, 404, 422, 429 y el 500 controlado.

## 10. Interpretar resultados

- `http_req_duration p(95)`: el 95% de peticiones terminó por debajo de ese
  tiempo. El umbral inicial es 1,200 ms y puede cambiarse con `P95_MS`.
- `http_req_failed`: fallos inesperados; debe ser menor a 1%.
- `checks`: contratos HTTP cumplidos; debe superar 99%.
- `http_reqs` y su `rate`: total y peticiones por segundo.
- `iterations`: recorridos completos de lectura.

En el panel `admin/sistema`, revisa latencia, percentiles, 4xx/5xx, cola,
worker y alertas. El error 500 controlado existe solo en loadtest, devuelve un
mensaje fijo y está limitado a cinco solicitudes por minuto.

## 11. Limpieza segura

Vuelve a comprobar el entorno y después limpia. La tabla `migrations` se
conserva y el archivo temporal de tokens se elimina.

```powershell
Set-Location "C:\Projects\CharBook Library\apps\api"
& "C:\xampp\php\php.exe" artisan --env=loadtest charbook:loadtest-check
& "C:\xampp\php\php.exe" artisan --env=loadtest charbook:loadtest-clean
```

Para limpieza no interactiva se requieren ambas opciones:

```powershell
& "C:\xampp\php\php.exe" artisan --env=loadtest charbook:loadtest-clean --force --confirm=CLEAN_CHARBOOK_LOADTEST
```

El comando rechaza cualquier entorno, driver o base distintos de los valores
protegidos; no limpia la base normal de CharBook.
