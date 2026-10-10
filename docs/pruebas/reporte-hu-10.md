# Reporte de pruebas · Sprint 1 · HU-10

**Responsable:** Angel
**Fecha:** 16/09/2026
**Entregable:** Incremento validado

---

## Objetivo

Probar el catálogo, las licencias y las suscripciones para entregar un incremento sin errores en la Sprint Review.

---

## Historias probadas

| ID | Historia | Estado | Resultado |
|---|---|---|---|
| HU-01 a HU-04 | Identidad visual y catálogo | ✅ | Aprobado |
| HU-05 | Ficha descriptiva de la obra | ✅ | Aprobado |
| HU-08 | Control de licencias | ✅ | Aprobado |
| HU-10 | Pruebas del Sprint | ✅ | Este documento |

---

## Pruebas ejecutadas

### 1. Catálogo de obras (`ObraTest.php`)

| # | Prueba | Resultado |
|---|---|---|
| 1 | Listar obras | ✅ |
| 2 | Registrar obra con sinopsis válida | ✅ |
| 3 | Rechazar sinopsis > 1000 caracteres | ✅ |
| 4 | Requerir páginas si es e-book | ✅ |
| 5 | Requerir duración si es audiolibro | ✅ |

### 2. Control de licencias (`LicenciaTest.php`)

| # | Prueba | Resultado |
|---|---|---|
| 6 | Listar licencias activas | ✅ |
| 7 | Bloquear acceso sin licencia | ✅ |
| 8 | Permitir acceso con licencia vigente | ✅ |
| 9 | Bloquear acceso con licencia vencida | ✅ |
| 10 | Registrar intento no válido | ✅ |

---

## Comando para ejecutar las pruebas

```bash
php artisan test