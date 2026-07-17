// Métricas y helpers de petición compartidos.
//
// Distingue errores INESPERADOS (5xx, fallos de red, 0) de respuestas
// ESPERADAS (2xx e incluso 429 por rate limit, que es comportamiento correcto
// bajo carga). Solo los inesperados cuentan para el umbral http_req_failed.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { THINK_TIME } from './config.js';

// Contadores por familia de código HTTP (para el resumen final).
export const httpStatus = {
  s2xx: new Counter('status_2xx'),
  s3xx: new Counter('status_3xx'),
  s4xx: new Counter('status_4xx'),
  s429: new Counter('status_429_rate_limited'),
  s5xx: new Counter('status_5xx'),
  other: new Counter('status_other'),
};

// Errores realmente inesperados (5xx / red). Alimenta el threshold principal.
export const unexpectedErrors = new Rate('unexpected_errors');

// Latencia separada por tipo de endpoint, para investigar GET /api/user.
export const authUserLatency = new Trend('latency_get_user', true);
export const publicReadLatency = new Trend('latency_public_read', true);
export const authReadLatency = new Trend('latency_auth_read', true);
// Búsqueda con métrica propia (Scout 'collection' = LIKE en BD; sin servicio externo).
export const searchLatency = new Trend('latency_search', true);

// Pausa "think time" aleatoria entre iteraciones.
export function think() {
  sleep(THINK_TIME.min + Math.random() * (THINK_TIME.max - THINK_TIME.min));
}

// Clasifica un status en su contador y devuelve si fue inesperado (5xx/red).
function classify(status) {
  if (status >= 200 && status < 300) httpStatus.s2xx.add(1);
  else if (status >= 300 && status < 400) httpStatus.s3xx.add(1);
  else if (status === 429) httpStatus.s429.add(1);
  else if (status >= 400 && status < 500) httpStatus.s4xx.add(1);
  else if (status >= 500) httpStatus.s5xx.add(1);
  else httpStatus.other.add(1); // status 0 = timeout / conexión fallida

  const unexpected = status === 0 || status >= 500;
  unexpectedErrors.add(unexpected);
  return unexpected;
}

// Ejecuta un GET, clasifica el resultado y aplica checks.
// `expectOk` marca si esperamos 2xx (para el check de éxito). 429 no se
// considera fallo del sistema: es el rate limiter haciendo su trabajo.
export function getAndTrack(url, params, opts = {}) {
  const { expectOk = true, latency = null, name = url } = opts;
  const res = http.get(url, params);
  const unexpected = classify(res.status);
  if (latency) latency.add(res.timings.duration);

  check(res, {
    [`${name}: sin error de servidor (no 5xx/red)`]: () => !unexpected,
    [`${name}: código esperado`]: (r) =>
      !expectOk || (r.status >= 200 && r.status < 300) || r.status === 429,
  });

  return res;
}
