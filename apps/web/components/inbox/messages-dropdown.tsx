"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Loader2, Inbox } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { messagesApi } from "@/lib/api-inbox";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { CATEGORY_META } from "./shared";

export function MessagesDropdown() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const autoReadFired = useRef(false);

  const { data: counts } = useQuery({
    queryKey: ["messages-counts"],
    queryFn: () => messagesApi.counts().catch(() => null),
    enabled: isAuthenticated,
    refetchInterval: 25_000,
    staleTime: 10_000,
    retry: false,
    refetchOnWindowFocus: true,
  });

  const { data: list, isLoading } = useQuery({
    queryKey: ["messages-recent"],
    queryFn: () => messagesApi.list({ page: 1 }).catch(() => ({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } })),
    enabled: isAuthenticated && open,
    retry: false,
  });

  const readAll = useMutation({
    mutationFn: () => messagesApi.readAll(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["messages-counts"] });
      const prev = queryClient.getQueryData<{ unread?: number } | null>(["messages-counts"]);
      if (prev) queryClient.setQueryData(["messages-counts"], { ...prev, unread: 0 });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["messages-counts"] });
      queryClient.invalidateQueries({ queryKey: ["messages-recent"] });
    },
  });

  if (!isAuthenticated) return null;
  const unread = counts?.unread ?? 0;

  // Al abrir, marcar todo como leído (badge desaparece de inmediato).
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && !autoReadFired.current && unread > 0) {
      autoReadFired.current = true;
      readAll.mutate();
    }
    if (!next) autoReadFired.current = false;
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Mensajes"
        >
          <MessageSquare className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-amber-950">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b border-border/60 px-3 py-2.5">
          <p className="font-medium text-sm">Bandeja de mensajes</p>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !list?.data.length ? (
            <div className="py-10 text-center">
              <Inbox className="mx-auto h-7 w-7 text-muted-foreground/30" />
              <p className="mt-3 text-xs text-muted-foreground">Sin mensajes</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {list.data.slice(0, 6).map((m) => {
                const meta = CATEGORY_META[m.category];
                return (
                  <li key={m.id}>
                    <Link
                      href={`/mensajes?id=${m.id}`}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex gap-2.5 px-3 py-2.5 transition-colors hover:bg-accent/50",
                        !m.is_read && "bg-amber-500/5"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs",
                          meta.bgCls
                        )}
                      >
                        <meta.icon className={cn("h-3.5 w-3.5", meta.iconCls)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className={cn(
                            "text-xs line-clamp-1",
                            !m.is_read ? "font-semibold text-foreground" : "text-muted-foreground"
                          )}>
                            {m.subject}
                          </p>
                          {m.is_important && (
                            <span className="text-amber-500 text-[10px]">★</span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                          {m.preview}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground/60">
                          {m.sender_name} · {timeAgo(m.created_at)}
                        </p>
                      </div>
                      {!m.is_read && (
                        <span className="h-1.5 w-1.5 mt-1 shrink-0 rounded-full bg-amber-500" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border/60 px-3 py-2">
          <Link
            href="/mensajes"
            onClick={() => setOpen(false)}
            className="block w-full rounded-md py-1.5 text-center text-xs font-medium text-primary hover:bg-primary/10"
          >
            Ver toda la bandeja
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
