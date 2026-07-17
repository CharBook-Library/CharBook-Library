# Handoff Codex -> Claude: endurecimiento y auditoria de produccion

Fecha: 2026-07-16

Este archivo resume el estado exacto alcanzado por Codex. No reiniciar la
auditoria, no descartar cambios existentes y no usar `git reset`, `git clean`
ni checkout destructivo.

## Reglas que se respetaron

- API: `C:\Projects\CharBook Library\apps\api`.
- Web Next.js anidada: `C:\Projects\CharBook Library\apps\web`.
- Artisan se ejecuto con `C:\xampp\php\php.exe` desde `apps\api`.
- No se ejecutaron migraciones, seeders, limpiezas ni backups sobre la base normal.
- No se contacto Stripe, Google OAuth, correo, R2 ni Meilisearch externo.
- No se desplego, no se hizo commit y no se hizo push.
- Las pruebas Laravel usan `testing` + SQLite `:memory:`.

## Trabajo completado

### 1. Suspension y baneo de cuentas

- Migracion reversible de estado de cuenta:
  `apps/api/database/migrations/2026_07_16_120000_add_account_status_to_users.php`.
- Servicio `AccountStatusService` y middleware `EnsureAccountIsActive`.
- Bloqueo aplicado a login normal, Google, 2FA, passkey y rutas Sanctum.
- Estados: active, suspended y banned; suspension temporal/permanente,
  expiracion automatica, reactivacion, revocacion de tokens, auditoria y
  notificacion segura.
- Protecciones contra autosuspension y contra dejar el sistema sin un Super Admin.
- UI integrada en `apps/web/app/admin/usuarios/page.tsx`, sin pagina nueva.
- Solo Super Admin puede administrar el estado. Incluye motivo interno, fecha,
  confirmacion, filtro, badge y fechas visibles solo en administracion.

### 2. Proxies y callback HTTPS

- Nuevo `TrustedProxyList`; se rechazan `*`, `**`, `REMOTE_ADDR` y hostnames.
- Produccion acepta solo IP/CIDR explicitos mediante `TRUSTED_PROXIES`.
- Encabezados `X-Forwarded-*` de clientes/proxies no confiables no alteran esquema/IP.
- Ngrok local puede funcionar solo si su proxy local se declara explicitamente.
- Google usa `GOOGLE_CALLBACK_URL` canonico HTTPS en produccion.
- Las excepciones de Google registran solo la clase, no mensajes con datos sensibles.

### 3. Seguridad EPUB

- `FileGuard` valida estructura EPUB, mimetype, container/rootfile, XML seguro,
  traversal, scripts, handlers, iframes, recursos remotos, DTD/entidades,
  profundidad, tamano, cantidad de entradas y relacion de compresion ZIP bomb.
- Limites nuevos en `.env.example`: `ARCHIVE_MAX_COMPRESSION_RATIO=200` y
  `ARCHIVE_RATIO_MIN_BYTES=1048576`.
- Web usa `epubjs@0.3.93` y override `@xmldom/xmldom@0.8.13`.
- El lector contiene CFI persistente, progreso, marcadores, busqueda, temas y TTS.

### 4. Redis, workers y scheduler

- Conexiones Redis separadas: default/cache/queue/session con DB 0/1/2/3.
- URLs separadas: `REDIS_URL`, `REDIS_CACHE_URL`, `REDIS_QUEUE_URL` y
  `REDIS_SESSION_URL`; prefijos por ambiente.
- Fallback local database/array; los tests no requieren Redis.
- `retry_after=1900` supera el timeout de importacion de 1800 segundos.
- Health check de Redis, cola, worker y scheduler; heartbeat y alertas.
- Ejemplos Linux completos en `apps/api/deploy/` para Supervisor, systemd y cron.
- Documentado drenado de jobs database antes de cambiar a Redis, reinicio,
  parada segura, memoria, logs y `queue:restart`.
- Redis no esta operativo en esta PC: XAMPP no tiene `ext-redis`; no se instalo nada.

### 5. Backups y restauracion

- Servicios y comandos nuevos en `apps/api/app/Services/Backups/` y
  `apps/api/app/Console/Commands/*CharBookBackup*.php`.
- Cifrado AES-256-GCM por bloques, formato `CHARBK01` version 2, cabecera
  autenticada con AAD, hashes SHA-256 y limites estrictos.
- `Process` recibe argumentos como arreglo, sin shell; binarios permitidos solo
  `pg_dump` y `pg_restore`.
- Protecciones contra traversal, ZIP malicioso, entradas extra/duplicadas,
  archivos cifrados, nombres manipulados, exceso de tamano y concurrencia.
- Temporales 0700/0600 y limpieza en errores. Destino S3 privado y separado.
- Restore solo con `APP_ENV=restore`, PostgreSQL y base exacta
  `charbook_restoretest`.
- Runbook: `apps/api/docs/PRODUCTION_OPERATIONS.md`.
- Preparado para staging, no validado contra R2 ni PostgreSQL real.

### 6. Load test aislado

- Guardas: `APP_ENV=loadtest`, driver PostgreSQL, base exacta
  `charbook_loadtest`, `DB_URL` vacio y host estrictamente loopback.
- La lista de hosts ya no puede redefinirse por variables de entorno.
- Servicios externos y credenciales deben estar vacios/deshabilitados.
- Migracion, seeder y limpieza requieren confirmaciones exactas en modo `--force`.
- Seeder por lotes de 1000; soporta 1000/10000 usuarios, autores, libros,
  categorias, favoritos, resenas, comentarios, vistas y actividad.
- Todos los correos se verifican como `@example.test`; no dispara eventos,
  Scout, correo, notificaciones, colas ni servicios externos.
- Tokens k6 quedan en ruta ignorada, modo 0600, y la limpieza los elimina.
- Scripts k6 preparados en `tests/load/`: smoke, lectura publica/autenticada,
  login/rate-limit, mixto, 100, 200-300 y 500 usuarios.

Estado real: `.env.loadtest` no existe, k6 no esta instalado y no hay API en
puerto 8001. `charbook:loadtest-check` se ejecuto y rechazo correctamente la
base normal `charbook` antes de conectar/escribir. No se creo
`charbook_loadtest` y no se generaron 10,000 usuarios.

### 7. Dependencias y build web

- `composer validate --strict`: correcto.
- `composer audit --no-dev`: 0 avisos.
- `npm audit` detecto PostCSS vulnerable dentro de Next. No se uso
  `npm audit fix --force`.
- Se agrego override limitado de Next -> `postcss@8.5.15`; auditoria final: 0.
- Se reemplazo `next/font/google` por fuentes locales:
  `@fontsource-variable/inter@5.2.8` y
  `@fontsource-variable/playfair-display@5.2.8`.
- El build ya no descarga Google Fonts y paso con 59 rutas.
- Se agrego `turbopack.root = process.cwd()` siguiendo la documentacion local
  de Next 16 para el repositorio web anidado. Falta repetir build tras este
  ultimo ajuste (el build anterior ya paso antes de agregar esta linea).

## Cambios adicionales de esta reanudacion

- Nueva prueba `AccountStatusMigrationTest.php`: rollback y reaplicacion.
- `LoadTestSafetyTest` ahora demuestra que un host PostgreSQL remoto se rechaza
  antes de abrir conexion.
- Se actualizaron dos expectativas antiguas en `ChapterImportTest`: EPUB sin
  paquete y EPUB con XXE ahora se rechazan en upload con 422 y no crean imports.
- Esos 19 tests de importacion pasan despues del ajuste.

## Resultados exactos disponibles

- PHP lint: 299 archivos, 0 fallos.
- Suite dirigida de seguridad: 94 tests, 619 assertions, todo en verde.
- Loadtest + factories + rollback: 19 tests, 145 assertions, todo en verde.
- `ChapterImportTest`: 19 tests, 86 assertions, todo en verde.
- Suite Laravel completa inicial: 205 pasaron, 2 fallaron, 1112 assertions.
  Los dos fallos eran expectativas antiguas y ya se corrigieron; falta repetir
  la suite completa para obtener el total final verde.
- `npx tsc --noEmit`: paso.
- Build Next: paso, 59 rutas, 67.3 s, antes del ajuste final de `turbopack.root`.
- `npm audit --omit=dev`: 0 vulnerabilidades despues del override.
- `composer audit --no-dev`: 0 vulnerabilidades.
- `git diff --check` habia pasado en raiz y web antes de los ultimos ajustes;
  debe repetirse al final.

## ESLint pendiente y explicado

`npm run lint` termino con 172 problemas: 122 errores y 50 warnings repartidos
por archivos previos de la web. No se oculto ni se interpreto como detencion.

- Los archivos de la UI de suspension (`admin/usuarios`, `api-creator` y
  `ui/textarea`) pasaron lint dirigido.
- `components/reader/epub-reader.tsx` conserva deuda propia: 32 errores y
  11 warnings (tipos `any`, efectos que inicializan estado, refs y funciones
  declaradas despues de handlers). TypeScript y build si pasan.
- No se hizo un refactor masivo para limpiar 122 errores ajenos al alcance.

## Riesgo critico descubierto, aun no corregido

`apps/api/app/Http/Controllers/Auth/PasskeyController.php` no verifica una
afirmacion WebAuthn criptografica. El login acepta un `credential_id` conocido
despues del challenge y emite token; el registro tampoco valida el challenge
ni attestation. No existe `web-auth/webauthn-lib` instalado.

Esto es un P1 de autenticacion. No declarar produccion mientras siga activo.
La correccion segura inmediata es deshabilitar registro/login passkey hasta
integrar y probar una libreria WebAuthn real; no se debe implementar criptografia
WebAuthn manualmente.

## Punto exacto para continuar

1. Decidir y aplicar el bloqueo temporal seguro de passkeys, con tests.
2. Ejecutar suite Laravel completa otra vez:
   `& "C:\xampp\php\php.exe" artisan test` desde `apps\api`.
3. Repetir `npx tsc --noEmit` y `npm run build` desde `apps\web`.
4. Ejecutar lint dirigido a archivos tocados y reportar por separado la deuda global.
5. Ejecutar `git diff --check` en raiz y en `apps\web`.
6. No crear loadtest hasta que el usuario proporcione `.env.loadtest` local
   seguro y confirme PostgreSQL local. No instalar k6 sin permiso.

## Estado de datos e infraestructura

- Base normal: no modificada por Codex durante esta auditoria.
- `charbook_loadtest`: no creada.
- Usuarios ficticios: 0 creados en PostgreSQL loadtest.
- Backups reales: no ejecutados.
- R2/PostgreSQL restore real: no contactados.
- Redis/workers/scheduler Linux: preparados, no ejecutados.
- Veredicto provisional: no apto para produccion; preparado para seguir en
  staging una vez cerrado passkey, repetida la suite final y probada la
  infraestructura real.
