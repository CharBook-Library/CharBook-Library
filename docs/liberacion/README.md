# Liberación continua · CharBook Library (API)

**Actividad 12:** Configuración de un pipeline para la liberación de artefactos en ambientes de pruebas y preproducción
**Materia:** Gestión del Proceso de Desarrollo de Software
**Docente:** R. Vinicio Camacho
**Alumno:** Sánchez Pérez Emiliano · Ingeniería en Desarrollo y Gestión de Software (IDGS) · UTVT
**Matrícula:** _(completar)_

Cada push a `main` pasa por pruebas, genera un paquete de la API y lo instala en un ambiente de preproducción para comprobar que funciona. Al crear un tag `vX.Y.Z` el paquete además se publica como versión.

## Dónde está cada entregable

| Entregable | Dónde está |
|---|---|
| Workflow de liberación continua | [`.github/workflows/ci-cd.yml`](../../.github/workflows/ci-cd.yml) |
| Configuración de generación de artefactos | Job `build-release` del workflow y [`build-release.sh`](../../scripts/release/build-release.sh) |
| Scripts para preparar el entorno de liberación | [`deploy-preprod.sh`](../../scripts/release/deploy-preprod.sh) y [`.env.preproduccion.example`](../../apps/api/.env.preproduccion.example) |
| Evidencia de un artefacto generado | Capturas en [`evidencias/`](evidencias) y pestañas **Actions** y **Releases** del repositorio |
| Diagrama del proceso de entrega continua | [`01-diseno-proceso-liberacion.md`](01-diseno-proceso-liberacion.md#15-diagrama-del-flujo-de-integración-continua-a-preproducción) |
| Parámetros del ambiente de preproducción | [`02-ambiente-preproduccion.md`](02-ambiente-preproduccion.md) |
| Evidencia de las validaciones | [`03-validacion-artefacto.md`](03-validacion-artefacto.md) y [`verify-artifact.sh`](../../scripts/release/verify-artifact.sh) |

## Cómo liberar una versión

```bash
git tag -a v1.0.0-rc.1 -m "Primera candidata a liberar"
git push origin v1.0.0-rc.1
```

Después, en GitHub: **Actions** → la ejecución del tag → **Artifacts**.
