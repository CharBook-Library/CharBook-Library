"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Tags, ExternalLink, Plus, Pencil, Trash2, Loader2,
  Search, Folder, CornerDownRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import { adminApi } from "@/lib/api-admin";
import type { Category } from "@/lib/types";

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [presetParentId, setPresetParentId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () =>
      apiClient.get<{ data: Category[] }>("/categories").then((r) => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (slug: string) => adminApi.categories.delete(slug),
    onSuccess: () => {
      toast.success("Categoría eliminada");
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-hierarchical"] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? "No se pudo eliminar"),
  });

  // Agrupar: padres (parent_id null) con sus hijas, ordenados alfabéticamente.
  const groups = useMemo(() => {
    const all = data ?? [];
    const q = search.trim().toLowerCase();
    const parents = all
      .filter((c) => c.parent_id == null)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    return parents
      .map((parent) => {
        const children = all
          .filter((c) => c.parent_id === parent.id)
          .sort((a, b) => a.name.localeCompare(b.name, "es"));
        if (!q) return { parent, children };
        // Con búsqueda: mostrar el grupo si el padre o alguna hija coincide
        const parentMatch = parent.name.toLowerCase().includes(q);
        const matchingChildren = children.filter((c) =>
          c.name.toLowerCase().includes(q)
        );
        if (!parentMatch && matchingChildren.length === 0) return null;
        return { parent, children: parentMatch ? children : matchingChildren };
      })
      .filter(Boolean) as { parent: Category; children: Category[] }[];
  }, [data, search]);

  const parentOptions = useMemo(
    () =>
      (data ?? [])
        .filter((c) => c.parent_id == null)
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [data]
  );

  const openCreate = (parentId: number | null = null) => {
    setEditing(null);
    setPresetParentId(parentId);
    setDialogOpen(true);
  };

  const handleDelete = (cat: Category) => {
    if (confirm(`¿Eliminar la categoría "${cat.name}"?`)) {
      deleteMutation.mutate(cat.slug);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Categorías</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.length ?? "—"} categorías organizadas por grupo.
          </p>
        </div>
        <Button
          onClick={() => openCreate(null)}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Nueva categoría
        </Button>
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar categoría o subcategoría..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card className="border-dashed border-border/60 py-12 text-center">
          <Tags className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search ? "Sin resultados para esa búsqueda." : "No hay categorías."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map(({ parent, children }) => (
            <Card key={parent.id} className="border-border/60 bg-card p-4">
              {/* ── Padre ── */}
              <div className="flex items-center gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                  style={{ background: (parent.color ?? "#888") + "22" }}
                >
                  <Folder
                    className="h-4 w-4"
                    style={{ color: parent.color ?? "var(--muted-foreground)" }}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{parent.name}</h3>
                    <Badge className="bg-primary/15 text-primary border-0 text-[10px]">
                      {parent.books_count ?? 0} libro{parent.books_count === 1 ? "" : "s"}
                    </Badge>
                    {children.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {children.length} subcategoría{children.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  {parent.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                      {parent.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={() => openCreate(parent.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Añadir subcategoría"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { setEditing(parent); setPresetParentId(null); setDialogOpen(true); }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Editar categoría"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(parent)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Eliminar categoría"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <Link
                    href={`/catalogo?category=${parent.slug}`}
                    target="_blank"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-primary"
                    title="Ver en catálogo"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* ── Hijas ── */}
              {children.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/40 pt-3 pl-11">
                  {children.map((child) => (
                    <span
                      key={child.id}
                      className="group inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs"
                    >
                      <CornerDownRight className="h-3 w-3 text-muted-foreground/50" />
                      {child.name}
                      <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                        {child.books_count ?? 0}
                      </span>
                      <button
                        onClick={() => { setEditing(child); setPresetParentId(null); setDialogOpen(true); }}
                        className="ml-0.5 rounded p-0.5 text-muted-foreground/50 hover:text-foreground"
                        title="Editar subcategoría"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(child)}
                        className="rounded p-0.5 text-muted-foreground/50 hover:text-destructive"
                        title="Eliminar subcategoría"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
        presetParentId={presetParentId}
        parentOptions={parentOptions}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Dialog crear / editar categoría
// ─────────────────────────────────────────────
function CategoryDialog({
  open,
  onOpenChange,
  category,
  presetParentId,
  parentOptions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category: Category | null;
  presetParentId: number | null;
  parentOptions: Category[];
}) {
  const queryClient = useQueryClient();
  const isEdit = !!category;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#d9a441");
  const [parentId, setParentId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setDescription(category?.description ?? "");
    setColor(category?.color ?? "#d9a441");
    setParentId(
      category?.parent_id != null
        ? String(category.parent_id)
        : presetParentId != null
          ? String(presetParentId)
          : ""
    );
  }, [open, category, presetParentId]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        color: color || null,
        parent_id: parentId ? Number(parentId) : null,
      };
      return isEdit
        ? adminApi.categories.update(category!.slug, payload as Partial<Category>)
        : adminApi.categories.create(payload as Partial<Category>);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Categoría actualizada" : "Categoría creada");
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-hierarchical"] });
      queryClient.invalidateQueries({ queryKey: ["categories-all"] });
      onOpenChange(false);
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      const first = e.response?.data?.errors
        ? Object.values(e.response.data.errors)[0]?.[0]
        : e.response?.data?.message;
      toast.error(first ?? "No se pudo guardar");
    },
  });

  // No permitir que una categoría con hijas se vuelva subcategoría (el
  // backend también lo valida; aquí solo ocultamos la opción imposible).
  const selectableParents = parentOptions.filter((p) => p.id !== category?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Actualiza "${category?.name}".`
              : "Crea una categoría principal o una subcategoría."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Nombre *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fantasía épica"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Categoría padre</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm"
            >
              <option value="">— Ninguna (categoría principal) —</option>
              {selectableParents.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Si eliges un padre, esta categoría será su subcategoría.
            </p>
          </div>

          <div className="grid grid-cols-[auto_1fr] items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-md border border-border/60 bg-background p-1"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Descripción</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opcional, se muestra en el catálogo"
              />
            </div>
          </div>
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
            {isEdit ? "Guardar cambios" : "Crear categoría"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
