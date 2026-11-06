import type {
  ApiCollection,
  ApiPaginated,
  ApiResource,
  Author,
  BookDetail,
  BookListItem,
  BookListParams,
  Category,
  ChapterSummary,
  ChapterFull,
  ComicPagesResponse,
  PublicProfile,
  Anthology,
} from "./types";
import { cacheModeForApiRequest } from "./server/api-cache-policy";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Fetch genérico (server-side) con manejo de errores + caché Next.js + Bearer token.
 *
 * Si está disponible la cookie `charbook_token` la incluye automáticamente.
 * Para forzar fresh data: { cache: 'no-store' }
 */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_URL}/api${path}`;

  // Server-side: intenta leer cookie de auth
  let authHeader: Record<string, string> = {};
  let hasAuth = false;
  if (typeof window === "undefined") {
    try {
      const { cookies } = await import("next/headers");
      const store = await cookies().catch(() => null);
      const token = store?.get("charbook_token")?.value;
      if (token) {
        authHeader = { Authorization: `Bearer ${token}` };
        hasAuth = true;
      }
    } catch {
      // contexto no soporta cookies() (ej: middleware fetch) — sin auth
    }
  }

  const cache = cacheModeForApiRequest(init?.cache, hasAuth);

  const res = await fetch(url, {
    ...init,
    cache,
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...authHeader,
      ...(init?.headers ?? {}),
    },
    next: cache ? undefined : { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`API ${res.status} on ${path}: ${await res.text()}`);
  }

  return res.json() as Promise<T>;
}

function qs<T extends object>(params?: T): string {
  if (!params) return "";
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params) as Array<[string, unknown]>) {
    if (v === undefined || v === null || v === "") continue;
    u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export const api = {
  books: {
    list: (params?: BookListParams) =>
      apiFetch<ApiPaginated<BookListItem>>(`/books${qs(params)}`),
    featured: () => apiFetch<ApiCollection<BookListItem>>("/books/featured"),
    recent: () => apiFetch<ApiCollection<BookListItem>>("/books/recent"),
    popular: () => apiFetch<ApiCollection<BookListItem>>("/books/popular"),
    get: (slug: string) =>
      apiFetch<ApiResource<BookDetail>>(`/books/${slug}`, { cache: "no-store" }),
    chapters: (slug: string) =>
      apiFetch<{ data: ChapterSummary[] }>(`/books/${slug}/chapters`, { cache: "no-store" }),
    chapter: (slug: string, number: number) =>
      apiFetch<ChapterFull>(`/books/${slug}/chapters/${number}`, { cache: "no-store" }),
    pages: (slug: string) =>
      apiFetch<ComicPagesResponse>(`/books/${slug}/pages`, { cache: "no-store" }),
    // Mapa de acceso por capítulo (paywall + lectura secuencial). Reenvía el
    // token por cookie, así que refleja los desbloqueos del lector logueado.
    access: (slug: string) =>
      apiFetch<{
        data: Array<{
          chapter_id: number;
          number: number;
          coin_price: number;
          access: boolean;
          reason: string;
          early_access: boolean;
        }>;
        plan: string | null;
      }>(`/books/${slug}/access`, { cache: "no-store" }),
  },
  categories: {
    list: () => apiFetch<ApiCollection<Category>>("/categories"),
    get: (slug: string) => apiFetch<ApiResource<Category>>(`/categories/${slug}`),
  },
  authors: {
    list: () => apiFetch<ApiCollection<Author>>("/authors"),
    get: (slug: string) =>
      apiFetch<{ data: Author; books: BookListItem[] }>(`/authors/${slug}`),
  },
  profiles: {
    // SSR del perfil publico: no-store para reflejar follow/edits al instante.
    get: (username: string) =>
      apiFetch<ApiResource<PublicProfile> & { meta: { is_private: boolean } }>(
        `/users/${username}`,
        { cache: "no-store" }
      ),
  },
  anthologies: {
    // SSR del detalle de antología (no-store para reflejar ediciones del dueño).
    get: (slug: string) =>
      apiFetch<ApiResource<Anthology>>(`/anthologies/${slug}`, {
        cache: "no-store",
      }),
  },
};

export const fileProxyUrl = (slug: string) =>
  `${API_URL}/api/books/${slug}/file-proxy`;
