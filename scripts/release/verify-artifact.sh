#!/usr/bin/env bash
# verify-artifact.sh — revisa que el paquete tenga lo necesario y nada sensible.
#
# Uso: bash scripts/release/verify-artifact.sh dist/charbook-api-v1.0.0.tar.gz
#
# Sale con código 0 si todo está bien y con 1 si algún criterio falla.
set -uo pipefail

ART="${1:?Uso: verify-artifact.sh <paquete.tar.gz>}"
[ -f "$ART" ] || { echo "✘ No existe $ART"; exit 1; }

ERRORES=0
ok()   { echo "  ✔ $1"; }
fail() { echo "  ✘ $1"; ERRORES=$((ERRORES + 1)); }

LIST="$(mktemp)"
TMP="$(mktemp -d)"
trap 'rm -rf "$LIST" "$TMP"' EXIT

tar -tzf "$ART" > "$LIST" || { echo "✘ No se pudo leer el paquete"; exit 1; }
TOP="$(head -1 "$LIST" | cut -d/ -f1)"

echo "Paquete:  $(basename "$ART")"
echo "Tamaño:   $(du -h "$ART" | cut -f1)"
echo "Archivos: $(grep -vc '/$' "$LIST")"
echo

echo "Contenido de la raíz del paquete:"
awk -F/ 'NF >= 2 && $2 != "" { print "  " $2 }' "$LIST" | sort -u
echo

echo "1) Integridad"
if [ -f "$ART.sha256" ]; then
  if (cd "$(dirname "$ART")" && sha256sum -c "$(basename "$ART").sha256" >/dev/null 2>&1); then
    ok "El SHA-256 coincide"
  else
    fail "El SHA-256 NO coincide"
  fi
else
  echo "  - No hay archivo .sha256 junto al paquete, se omite"
fi

echo "2) Archivos necesarios para ejecutar la aplicación"
for f in artisan composer.json composer.lock bootstrap/app.php public/index.php \
         vendor/autoload.php .env.example RELEASE.json; do
  if grep -Fxq "$TOP/$f" "$LIST"; then ok "$f"; else fail "Falta $f"; fi
done
for d in app config database/migrations routes vendor bootstrap/cache storage/framework storage/logs; do
  if grep -Fxq "$TOP/$d/" "$LIST"; then ok "$d/"; else fail "Falta la carpeta $d/"; fi
done

echo "3) Dependencias de producción (sin herramientas de desarrollo)"
for dev in phpunit/phpunit mockery/mockery; do
  if grep -Fxq "$TOP/vendor/$dev/" "$LIST"; then
    fail "vendor/$dev está incluido (el paquete trae dependencias de desarrollo)"
  else
    ok "vendor/$dev no está incluido"
  fi
done
if grep -Fxq "$TOP/tests/" "$LIST"; then fail "Se incluyó la carpeta tests/"; else ok "tests/ no está incluida"; fi

echo "4) Archivos sensibles (se ignora vendor/)"
grep -vE "^$TOP/vendor/" "$LIST" > "$LIST.nv"

ENVS="$(grep -E '(^|/)\.env(\.[^/]*)?$' "$LIST.nv" | grep -vE '\.example$' || true)"
if [ -n "$ENVS" ]; then fail "Hay archivos .env reales: $ENVS"; else ok "No hay .env (solo los de ejemplo)"; fi

KEYS="$(grep -E '(^|/)(auth\.json|id_rsa[^/]*|[^/]*\.pem|[^/]*\.key|[^/]*\.p12|[^/]*\.sqlite|(client_secret|credentials|service-account)[^/]*\.json)$' "$LIST.nv" || true)"
if [ -n "$KEYS" ]; then fail "Hay llaves o credenciales: $KEYS"; else ok "No hay llaves ni credenciales"; fi

LOGS="$(grep -E '^[^/]+/storage/.*\.log$' "$LIST.nv" || true)"
if [ -n "$LOGS" ]; then fail "Hay logs dentro del paquete: $LOGS"; else ok "No hay logs"; fi

if grep -qE '(^|/)(\.git|node_modules)/' "$LIST.nv"; then
  fail "Se coló .git/ o node_modules/"
else
  ok "No hay .git/ ni node_modules/"
fi

echo "5) Secretos dentro del contenido (se ignora vendor/ y los *.example)"
tar -xzf "$ART" -C "$TMP" --exclude="$TOP/vendor"
HITS="$(grep -rIlE 'APP_KEY=base64:[A-Za-z0-9+/=]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}' \
        --exclude='*.example' "$TMP" 2>/dev/null || true)"
if [ -n "$HITS" ]; then fail "Posibles secretos en: $HITS"; else ok "No se encontraron secretos"; fi

echo
if [ "$ERRORES" -eq 0 ]; then
  echo "RESULTADO: APROBADO"
  exit 0
else
  echo "RESULTADO: RECHAZADO ($ERRORES problema(s))"
  exit 1
fi
