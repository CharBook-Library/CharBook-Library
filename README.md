# CharBook Library

Monorepo con:

- **`apps/api`** — API en Laravel 12 (PHP 8.2+, PostgreSQL, Sanctum)
- **`apps/web`** — Frontend en Next.js 16 (App Router, React 19, Tailwind)

> Este repositorio **no incluye claves ni contraseñas**. Cada persona debe crear sus
> propios archivos `.env` a partir de las plantillas `.env.example` y poner sus claves.

---

## Requisitos

- PHP 8.2+ con extensiones `pdo_pgsql`, `zip`, `mbstring`, `fileinfo`
- Composer 2
- Node.js 20+ y npm
- PostgreSQL 14+
- (Opcional) Meilisearch, Stripe CLI, cuenta de Cloudflare R2, proyecto de Google Cloud

## 1. API (Laravel)

```bash
cd apps/api
composer install
cp .env.example .env
php artisan key:generate
```

Crea la base de datos en PostgreSQL (por defecto `charbook`) y pon tu contraseña en
`DB_PASSWORD` dentro de `apps/api/.env`. Luego:

```bash
php artisan migrate --seed
php artisan storage:link
php artisan serve
```

La API queda en <http://localhost:8000>.

Si usas colas para importaciones/correos, en otra terminal:

```bash
php artisan queue:work
```

## 2. Web (Next.js)

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

La web queda en <http://localhost:3000>.

## 3. Tus claves (`apps/api/.env`)

Todas son opcionales para arrancar; cada una activa una función:

| Variable(s) | Para qué sirve | Dónde se obtiene |
|---|---|---|
| `DB_*` | Base de datos PostgreSQL | Tu instalación local de PostgreSQL |
| `R2_*` | Subir libros y portadas | Cloudflare → R2 → buckets + API token (`php artisan r2:test` para probar) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Iniciar sesión con Google | Google Cloud Console → Credenciales → OAuth. Redirect URI: `http://localhost:8000/auth/google/callback` |
| `GOOGLE_BOOKS_API_KEY` | Metadatos de libros | Google Cloud Console → API key con Books API |
| `MAIL_*` | Envío de correos (verificación, etc.) | Gmail con "contraseña de aplicación", Outlook u otro SMTP. Con `MAIL_MAILER=log` se escriben en `storage/logs` |
| `STRIPE_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Pagos / monedas | Stripe Dashboard (modo prueba). Webhook local: `stripe listen --forward-to localhost:8000/api/webhooks/stripe` |
| `SCOUT_DRIVER`, `MEILISEARCH_*` | Búsqueda | `collection` funciona sin instalar nada; usa `meilisearch` si tienes Meilisearch en el puerto 7700 |
| `SUPER_ADMIN_EMAIL` | Cuenta con rol super admin | Tu correo |

`apps/api/.env.loadtest.example` es la plantilla para el entorno aislado de pruebas de carga.

## Verificación

```bash
cd apps/api && php artisan test
cd apps/web && npx tsc --noEmit && npm test
```

## App móvil

`run-mobile.ps1` levanta la API para probar desde un teléfono con Expo Go. Espera que la
app de Expo (`CharBookReact-main`, repositorio aparte) esté en una carpeta hermana de este proyecto.

Más contexto técnico en [`HANDOFF.md`](./HANDOFF.md) y [`AGENTS.md`](./AGENTS.md).
