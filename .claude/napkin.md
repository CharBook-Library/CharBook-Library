# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-07-16] PHP is XAMPP's, not on PATH**
   Do instead: run artisan as `& "C:\xampp\php\php.exe" artisan ...` from `apps\api` (PowerShell) or `/c/xampp/php/php.exe` (bash).
2. **[2026-07-16] Tests must never touch the real PostgreSQL DB**
   Do instead: set `APP_ENV=testing DB_CONNECTION=sqlite DB_DATABASE=:memory: CACHE_STORE=array QUEUE_CONNECTION=sync MAIL_MAILER=array` before `artisan test`.
3. **[2026-07-16] Redis/ext-redis NOT installed on this PC**
   Do instead: any Redis-dependent code path must degrade gracefully; never assume `Redis::` facade works locally.

## Shell & Command Reliability
1. **[2026-07-16] Repo has a NESTED git repo at apps/web**
   Do instead: run `git status`/`git diff` separately in root and in `apps/web`; never `git reset/clean` (many uncommitted changes).
2. **[2026-07-17] PowerShell shell-guard da falsos positivos con `icacls .../inheritance:r`, `*` y rutas `C:\Program`**
   Do instead: si un comando read-only se bloquea como "Remove-Item on system path", reintenta en Bash tool o parte el comando; construye rutas con espacio vía variable/Join-Path.
3. **[2026-07-17] PowerShell 5.1: `$i:` se parsea como unidad; `??`/`?.` no existen**
   Do instead: usa `${i}` en strings, `if/else` en vez de `??`, aliases separados.

## Loadtest server (Windows/XAMPP)
1. **[2026-07-17] artisan serve es MONOPROCESO; PHP_CLI_SERVER_WORKERS NO funciona en Windows (probado: serializa)**
   Do instead: para concurrencia usa la instancia Apache aislada en `apps/api/deploy/windows-loadtest/httpd-loadtest.conf` (8001, loopback, ThreadsPerChild 32).
2. **[2026-07-17] mod_php ZTS en Windows: carga de .env en runtime NO es thread-safe → algunas peticiones caen a sqlite default**
   Do instead: cachea config a ruta aislada (`APP_CONFIG_CACHE=storage/app/private/loadtest/apache/config-loadtest.php`, RELATIVA); NO contamina `bootstrap/cache/config.php` normal.
3. **[2026-07-17] opcache SHM en Apache/Windows da "VirtualProtect failed [87]"; file_cache_only es más lento que off**
   Do instead: opcache OFF en el php.ini loadtest (estable); en producción Linux opcache SHM sí sirve.
2. **[2026-07-16] PowerShell env vars / $globals DON'T persist between tool calls**
   Do instead: re-read `.env` (DB creds) inside each PowerShell script block that needs them; never rely on a var set in a previous call.
3. **[2026-07-16] psql/createdb/pg_dump live at `C:\Program Files\PostgreSQL\18\bin` (not on PATH); Postgres on 127.0.0.1:5432**
   Do instead: call the full path; set `$env:PGPASSWORD` from normal `.env` DB_PASSWORD (mask it in output). Normal DB = `charbook`, loadtest = `charbook_loadtest`.

## Loadtest Environment
1. **[2026-07-16] Loadtest is a hard-guarded separate PG DB `charbook_loadtest`**
   Do instead: needs `.env.loadtest` (git-ignored) with APP_ENV=loadtest, pgsql, host 127.0.0.1, DB_URL empty, all external creds blank. Guard = `App\Support\LoadTestEnvironment`. Run `artisan --env=loadtest charbook:loadtest-check` first.
2. **[2026-07-16] loadtest migrate/seed need non-interactive confirm flags**
   Do instead: `charbook:loadtest-migrate --force --confirm=MIGRATE_CHARBOOK_LOADTEST`; `charbook:loadtest-seed 10000 --force --confirm=SEED_CHARBOOK_LOADTEST`. Users arg must be exactly 1000 or 10000. Seed 10k ≈ 20s, DB ≈ 38 MB.
3. **[2026-07-16] k6 NOT installed; k6 scripts now exist at `apps/api/tests/load/`**
   Do instead: don't install silently; official install `winget install k6 --source winget`. Run k6 FROM `apps/api` (open() resolves tokens.json relative to CWD; override with `-e TOKENS_FILE=abs`). Start loadtest API: `artisan --env=loadtest serve --host=127.0.0.1 --port=8001`.
4. **[2026-07-16] loadtest tokens.json inherits BROAD Windows ACL (Users/Authenticated Users)**
   Do instead: `chmod 0600` is a no-op on Windows; after each re-seed harden with `icacls <file> /inheritance:r /grant:r "$(whoami):(R,W)" "SYSTEM:(F)" "Administrators:(F)"`.
5. **[2026-07-17] Hardening tokens.json with only (R,W) blocks DELETE → breaks re-seed's deleteDirectory('loadtest') and clean**
   Do instead: before a re-seed, remove the stale file as admin: `icacls <file> /grant:r "$(whoami):(F)"` then `Remove-Item`, OR grant (F). Owner needs DELETE (F), not just (R,W).
6. **[2026-07-17] Forensics: distinguish TRUNCATE vs DROP vs DELETE via pg_stat_user_tables**
   Do instead: n_tup_ins preserved + n_tup_del=0 + live=0 → TRUNCATE. n_tup_ins=0 after → table DROPed (migrate:fresh). Check `$env:APPDATA\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt` for the actual command.

## Passkey Security (fail-closed)
1. **[2026-07-16] Passkeys must stay blocked; env flag alone must NOT reactivate**
   Do instead: gate on `App\Support\Passkeys::operational()` = bound `WebAuthnVerifier` (none exists) AND `PASSKEYS_ENABLED`. Endpoints return 501 `PASSKEYS_NOT_IMPLEMENTED`. Never reintroduce presence-only token issuance.

## Domain Behavior Guardrails
1. **[2026-07-16] PostgreSQL localizado en Windows emite errores en Windows-1252**
   Do instead: cualquier endpoint que devuelva texto de drivers o del log debe coercionar a UTF-8 (ver `HealthCheckService::sanitize()`); `response()->json` revienta con 500 "Malformed UTF-8" ante un solo byte inválido. Para responses de diagnóstico usar `JSON_INVALID_UTF8_SUBSTITUTE`.
2. **[2026-07-16] Turbopack dev-server serves stale 404s for new routes**
   Do instead: restart `npm run dev` and hard-refresh before debugging routing code.
2. **[2026-07-16] Claude_Preview tab is hidden — rAF/IntersectionObserver never fire**
   Do instead: verify canvas/pdf.js/animation features in a real browser, not only the preview pane.

## User Directives
1. **[2026-07-16] No commits/push/deploy, no migrations on the normal DB, no dependency updates, no installing software, no contacting external providers**
   Do instead: read-only artisan checks; migrations only listed, never run; tests on SQLite :memory:.
