"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell, CheckCheck, Trash2, BookOpen, MessageCircle, Users,
  Library, Settings, Coins, Sparkles, Loader2, Activity,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { notificationsApi } from "@/lib/api-inbox";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationCategory } from "@/lib/types";

const CATEGORIES: { key: string; label: string; icon: typeof Bell }[] = [
  { key: "all", label: "Todas", icon: Bell },
  { key: "reading", label: "Lectura", icon: BookOpen },
  { key: "comments", label: "Comentarios", icon: MessageCircle },
  { key: "followers", label: "Seguidores", icon: Users },
  { key: "works", label: "Obras", icon: Library },
  { key: "system", label: "Sistema", icon: Settings },
  { key: "monetization", label: "Monetización", icon: Coins },
];

const CATEGORY_COLORS: Record<string, string> = {
  reading: "border-primary/40 text-primary",
  comments: "border-violet-500/40 text-violet-500",
  followers: "border-rose-500/40 text-rose-500",
  works: "border-amber-500/40 text-amber-500",
  system: "border-muted-foreground/40 text-muted-foreground",
  monetization: "border-emerald-500/40 text-emerald-500",
};

export default function NotificationsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [filter, setFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data, isLoading: loadingList } = useQuery({
    queryKey: ["notifications", filter],
    queryFn: () => notificationsApi.list({ category: filter, page: 1 }),
    enabled: isAuthenticated,
  });

  const { data: activity } = useQuery({
    queryKey: ["notifications-activity"],
    queryFn: () => notificationsApi.activity(),
    enabled: isAuthenticated,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-recent"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-activity"] });
  };

  const markRead = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });

  const readAll = useMutation({
    mutationFn: () => notificationsApi.readAll(),
    onSuccess: () => {
      toast.success("Todas marcadas como leídas");
      invalidate();
    },
  });

  const removeOne = useMutation({
    mutationFn: (id: number) => notificationsApi.remove(id),
    onSuccess: invalidate,
  });

  if (isLoading) {
    return <div className="p-6"><Skeleton className="h-96" /></div>;
  }
  if (!isAuthenticated) {
    return (
      <div className="container max-w-2xl mx-auto p-6 text-center">
        <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">
          Inicia sesión para ver tus notificaciones.
        </p>
        <Button asChild className="mt-4"><Link href="/login">Iniciar sesión</Link></Button>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Notificaciones
          </h1>
          <p className="text-sm text-muted-foreground">
            Centro de actividad y avisos recientes.
          </p>
        </div>
        {(data?.meta.unread_total ?? 0) > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => readAll.mutate()}
            disabled={readAll.isPending}
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Marcar todo como leído
          </Button>
        )}
      </header>

      {/* ═══════ CENTRO DE ACTIVIDAD ═══════ */}
      {activity &&
        (activity.today.length > 0 || activity.this_week.length > 0) && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="font-medium text-sm">Centro de actividad</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {activity.today.length > 0 && (
              <ActivityCard label="Hoy" groups={activity.today} />
            )}
            {activity.this_week.length > 0 && (
              <ActivityCard label="Esta semana" groups={activity.this_week} />
            )}
          </div>
        </section>
      )}

      {/* ═══════ TABS DE CATEGORÍA ═══════ */}
      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-border/60 pb-2">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = filter === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {c.label}
            </button>
          );
        })}
      </nav>

      {/* ═══════ LISTA DE NOTIFICACIONES ═══════ */}
      {loadingList ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-md" />)}
        </div>
      ) : !data?.data.length ? (
        <Card className="border-dashed border-border/60 bg-card/40 py-16 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">Sin notificaciones por ahora.</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {data.data.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              onRead={() => markRead.mutate(n.id)}
              onRemove={() => removeOne.mutate(n.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationRow({
  n, onRead, onRemove,
}: { n: AppNotification; onRead: () => void; onRemove: () => void }) {
  const Inner = (
    <Card
      className={cn(
        "border-border/60 bg-card p-3 transition-colors hover:border-primary/30 flex items-start gap-3",
        !n.read_at && "bg-primary/5 border-primary/20"
      )}
    >
      <span className="text-xl mt-0.5">{n.emoji ?? "🔔"}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn("text-sm", !n.read_at && "font-medium")}>
            {n.title}
          </p>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] capitalize",
              CATEGORY_COLORS[n.category]
            )}
          >
            {n.category}
          </Badge>
          {!n.read_at && (
            <span className="text-[10px] font-semibold text-primary uppercase">Nuevo</span>
          )}
        </div>
        {n.body && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground/60">{timeAgo(n.created_at)}</p>
      </div>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
        aria-label="Eliminar"
        className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </Card>
  );

  return (
    <li>
      {n.link ? (
        <Link href={n.link} onClick={() => { if (!n.read_at) onRead(); }} className="block">
          {Inner}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => { if (!n.read_at) onRead(); }}
          className="block w-full text-left"
        >
          {Inner}
        </button>
      )}
    </li>
  );
}

function ActivityCard({
  label, groups,
}: { label: string; groups: { category: string; count: number; preview: any[] }[] }) {
  const total = groups.reduce((acc, g) => acc + g.count, 0);
  return (
    <Card className="border-border/60 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-medium text-sm">{label}</p>
        <Badge variant="outline" className="text-[10px]">{total} eventos</Badge>
      </div>
      <ul className="space-y-2">
        {groups.map((g) => (
          <li key={g.category} className="flex items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground shrink-0">
              {g.count}
            </span>
            <span className="text-xs capitalize text-muted-foreground">
              {g.category}
            </span>
            <span className="text-xs text-foreground/80 line-clamp-1 flex-1">
              {g.preview[0]?.title}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
}
