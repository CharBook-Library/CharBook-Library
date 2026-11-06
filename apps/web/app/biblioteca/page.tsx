"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Heart, BookOpen, ChevronLeft, ChevronRight, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookCard } from "@/components/book-card";
import { BookGridSkeleton } from "@/components/skeletons";
import { useAuth } from "@/hooks/use-auth";
import { socialApi } from "@/lib/api-social";

export default function BibliotecaPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["my-favorites", page],
    queryFn: () => socialApi.favorites.mine(page),
    enabled: isAuthenticated,
  });

  // Mientras carga el estado auth
  if (authLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <BookGridSkeleton />
      </div>
    );
  }

  // No autenticado
  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <Library className="mx-auto mb-6 h-16 w-16 text-primary" />
        <h1 className="font-serif text-3xl font-bold">Tu biblioteca personal</h1>
        <p className="mt-3 text-muted-foreground">
          Inicia sesión para guardar tus libros favoritos y construir tu colección.
        </p>
        <Button
          asChild
          className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Link href="/login?from=/biblioteca">Iniciar sesión</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Library className="h-4 w-4" />
          <span>Mi biblioteca</span>
        </div>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight md:text-4xl">
          Hola, {user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data?.meta?.total
            ? `Tienes ${data.meta.total} libro${data.meta.total === 1 ? "" : "s"} en favoritos`
            : "Empieza a guardar tus libros favoritos"}
        </p>
      </div>

      {/* Grid */}
      {isLoading ? (
        <BookGridSkeleton />
      ) : !data?.data.length ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-6 lg:grid-cols-5 xl:grid-cols-6">
            {data.data.map((book) => (
              <BookCard key={book.id} book={book} size="sm" />
            ))}
          </div>

          {/* Paginación */}
          {data.meta.last_page > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="border-border/60"
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </Button>
              <span className="px-3 text-sm text-muted-foreground">
                Página {data.meta.current_page} de {data.meta.last_page}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.meta.last_page}
                onClick={() => setPage((p) => p + 1)}
                className="border-border/60"
              >
                Siguiente <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 py-20 text-center">
      <Heart className="mx-auto mb-5 h-12 w-12 text-primary/40" strokeWidth={1.5} />
      <h2 className="font-serif text-2xl font-bold">Aún no tienes favoritos</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Explora el catálogo y dale al corazón en los libros que te gusten. Aparecerán aquí.
      </p>
      <Button
        asChild
        className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Link href="/catalogo">
          <BookOpen className="mr-1.5 h-4 w-4" />
          Explorar catálogo
        </Link>
      </Button>
    </div>
  );
}
