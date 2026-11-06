#!/usr/bin/env bash
# deploy-preprod.sh — instala un artefacto en el ambiente de preproducción.
#
# Uso: bash deploy-preprod.sh <paquete.tar.gz> [carpeta_base]
#      carpeta_base por defecto: /var/www/charbook-preprod
#
# Estructura que deja (cada versión queda aparte y "current" apunta a la activa):
#   <base>/releases/<versión>/   código de esta versión
#   <base>/shared/.env           variables de ESTE ambiente (no viaja en el paquete)
#   <base>/shared/storage/       archivos y logs que sobreviven entre versiones
#   <base>/current -> releases/<versión>
#
# Requisito: crear antes <base>/shared/.env con los valores de preproducción
# (hay una plantilla en apps/api/.env.preproduccion.example).
set -Eeuo pipefail
trap 'echo "✘ El despliegue se detuvo en la línea $LINENO"' ERR

# Muestra cada comando de artisan antes de correrlo, para saber cuál falló
artisan() { echo "  \$ php artisan $*"; php artisan "$@"; }

ARTIFACT="$(realpath "${1:?Uso: deploy-preprod.sh <paquete.tar.gz> [carpeta_base]}")"
BASE="${2:-/var/www/charbook-preprod}"
CONSERVAR=3

NAME="$(basename "$ARTIFACT" .tar.gz)"
VERSION="${NAME#charbook-api-}"
RELEASE="$BASE/releases/$VERSION"
SHARED="$BASE/shared"

echo "→ Revisando requisitos del servidor"
php -r 'exit(version_compare(PHP_VERSION, "8.2.0", ">=") ? 0 : 1);' \
  || { echo "✘ Se necesita PHP 8.2 o superior (se recomienda 8.3)"; exit 1; }
MODULOS="$(php -m)"
for ext in mbstring openssl pdo_pgsql tokenizer xml ctype fileinfo bcmath curl; do
  grep -qix "$ext" <<< "$MODULOS" || { echo "✘ Falta la extensión PHP: $ext"; exit 1; }
done
echo "  PHP $(php -r 'echo PHP_VERSION;') con las extensiones necesarias"

[ -f "$SHARED/.env" ] || { echo "✘ Falta $SHARED/.env (el .env de preproducción)"; exit 1; }

echo "→ Desempacando $VERSION en $RELEASE"
mkdir -p "$RELEASE" \
  "$SHARED/storage/app/public" \
  "$SHARED/storage/framework/cache/data" \
  "$SHARED/storage/framework/sessions" \
  "$SHARED/storage/framework/views" \
  "$SHARED/storage/logs"
tar -xzf "$ARTIFACT" -C "$RELEASE" --strip-components=1

echo "→ Enlazando .env y storage compartidos"
ln -sfn "$SHARED/.env" "$RELEASE/.env"
rm -rf "$RELEASE/storage"
ln -sfn "$SHARED/storage" "$RELEASE/storage"

echo "→ Permisos de storage/ y bootstrap/cache/"
chmod -R ug+rwX "$SHARED/storage" "$RELEASE/bootstrap/cache"
if getent group www-data >/dev/null 2>&1; then
  chgrp -R www-data "$SHARED/storage" "$RELEASE/bootstrap/cache" 2>/dev/null || true
fi

cd "$RELEASE"

echo "→ Preparando la aplicación"
artisan package:discover --ansi
artisan migrate --force
artisan config:cache
artisan event:cache
artisan view:cache
# Si alguna ruta usa closures, Laravel no puede guardarlas en caché. Es solo una
# optimización, así que se avisa y se sigue en lugar de tumbar el despliegue.
artisan route:cache || echo "  ⚠ route:cache no se pudo (hay rutas con closures); se sigue sin caché de rutas"
artisan storage:link --force || true

echo "→ Activando la versión"
ln -sfn "$RELEASE" "$BASE/current"

echo "→ Recargando PHP-FPM (si existe)"
sudo -n systemctl reload php8.3-fpm 2>/dev/null || echo "  (sin PHP-FPM o sin permisos, se omite)"

echo "→ Borrando versiones viejas (se conservan las últimas $CONSERVAR)"
ls -1dt "$BASE"/releases/*/ 2>/dev/null | tail -n +"$((CONSERVAR + 1))" | xargs -r rm -rf

echo
echo "Versión $VERSION instalada en $BASE/current"
