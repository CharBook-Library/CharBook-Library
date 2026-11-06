"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users, Search, ExternalLink, Plus, Pencil, Trash2, Loader2, ArrowUpDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import { adminApi } from "@/lib/api-admin";
import type { Author } from "@/lib/types";

type SortKey = "name" | "books";

export default function AdminAuthorsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Author | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-authors"],
    queryFn: () =>
      apiClient.get<{ data: Author[] }>("/authors").then((r) => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (slug: string) => adminApi.authors.delete(slug),
    onSuccess: () => {
      toast.success("Autor eliminado");
      queryClient.invalidateQueries({ queryKey: ["admin-authors"] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? "No se pudo eliminar"),
  });

  const filtered = useMemo(() => {
    const list = (data ?? []).filter((a) =>
      a.name.toLowerCase().includes(search.toLowerCase())
    );
    return sort === "books"
      ? [...list].sort((a, b) => (b.books_count ?? 0) - (a.books_count ?? 0))
      : [...list].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [data, search, sort]);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Autores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.length ?? "—"} autores en el catálogo.
          </p>
        </div>
        <Button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Nuevo autor
        </Button>
      </div>

      {/* Búsqueda y orden */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar autor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="relative">
          <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-10 rounded-md border border-border/60 bg-card pl-9 pr-3 text-sm"
          >
            <option value="name">Nombre (A–Z)</option>
            <option value="books">Más libros</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border/60 py-12 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No se encontraron autores.</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((author) => (
            <Card key={author.id} className="group border-border/60 bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-base font-bold">
                  {author.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{author.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {author.nationality && <span>{author.nationality}</span>}
                    {author.birth_year && (
                      <span>
                        {author.birth_year}{author.death_year ? ` — ${author.death_year}` : ""}
                      </span>
                    )}
                  </div>
                  <Badge className="mt-2 bg-primary/15 text-primary border-0 text-[10px]">
                    {author.books_count ?? 0} libro{author.books_count === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={() => { setEditing(author); setDialogOpen(true); }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Editar autor"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`¿Eliminar al autor "${author.name}"? Solo es posible si no tiene libros.`)) {
                        deleteMutation.mutate(author.slug);
                      }
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Eliminar autor"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <Link
                    href={`/autor/${author.slug}`}
                    target="_blank"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-primary"
                    title="Ver perfil público"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AuthorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        author={editing}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Dialog crear / editar autor
// ─────────────────────────────────────────────
function AuthorDialog({
  open,
  onOpenChange,
  author,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  author: Author | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!author;

  const [name, setName] = useState("");
  const [nationality, setNationality] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [deathYear, setDeathYear] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [biography, setBiography] = useState("");

  // Cargar valores al abrir (crear → vacío, editar → datos del autor)
  useEffect(() => {
    if (!open) return;
    setName(author?.name ?? "");
    setNationality(author?.nationality ?? "");
    setBirthYear(author?.birth_year?.toString() ?? "");
    setDeathYear(author?.death_year?.toString() ?? "");
    setPhotoUrl(author?.photo_url ?? "");
    setBiography((author as { biography?: string } | null)?.biography ?? "");
  }, [open, author]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        nationality: nationality.trim() || null,
        birth_year: birthYear ? Number(birthYear) : null,
        death_year: deathYear ? Number(deathYear) : null,
        photo_url: photoUrl.trim() || null,
        biography: biography.trim() || null,
      };
      return isEdit
        ? adminApi.authors.update(author!.slug, payload as Partial<Author>)
        : adminApi.authors.create(payload as Partial<Author>);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Autor actualizado" : "Autor creado");
      queryClient.invalidateQueries({ queryKey: ["admin-authors"] });
      queryClient.invalidateQueries({ queryKey: ["authors-all"] });
      onOpenChange(false);
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      const first = e.response?.data?.errors
        ? Object.values(e.response.data.errors)[0]?.[0]
        : e.response?.data?.message;
      toast.error(first ?? "No se pudo guardar");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar autor" : "Nuevo autor"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Actualiza los datos de ${author?.name}.`
              : "Crea un autor para asignarlo a libros del catálogo."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <DialogField label="Nombre *">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gabriel García Márquez"
            />
          </DialogField>

          <div className="grid grid-cols-3 gap-3">
            <DialogField label="Nacionalidad">
              <Input
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                placeholder="Colombiana"
              />
            </DialogField>
            <DialogField label="Nacimiento">
              <Input
                type="number"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder="1927"
              />
            </DialogField>
            <DialogField label="Fallecimiento">
              <Input
                type="number"
                value={deathYear}
                onChange={(e) => setDeathYear(e.target.value)}
                placeholder="2014"
              />
            </DialogField>
          </div>

          <DialogField label="URL de la foto">
            <Input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
            />
          </DialogField>

          <DialogField label="Biografía">
            <textarea
              rows={4}
              value={biography}
              onChange={(e) => setBiography(e.target.value)}
              placeholder="Breve biografía del autor..."
              className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </DialogField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={mutation.isPending || name.trim().length < 2}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Crear autor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}
