// SMOKE — humo mínimo para confirmar que la API loadtest responde y que el
// recorrido básico (público + autenticado) funciona. Máximo 5 VUs, corto.
//
// Ejecutar desde apps/api (para que ./storage/... resuelva):
//   k6 run tests/load/smoke.js
//
// SEGURIDAD: solo apunta a http://127.0.0.1:8001 (ver lib/config.js). Los
// tokens se leen de storage/app/private/loadtest/tokens.json y NUNCA se imprimen.

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
    smoke: {
      executor: 'constant-vus',
      vus: 5, // máximo 5 usuarios virtuales
      duration: '30s', // duración corta
    },
  },
  // P50/P90/P95/P99 en el resumen (por defecto k6 no incluye p99).
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    // Menos del 1 % de errores INESPERADOS (5xx/red); 429 no cuenta.
    unexpected_errors: ['rate<0.01'],
    // Objetivo inicial P95 < 1 s (no se oculta si no se cumple: 'abortOnFail' off).
    http_req_duration: ['p(95)<1000'],
    // Checks > 99 %.
    checks: ['rate>0.99'],
  },
};

export default function () {
  const token = tokenForVU(__VU);

  group('público: listar libros', function () {
    getAndTrack(ENDPOINTS.books, { headers: JSON_HEADERS }, {
      name: 'GET /books',
      latency: publicReadLatency,
    });
    think();
  });

  group('público: detalle de libro', function () {
    getAndTrack(ENDPOINTS.bookDetail(randomBookSlug()), { headers: JSON_HEADERS }, {
      name: 'GET /books/{slug}',
      latency: publicReadLatency,
    });
    think();
  });

  group('público: categorías', function () {
    getAndTrack(ENDPOINTS.categories, { headers: JSON_HEADERS }, {
      name: 'GET /categories',
      latency: publicReadLatency,
    });
    think();
  });

  group('público: búsqueda', function () {
    getAndTrack(ENDPOINTS.searchBooks(randomSearchTerm()), { headers: JSON_HEADERS }, {
      name: 'GET /books?search',
      latency: publicReadLatency,
    });
    think();
  });

  group('autenticado: GET /api/user', function () {
    // Endpoint bajo la lupa: registrar su latencia por separado.
    getAndTrack(ENDPOINTS.me, { headers: authHeaders(token) }, {
      name: 'GET /user',
      latency: authUserLatency,
    });
    think();
  });

  group('autenticado: biblioteca/estante', function () {
    getAndTrack(ENDPOINTS.myShelf, { headers: authHeaders(token) }, {
      name: 'GET /me/shelf',
      latency: authReadLatency,
    });
    think();
  });

  group('autenticado: operación segura (favoritos, solo lectura)', function () {
    getAndTrack(ENDPOINTS.myFavorites, { headers: authHeaders(token) }, {
      name: 'GET /me/favorites',
      latency: authReadLatency,
    });
    think();
  });
}
