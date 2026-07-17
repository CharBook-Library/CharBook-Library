// LIGHT — carga ligera con subida gradual. Máximo 20 VUs. Mezcla lectura
// pública (mayoría) y autenticada (minoría). SOLO lecturas: no genera
// comentarios, favoritos ni progreso, y no llama servicios externos.
//
// Ejecutar desde apps/api:
//   k6 run tests/load/light.js
//
// SEGURIDAD: solo http://127.0.0.1:8001 (ver lib/config.js). Tokens desde
// storage/app/private/loadtest/tokens.json, nunca impresos.

import { group } from 'k6';
import {
  ENDPOINTS,
  JSON_HEADERS,
  authHeaders,
  randomBookSlug,
  randomCategorySlug,
  randomSearchTerm,
} from './lib/config.js';
import { tokenForVU } from './lib/tokens.js';
import {
  getAndTrack,
  think,
  authUserLatency,
  publicReadLatency,
  authReadLatency,
} from './lib/metrics.js';

export const options = {
  scenarios: {
    light: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 }, // subida gradual
        { duration: '1m', target: 20 }, // meseta a 20 VUs (máximo)
        { duration: '30s', target: 0 }, // bajada
      ],
      gracefulRampDown: '10s',
    },
  },
  // P50/P90/P95/P99 en el resumen (por defecto k6 no incluye p99).
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    unexpected_errors: ['rate<0.01'], // <1 % de errores inesperados
    http_req_duration: ['p(95)<1000'], // objetivo inicial P95 < 1 s
    checks: ['rate>0.99'], // checks > 99 %
  },
};

// ~75 % de las iteraciones son lectura pública anónima; ~25 % autenticada.
export default function () {
  const roll = Math.random();

  if (roll < 0.75) {
    group('lectura pública', function () {
      const step = Math.random();
      if (step < 0.4) {
        getAndTrack(ENDPOINTS.books, { headers: JSON_HEADERS }, {
          name: 'GET /books',
          latency: publicReadLatency,
        });
      } else if (step < 0.7) {
        getAndTrack(ENDPOINTS.bookDetail(randomBookSlug()), { headers: JSON_HEADERS }, {
          name: 'GET /books/{slug}',
          latency: publicReadLatency,
        });
      } else if (step < 0.85) {
        getAndTrack(ENDPOINTS.categories, { headers: JSON_HEADERS }, {
          name: 'GET /categories',
          latency: publicReadLatency,
        });
      } else {
        getAndTrack(ENDPOINTS.searchBooks(randomSearchTerm()), { headers: JSON_HEADERS }, {
          name: 'GET /books?search',
          latency: publicReadLatency,
        });
      }
      think();
    });
  } else {
    group('lectura autenticada', function () {
      const token = tokenForVU(__VU);
      // GET /api/user es el endpoint bajo investigación: latencia separada.
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
