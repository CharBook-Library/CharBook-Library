# Operacion de CharBook: Redis, colas y backups

Este documento prepara staging/produccion. No sustituye una prueba real en la
infraestructura final y no contiene secretos.

## 1. Redis

### Estado actual de desarrollo

- El PHP de XAMPP detectado no tiene `ext-redis`.
- Docker esta disponible, pero no se instalo ni inicio ningun contenedor.
- Local puede seguir con `CACHE_STORE=database`, `QUEUE_CONNECTION=database`
  y `SESSION_DRIVER=database`.
- El health check solo intenta Redis si cache, cola o sesion realmente lo usan.

### Desarrollo con Docker

1. Pedir autorizacion antes de instalar o iniciar software.
2. Iniciar un Redis local persistente:

```powershell
docker run --name charbook-redis -p 6379:6379 -d redis:7-alpine redis-server --appendonly yes
```

3. Instalar un cliente PHP compatible: `ext-redis` para la version exacta de
   PHP/XAMPP, o agregar `predis/predis` al proyecto y usar
   `REDIS_CLIENT=predis`. Ninguna de esas opciones se instalo automaticamente.
4. Configurar conexiones separadas: DB 0 general, DB 1 cache, DB 2 cola y DB 3
   sesiones. Usar `REDIS_PREFIX` y `CACHE_PREFIX` distintos por ambiente.
   Si el proveedor entrega URLs con el DB incluido, usar `REDIS_URL`,
   `REDIS_CACHE_URL`, `REDIS_QUEUE_URL` y `REDIS_SESSION_URL` por separado;
   no reutilizar una sola URL para las cuatro conexiones.

### Produccion Linux

Usar Redis administrado o Redis 7 privado, TLS si cruza redes, autenticacion,
sin puerto publico y con `phpredis`. Variables principales:

```dotenv
CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
SESSION_CONNECTION=session
SESSION_SECURE_COOKIE=true
REDIS_CLIENT=phpredis
REDIS_QUEUE_CONNECTION=queue
REDIS_QUEUE_RETRY_AFTER=1900
REDIS_QUEUE_BLOCK_FOR=5
REDIS_PREFIX=charbook_production_redis_
CACHE_PREFIX=charbook_production_cache_
```

El `retry_after` de 1900 s supera el timeout maximo actual de importacion
(1800 s), evitando que otro worker tome el mismo job antes de tiempo. El
fallback `database` usa el mismo valor mediante `DB_QUEUE_RETRY_AFTER=1900`.

### Cambio desde la cola database sin perder jobs

No cambiar `QUEUE_CONNECTION` mientras existan filas pendientes:

1. Detener temporalmente nuevas importaciones/despachos.
2. Mantener workers `database` hasta que listos, retrasados y reservados sean 0.
3. Revisar `failed_jobs` y resolver/reintentar de forma consciente.
4. Cambiar a Redis, limpiar solo cache de configuracion y arrancar workers Redis.
5. Ejecutar `php artisan queue:restart` en cada despliegue.

Laravel no mueve automaticamente jobs existentes entre drivers. Este drenado es
obligatorio. Los dos jobs de importacion conservan `tries=1`: un reintento
automatico podria duplicar capitulos tras una ejecucion parcial. Los demas jobs
usan el backoff y los intentos del worker.

Horizon no se agrego: hoy solo existen dos jobs largos y el panel propio ya
mide heartbeat, pendientes y fallos. Reevaluarlo despues de validar Redis en
staging y si se necesitan colas/prioridades adicionales.

## 2. Workers y scheduler

Elegir Supervisor o systemd para workers. Para scheduler, elegir timer systemd
o cron, nunca ambos.

### Supervisor

Copiar `deploy/supervisor/charbook-worker.conf.example`, ajustar rutas/usuario y:

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status charbook-worker:*
```

### systemd

Copiar los ejemplos de `deploy/systemd`, proteger `/etc/charbook/api.env` con
modo 600 y arrancar dos workers:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now charbook-worker@1 charbook-worker@2
sudo systemctl enable --now charbook-scheduler.timer
systemctl status charbook-worker@1 charbook-scheduler.timer
```

Despliegue seguro:

```bash
php artisan down --retry=30
php artisan config:cache
php artisan route:cache
php artisan queue:restart
php artisan up
```

Esperar la salida limpia de workers antes de reemplazar codigo. El timeout de
parada es 1900 s, memoria 512 MB y cada proceso se recicla cada hora. El panel
marca degradado/crítico si el heartbeat se vuelve antiguo, hay jobs listos sin
worker o aparecen fallos. Revisar `journalctl`, Supervisor y `failed_jobs`.

## 3. Backups cifrados

### Alcance y seguridad

El backup incluye un `pg_dump` custom y los discos configurados (public,
r2_books y r2_covers), pero excluye archivos temporales, `.env`, claves,
tokens loadtest y tablas transitorias de sesiones/cache/colas/tokens. La clave
de cifrado nunca entra al ZIP, auditoria ni logs.

- `Process` recibe argumentos como arreglo: no usa shell.
- Solo acepta binarios llamados `pg_dump` y `pg_restore`.
- AES-256-GCM autentica bloques de 1 MB con nonce aleatorio y AAD secuencial.
- El formato `CHARBK01` version 2 autentica tambien la cabecera del cifrado.
- Hashes SHA-256 validan archivo cifrado, ZIP, dump y cada objeto.
- Se rechazan traversal, entradas extra/duplicadas, ZIP corrupto, exceso de
  archivos y limites por archivo/total/archivo cifrado.
- Temporales usan directorio 0700 y archivos 0600; siempre se limpian.
- Un lock impide backup, restore y retencion concurrentes.
- El destino debe ser un bucket S3/R2 privado y separado.

### Configuracion

1. Crear bucket privado exclusivo, sin acceso publico y con lifecycle adicional
   del proveedor si se desea una segunda barrera de retencion.
2. Usar credenciales con acceso solo a ese bucket.
3. Generar 32 bytes aleatorios fuera del repositorio y guardarlos como base64
   en el gestor de secretos (`BACKUP_ENCRYPTION_KEY`).
4. Configurar `BACKUP_S3_*`, rutas de PostgreSQL y limites de `.env.example`.
   `BACKUP_PATH` debe ser relativo y seguro, el disco de destino no puede
   aparecer en `BACKUP_SOURCE_DISKS`, y el cache compartido debe ser Redis o
   database para que el lock funcione entre procesos.
5. Ejecutar primero:

```bash
php artisan charbook:backup
```

El dry-run no escribe. Solo cuando staging reporte todo listo:

```bash
php artisan charbook:backup --execute --confirm=BACKUP_CHARBOOK
```

Verificar un objeto sin restaurar:

```bash
php artisan charbook:backup-verify charbook/YYYY/MM/DD/charbook-TIMESTAMP-ID.cbk
```

La programacion diaria solo se activa con `BACKUP_ENABLED=true` y
`BACKUP_SCHEDULE_ENABLED=true`. Retencion manual primero en dry-run:

```bash
php artisan charbook:backup-prune
php artisan charbook:backup-prune --execute --confirm=PRUNE_CHARBOOK_BACKUPS
```

### Restauracion y simulacro

Nunca restaurar sobre desarrollo normal o produccion. Crear PostgreSQL
`charbook_restoretest`, copiar `.env.restore.example` a `.env.restore`, llenar
solo credenciales de restore/backup y generar una APP_KEY exclusiva.

```powershell
& "C:\xampp\php\php.exe" artisan --env=restore charbook:backup-restore `
  charbook/YYYY/MM/DD/charbook-TIMESTAMP-ID.cbk
& "C:\xampp\php\php.exe" artisan --env=restore charbook:backup-restore `
  charbook/YYYY/MM/DD/charbook-TIMESTAMP-ID.cbk --execute `
  --confirm=RESTORE_CHARBOOK_RESTORETEST
```

El primer comando solo verifica. El segundo usa `pg_restore --clean` y solo se
habilita con `APP_ENV=restore`, driver PostgreSQL y nombre exacto
`charbook_restoretest`. Los archivos del ZIP se verifican, pero no se copian
automaticamente a buckets activos: un simulacro debe restaurarlos en buckets
aislados y comparar manifiesto/conteos antes de promover datos.

### Rotacion de clave e incidentes

- Conservar claves anteriores en el gestor de secretos durante toda la
  retencion; para verificar un backup antiguo, cargar temporalmente su clave.
- Crear y verificar un backup con la nueva clave antes de retirar la anterior.
- Si falla un backup, revisar `backup.failed`, logs, disco temporal, PostgreSQL
  y permisos del bucket. No borrar el ultimo backup valido.
- Probar restauracion mensual en infraestructura aislada y registrar tiempo,
  conteos y hashes. Definir RPO/RTO con negocio.

## 4. Limite de la evidencia actual

El cifrado, manipulacion, limites, guardas y restore ficticio tienen tests
automatizados. Aun no se contacto R2/S3 ni se ejecuto `pg_dump/pg_restore`
contra PostgreSQL real. Workers, Redis y scheduler tampoco se ejecutaron en
Linux. Por eso el subsistema esta preparado para staging, no validado para
produccion.
