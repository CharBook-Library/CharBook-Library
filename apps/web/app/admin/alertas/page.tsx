"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BellRing, Check, CheckCircle2, ChevronLeft, ChevronRight,
  ShieldAlert, ShieldCheck,
} from "lucide-react";
import { adminApi, type AdminAlert, type AlertSeverity } from "@/lib/api-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const SEVERITY_META: Record<AlertSeverity, { label: string; cls: string; dot: string }> = {
  critical: { label: "Crítica", cls: "border-destructive/30 bg-destructive/5", dot: "bg-destructive" },
  high: { label: "Alta", cls: "border-orange-500/30 bg-orange-500/5", dot: "bg-orange-500" },
  medium: { label: "Media", cls: "border-amber-500/30 bg-amber-500/5", dot: "bg-amber-500" },
  low: { label: "Baja", cls: "border-border/60 bg-card", dot: "bg-muted-foreground" },
};

const STATUS_LABEL: Record<string, string> = {
  new: "Nueva",
  acknowledged: "Reconocida",
  resolved: "Resuelta",
};

const STATUS_TABS = [
  { value: "open", label: "Activas" },
  { value: "new", label: "Nuevas" },
  { value: "acknowledged", label: "Reconocidas" },
  { value: "resolved", label: "Resueltas (historial)" },
];

const SEVERITY_TABS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "critical", label: "Críticas" },
  { value: "high", label: "Altas" },
  { value: "medium", label: "Medias" },
  { value: "low", label: "Bajas" },
];

export default function AlertCenterPage() {
  const { user, isLoading: loadingUser } = useAuth();
  const isSuperAdmin = !!user?.is_super_admin;
  const queryClient = useQueryClient();

  const [status, setStatus] = useState("open");
  const [severity, setSeverity] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "alerts", { status, severity, page }],
    queryFn: () => adminApi.alerts.list({ status, severity: severity || undefined, page }),
    enabled: isSuperAdmin,
    refetchInterval: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "alerts"] });
  };

  const ackMutation = useMutation({
    mutationFn: (id: number) => adminApi.alerts.acknowledge(id),
    onSuccess: (res) => { toast.success(res.message); invalidate(); },
    onError: () => toast.error("No se pudo reconocer la alerta"),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => adminApi.alerts.resolve(id),
    onSuccess: (res) => { toast.success(res.message); invalidate(); },
    onError: () => toast.error("No se pudo resolver la alerta"),
  });

  if (!loadingUser && user && !isSuperAdmin) {
    return (
      <div className="p-6 md:p-8">
        <Card className="border-destructive/30 bg-destructive/5 p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive/60" />
          <h1 className="font-serif text-xl font-bold">Solo Super Admin</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            El centro de alertas contiene información sensible de operación.
          </p>
        </Card>
      </div>
    );
  }

  const alerts = data?.data ?? [];
  const busy = ackMutation.isPending || resolveMutation.isPending;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <BellRing className="h-5 w-5 text-primary" />
        <h1 className="font-serif text-2xl font-bold tracking-tight">Centro de alertas</h1>
        {data && (
          <span className="text-xs text-muted-foreground tabular-nums">· {data.meta.total} registros</span>
        )}
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        Historial persistente de incidencias de sistema y seguridad. Cada alerta indica qué
        ocurrió, cuándo, su severidad, el servicio afectado, la acción recomendada y su estado.
      </p>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => { setStatus(t.value); setPage(1); }}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                status === t.value ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 hover:bg-muted/50"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          {SEVERITY_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => { setSeverity(t.value); setPage(1); }}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                severity === t.value ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 hover:bg-muted/50"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-card/40 py-16 text-center">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-emerald-500/50" />
          <p className="text-sm text-muted-foreground">
            {status === "resolved" ? "No hay historial resuelto en este filtro."
              : "Sin alertas en este filtro. Todo en orden."}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <AlertRow
              key={a.id}
              alert={a}
              busy={busy}
              onAck={() => ackMutation.mutate(a.id)}
              onResolve={() => resolveMutation.mutate(a.id)}
            />
          ))}
        </div>
      )}

      {/* Paginación */}
      {data && data.meta.last_page > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="px-3 text-muted-foreground">Página {data.meta.current_page} de {data.meta.last_page}</span>
          <Button variant="outline" size="sm" disabled={page >= data.meta.last_page} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function AlertRow({
  alert, busy, onAck, onResolve,
}: {
  alert: AdminAlert; busy: boolean; onAck: () => void; onResolve: () => void;
}) {
  const meta = SEVERITY_META[alert.severity];
  const resolved = alert.status === "resolved";

  return (
    <Card className={cn("border p-3", resolved ? "border-border/50 bg-card/40 opacity-80" : meta.cls)}>
      <div className="flex flex-wrap items-start gap-3">
        <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", resolved ? "bg-emerald-500" : meta.dot)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold">{alert.title}</span>
            <span className="rounded border border-border/50 px-1.5 py-0.5 text-[10px] font-medium">{meta.label}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{alert.service}</span>
            <span className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium",
              alert.status === "new" ? "bg-primary/15 text-primary"
                : alert.status === "acknowledged" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            )}>
              {STATUS_LABEL[alert.status]}
            </span>
            {alert.occurrences > 1 && (
              <span className="text-[10px] text-muted-foreground">×{alert.occurrences}</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{alert.message}</p>
          {alert.recommended_action && (
            <p className="mt-1 text-[11px] text-foreground/70">
              <span className="font-semibold">Acción: </span>{alert.recommended_action}
            </p>
          )}
          <p className="mt-1 text-[10px] text-muted-foreground/70">
            {alert.first_seen_at && <>Detectada {fmt(alert.first_seen_at)}</>}
            {alert.last_seen_at && alert.occurrences > 1 && <> · vista {fmt(alert.last_seen_at)}</>}
            {alert.acknowledged_by && <> · reconocida por {alert.acknowledged_by.name}</>}
            {alert.resolved_at && <> · resuelta {fmt(alert.resolved_at)}</>}
          </p>
        </div>

        {!resolved && (
          <div className="flex shrink-0 gap-1.5">
            {alert.status === "new" && (
              <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" disabled={busy} onClick={onAck}>
                <Check className="mr-1 h-3 w-3" /> Reconocer
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" disabled={busy} onClick={onResolve}>
              <CheckCircle2 className="mr-1 h-3 w-3" /> Resolver
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
