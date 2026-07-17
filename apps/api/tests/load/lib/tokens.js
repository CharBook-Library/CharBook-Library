// Carga de tokens ficticios generados por el seeder de loadtest.
//
// SEGURIDAD:
//  - Los tokens se leen EXCLUSIVAMENTE de storage/app/private/loadtest/tokens.json,
//    el archivo 0600 que produce `charbook:loadtest-seed`.
//  - Los tokens NUNCA se imprimen, ni se incluyen en métricas, checks, errores
//    ni en el JSON de resultados. Solo viajan en la cabecera Authorization.
//  - El archivo se lee una sola vez en init (fuera del bucle de VUs).

import { SharedArray } from 'k6/data';

// k6 resuelve open() de forma RELATIVA A ESTE ARCHIVO (tests/load/lib/), no al
// directorio de trabajo. Subimos 3 niveles (lib → load → tests → apps/api) hasta
// storage/. Si tu k6 lo resuelve distinto, pásalo con:
//   -e TOKENS_FILE=C:/ruta/absoluta/tokens.json
const TOKENS_PATH =
  __ENV.TOKENS_FILE || '../../../storage/app/private/loadtest/tokens.json';

// SharedArray mantiene los datos en memoria una sola vez para todos los VUs.
export const tokens = new SharedArray('loadtest-tokens', function () {
  let raw;
  try {
    raw = open(TOKENS_PATH);
  } catch (e) {
    throw new Error(
      `No se pudo leer ${TOKENS_PATH}. Ejecuta primero ` +
        `"artisan --env=loadtest charbook:loadtest-seed 10000". Detalle: ${e}`
    );
  }

  const parsed = JSON.parse(raw);
  if (parsed.environment !== 'loadtest' || parsed.database !== 'charbook_loadtest') {
    throw new Error('tokens.json no corresponde al entorno loadtest esperado.');
  }
  const list = Array.isArray(parsed.tokens) ? parsed.tokens : [];
  if (list.length === 0) {
    throw new Error('tokens.json no contiene tokens de loadtest.');
  }

  // Solo exponemos el token (para Authorization); descartamos el resto.
  // El email se mantiene únicamente para depurar sin imprimirlo.
  return list.map((t) => ({ token: t.token }));
});

// Devuelve un token para el VU actual, repartido de forma estable.
export function tokenForVU(vuId) {
  return tokens[(vuId - 1) % tokens.length].token;
}
