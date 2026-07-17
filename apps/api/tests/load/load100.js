// LOAD100 — prueba de carga de 100 usuarios virtuales contra la API loadtest.
//
// SOLO LECTURAS: todas las peticiones son GET (vía getAndTrack → http.get).
// No registra, modifica ni elimina datos; no genera comentarios, favoritos ni
// progreso; no llama servicios externos.
//
// Ejecutar desde apps/api (SOLO con autorización explícita):
//   & "C:\Program Files\k6\k6.exe" run tests/load/load100.js
//
// SEGURIDAD: el host está FIJADO a http://127.0.0.1:8001 (lib/config.js rechaza
// cualquier override por -e BASE_URL). Tokens exclusivamente desde
// storage/app/private/loadtest/tokens.json; nunca se imprimen.

import { group } from 'k6';
import http from 'k6/http';
import {
  BASE_URL,
  ENDPOINTS,
  JSON_HEADERS,
  authHeaders,
  randomBookSlug,
  randomSearchTerm,
} from './lib/config.js';
import { tokenForVU } from './lib/tokens.js';
import {
  getAndTrack,
  think,
  authUserLatency,
  publicReadLatency,
  authReadLatency,
  searchLatency,
} from './lib/metrics.js';

export const options = {
  scenarios: {
    load100: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 25 },  // subida suave
        { duration: '1m', target: 50 },  // media carga
        { duration: '1m', target: 100 }, // subida al máximo
        { duration: '3m', target: 100 }, // meseta sostenida a 100 VUs (MÁXIMO)
        { duration: '30s', target: 0 },  // bajada
      ],
      gracefulRampDown: '15s',
    },
  },
  // P50/P90/P95/P99 en el resumen (por defecto k6 no incluye p99).
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    // Errores INESPERADOS (5xx / red) < 1 %. 429 del rate limiter NO cuenta.
    unexpected_errors: ['rate<0.01'],
    // Checks > 99 %.
    checks: ['rate>0.99'],
    // Objetivos de latencia global (P95/P99). No abortan: si no se cumplen se
    // reporta el ✗ tal cual, sin ocultarlo (abortOnFail desactivado adrede).
    http_req_duration: ['p(95)<1000', 'p(99)<3000'],
    // El endpoint bajo la lupa conserva su objetivo propio.
    latency_get_user: ['p(95)<1000', 'p(99)<3000'],
  },
};

// Sanity check previo: si la API loadtest no responde, se aborta ANTES de
// generar carga (evita 100 VUs martillando un puerto muerto).
export function setup() {
  const res = http.get(ENDPOINTS.health, { headers: JSON_HEADERS, timeout: '10s' });
  if (res.status !== 200) {
    throw new Error(
      `La API loadtest en ${BASE_URL} no responde (HTTP ${res.status}). ` +
        'Arranca el Apache loadtest antes de la prueba (deploy/windows-loadtest/README.md).'
    );
  }
}

// Mezcla de tráfico por iteración (igual filosofía que light.js):
//   ~55 % lectura pública · ~15 % búsqueda · ~30 % flujo autenticado.
export default function () {
  const roll = Math.random();

  if (roll < 0.55) {
    group('lectura pública', function () {
      const step = Math.random();
      if (step < 0.4) {
        getAndTrack(ENDPOINTS.books, { headers: JSON_HEADERS }, {
          name: 'GET /books',
          latency: publicReadLatency,
        });
      } else if (step < 0.75) {
        getAndTrack(ENDPOINTS.bookDetail(randomBookSlug()), { headers: JSON_HEADERS }, {
          name: 'GET /books/{slug}',
          latency: publicReadLatency,
        });
      } else {
        getAndTrack(ENDPOINTS.categories, { headers: JSON_HEADERS }, {
          name: 'GET /categories',
          latency: publicReadLatency,
        });
      }
      think();
    });
  } else if (roll < 0.7) {
    group('búsqueda', function () {
      // Métrica propia: permite ver si la búsqueda LIKE degrada distinto
      // del resto de lecturas públicas bajo 100 VUs.
      getAndTrack(ENDPOINTS.searchBooks(randomSearchTerm()), { headers: JSON_HEADERS }, {
        name: 'GET /books?search',
        latency: searchLatency,
      });
      think();
    });
  } else {
    group('flujo autenticado', function () {
      const token = tokenForVU(__VU);
      // GET /api/user: el endpoint bajo investigación, latencia separada.
      getAndTrack(ENDPOINTS.me, { headers: authHeaders(token) }, {
        name: 'GET /user',
        latency: authUserLatency,
      });
      think();

      const step = Math.random();
      const url = step < 0.5 ? ENDPOINTS.myShelf : ENDPOINTS.myFavorites;
      getAndTrack(url, { headers: authHeaders(token) }, {
        name: step < 0.5 ? 'GET /me/shelf' : 'GET /me/favorites',
        latency: authReadLatency,
      });
      think();
    });
  }
}
