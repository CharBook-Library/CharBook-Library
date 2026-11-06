"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell, CheckCheck, ChevronLeft, ChevronRight, Trash2, Circle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { notificationsApi } from "@/lib/api-inbox";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/types";

const CATEGORIES: { key: string; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "comments", label: "Comentarios" },
  { key: "followers", label: "Seguidores" },
  { key: "reading", label: "Lecturas" },
  { key: "works", label: "Obras" },
  { key: "monetization", label: "Monetización" },
  { key: "system", label: "Sistema" },
];

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["studio-notifications", { category, unreadOnly, page }],
    queryFn: () =>
      notificationsApi.list({
        category: category === "all" ? undefined : category,
        unread_only: unreadOnly || undefined,
        page,
      }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["studio-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
  };

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });

  const readAllMutation = useMutation({
    mutationFn: () => notificationsApi.readAll(),
    onSuccess: () => {
      toast.success("Todas marcadas como leídas");
      invalidate();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.remove(id),
    onSuccess: () => {
      toast.success("Notificación eliminada");
      invalidate();
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const items = data?.data ?? [];
  const unread = data?.meta.unread_total ?? 0;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              Notificaciones
            </h1>
            {unread > 0 && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums">
                {unread} sin leer
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Avisos de tus obras: comentarios, seguidores nuevos y novedades del
            equipo.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={readAllMutation.isPending || unread === 0}
          onClick={() => readAllMutation.mutate()}
        >
          <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
          Marcar todo como leído
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => { setCategory(c.key); setPage(1); }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              category === c.key
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {c.label}
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }}
            className="h-3.5 w-3.5 accent-primary"
          />
          Solo sin leer
        </label>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-card/40 py-16 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {unreadOnly
              ? "No tienes notificaciones sin leer. 🎉"
              : "Todavía no tienes notificaciones."}
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card divide-y divide-border/60">
          {items.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onRead={() => markReadMutation.mutate(n.id)}
              onDelete={() => removeMutation.mutate(n.id)}
            />
          ))}
        </div>
      )}

      {/* Paginación */}
      {data && data.meta.last_page > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="px-3 text-muted-foreground">
            Página {data.meta.current_page} de {data.meta.last_page}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.meta.last_page}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
function NotificationRow({
  notification: n,
  onRead,
  onDelete,
}: {
  notification: AppNotification;
  onRead: () => void;
  onDelete: () => void;
}) {
  const isUnread = !n.read_at;

  const inner = (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-lg leading-none">{n.emoji ?? "🔔"}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn("line-clamp-1 text-sm", isUnread ? "font-semibold" : "font-medium text-foreground/80")}>
            {n.title}
          </p>
          {isUnread && <Circle className="h-2 w-2 shrink-0 fill-primary text-primary" />}
        </div>
        {n.body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {n.body}
          </p>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground/70">
          {new Date(n.created_at).toLocaleDateString("es", {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "group flex items-start gap-2 px-4 py-3 transition-colors",
        isUnread ? "bg-primary/[0.03]" : "hover:bg-accent/30"
      )}
    >
      <div className="min-w-0 flex-1">
        {n.link ? (
          <Link href={n.link} onClick={() => isUnread && onRead()} className="block">
            {inner}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => isUnread && onRead()}
            className="block w-full text-left"
          >
            {inner}
          </button>
        )}
      </div>
      <button
        onClick={onDelete}
        className="rounded-md p-1.5 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        title="Eliminar notificación"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
