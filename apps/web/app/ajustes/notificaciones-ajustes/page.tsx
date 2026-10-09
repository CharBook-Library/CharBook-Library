"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell, BellOff, CheckCheck, Loader2, Trash2, X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { notificationsApi } from "@/lib/api-inbox";
import type { AppNotification, NotificationCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORIES: { value: "all" | NotificationCategory; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "reading", label: "Lectura" },
  { value: "comments", label: "Comentarios" },
  { value: "followers", label: "Seguidores" },
  { value: "works", label: "Mis obras" },
  { value: "monetization", label: "Monetización" },
  { value: "system", label: "Sistema" },
];

function relTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 604800) return `hace ${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

export default function NotificacionesAjustesPage() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<"all" | NotificationCategory>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["settings-notifications", category, page],
    queryFn: () =>
      notificationsApi.list({
        category: category === "all" ? undefined : category,
        page,
      }),
  });

  const items: AppNotification[] = data?.data ?? [];
  const meta = data?.meta;

  const allSelected = items.length > 0 && items.every((n) => selected.has(n.id));
  const someSelected = selected.size > 0;

  const invalidate = () => {
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["settings-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
  };

  const removeBulk = useMutation({
    mutationFn: (ids: number[]) => notificationsApi.removeBulk(ids),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidate();
    },
    onError: () => toast.error("No se pudieron eliminar"),
  });

  const removeAll = useMutation({
    mutationFn: () => notificationsApi.removeAll(),
    onSuccess: (res) => {
      toast.success(res.message);
      setPage(1);
      invalidate();
    },
    onError: () => toast.error("No se pudieron eliminar"),
  });

  const readAll = useMutation({
    mutationFn: () => notificationsApi.readAll(),
    onSuccess: () => {
      toast.success("Todas marcadas como leídas");
      invalidate();
    },
  });

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(items.map((n) => n.id)));

  const unread = useMemo(() => meta?.unread_total ?? 0, [meta]);

  return (
    <div className="space-y-4">
      {/* ───── Encabezado ───── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-xl font-bold tracking-tight">
            <Bell className="h-5 w-5 text-primary" />
            Notificaciones
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {meta ? (
              <>
                {meta.total} en total{unread > 0 && <> · <span className="font-medium text-primary">{unread} sin leer</span></>}
              </>
            ) : (
              "Gestiona y limpia tus notificaciones."
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unread > 0 && (
            <Button size="sm" variant="outline" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
              {readAll.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="mr-1.5 h-3.5 w-3.5" />}
              Marcar todo leído
            </Button>
          )}
          {(meta?.total ?? 0) > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (confirm("¿Eliminar TODAS tus notificaciones? Esta acción no se puede deshacer.")) {
                  removeAll.mutate();
                }
              }}
              disabled={removeAll.isPending}
            >
              {removeAll.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
              Eliminar todas
            </Button>
          )}
        </div>
      </div>

      {/* ───── Filtro por categoría ───── */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => {
              setCategory(c.value);
              setPage(1);
              setSelected(new Set());
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              category === c.value
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* ───── Barra de selección ───── */}
      {items.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-muted-foreground">
              {someSelected ? `${selected.size} seleccionada${selected.size === 1 ? "" : "s"}` : "Seleccionar todo"}
            </span>
          </label>
          {someSelected && (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                <X className="mr-1 h-3.5 w-3.5" /> Quitar selección
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => removeBulk.mutate([...selected])}
                disabled={removeBulk.isPending}
              >
                {removeBulk.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                Eliminar ({selected.size})
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* ───── Lista ───── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-14 text-center">
          <BellOff className="h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium">No hay notificaciones</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {category === "all" ? "Estás al día." : "No hay notificaciones en esta categoría."}
          </p>
        </Card>
      ) : (
        <ul className="space-y-1.5">
          {items.map((n) => (
            <li key={n.id}>
              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                  selected.has(n.id)
                    ? "border-primary/50 bg-primary/[0.06]"
                    : "border-border/60 bg-card hover:border-primary/30",
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.has(n.id)}
                  onChange={() => toggle(n.id)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-border"
                  aria-label={`Seleccionar «${n.title}»`}
                />
                <span className="mt-0.5 text-lg leading-none">{n.emoji ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!n.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Sin leer" />}
                    <p className={cn("text-sm", !n.read_at ? "font-semibold" : "font-medium text-foreground/85")}>
                      {n.title}
                    </p>
                    <Badge variant="outline" className="border-border/60 text-[9px] uppercase text-muted-foreground">
                      {CATEGORIES.find((c) => c.value === n.category)?.label ?? n.category}
                    </Badge>
                  </div>
                  {n.body && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground/70">
                    <span>{relTime(n.created_at)}</span>
                    {n.link && (
                      <Link href={n.link} className="font-medium text-primary hover:underline">
                        Ver
                      </Link>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeBulk.mutate([n.id])}
                  disabled={removeBulk.isPending}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Eliminar notificación"
                  title="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ───── Paginación ───── */}
      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => { setPage((p) => p - 1); setSelected(new Set()); }}>
            Anterior
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            Página {meta.current_page} de {meta.last_page}
          </span>
          <Button size="sm" variant="outline" disabled={page >= meta.last_page} onClick={() => { setPage((p) => p + 1); setSelected(new Set()); }}>
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
