"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Inbox, Search, Clock, Trophy, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { staffApi } from "@/lib/api-creator";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  { key: "pending", label: "Pendientes" },
  { key: "changes_requested", label: "Cambios solicitados" },
  { key: "approved", label: "Aprobadas" },
  { key: "rejected", label: "Rechazadas" },
  { key: "all", label: "Todas" },
];

export default function AdminCreatorAppsPage() {
  const t = useTranslations("admin.creator_apps");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-creator-apps", { status, search, page }],
    queryFn: () => staffApi.creatorApps.list({ status, search, page }),
  });

  const tierMutation = useMutation({
    mutationFn: ({ userId, tier }: { userId: number; tier: "none" | "featured" }) =>
      staffApi.users.setCreatorTier(userId, tier),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["admin-creator-apps"] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? "No se pudo actualizar"),
  });

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.key}
              variant={status === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => { setStatus(f.key); setPage(1); }}
              className={status === f.key ? "bg-primary text-primary-foreground" : "border-border/60"}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email, pen name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10"
          />
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : !data?.data.length ? (
        <Card className="border-dashed border-border/60 bg-card/50 py-16 text-center">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t("no_apps")}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.data.map((app) => (
            <Card key={app.id} className="border-border/60 bg-card p-4 transition-colors hover:border-primary/40">
              <div className="flex items-center gap-4">
                <Link href={`/admin/solicitudes-creador/${app.id}`} className="flex items-center gap-4 min-w-0 flex-1">
                  <Avatar className="h-12 w-12 shrink-0 border border-border/60">
                    <AvatarImage src={app.user?.avatar ?? undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {app.user?.name?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{app.display_name}</span>
                      {app.pen_name && (
                        <span className="text-xs text-muted-foreground italic">
                          "{app.pen_name}"
                        </span>
                      )}
                      <StatusBadge status={app.status} />
                      {app.user?.creator_tier === "featured" && (
                        <Badge className="text-[10px] border bg-amber-500/20 text-amber-500 border-amber-500/40">
                          🏆 Destacado
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      @{app.user?.username} · {app.user?.email}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Hace {daysSince(app.submitted_at)} día{daysSince(app.submitted_at) === 1 ? "" : "s"}
                      </span>
                      <span>· {app.genres.length} géneros</span>
                      <span>· {app.languages.length} idiomas</span>
                    </div>
                  </div>
                </Link>

                {app.score.total !== null && (
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-muted-foreground">Score</div>
                    <div className={cn(
                      "text-lg font-bold",
                      app.score.total >= 8 ? "text-emerald-400" : "text-amber-400"
                    )}>
                      {app.score.total}/12
                    </div>
                  </div>
                )}

                {/* Acciones rápidas: solo para aprobados */}
                {app.status === "approved" && app.user && (
                  <div className="shrink-0">
                    {app.user.creator_tier === "featured" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={tierMutation.isPending}
                        onClick={() => tierMutation.mutate({ userId: app.user!.id, tier: "none" })}
                        className="border-border/60 hover:border-destructive/40 hover:text-destructive"
                      >
                        <X className="mr-1.5 h-3.5 w-3.5" />
                        Quitar destacado
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={tierMutation.isPending}
                        onClick={() => tierMutation.mutate({ userId: app.user!.id, tier: "featured" })}
                        className="bg-amber-500 text-amber-950 hover:bg-amber-500/90"
                      >
                        <Trophy className="mr-1.5 h-3.5 w-3.5" />
                        Destacar
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}

          {data.meta.last_page > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground px-3">
                {data.meta.current_page} / {data.meta.last_page}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.meta.last_page}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pendiente", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    changes_requested: { label: "Cambios", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    approved: { label: "Aprobada", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    rejected: { label: "Rechazada", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  };
  const meta = map[status] ?? { label: status, cls: "" };
  return <Badge className={`border ${meta.cls} text-[10px]`}>{meta.label}</Badge>;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}
