#!/usr/bin/env bash
# build-release.sh — arma el paquete liberable de la API Laravel.
#
# Uso:       bash scripts/release/build-release.sh v1.0.0
# Variables: API_DIR  carpeta donde vive Laravel (por defecto apps/api)
#
# Antes de correrlo hay que tener vendor/ instalado solo con producción:
#   composer install --no-dev --optimize-autoloader
#
# Resultado: dist/charbook-api-<versión>.tar.gz y su .sha256
set -euo pipefail

VERSION="${1:?Falta la versión. Ejemplo: build-release.sh v1.0.0}"
API_DIR="${API_DIR:-apps/api}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/$API_DIR"
NAME="charbook-api-$VERSION"
OUT="$ROOT/dist"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

[ -f "$SRC/artisan" ] || { echo "✘ No encontré artisan en $SRC (revisa API_DIR)"; exit 1; }
[ -f "$SRC/vendor/autoload.php" ] || {
  echo "✘ Falta vendor/. Corre primero: composer install --no-dev --optimize-autoloader"
  exit 1
}

echo "→ Copiando archivos a $NAME"
mkdir -p "$STAGE/$NAME" "$OUT"

# Lista de lo PERMITIDO: solo se copia lo que Laravel necesita para correr.
# Todo lo demás (.git, .github, .env, tests, notas, carpetas de herramientas...)
# se queda fuera sin tener que acordarse de excluirlo. Si tu app usa otra
# carpeta en tiempo de ejecución (por ejemplo "lang"), agrégala aquí.
INCLUIR=(
  app bootstrap config database lang public resources routes storage vendor
  artisan composer.json composer.lock .env.example .env.preproduccion.example
)
for item in "${INCLUIR[@]}"; do
  if [ -e "$SRC/$item" ]; then
    cp -a "$SRC/$item" "$STAGE/$NAME/"
  else
    echo "  (no existe $item, se omite)"
  fi
done

# Restos de desarrollo que pueden estar dentro de las carpetas permitidas
rm -f "$STAGE/$NAME/public/hot" "$STAGE/$NAME/public/storage"
find "$STAGE/$NAME/database" -type f \( -name '*.sqlite' -o -name '*.sqlite-*' \) -delete 2>/dev/null || true

echo "→ Limpiando logs, cachés y archivos temporales"
find "$STAGE/$NAME/storage" -type f ! -name '.gitignore' -delete 2>/dev/null || true
find "$STAGE/$NAME/bootstrap/cache" -type f ! -name '.gitignore' -delete 2>/dev/null || true
mkdir -p \
  "$STAGE/$NAME/storage/app/public" \
  "$STAGE/$NAME/storage/framework/cache/data" \
  "$STAGE/$NAME/storage/framework/sessions" \
  "$STAGE/$NAME/storage/framework/views" \
  "$STAGE/$NAME/storage/logs" \
  "$STAGE/$NAME/bootstrap/cache"

echo "→ Escribiendo RELEASE.json"
cat > "$STAGE/$NAME/RELEASE.json" <<EOF
{
  "proyecto": "CharBook Library (API Laravel)",
  "version": "$VERSION",
  "commit": "$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo desconocido)",
  "construido": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "autor": "Sánchez Pérez Emiliano"
}
EOF

echo "→ Comprimiendo"
tar -czf "$OUT/$NAME.tar.gz" -C "$STAGE" "$NAME"
(cd "$OUT" && sha256sum "$NAME.tar.gz" > "$NAME.tar.gz.sha256")

echo "→ Verificando criterios de liberación"
bash "$ROOT/scripts/release/verify-artifact.sh" "$OUT/$NAME.tar.gz"

echo
echo "Listo: $OUT/$NAME.tar.gz"
