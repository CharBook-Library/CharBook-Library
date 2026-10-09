"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Edit2, Trash2, ExternalLink } from "lucide-react";
import { adminApi } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function AdminBooksPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "books", { search, page }],
    queryFn: () => adminApi.books.list({ search, page, per_page: 20 }),
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.books.delete,
    onSuccess: () => {
      toast.success("Libro eliminado");
      queryClient.invalidateQueries({ queryKey: ["admin", "books"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
    onError: () => toast.error("No se pudo eliminar el libro"),
  });

  const confirmDelete = (slug: string, title: string) => {
    if (confirm(`¿Eliminar "${title}"? Esta acción se puede revertir desde la BD.`)) {
      deleteMutation.mutate(slug);
    }
  };

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Libros</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona el catálogo completo.
          </p>
        </div>
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/admin/libros/nuevo">
            <Plus className="mr-1.5 h-4 w-4" />
            Nuevo libro
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar por título, autor, ISBN..."
          className="h-10 rounded-md pl-10"
        />
      </div>

      {/* Tabla */}
      <Card className="border-border/60 overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !data?.data.length ? (
          <div className="py-16 text-center text-muted-foreground">
            <p className="font-serif text-lg">Sin libros</p>
            <p className="mt-1 text-sm">Empieza por subir tu primer libro.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {data.data.map((book) => (
              <div
                key={book.id}
                className="flex items-center gap-4 p-3 transition-colors hover:bg-accent/30 md:p-4"
              >
                {/* Cover */}
                <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded border border-border/40 bg-muted">
                  {book.cover && (
                    <Image
                      src={book.cover}
                      alt={book.title}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{book.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {book.author?.name}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge
                      variant="outline"
                      className={
                        "h-5 border-0 text-[10px] " +
                        (book.access_type === "free"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-primary/20 text-primary")
                      }
                    >
                      {book.access_type === "free" ? "Gratis" : "Premium"}
                    </Badge>
                    {book.is_featured && (
                      <Badge className="h-5 border-0 bg-primary text-[10px] text-primary-foreground">
                        ⭐ Destacado
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Ver en el sitio"
                  >
                    <Link href={`/libro/${book.slug}`} target="_blank">
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    title="Editar"
                  >
                    <Link href={`/admin/libros/${book.slug}/editar`}>
                      <Edit2 className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => confirmDelete(book.slug, book.title)}
                    disabled={deleteMutation.isPending}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Paginación simple */}
      {data && data.meta.last_page > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="px-3 text-sm text-muted-foreground">
            Página {data.meta.current_page} de {data.meta.last_page}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.meta.last_page}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
