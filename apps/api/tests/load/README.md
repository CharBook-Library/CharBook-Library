# Pruebas de carga (k6) — entorno loadtest aislado

Estas pruebas ejercen **solo** la API loadtest en `http://127.0.0.1:8001`, contra
la base PostgreSQL `charbook_loadtest`. **Nunca** tocan la base normal `charbook`
ni llaman servicios externos (Google, Stripe, correo, R2, Meilisearch, IA, voz).

## Archivos

| Archivo | Qué hace |
|---|---|
| `lib/config.js` | Host FIJO `127.0.0.1:8001` (rechaza overrides), endpoints reales, slugs deterministas del seeder. |
| `lib/tokens.js` | Lee tokens de `storage/app/private/loadtest/tokens.json`. Nunca los imprime. |
| `lib/metrics.js` | Métricas, contadores por código HTTP, separa errores esperados vs inesperados. |
| `smoke.js` | Humo: 5 VUs, 30 s. Recorrido público + autenticado. |
| `light.js` | Ligera: hasta 20 VUs con rampa. Mezcla lectura pública/autenticada, solo lecturas. |

## Rutas reales usadas (verificadas en `apps/api/routes/api.php`)

- Público: `GET /api/books`, `GET /api/books/{slug}`, `GET /api/categories`,
  `GET /api/books/search-instant?q=…`, `GET /api/health`.
- Autenticado (Bearer): `GET /api/user`, `GET /api/me/shelf`, `GET /api/me/favorites`.

## Requisitos previos

1. **k6 instalado.** No se instala automáticamente. Comando oficial en Windows:
   ```powershell
   winget install k6 --source winget
   ```
   (alternativa: `choco install k6`). Verifica con `k6 version`.
2. **Datos sembrados** en `charbook_loadtest` (10 000 usuarios) — ya generados por
   `charbook:loadtest-seed 10000`. Esto crea también
   `storage/app/private/loadtest/tokens.json` (permisos 0600).
3. **API loadtest levantada en el puerto 8001** (ver comandos abajo).

## Comandos exactos (ejecutar desde `apps/api`)

### 1) Levantar la API loadtest en 8001
```powershell
cd "C:\Projects\CharBook Library\apps\api"
& "C:\xampp\php\php.exe" artisan --env=loadtest serve --host=127.0.0.1 --port=8001
```
Déjala corriendo en su propia terminal. Comprueba: `http://127.0.0.1:8001/api/health`.

### 2) Levantar un worker loadtest (SOLO si se necesita)
Smoke y light son **solo lecturas** y NO encolan jobs, así que **no hace falta**
worker. Si más adelante una prueba genera jobs:
```powershell
& "C:\xampp\php\php.exe" artisan --env=loadtest queue:work --queue=default --stop-when-empty
```

### 3) Ejecutar smoke (5 VUs)
```powershell
cd "C:\Projects\CharBook Library\apps\api"
k6 run tests/load/smoke.js
```

### 4) Ejecutar light (hasta 20 VUs)
```powershell
cd "C:\Projects\CharBook Library\apps\api"
k6 run tests/load/light.js
```

Si tu k6 no encuentra el archivo de tokens, pásalo explícito:
```powershell
k6 run -e TOKENS_FILE="C:/Projects/CharBook Library/apps/api/storage/app/private/loadtest/tokens.json" tests/load/smoke.js
```

### 5) Detener procesos
- k6 termina solo al acabar el escenario.
- API/worker: `Ctrl+C` en su terminal. O por puerto:
  ```powershell
  Get-NetTCPConnection -LocalPort 8001 -State Listen | Select-Object -Expand OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
  ```

### 6) Limpiar los datos loadtest (SOLO con autorización explícita)
No borra nada por defecto. Cuando se autorice:
```powershell
& "C:\xampp\php\php.exe" artisan --env=loadtest charbook:loadtest-clean --force --confirm=CLEAN_CHARBOOK_LOADTEST
```

## Thresholds iniciales

- `unexpected_errors` (5xx / red / status 0) **< 1 %**. Los **429** por rate limit
  NO cuentan como error del sistema.
- `http_req_duration` **p(95) < 1 s** (objetivo inicial; si no se cumple, k6 lo
  marca en rojo — no se oculta).
- `checks` **> 99 %**.

El resumen de k6 reporta P50/P90/P95/P99, RPS (`http_reqs`) y los contadores
`status_2xx/3xx/4xx/429/5xx` para ver la distribución de códigos.

## Seguridad

- Host fijado a `127.0.0.1:8001`; cualquier `-e BASE_URL=` distinto aborta.
- Tokens solo desde `storage/app/private/loadtest/tokens.json`; jamás se imprimen
  ni aparecen en resúmenes ni en JSON de resultados (solo viajan en `Authorization`).
- `tokens.json` y `.env.loadtest` están en `.gitignore`.
