"use client";

import { Suspense, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Inbox, Star, Archive, Search, ChevronLeft, Trash2,
  CheckCircle2, Mail, MailOpen, MessageCircle, Loader2,
  ExternalLink,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { messagesApi } from "@/lib/api-inbox";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { CATEGORY_META } from "@/components/inbox/shared";
import type { MessageCategory } from "@/lib/types";

const VIEWS: { key: string; label: string; icon: typeof Inbox }[] = [
  { key: "inbox", label: "Bandeja", icon: Inbox },
  { key: "important", label: "Importantes", icon: Star },
  { key: "archived", label: "Archivados", icon: Archive },
];

const CAT_ORDER: MessageCategory[] = [
  "review", "report", "achievement", "event", "tip", "platform",
];

export default function MessagesPage() {
  // useSearchParams() forces a CSR bailout during prerender, so it must live
  // under a Suspense boundary or `next build` aborts the static export.
  return (
    <Suspense fallback={null}>
      <MessagesPageContent />
    </Suspense>
  );
}

function MessagesPageContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [view, setView] = useState("inbox");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const fromUrl = searchParams.get("id");
    return fromUrl ? Number(fromUrl) : null;
  });

  const { data: counts } = useQuery({
    queryKey: ["messages-counts"],
    queryFn: () => messagesApi.counts(),
    enabled: isAuthenticated,
  });

  const { data: list, isLoading: loadingList } = useQuery({
    queryKey: ["messages", { view, category, search }],
    queryFn: () => messagesApi.list({ view, category, search, page: 1 }),
    enabled: isAuthenticated,
  });

  const { data: selected, isLoading: loadingSelected } = useQuery({
    queryKey: ["message", selectedId],
    queryFn: () => messagesApi.get(selectedId as number),
    enabled: !!selectedId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["messages"] });
    queryClient.invalidateQueries({ queryKey: ["messages-counts"] });
    queryClient.invalidateQueries({ queryKey: ["messages-recent"] });
    if (selectedId) {
      queryClient.invalidateQueries({ queryKey: ["message", selectedId] });
    }
  };

  const action = useMutation({
    mutationFn: ({ id, action }: { id: number; action: any }) =>
      messagesApi.action(id, action),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => messagesApi.remove(id),
    onSuccess: () => {
      toast.success("Mensaje eliminado");
      setSelectedId(null);
      invalidate();
    },
  });

  if (isLoading) {
    return <div className="p-6"><Skeleton className="h-96" /></div>;
  }
  if (!isAuthenticated) {
    return (
      <div className="container max-w-2xl mx-auto p-6 text-center">
        <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">
          Inicia sesión para ver tu bandeja.
        </p>
        <Button asChild className="mt-4"><Link href="/login">Iniciar sesión</Link></Button>
      </div>
    );
  }

  // Mobile: mostrar detalle si hay seleccionado
  const showDetailMobile = !!selectedId;

  return (
    <div className="container max-w-7xl mx-auto p-3 md:p-6">
      <header className="mb-4">
        <h1 className="font-serif text-2xl font-bold tracking-tight md:text-3xl">
          Mensajes
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Centro de comunicaciones — revisiones, reportes, logros y novedades de CharBook.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-[200px_1fr_minmax(0,1.4fr)] md:gap-4">
        {/* ═══════ SIDEBAR ═══════ */}
        <aside className={cn("space-y-4", showDetailMobile && "hidden md:block")}>
          {/* Vistas */}
          <div className="space-y-0.5">
            {VIEWS.map((v) => {
              const Icon = v.icon;
              const active = view === v.key;
              const badge =
                v.key === "inbox" ? counts?.unread :
                v.key === "important" ? counts?.important :
                v.key === "archived" ? counts?.archived :
                undefined;
              return (
                <button
                  key={v.key}
                  onClick={() => { setView(v.key); setSelectedId(null); }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" /> {v.label}
                  </span>
                  {badge != null && badge > 0 && (
                    <span className="text-[10px] tabular-nums">{badge}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Categorías */}
          <div>
            <p className="px-2 mb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
              Categorías
            </p>
            <div className="space-y-0.5">
              <button
                onClick={() => setCategory("all")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                  category === "all"
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                )}
              >
                Todas
              </button>
              {CAT_ORDER.map((c) => {
                const meta = CATEGORY_META[c];
                const count = counts?.by_category[c] ?? 0;
                const active = category === c;
                return (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs",
                      active
                        ? "bg-accent text-foreground font-medium"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <meta.icon className={cn("h-3 w-3", meta.iconCls)} />
                      {meta.label}
                    </span>
                    {count > 0 && (
                      <span className="text-[10px] tabular-nums">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ═══════ LISTA ═══════ */}
        <div className={cn(showDetailMobile && "hidden md:block")}>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar mensajes..."
              className="h-9 w-full rounded-md border border-border/60 bg-background pl-8 pr-3 text-xs outline-none focus-visible:border-primary/50"
            />
          </div>

          {loadingList ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-md" />)}
            </div>
          ) : !list?.data.length ? (
            <Card className="border-dashed border-border/60 bg-card/40 py-12 text-center">
              <Inbox className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 text-xs text-muted-foreground">
                {search ? `Sin resultados para "${search}"` : "Bandeja vacía"}
              </p>
            </Card>
          ) : (
            <ul className="space-y-1.5">
              {list.data.map((m) => {
                const meta = CATEGORY_META[m.category];
                const isSelected = selectedId === m.id;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className={cn(
                        "block w-full rounded-md border p-3 text-left transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : !m.is_read
                            ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                            : "border-border/60 bg-card hover:border-primary/30"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                          meta.bgCls
                        )}>
                          <meta.icon className={cn("h-3.5 w-3.5", meta.iconCls)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {!m.is_read ? (
                              <Mail className="h-3 w-3 text-amber-500 shrink-0" />
                            ) : (
                              <MailOpen className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                            )}
                            <p className={cn(
                              "line-clamp-1 text-xs",
                              !m.is_read ? "font-semibold" : "text-muted-foreground"
                            )}>
                              {m.subject}
                            </p>
                            {m.is_important && (
                              <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                            )}
                            {m.priority === "urgent" && (
                              <Badge variant="outline" className="border-destructive/40 text-destructive text-[9px]">
                                Urgente
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground leading-snug">
                            {m.preview}
                          </p>
                          <p className="mt-1.5 text-[10px] text-muted-foreground/60">
                            {m.sender_name} · {timeAgo(m.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ═══════ DETALLE ═══════ */}
        <div className={cn(!showDetailMobile && "hidden md:block")}>
          {!selectedId ? (
            <Card className="border-dashed border-border/60 bg-card/40 flex items-center justify-center min-h-[400px] text-center">
              <div>
                <Inbox className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Selecciona un mensaje para leerlo
                </p>
              </div>
            </Card>
          ) : loadingSelected || !selected ? (
            <Card className="p-6">
              <Skeleton className="h-8 w-3/4 mb-3" />
              <Skeleton className="h-32" />
            </Card>
          ) : (
            <Card className="border-border/60 bg-card overflow-hidden flex flex-col h-full">
              {/* Header del mensaje */}
              <div className="border-b border-border/60 p-4">
                <button
                  className="md:hidden inline-flex items-center gap-1 text-xs text-muted-foreground mb-2"
                  onClick={() => setSelectedId(null)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Volver
                </button>

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {(() => {
                        const meta = CATEGORY_META[selected.category as MessageCategory];
                        return (
                          <Badge variant="outline" className={cn(
                            "gap-1",
                            CATEGORY_META[selected.category as MessageCategory].iconCls
                          )}>
                            <meta.icon className="h-3 w-3" />
                            {meta.label}
                          </Badge>
                        );
                      })()}
                      {selected.priority === "urgent" && (
                        <Badge variant="outline" className="border-destructive/40 text-destructive">
                          Urgente
                        </Badge>
                      )}
                      {selected.priority === "high" && (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-500">
                          Alta prioridad
                        </Badge>
                      )}
                    </div>
                    <h2 className="font-serif text-lg font-bold leading-tight">
                      {selected.subject}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      De: <strong className="text-foreground/80">{selected.sender_name}</strong>
                      {" · "}
                      {new Date(selected.created_at).toLocaleString("es", {
                        year: "numeric", month: "long", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {/* Acciones rápidas */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => action.mutate({
                        id: selected.id,
                        action: selected.is_important ? "unimportant" : "important",
                      })}
                      title={selected.is_important ? "Quitar importante" : "Marcar importante"}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Star className={cn(
                        "h-3.5 w-3.5",
                        selected.is_important && "fill-amber-500 text-amber-500"
                      )} />
                    </button>
                    <button
                      onClick={() => action.mutate({
                        id: selected.id,
                        action: selected.is_archived ? "unarchive" : "archive",
                      })}
                      title={selected.is_archived ? "Desarchivar" : "Archivar"}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Eliminar este mensaje?")) remove.mutate(selected.id);
                      }}
                      title="Eliminar"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 flex-1 overflow-y-auto">
                <div className="whitespace-pre-line text-sm leading-relaxed text-foreground/90 font-serif">
                  {selected.body}
                </div>

                {/* Adjuntos */}
                {selected.attachments && selected.attachments.length > 0 && (
                  <div className="mt-6 border-t border-border/60 pt-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                      Adjuntos
                    </p>
                    <ul className="space-y-1.5">
                      {selected.attachments.map((a, i) => (
                        <li key={i}>
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {a.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Acciones del mensaje */}
                {selected.actions && selected.actions.length > 0 && (
                  <div className="mt-6 border-t border-border/60 pt-4 flex flex-wrap gap-2">
                    {selected.actions.map((a, i) => (
                      <Button
                        key={i}
                        asChild
                        size="sm"
                        variant={a.variant === "outline" ? "outline" : a.variant === "destructive" ? "destructive" : "default"}
                      >
                        <Link href={a.href}>{a.label}</Link>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
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
