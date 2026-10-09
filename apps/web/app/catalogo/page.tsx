import type { Metadata } from "next";
import { BookCard } from "@/components/book-card";
import { CatalogFilters } from "@/components/catalog-filters";
import { CatalogPagination } from "@/components/catalog-pagination";
import { api } from "@/lib/api";
import type { BookListParams } from "@/lib/types";

export const metadata: Metadata = {
  title: "Catálogo completo",
  description: "Explora todos los libros disponibles en CharBook Library.",
};

interface CatalogPageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    author?: string;
    access_type?: "free" | "premium";
    language?: string;
    sort?: BookListParams["sort"];
    page?: string;
  }>;
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);

  const queryParams: BookListParams = {
    search: params.search,
    category: params.category,
    author: params.author,
    access_type: params.access_type,
    language: params.language,
    sort: params.sort ?? "recent",
    page,
    per_page: 24,
  };

  // Fetch paralelo
  const [booksRes, catsRes] = await Promise.all([
    api.books.list(queryParams).catch(() => ({
      data: [],
      meta: { current_page: 1, last_page: 1, total: 0 } as any,
    })),
    api.categories.list().catch(() => ({ data: [] })),
  ]);

  // Helper que construye href de paginación conservando filtros
  const buildPageHref = (p: number) => {
    const u = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v && k !== "page") u.set(k, String(v));
    });
    if (p > 1) u.set("page", String(p));
    const qs = u.toString();
    return `/catalogo${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      {/* Header */}
      <div className="mb-8 space-y-2">
        <h1 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
          Catálogo completo
        </h1>
        <p className="text-muted-foreground">
          Descubre miles de libros clásicos seleccionados con cariño.
        </p>
      </div>

      <CatalogFilters
        categories={catsRes.data}
        total={booksRes.meta?.total ?? 0}
      />

      {/* Grid de libros */}
      {booksRes.data.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-6 lg:grid-cols-5 xl:grid-cols-6">
            {booksRes.data.map((book) => (
              <BookCard key={book.id} book={book} size="sm" />
            ))}
          </div>

          <CatalogPagination
            currentPage={booksRes.meta?.current_page ?? 1}
            lastPage={booksRes.meta?.last_page ?? 1}
            hrefFor={buildPageHref}
          />
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 py-20 text-center">
      <p className="font-serif text-2xl font-bold">Sin resultados</p>
      <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
        No encontramos libros con esos criterios. Intenta cambiar los filtros o
        la búsqueda.
      </p>
    </div>
  );
}
