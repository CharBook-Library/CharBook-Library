# 3. Validación del artefacto

**Actividad 12 · Gestión del Proceso de Desarrollo de Software**
Alumno: Sánchez Pérez Emiliano · IDGS · UTVT

## 3.1 Datos de la ejecución validada

| Dato | Valor |
|---|---|
| Versión | _(por ejemplo `v1.0.0-rc.1`)_ |
| Fecha de validación | _(completar)_ |
| Commit | _(primeros 7 caracteres)_ |
| Enlace a la ejecución en Actions | _(pegar URL)_ |
| Nombre del artefacto | `charbook-api-<versión>` |

## 3.2 Procedimiento

Los comandos se corren en Git Bash o WSL, dentro de una carpeta vacía de pruebas.

**1. Descargar el artefacto.** En GitHub: **Actions → ejecución → Artifacts → `charbook-api-<versión>`**. GitHub lo entrega dentro de un `.zip`, así que primero se descomprime:

```bash
unzip charbook-api-v1.0.0-rc.1.zip
```

**2. Comprobar que no se dañó en la descarga:**

```bash
sha256sum -c charbook-api-v1.0.0-rc.1.tar.gz.sha256
```

**3. Ver qué archivos contiene:**

```bash
tar -tzf charbook-api-v1.0.0-rc.1.tar.gz | grep -v '/vendor/' | head -60
```

**4. Buscar archivos sensibles.** Solo deben aparecer los `.example`:

```bash
tar -tzf charbook-api-v1.0.0-rc.1.tar.gz | grep -v '/vendor/' | grep -E '\.env|\.pem|\.key|auth\.json'
```

**5. Correr la verificación completa:**

```bash
bash scripts/release/verify-artifact.sh charbook-api-v1.0.0-rc.1.tar.gz
```

**6. Instalarlo en el ambiente de pruebas.** El job `validate-preprod` ya lo hace en cada ejecución (su resumen aparece en la página del run). Para repetirlo a mano en el servidor:

```bash
bash deploy-preprod.sh charbook-api-v1.0.0-rc.1.tar.gz /var/www/charbook-preprod
curl -i http://preprod.charbook.example/up
```

## 3.3 Registro de resultados

Marcar con ✔ o ✘ y pegar la captura correspondiente en `docs/liberacion/evidencias/`.

| # | Verificación | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|
| 1 | Descarga del artefacto desde Actions | Se descarga el `.zip` con el `.tar.gz` y el `.sha256` | | `evidencias/01-descarga.png` |
| 2 | Checksum SHA-256 | `OK` | | `evidencias/02-checksum.png` |
| 3 | Contiene los archivos necesarios | `artisan`, `vendor/`, `public/index.php`, migraciones, `RELEASE.json` | | `evidencias/03-contenido.png` |
| 4 | No incluye `.env` ni credenciales | Solo `.env.example` y `.env.preproduccion.example` | | `evidencias/04-sin-secretos.png` |
| 5 | Sin dependencias de desarrollo | No hay `vendor/phpunit` ni `tests/` | | `evidencias/05-verify.png` |
| 6 | Verificación completa | `RESULTADO: APROBADO` | | `evidencias/05-verify.png` |
| 7 | Instalación en el ambiente de pruebas | Migraciones aplicadas y cachés generadas sin errores | | `evidencias/06-instalacion.png` |
| 8 | Prueba de humo | `GET /up` responde `HTTP/1.1 200` | | `evidencias/07-humo.png` |
| 9 | Permisos de `storage/` y `bootstrap/cache/` | Escribibles por el usuario y por `www-data` | | `evidencias/08-permisos.png` |

## 3.4 Observaciones

_(Anotar aquí cualquier problema que apareciera y cómo se resolvió.)_
