"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Library,
  Globe,
  Lock,
  Plus,
  Search,
  Trash2,
  X,
  Loader2,
  Check,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookCard } from "@/components/book-card";
import { apiClient } from "@/lib/api-client";
import { socialApi } from "@/lib/api-social";
import { useDebounce } from "@/hooks/use-debounce";
import type { Anthology, ApiCollection, BookListItem } from "@/lib/types";

interface AnthologyDetailProps {
  initial: Anthology;
}

export function AnthologyDetail({ initial }: AnthologyDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: anthology } = useQuery({
    queryKey: ["anthology", initial.slug],
    queryFn: () => socialApi.anthologies.get(initial.slug),
    initialData: initial,
  });

  const isMine = anthology.is_mine;

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(anthology.title);
  const [description, setDescription] = useState(anthology.description ?? "");
  const [adding, setAdding] = useState(false);
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 250);

  const setData = (next: Anthology) =>
    queryClient.setQueryData(["anthology", initial.slug], next);

  // ----- Buscar libros para añadir -----
  const { data: results, isFetching } = useQuery({
    queryKey: ["anthology-search", debounced],
    queryFn: () =>
      apiClient
        .get<ApiCollection<BookListItem>>("/books/search-instant", {
          params: { q: debounced },
        })
        .then((r) => r.data.data),
    enabled: adding && debounced.trim().length >= 2,
  });

  const existingIds = new Set(anthology.books?.map((b) => b.book.id) ?? []);

  // ----- Mutaciones -----
  const updateMutation = useMutation({
    mutationFn: () =>
      socialApi.anthologies.update(anthology.slug, {
        title: title.trim(),
        description: description.trim() === "" ? null : description.trim(),
      }),
    onSuccess: (next) => {
      setData(next);
      setEditing(false);
      toast.success("Antología actualizada");
    },
    onError: () => toast.error("No se pudo guardar"),
  });

  const visibilityMutation = useMutation({
    mutationFn: (next: boolean) =>
      socialApi.anthologies.update(anthology.slug, { is_public: next }),
    onSuccess: (next) => {
      setData(next);
      toast.success(next.is_public ? "Ahora es pública" : "Ahora es privada");
    },
    onError: () => toast.error("No se pudo cambiar la visibilidad"),
  });

  const addMutation = useMutation({
    mutationFn: (bookId: number) =>
      socialApi.anthologies.addBook(anthology.slug, bookId),
    onSuccess: (next) => {
      setData(next);
      toast.success("Libro añadido");
    },
    onError: () => toast.error("No se pudo añadir el libro"),
  });

  const removeMutation = useMutation({
    mutationFn: (bookSlug: string) =>
      socialApi.anthologies.removeBook(anthology.slug, bookSlug),
    onSuccess: (next) => {
      setData(next);
      toast.success("Libro quitado");
    },
    onError: () => toast.error("No se pudo quitar el libro"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => socialApi.anthologies.remove(anthology.slug),
    onSuccess: () => {
      toast.success("Antología eliminada");
      queryClient.invalidateQueries({ queryKey: ["my-anthologies"] });
      router.push("/antologias");
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12">
      {/* ===== Header ===== */}
      <header className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Library className="h-4 w-4" />
          <span>Antología</span>
          {anthology.is_public ? (
            <span className="inline-flex items-center gap-1 text-xs">
              · <Globe className="h-3 w-3" /> Pública
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs">
              · <Lock className="h-3 w-3" /> Privada
            </span>
          )}
        </div>

        {editing ? (
          <div className="mt-3 space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="h-11 font-serif text-2xl font-bold"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              rows={3}
              placeholder="Describe el hilo que une estos libros..."
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Guardar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setTitle(anthology.title);
                  setDescription(anthology.description ?? "");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight md:text-4xl">
              {anthology.title}
            </h1>
            {anthology.description && (
              <p className="mt-3 max-w-prose text-pretty leading-relaxed text-muted-foreground">
                {anthology.description}
              </p>
            )}
          </>
        )}

        {/* Autor + acciones */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {anthology.owner && (
            <Link
              href={`/u/${anthology.owner.username}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <span className="relative h-7 w-7 overflow-hidden rounded-full border border-border/60">
                {anthology.owner.avatar ? (
                  <Image
                    src={anthology.owner.avatar}
                    alt={anthology.owner.name}
                    fill
                    sizes="28px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-primary/15 text-xs text-primary">
                    {anthology.owner.name?.[0]?.toUpperCase()}
                  </span>
                )}
              </span>
              Curada por {anthology.owner.name}
            </Link>
          )}

          {isMine && !editing && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => visibilityMutation.mutate(!anthology.is_public)}
                disabled={visibilityMutation.isPending}
              >
                {anthology.is_public ? (
                  <>
                    <Lock className="mr-1.5 h-3.5 w-3.5" /> Hacer privada
                  </>
                ) : (
                  <>
                    <Globe className="mr-1.5 h-3.5 w-3.5" /> Hacer pública
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm("¿Eliminar esta antología?")) deleteMutation.mutate();
                }}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Eliminar
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* ===== Añadir libros (solo dueño) ===== */}
      {isMine && (
        <div className="mb-8">
          {adding ? (
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Busca un libro por título o autor..."
                  className="h-9 border-0 focus-visible:ring-0"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setAdding(false);
                    setTerm("");
                  }}
                  aria-label="Cerrar buscador"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {debounced.trim().length >= 2 && (
                <div className="mt-3 space-y-1">
                  {isFetching && (
                    <p className="px-1 py-2 text-sm text-muted-foreground">
                      Buscando...
                    </p>
                  )}
                  {results?.map((book) => {
                    const already = existingIds.has(book.id);
                    return (
                      <button
                        key={book.id}
                        type="button"
                        disabled={already || addMutation.isPending}
                        onClick={() => addMutation.mutate(book.id)}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        <div className="relative h-12 w-8 shrink-0 overflow-hidden rounded border border-border/40">
                          {book.cover && (
                            <Image
                              src={book.cover}
                              alt=""
                              fill
                              sizes="32px"
                              className="object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-1 text-sm font-medium">
                            {book.title}
                          </div>
                          <div className="line-clamp-1 text-xs text-muted-foreground">
                            {book.author?.name}
                          </div>
                        </div>
                        {already ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                  {results && results.length === 0 && !isFetching && (
                    <p className="px-1 py-2 text-sm text-muted-foreground">
                      Sin resultados.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Button variant="outline" onClick={() => setAdding(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Añadir libros
            </Button>
          )}
        </div>
      )}

      {/* ===== Libros ===== */}
      {anthology.books && anthology.books.length > 0 ? (
        <ul className="space-y-4">
          {anthology.books.map((entry) => (
            <li
              key={entry.book.id}
              className="flex gap-4 rounded-xl border border-border/60 bg-card p-3"
            >
              <BookCard book={entry.book} size="sm" />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/libro/${entry.book.slug}`}
                  className="font-serif text-lg font-bold hover:text-primary"
                >
                  {entry.book.title}
                </Link>
                {entry.book.author && (
                  <p className="text-sm text-muted-foreground">
                    {entry.book.author.name}
                  </p>
                )}
                {entry.note && (
                  <p className="mt-2 text-sm italic text-muted-foreground">
                    “{entry.note}”
                  </p>
                )}
              </div>
              {isMine && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeMutation.mutate(entry.book.slug)}
                  disabled={removeMutation.isPending}
                  aria-label="Quitar de la antología"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 py-16 text-center">
          <Library className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isMine
              ? "Esta antología está vacía. Añade tu primer libro."
              : "Esta antología todavía no tiene libros."}
          </p>
        </div>
      )}
    </div>
  );
}
