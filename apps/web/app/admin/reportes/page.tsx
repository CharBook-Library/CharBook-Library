"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Flag, ChevronLeft, ChevronRight, X, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { staffApi } from "@/lib/api-creator";
import type { Report } from "@/lib/types";

const STATUS_TABS = [
  { key: "open", label: "Abiertos" },
  { key: "in_review", label: "En revisión" },
  { key: "resolved", label: "Resueltos" },
  { key: "dismissed", label: "Descartados" },
  { key: "all", label: "Todos" },
];

const RESOLUTION_ACTIONS = [
  { key: "warn", label: "Advertir", color: "amber" },
  { key: "hide", label: "Ocultar", color: "amber" },
  { key: "delete", label: "Eliminar", color: "red" },
  { key: "suspend_temp", label: "Suspender temporal", color: "red" },
  { key: "suspend_perm", label: "Suspender permanente", color: "red" },
  { key: "ban", label: "Banear", color: "red" },
];

export default function AdminReportsPage() {
  const t = useTranslations("admin.reports");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("open");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Report | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports", { status, page }],
    queryFn: () => staffApi.reports.list({ status, page }),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      staffApi.reports.resolve(id, action, resolutionNotes),
    onSuccess: (res) => {
      // El backend ejecuta la acción de verdad y reporta el efecto real.
      if (res.effect && !res.effect.executed) {
        toast.warning(res.effect.message);
      } else {
        toast.success(res.effect?.message ?? "Reporte resuelto");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      setSelected(null);
      setResolutionNotes("");
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      const first = e.response?.data?.errors
        ? Object.values(e.response.data.errors)[0]?.[0]
        : e.response?.data?.message;
      toast.error(first ?? "No se pudo resolver el reporte");
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: number) => staffApi.reports.dismiss(id, resolutionNotes),
    onSuccess: () => {
      toast.success("Reporte descartado");
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      setSelected(null);
      setResolutionNotes("");
    },
  });

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={status === tab.key ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatus(tab.key); setPage(1); }}
            className={status === tab.key ? "bg-primary text-primary-foreground" : "border-border/60"}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Layout master-detail */}
      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        {/* LISTA */}
        <div className="space-y-2 min-w-0">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : !data?.data.length ? (
            <Card className="border-dashed border-border/60 py-16 text-center">
              <Flag className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t("no_reports")}</p>
            </Card>
          ) : (
            data.data.map((report) => (
              <Card
                key={report.id}
                onClick={() => setSelected(report)}
                className={`cursor-pointer border bg-card p-4 transition-colors ${
                  selected?.id === report.id ? "border-primary/60" : "border-border/60 hover:border-primary/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={report.reporter?.avatar ?? undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {report.reporter?.name?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-destructive/15 text-destructive border border-destructive/40 text-[10px] capitalize">
                        {t(`reason_${report.reason}`)}
                      </Badge>
                      <Badge variant="outline" className="border-border/60 text-[10px] capitalize">
                        {report.target_type}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <strong>@{report.reporter?.username}</strong> reportó hace{" "}
                      {daysAgo(report.created_at)} día(s)
                    </p>
                    {report.details && (
                      <p className="mt-1.5 text-xs line-clamp-2">{report.details}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}

          {data && data.meta.last_page > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </Button>
              <span className="text-sm text-muted-foreground px-3">
                {data.meta.current_page} / {data.meta.last_page}
              </span>
              <Button variant="outline" size="sm" disabled={page >= data.meta.last_page} onClick={() => setPage((p) => p + 1)}>
                Siguiente <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* DETALLE */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          {!selected ? (
            <Card className="border-dashed border-border/60 py-16 text-center">
              <Flag className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Selecciona un reporte</p>
            </Card>
          ) : (
            <Card className="border-border/60 bg-card p-5 space-y-4">
              <div>
                <h3 className="font-serif text-lg font-bold">Reporte #{selected.id}</h3>
                <p className="text-xs text-muted-foreground">
                  Tipo: <strong>{selected.target_type}</strong> · ID: {selected.target_id}
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Razón</p>
                <p className="text-sm font-medium">{t(`reason_${selected.reason}`)}</p>
              </div>

              {selected.details && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Detalles</p>
                  <p className="text-sm whitespace-pre-line">{selected.details}</p>
                </div>
              )}

              {selected.status === "open" || selected.status === "in_review" ? (
                <>
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Motivo de la resolución <span className="text-destructive">*</span>
                    </label>
                    <textarea
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      rows={3}
                      placeholder="Obligatorio: explica la decisión (queda en auditoría)..."
                      className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    />
                    {resolutionNotes.trim().length < 5 && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Escribe al menos 5 caracteres para habilitar las acciones.
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                      Acción (se ejecuta de verdad y queda en auditoría)
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {RESOLUTION_ACTIONS.map((act) => (
                        <Button
                          key={act.key}
                          variant="outline"
                          size="sm"
                          disabled={resolveMutation.isPending || resolutionNotes.trim().length < 5}
                          onClick={() => resolveMutation.mutate({ id: selected.id, action: act.key })}
                          className={
                            act.color === "red"
                              ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                              : "border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                          }
                        >
                          {act.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    disabled={dismissMutation.isPending}
                    onClick={() => dismissMutation.mutate(selected.id)}
                  >
                    {dismissMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                    Descartar reporte
                  </Button>
                </>
              ) : (
                <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                  Ya resuelto con acción: <strong>{selected.resolution_action ?? "ninguna"}</strong>
                  {selected.resolution_notes && (
                    <p className="mt-1 italic">&ldquo;{selected.resolution_notes}&rdquo;</p>
                  )}
                </div>
              )}
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function daysAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}
