"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { notificationsApi } from "@/lib/api-inbox";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export function NotificationsDropdown() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const autoReadFired = useRef(false);

  const { data: count = 0 } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => notificationsApi.unreadCount().catch(() => 0),
    enabled: isAuthenticated,
    refetchInterval: 25_000, // refresca cada 25 s para casi tiempo-real
    staleTime: 10_000,
    retry: false,
    refetchOnWindowFocus: true,
  });

  const { data: list, isLoading } = useQuery({
    queryKey: ["notifications-recent"],
    queryFn: () => notificationsApi.list({ page: 1 }).catch(() => ({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } })),
    enabled: isAuthenticated && open,
    retry: false,
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.readAll(),
    onMutate: async () => {
      // Optimistic: el badge desaparece al instante
      await queryClient.cancelQueries({ queryKey: ["notifications-count"] });
      queryClient.setQueryData(["notifications-count"], 0);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-recent"] });
    },
  });

  const markOne = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-recent"] });
    },
  });

  // Al abrir el dropdown, marca todo como leído automáticamente.
  // Se vuelve a permitir disparar cuando se cierra.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && !autoReadFired.current && count > 0) {
      autoReadFired.current = true;
      markAll.mutate();
    }
    if (!next) {
      // permite re-disparar si vuelve a llegar algo nuevo
      autoReadFired.current = false;
    }
  };

  if (!isAuthenticated) return null;

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] max-w-[calc(100vw-2rem)] p-0">
        {/* Header del dropdown */}
        <div className="border-b border-border/60 px-3 py-2.5">
          <p className="font-medium text-sm">Notificaciones</p>
        </div>

        {/* Lista */}
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !list?.data.length ? (
            <div className="py-10 text-center">
              <Bell className="mx-auto h-7 w-7 text-muted-foreground/30" />
              <p className="mt-3 text-xs text-muted-foreground">Sin notificaciones</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {list.data.slice(0, 8).map((n) => {
                const content = (
                  <div className={cn(
                    "flex gap-2.5 px-3 py-2.5 transition-colors hover:bg-accent/50",
                    !n.read_at && "bg-primary/5"
                  )}>
                    <span className="text-base mt-0.5">{n.emoji ?? "🔔"}</span>
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        "text-xs leading-snug line-clamp-2",
                        !n.read_at ? "font-medium text-foreground" : "text-muted-foreground"
                      )}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground/80">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-muted-foreground/60">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    {!n.read_at && (
                      <span className="h-1.5 w-1.5 mt-1 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                );

                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => {
                          if (!n.read_at) markOne.mutate(n.id);
                          setOpen(false);
                        }}
                        className="block"
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!n.read_at) markOne.mutate(n.id);
                        }}
                        className="block w-full text-left"
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/60 px-3 py-2">
          <Link
            href="/notificaciones"
            onClick={() => setOpen(false)}
            className="block w-full rounded-md py-1.5 text-center text-xs font-medium text-primary hover:bg-primary/10"
          >
            Ver todas las notificaciones
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
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
