# 2. Ambiente de preproducción

**Actividad 12 · Gestión del Proceso de Desarrollo de Software**
Alumno: Sánchez Pérez Emiliano · IDGS · UTVT

Aquí van los parámetros del ambiente donde se entrega el artefacto. Lo trabajamos en dos niveles:

- **Ambiente automático (siempre):** el job `validate-preprod` del workflow levanta una máquina limpia de GitHub Actions con PostgreSQL, instala el paquete con `deploy-preprod.sh` y comprueba que responde. Sirve como ambiente de pruebas desechable.
- **Servidor propio (opcional):** una máquina virtual con Ubuntu donde se hace la misma instalación de forma permanente. Si se configura la variable `PREPROD_HOST` en GitHub, el job `deploy-preprod` entrega ahí cada vez que se publica un tag.

## 2.1 Datos del servidor

| Parámetro | Valor |
|---|---|
| Sistema operativo | Ubuntu Server 24.04 LTS |
| Proveedor / máquina | _(completar: VM local, Oracle Cloud Free Tier, etc.)_ |
| Dirección o dominio | _(completar, por ejemplo `preprod.charbook.example`)_ |
| Usuario de despliegue | _(completar)_ |
| Carpeta base | `/var/www/charbook-preprod` |

## 2.2 Software requerido

| Componente | Versión | Nota |
|---|---|---|
| PHP | 8.3 (mínimo 8.2, por Laravel 12) | Con PHP-FPM |
| Extensiones PHP | `mbstring`, `openssl`, `pdo_pgsql`, `tokenizer`, `xml`, `ctype`, `fileinfo`, `bcmath`, `curl`, `intl`, `zip`, `redis` | `deploy-preprod.sh` las revisa antes de instalar |
| Composer | 2.x | Para mantenimiento. El paquete ya trae `vendor/`, no se necesita para instalarlo |
| Servidor web | Nginx | Apunta a `current/public` |
| Base de datos | PostgreSQL 16 | Base `charbook_preprod`, separada de desarrollo |
| Redis | 7.x | Cache, colas y sesiones |
| Meilisearch | 1.x | Búsqueda del catálogo |
| Almacenamiento | Bucket de Cloudflare R2 de pruebas | Distinto al de producción |

Instalación en Ubuntu 24.04 (ya trae PHP 8.3):

```bash
sudo apt update
sudo apt install -y nginx php8.3-fpm php8.3-cli php8.3-pgsql php8.3-mbstring \
  php8.3-xml php8.3-curl php8.3-intl php8.3-bcmath php8.3-zip php-redis \
  postgresql redis-server unzip
```

Base de datos y usuario propios del ambiente:

```bash
sudo -u postgres psql -c "CREATE USER charbook_preprod WITH PASSWORD 'CAMBIAR';"
sudo -u postgres psql -c "CREATE DATABASE charbook_preprod OWNER charbook_preprod;"
```

## 2.3 Estructura de carpetas

```
/var/www/charbook-preprod/
├── releases/
│   ├── v1.0.0-rc.1/      ← cada versión instalada queda aparte
│   └── v1.0.0-rc.2/
├── shared/
│   ├── .env              ← variables de este ambiente (NO viene en el paquete)
│   └── storage/          ← logs y archivos que se conservan entre versiones
└── current -> releases/v1.0.0-rc.2
```

Con este esquema, regresar a una versión anterior es cambiar el enlace `current`:

```bash
ln -sfn /var/www/charbook-preprod/releases/v1.0.0-rc.1 /var/www/charbook-preprod/current
```

## 2.4 Variables de entorno independientes

Cada ambiente tiene su propio `.env`. La plantilla está en [`apps/api/.env.preproduccion.example`](../../apps/api/.env.preproduccion.example) y se copia a `shared/.env` en el servidor.

| Variable | Valor en preproducción | Por qué |
|---|---|---|
| `APP_ENV` | `staging` | Distingue el ambiente |
| `APP_DEBUG` | `false` | No mostrar errores detallados |
| `APP_KEY` | Una propia (`php artisan key:generate --show`) | Nunca se reutiliza la de otro ambiente |
| `APP_URL` | URL de preproducción | |
| `DB_*` | Base `charbook_preprod` y su usuario | Datos aislados |
| `CACHE_STORE`, `SESSION_DRIVER`, `QUEUE_CONNECTION` | `redis` | |
| `SCOUT_DRIVER` y `MEILISEARCH_*` | Meilisearch de preproducción | |
| `AWS_*` / `FILESYSTEM_DISK` | Bucket `charbook-preprod` | Archivos de prueba separados |
| `GOOGLE_*` | Credenciales OAuth de pruebas | |
| `MAIL_MAILER` | `log` | No se envían correos reales |

## 2.5 Servidor web (Nginx)

Archivo `/etc/nginx/sites-available/charbook-preprod`:

```nginx
server {
    listen 80;
    server_name preprod.charbook.example;
    root /var/www/charbook-preprod/current/public;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT $realpath_root;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

Se usa `$realpath_root` para que PHP-FPM no se quede con la versión anterior en caché cuando cambia el enlace `current`.

```bash
sudo ln -s /etc/nginx/sites-available/charbook-preprod /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 2.6 Permisos de `storage/` y `bootstrap/cache/`

Laravel necesita escribir en estas dos carpetas. `deploy-preprod.sh` aplica esto en cada instalación:

```bash
chmod -R ug+rwX shared/storage releases/<versión>/bootstrap/cache
chgrp -R www-data shared/storage releases/<versión>/bootstrap/cache
```

Resultado esperado: el usuario de despliegue y el grupo `www-data` pueden escribir, y los demás usuarios no.

## 2.7 Variables de GitHub para la entrega por SSH (opcional)

En el repositorio: **Settings → Environments → preproduccion**.

| Tipo | Nombre | Contenido |
|---|---|---|
| Variable | `PREPROD_HOST` | IP o dominio del servidor |
| Variable | `PREPROD_USER` | Usuario de despliegue |
| Variable | `PREPROD_PATH` | `/var/www/charbook-preprod` |
| Secret | `PREPROD_SSH_KEY` | Llave privada SSH del usuario de despliegue |

Si `PREPROD_HOST` no existe, el job de SSH simplemente se omite y el resto del pipeline funciona igual.
