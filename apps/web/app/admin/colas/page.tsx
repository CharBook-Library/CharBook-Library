"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity, AlertOctagon, AlertTriangle, CheckCircle2, Clock,
  ListOrdered, Loader2, Pause, Play, RefreshCw, RotateCcw,
  ShieldAlert, Timer, Trash2, XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi, type HealthLevel, type QueueJobItem } from "@/lib/api-admin";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const LEVEL_META: Record<HealthLevel, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  ok: { label: "Operativa", icon: CheckCircle2, cls: "text-emerald-500" },
  warning: { label: "Advertencia", icon: AlertTriangle, cls: "text-amber-500" },
  degraded: { label: "Degradada", icon: AlertOctagon, cls: "text-orange-500" },
  critical: { label: "Crítica", icon: XCircle, cls: "text-destructive" },
};

export default function QueueAdminPage() {
  const { user, isLoading: loadingUser } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = !!user?.is_super_admin;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["system-queue"],
    queryFn: () => adminApi.system.queueDetail(),
    enabled: isSuperAdmin,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["system-queue"] });
    queryClient.invalidateQueries({ queryKey: ["system-health"] });
  };

  const retryMutation = useMutation({
    mutationFn: (uuid?: string) => adminApi.system.retryJob(uuid),
    onSuccess: (res) => { toast.success(res.message); invalidate(); },
    onError: () => toast.error("No se pudo reencolar"),
  });

  const forgetMutation = useMutation({
    mutationFn: (uuid: string) => adminApi.system.forgetJob(uuid),
    onSuccess: (res) => { toast.success(res.message); invalidate(); },
    onError: () => toast.error("No se pudo descartar"),
  });

  const flushMutation = useMutation({
    mutationFn: () => adminApi.system.flushJobs(),
    onSuccess: (res) => { toast.success(res.message); invalidate(); },
    onError: () => toast.error("No se pudo vaciar"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => adminApi.system.cancelPendingJob(id),
    onSuccess: (res) => { toast.success(res.message); invalidate(); },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? "No se pudo cancelar"),
  });

  if (!loadingUser && user && !isSuperAdmin) {
    return (
      <div className="p-6 md:p-8">
        <Card className="border-destructive/30 bg-destructive/5 p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive/60" />
          <h1 className="font-serif text-xl font-bold">Solo Super Admin</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            La gestión de colas está restringida al super administrador.
          </p>
        </Card>
      </div>
    );
  }

  if (loadingUser || (isLoading && !data)) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-3 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const q = data!;
  const meta = LEVEL_META[q.status.status] ?? LEVEL_META.warning;
  const StatusIcon = meta.icon;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-primary" />
            <h1 className="font-serif text-2xl font-bold tracking-tight">Colas y jobs</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Estado del worker y de los trabajos en segundo plano (driver: {q.status.driver}).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")} />
          Actualizar
        </Button>
      </div>

      {/* Estado + contadores */}
      <Card className="border-border/60 bg-card p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn("h-6 w-6", meta.cls)} aria-hidden />
            <div>
              <p className={cn("font-bold leading-tight", meta.cls)}>Cola: {meta.label}</p>
              {q.status.status_reason && (
                <p className="text-[11px] text-muted-foreground">{q.status.status_reason}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {q.status.worker.active ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500">
                <Play className="h-3 w-3" /> Worker activo
                {q.status.worker.seconds_since_heartbeat != null && (
                  <span className="text-[10px] opacity-70">
                    (latido hace {q.status.worker.seconds_since_heartbeat}s)
                  </span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                <Pause className="h-3 w-3" /> Worker inactivo
                {q.status.worker.last_heartbeat && (
                  <span className="text-[10px] opacity-70">
                    (último latido {new Date(q.status.worker.last_heartbeat).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })})
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="ml-auto flex flex-wrap gap-4 text-center">
            <Counter label="Listos" value={q.status.pending_ready ?? 0} warn={(q.status.pending_ready ?? 0) > 0 && !q.status.worker.active} />
            <Counter label="Procesando" value={q.status.processing ?? 0} />
            <Counter label="Programados" value={q.status.delayed ?? 0} />
            <Counter label="Fallidos" value={q.status.failed} warn={q.status.failed > 0} />
          </div>
        </div>

        {!q.status.worker.active && (
          <p className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            💡 Para arrancar el worker ejecuta <code className="rounded bg-background px-1 py-0.5 font-mono text-primary">php artisan queue:work</code> en el servidor
            (o configura un supervisor en producción). El panel lo detectará automáticamente por su heartbeat.
          </p>
        )}
      </Card>

      {/* Listas */}
      <div className="grid gap-3 xl:grid-cols-2">
        <JobList
          icon={<Activity className="h-3.5 w-3.5 text-primary" />}
          title="Listos para ejecutar"
          jobs={q.ready}
          emptyText="No hay jobs esperando."
          ageLabel="esperando"
          onCancel={(job) => {
            if (confirm(`¿Cancelar el job "${job.name}"? No se ejecutará.`)) {
              cancelMutation.mutate(job.id);
            }
          }}
          cancelPending={cancelMutation.isPending}
        />

        <JobList
          icon={<Timer className="h-3.5 w-3.5 text-primary" />}
          title="Programados (a futuro)"
          jobs={q.delayed}
          emptyText="No hay jobs programados."
          ageLabel="se ejecuta en"
          useAvailableIn
          onCancel={(job) => {
            if (confirm(`¿Cancelar el job programado "${job.name}"? No se ejecutará.`)) {
              cancelMutation.mutate(job.id);
            }
          }}
          cancelPending={cancelMutation.isPending}
        />

        <JobList
          icon={<Loader2 className="h-3.5 w-3.5 text-primary" />}
          title="En proceso"
          jobs={q.processing}
          emptyText="Ningún job ejecutándose ahora mismo."
          ageLabel="en curso"
        />

        {/* Fallidos */}
        <Card className="border-border/60 bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5 text-destructive/70" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Fallidos
              </h2>
              <span className="text-[10px] text-muted-foreground tabular-nums">{q.failed.total}</span>
            </div>
            {q.failed.total > 0 && (
              <div className="flex gap-1.5">
                <Button variant="outline" size="xs" disabled={retryMutation.isPending}
                  onClick={() => retryMutation.mutate(undefined)}>
                  {retryMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                  Reintentar todos
                </Button>
                <Button variant="outline" size="xs" disabled={flushMutation.isPending}
                  onClick={() => {
                    if (confirm("¿Eliminar TODOS los jobs fallidos sin reintentarlos?")) flushMutation.mutate();
                  }}
                  aria-label="Vaciar fallidos">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          {q.failed.jobs.length === 0 ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <p className="text-xs text-muted-foreground">No hay jobs fallidos registrados.</p>
            </div>
          ) : (
            <div className="mt-2 max-h-64 divide-y divide-border/50 overflow-y-auto pr-1">
              {q.failed.jobs.map((j) => (
                <div key={j.uuid} className="flex items-start gap-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-mono text-[11px] leading-snug text-foreground/90">
                      {j.exception || "(sin detalle)"}
                    </p>
                    <p className="text-[9px] text-muted-foreground/60">
                      {j.queue} · <span className="tabular-nums">{j.failed_at}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      onClick={() => retryMutation.mutate(j.uuid)}
                      disabled={retryMutation.isPending}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                      title="Reintentar" aria-label="Reintentar job"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => { if (confirm("¿Descartar este job fallido?")) forgetMutation.mutate(j.uuid); }}
                      disabled={forgetMutation.isPending}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      title="Descartar" aria-label="Descartar job"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <p className="text-[10px] text-muted-foreground/70">
        Última actualización: {new Date(q.generated_at).toLocaleTimeString("es")} · se refresca cada 15 s ·{" "}
        <Link href="/admin/sistema" className="text-primary hover:underline">volver a Salud del sistema</Link>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
function Counter({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <p className={cn("text-xl font-bold tabular-nums leading-none", warn && "text-amber-500")}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function JobList({
  icon,
  title,
  jobs,
  emptyText,
  ageLabel,
  useAvailableIn,
  onCancel,
  cancelPending,
}: {
  icon: React.ReactNode;
  title: string;
  jobs: QueueJobItem[];
  emptyText: string;
  ageLabel: string;
  useAvailableIn?: boolean;
  onCancel?: (job: QueueJobItem) => void;
  cancelPending?: boolean;
}) {
  return (
    <Card className="border-border/60 bg-card p-4">
      <div className="flex items-center gap-1.5">
        {icon}
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        <span className="text-[10px] text-muted-foreground tabular-nums">{jobs.length}</span>
      </div>
      {jobs.length === 0 ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-border/50 bg-card/40 px-3 py-2.5">
          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">{emptyText}</p>
        </div>
      ) : (
        <div className="mt-2 max-h-64 divide-y divide-border/50 overflow-y-auto pr-1">
          {jobs.map((j) => (
            <div key={j.id} className="flex items-center gap-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[11px] text-foreground/90">{j.name}</p>
                <p className="text-[9px] text-muted-foreground/60 tabular-nums">
                  cola {j.queue} · {ageLabel}{" "}
                  {formatSeconds(useAvailableIn ? j.available_in_seconds : j.age_seconds)}
                  {j.attempts > 0 && ` · ${j.attempts} intento(s)`}
                </p>
              </div>
              {onCancel && (
                <button
                  onClick={() => onCancel(j)}
                  disabled={cancelPending}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  title="Cancelar job" aria-label="Cancelar job"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} día(s)`;
}
