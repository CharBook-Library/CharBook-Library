"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  Lightbulb,
  CalendarDays,
  Link as LinkIcon,
  BookPlus,
  Folder,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { widgetsApi, type CreatorWidgetInput } from "@/lib/api-creator";
import { useAuth } from "@/hooks/use-auth";
import type { CreatorWidget, CreatorWidgetType } from "@/lib/types";

const TYPE_META: Record<
  CreatorWidgetType,
  { label: string; icon: typeof Megaphone; accent: string; needsUrl?: boolean; needsDates?: boolean; needsBook?: boolean; needsCategory?: boolean }
> = {
  announcement: { label: "Anuncio", icon: Megaphone, accent: "text-amber-500" },
  tip: { label: "Tip de lectura", icon: Lightbulb, accent: "text-emerald-400" },
  event: { label: "Evento", icon: CalendarDays, accent: "text-violet-400", needsDates: true, needsUrl: true },
  link: { label: "Acceso directo", icon: LinkIcon, accent: "text-rose-400", needsUrl: true },
  new_arrival: { label: "Nueva adquisición", icon: BookPlus, accent: "text-primary", needsBook: true },
  featured_cat: { label: "Categoría destacada", icon: Folder, accent: "text-sky-400", needsCategory: true },
};

const ALL_TYPES: CreatorWidgetType[] = [
  "announcement",
  "tip",
  "event",
  "link",
  "new_arrival",
  "featured_cat",
];

export default function StudioWidgetsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading } = useAuth();
  const [editing, setEditing] = useState<CreatorWidget | null>(null);
  const [creatingType, setCreatingType] = useState<CreatorWidgetType | null>(null);

  const { data: widgets, isLoading: loadingWidgets } = useQuery({
    queryKey: ["my-widgets"],
    queryFn: () => widgetsApi.mine(),
    enabled: !!user, // Modelo abierto: cualquier user logueado tiene Atelier
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["my-widgets"] });
    if (user?.username) {
      queryClient.invalidateQueries({ queryKey: ["profile", user.username] });
    }
  };

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, is_published }: { id: number; is_published: boolean }) =>
      widgetsApi.update(id, { is_published }),
    onSuccess: () => {
      toast.success("Visibilidad actualizada");
      invalidate();
    },
    onError: () => toast.error("No se pudo actualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => widgetsApi.remove(id),
    onSuccess: () => {
      toast.success("Widget eliminado");
      invalidate();
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  // Guard: solo creators aprobados
  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="container max-w-2xl mx-auto p-6 text-center">
        <h1 className="font-serif text-2xl font-bold">Inicia sesión</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Necesitas una cuenta para personalizar tu Atelier.
        </p>
        <Button className="mt-4" onClick={() => router.push("/login")}>
          Iniciar sesión
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Secciones de tu perfil
        </h1>
        <p className="text-sm text-muted-foreground">
          Personaliza lo que verán quienes visiten tu Atelier de creador. Crea
          anuncios, tips, eventos, links de acceso directo y más.
        </p>
      </header>

      {/* Quick add buttons por tipo */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Añadir nueva sección
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ALL_TYPES.map((type) => {
            const meta = TYPE_META[type];
            const Icon = meta.icon;
            return (
              <button
                key={type}
                onClick={() => {
                  setEditing(null);
                  setCreatingType(type);
                }}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-card p-3 text-center transition-colors hover:border-primary/40 hover:bg-card/80"
              >
                <Icon className={`h-5 w-5 ${meta.accent}`} />
                <span className="text-xs font-medium">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de widgets existentes */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tus secciones
        </p>
        {loadingWidgets ? (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : !widgets?.length ? (
          <Card className="border-dashed border-border/60 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Aún no has creado ninguna sección. Usa los botones de arriba para
              añadir la primera.
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {widgets.map((w) => {
              const meta = TYPE_META[w.type];
              const Icon = meta.icon;
              return (
                <li key={w.id}>
                  <Card className="border-border/60 bg-card p-3 flex items-center gap-3">
                    <div
                      className={`rounded-md bg-${meta.accent.split("-")[1]}-400/15 p-2 shrink-0`}
                    >
                      <Icon className={`h-4 w-4 ${meta.accent}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="line-clamp-1 text-sm font-medium">
                          {w.title}
                        </span>
                        <Badge
                          variant="outline"
                          className="border-border/60 text-[10px]"
                        >
                          {meta.label}
                        </Badge>
                        {w.is_published === false && (
                          <Badge
                            variant="outline"
                            className="border-amber-400/40 text-amber-500 text-[10px]"
                          >
                            Borrador
                          </Badge>
                        )}
                      </div>
                      {w.body && (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {w.body}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        title={w.is_published === false ? "Publicar" : "Ocultar"}
                        onClick={() =>
                          togglePublishMutation.mutate({
                            id: w.id,
                            is_published: w.is_published === false,
                          })
                        }
                        disabled={togglePublishMutation.isPending}
                        className="h-8 w-8"
                      >
                        {w.is_published === false ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Editar"
                        onClick={() => {
                          setCreatingType(null);
                          setEditing(w);
                        }}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Eliminar"
                        onClick={() => {
                          if (
                            confirm(
                              `¿Eliminar la sección "${w.title}"? Esta acción no se puede deshacer.`
                            )
                          ) {
                            deleteMutation.mutate(w.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Editor (sheet) */}
      <WidgetEditor
        widget={editing}
        createType={creatingType}
        onClose={() => {
          setEditing(null);
          setCreatingType(null);
        }}
        onSaved={() => {
          setEditing(null);
          setCreatingType(null);
          invalidate();
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Editor unificado (crear / editar)
// ─────────────────────────────────────────────────────────────
function WidgetEditor({
  widget,
  createType,
  onClose,
  onSaved,
}: {
  widget: CreatorWidget | null;
  createType: CreatorWidgetType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = widget !== null || createType !== null;
  const type = widget?.type ?? createType;
  const meta = type ? TYPE_META[type] : null;

  const [title, setTitle] = useState(widget?.title ?? "");
  const [body, setBody] = useState(widget?.body ?? "");
  const [url, setUrl] = useState(widget?.url ?? "");
  const [startsAt, setStartsAt] = useState(
    widget?.starts_at ? widget.starts_at.slice(0, 16) : ""
  );
  const [endsAt, setEndsAt] = useState(
    widget?.ends_at ? widget.ends_at.slice(0, 16) : ""
  );
  const [bookId, setBookId] = useState<string>(
    widget?.book?.id ? String(widget.book.id) : ""
  );
  const [categoryId, setCategoryId] = useState<string>(
    widget?.category?.id ? String(widget.category.id) : ""
  );

  // Reset cuando cambia el target
  const resetKey = `${widget?.id ?? "new"}-${createType ?? ""}`;
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setTitle(widget?.title ?? "");
    setBody(widget?.body ?? "");
    setUrl(widget?.url ?? "");
    setStartsAt(widget?.starts_at ? widget.starts_at.slice(0, 16) : "");
    setEndsAt(widget?.ends_at ? widget.ends_at.slice(0, 16) : "");
    setBookId(widget?.book?.id ? String(widget.book.id) : "");
    setCategoryId(widget?.category?.id ? String(widget.category.id) : "");
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: CreatorWidgetInput = {
        type: type!,
        title: title.trim(),
        body: body.trim() || null,
        url: url.trim() || null,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        book_id: bookId ? parseInt(bookId, 10) : null,
        category_id: categoryId ? parseInt(categoryId, 10) : null,
      };
      return widget
        ? widgetsApi.update(widget.id, payload)
        : widgetsApi.create(payload);
    },
    onSuccess: () => {
      toast.success(widget ? "Sección actualizada" : "Sección creada");
      onSaved();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? "No se pudo guardar");
    },
  });

  if (!type || !meta) return null;
  const Icon = meta.icon;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[92vh] overflow-y-auto"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-serif text-xl flex items-center gap-2">
            <Icon className={`h-5 w-5 ${meta.accent}`} />
            {widget ? "Editar" : "Nueva"} sección · {meta.label}
          </SheetTitle>
          <SheetDescription>
            Esta sección aparecerá en tu perfil público de creador.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Título *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 140))}
              placeholder="Título corto y claro"
              className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>

          {type !== "featured_cat" && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contenido
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 4000))}
                rows={4}
                placeholder={
                  type === "tip"
                    ? "Comparte un consejo breve…"
                    : type === "event"
                    ? "Descripción del evento…"
                    : "Detalles opcionales…"
                }
                className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
            </div>
          )}

          {meta.needsUrl && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                URL {type === "link" ? "*" : "(opcional)"}
              </label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                type="url"
                placeholder="https://..."
                className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
            </div>
          )}

          {meta.needsDates && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Inicio
                </label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Fin
                </label>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </div>
            </div>
          )}

          {meta.needsBook && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                ID del libro (opcional)
              </label>
              <input
                type="number"
                value={bookId}
                onChange={(e) => setBookId(e.target.value)}
                placeholder="ej. 42"
                className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                Encuéntralo en la URL del libro o en tu catálogo.
              </p>
            </div>
          )}

          {meta.needsCategory && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                ID de la categoría
              </label>
              <input
                type="number"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                placeholder="ej. 3"
                className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
            </div>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 px-4 pb-6">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={saveMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={() => saveMutation.mutate()}
            disabled={!title.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {widget ? "Guardar cambios" : "Crear sección"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
