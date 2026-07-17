// Configuración compartida de las pruebas de carga k6.
//
// SEGURIDAD: la API objetivo está FIJADA a la instancia loadtest local. No se
// permite apuntar a otro host por variable de entorno para evitar disparar
// carga contra producción o contra la base normal por accidente.

export const BASE_URL = 'http://127.0.0.1:8001';

// Si alguien intenta redefinir el host vía -e BASE_URL=..., lo rechazamos.
const override = __ENV.BASE_URL;
if (override && override !== BASE_URL) {
  throw new Error(
    `Host no permitido: ${override}. Las pruebas de carga solo pueden apuntar a ${BASE_URL} (entorno loadtest).`
  );
}

// Endpoints reales (rutas verificadas en apps/api/routes/api.php).
// URLs ABSOLUTAS: k6 http.get() exige esquema+host, no acepta solo la ruta.
export const ENDPOINTS = {
  health: `${BASE_URL}/api/health`, // público, sin rate limit
  books: `${BASE_URL}/api/books`, // listado público de libros
  bookDetail: (slug) => `${BASE_URL}/api/books/${slug}`, // detalle público
  categories: `${BASE_URL}/api/categories`, // listado público de categorías
  // Búsqueda pública vía el índice (Scout; en loadtest driver 'collection' = LIKE
  // sobre la BD, sin servicio externo). NOTA: /api/books/search-instant queda
  // ensombrecido por la ruta /api/books/{book:slug} y devuelve 404 — bug de
  // enrutamiento de la app, ajeno a la carga; por eso usamos ?search=.
  searchBooks: (q) => `${BASE_URL}/api/books?search=${encodeURIComponent(q)}&per_page=8`,
  me: `${BASE_URL}/api/user`, // requiere Bearer token
  myShelf: `${BASE_URL}/api/me/shelf`, // biblioteca/estante del usuario autenticado
  myFavorites: `${BASE_URL}/api/me/favorites`, // operación autenticada segura (solo lectura)
};

// El seeder de loadtest crea slugs deterministas: nos evita parsear listados.
//   libros:     loadtest-book-0001 .. loadtest-book-0500  (500)
//   categorías: loadtest-category-001 .. loadtest-category-012 (12)
const LOADTEST_BOOKS = 500;
const LOADTEST_CATEGORIES = 12;

export function randomBookSlug() {
  const n = 1 + Math.floor(Math.random() * LOADTEST_BOOKS);
  return `loadtest-book-${String(n).padStart(4, '0')}`;
}

export function randomCategorySlug() {
  const n = 1 + Math.floor(Math.random() * LOADTEST_CATEGORIES);
  return `loadtest-category-${String(n).padStart(3, '0')}`;
}

// Términos de búsqueda que coinciden con los títulos ficticios "Loadtest Book NNNN".
export const SEARCH_TERMS = ['Loadtest', 'Book'];

export function randomSearchTerm() {
  return SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
}

// Cabeceras JSON estándar. La API fuerza Accept: application/json igualmente.
export const JSON_HEADERS = { Accept: 'application/json' };

// Cabeceras autenticadas a partir de un token de loadtest (nunca se imprime).
export function authHeaders(token) {
  return { ...JSON_HEADERS, Authorization: `Bearer ${token}` };
}

// Pausa aleatoria (segundos) para simular lectura humana entre peticiones.
export const THINK_TIME = { min: 0.5, max: 2.0 };
