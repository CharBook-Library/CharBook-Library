"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertOctagon, AlertTriangle, Archive, BookX, CheckCircle2,
  CircleDollarSign, Clock, Cpu, Database, ExternalLink,
  FileScan, FileWarning, Globe, HardDrive, Layers, Loader2, RefreshCw,
  RotateCcw, Search, ShieldAlert, ShieldCheck, Trash2, TrendingUp,
  UserPlus, Wifi, XCircle, Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminApi,
  type DayCount,
  type HealthLevel,
  type SystemAlert,
  type SystemHealth,
} from "@/lib/api-admin";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Config del refresco (persistida en localStorage)
// ─────────────────────────────────────────────
const REFRESH_STORAGE_KEY = "cb_health_refresh";

const REFRESH_OPTIONS: { value: string; label: string }[] = [
  { value: "15000", label: "Auto: 15 s" },
  { value: "30000", label: "Auto: 30 s" },
  { value: "60000", label: "Auto: 1 min" },
  { value: "custom", label: "Personalizado…" },
  { value: "0", label: "Solo manual" },
];

const clampSeconds = (n: number) => Math.min(3600, Math.max(5, Math.round(n) || 5));

function loadRefreshPrefs(): { mode: string; customSeconds: number } {
  const fallback = { mode: "30000", customSeconds: 45 };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(REFRESH_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { mode?: string; customSeconds?: number };
    const mode = REFRESH_OPTIONS.some((o) => o.value === parsed.mode)
      ? parsed.mode!
      : fallback.mode;
    return { mode, customSeconds: clampSeconds(parsed.customSeconds ?? 45) };
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────
// Vocabulario de estados: icono + texto, nunca solo color
// ─────────────────────────────────────────────
const LEVEL_META: Record<
  HealthLevel,
  { label: string; icon: typeof CheckCircle2; text: string; chip: string }
> = {
  ok: {
    label: "Operativo",
    icon: CheckCircle2,
    text: "text-emerald-500",
    chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  },
  warning: {
    label: "Advertencia",
    icon: AlertTriangle,
    text: "text-amber-500",
    chip: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  },
  degraded: {
    label: "Degradado",
    icon: AlertOctagon,
    text: "text-orange-500",
    chip: "border-orange-500/40 bg-orange-500/10 text-orange-500",
  },
  critical: {
    label: "Crítico",
    icon: XCircle,
    text: "text-destructive",
    chip: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

const COMPONENT_LABELS: Record<string, string> = {
  db: "Base de datos",
  cache: "Cache",
  storage: "Storage",
  disk: "Disco",
  queue: "Cola",
  scheduler: "Scheduler",
  stripe: "Stripe",
  meilisearch: "Búsqueda",
};

const FILE_ISSUE_LABELS: Record<string, string> = {
  archivo_faltante: "Archivo faltante",
  epub_invalido: "EPUB inválido",
  pdf_ilegible: "PDF ilegible",
  portada_faltante: "Portada faltante",
  publicado_sin_archivo: "Publicado sin archivo",
};

const nf = Intl.NumberFormat("es", { notation: "compact" });

export default function SystemHealthPage() {
  const { user, isLoading: loadingUser } = useAuth();
  const queryClient = useQueryClient();

  // Lazy init desde localStorage (en SSR usa el fallback; el <select> lleva
  // suppressHydrationWarning porque el valor puede diferir del HTML servido).
  const [refreshPrefs, setRefreshPrefs] = useState(loadRefreshPrefs);
  const { mode, customSeconds } = refreshPrefs;

  useEffect(() => {
    try {
      localStorage.setItem(REFRESH_STORAGE_KEY, JSON.stringify(refreshPrefs));
    } catch {
      // sin localStorage → simplemente no persiste
    }
  }, [refreshPrefs]);

  const refreshMs =
    mode === "custom" ? clampSeconds(customSeconds) * 1000 : Number(mode);

  const isSuperAdmin = !!user?.is_super_admin;

  const { data, isLoading, isError, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["system-health"],
    queryFn: () => adminApi.system.health(),
    enabled: isSuperAdmin,
    refetchInterval: refreshMs || false,
    refetchIntervalInBackground: false,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["system-health"] });

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
    onError: () => toast.error("No se pudo vaciar la lista"),
  });

  const clearLogsMutation = useMutation({
    mutationFn: () => adminApi.system.clearLogs(),
    onSuccess: (res) => { toast.success(res.message); invalidate(); },
    onError: () => toast.error("No se pudo vaciar el log"),
  });

  const clearMetricsMutation = useMutation({
    mutationFn: () => adminApi.system.clearMetrics(),
    onSuccess: (res) => { toast.success(res.message); invalidate(); },
    onError: () => toast.error("No se pudieron vaciar las métricas"),
  });

  const scanMutation = useMutation({
    mutationFn: () => adminApi.system.runFileScan(),
    onSuccess: (res) => { toast.success(res.message); invalidate(); },
    onError: () => toast.error("No se pudo ejecutar el análisis"),
  });

  const ackMutation = useMutation({
    mutationFn: ({ id, acked }: { id: string; acked: boolean }) =>
      adminApi.system.ackAlert(id, acked),
    onSuccess: (res) => { toast.success(res.message); invalidate(); },
    onError: () => toast.error("No se pudo actualizar la alerta"),
  });

  // ───── Gate: solo super admin (Laravel valida también) ─────
  if (!loadingUser && user && !isSuperAdmin) {
    return (
      <div className="p-6 md:p-8">
        <Card className="border-destructive/30 bg-destructive/5 p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive/60" />
          <h1 className="font-serif text-xl font-bold">Solo Super Admin</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            La salud del sistema contiene información sensible de producción y
            solo está disponible para el super administrador.
          </p>
        </Card>
      </div>
    );
  }

  if (loadingUser || (isLoading && !data)) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-3 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ───── Error recuperable: la API falló (500/timeout/red) ─────
  // Sin este guard, `data` indefinido rompía el render completo (TypeError).
  if (isError || !data) {
    return (
      <div className="p-6 md:p-8">
        <Card className="border-destructive/30 bg-destructive/5 p-8 text-center">
          <XCircle className="mx-auto mb-3 h-10 w-10 text-destructive/60" />
          <h1 className="font-serif text-xl font-bold">
            No se pudo cargar la salud del sistema
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            La API no respondió correctamente. Puede ser un fallo temporal del
            servidor o de la conexión; vuelve a intentarlo.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")}
            />
            Reintentar
          </Button>
        </Card>
      </div>
    );
  }

  const h: SystemHealth = data;
  const secondsAgo = secondsSince(dataUpdatedAt);
  const overall = LEVEL_META[h.overall.status] ?? LEVEL_META.warning;
  const OverallIcon = overall.icon;
  const activeAlerts = h.alerts.filter((a) => !a.acked);
  const ackedAlerts = h.alerts.filter((a) => a.acked);

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ═══════ BANNER: ESTADO GENERAL ═══════ */}
      <Card
        className={cn(
          "space-y-3 border p-4",
          overall.chip.split(" ").filter((c) => c.startsWith("border-") || c.startsWith("bg-")).join(" ")
        )}
      >
        {/* Fila 1: estado a la izquierda, controles de refresco a la derecha */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-2.5">
            <OverallIcon className={cn("h-7 w-7", overall.text)} aria-hidden />
            <div>
              <p className={cn("text-lg font-bold leading-tight", overall.text)}>
                Sistema: {overall.label}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {activeAlerts.length === 0
                  ? "Sin alertas activas"
                  : `${activeAlerts.length} alerta(s) activa(s)`}{" "}
                · comprobado hace {secondsAgo}s
              </p>
            </div>
          </div>

          {/* Controles de refresco */}
          <div className="flex items-center gap-2">
          <select
            value={mode}
            onChange={(e) => setRefreshPrefs((p) => ({ ...p, mode: e.target.value }))}
            className="h-8 rounded-md border border-border/60 bg-card px-2 text-xs"
            title="Frecuencia de actualización automática"
            aria-label="Frecuencia de actualización automática"
            suppressHydrationWarning
          >
            {REFRESH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {mode === "custom" && (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={5}
                max={3600}
                value={customSeconds}
                onChange={(e) =>
                  setRefreshPrefs((p) => ({ ...p, customSeconds: Number(e.target.value) }))
                }
                onBlur={() =>
                  setRefreshPrefs((p) => ({ ...p, customSeconds: clampSeconds(p.customSeconds) }))
                }
                className="h-8 w-16 rounded-md border border-border/60 bg-card px-2 text-xs tabular-nums outline-none focus-visible:border-primary/50"
                title="Cada cuántos segundos se actualiza (5–3600)"
                aria-label="Segundos entre actualizaciones"
              />
              <span className="text-[10px] text-muted-foreground">s</span>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")} />
            Actualizar ahora
          </Button>
          </div>
        </div>

        {/* Fila 2: componentes con icono + texto (no solo color) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(h.overall.components).map(([key, level]) => {
            const meta = LEVEL_META[level as HealthLevel] ?? LEVEL_META.warning;
            const Icon = meta.icon;
            return (
              <span
                key={key}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  meta.chip
                )}
                title={`${COMPONENT_LABELS[key] ?? key}: ${meta.label}`}
              >
                <Icon className="h-2.5 w-2.5" aria-hidden />
                {COMPONENT_LABELS[key] ?? key}
              </span>
            );
          })}
        </div>
      </Card>

      {/* ═══════ FILA 1: tira de estado ═══════ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MiniTile
          icon={Zap}
          label="API"
          level={h.api.ok ? "ok" : "critical"}
          headline={h.api.ok ? "Operativa" : "Con fallos"}
          detail={`BD ${h.api.db.latency_ms ?? "—"} ms · cache ${h.api.cache.latency_ms ?? "—"} ms`}
          title={`Laravel ${h.api.laravel} · PHP ${h.api.php} · ${h.api.environment}${h.api.debug ? " · debug ON" : ""}${h.api.db.active_connections != null ? ` · ${h.api.db.active_connections} conexiones BD` : ""}`}
        />
        <MiniTile
          icon={RotateCcw}
          label="Cola"
          level={h.queue.status}
          headline={LEVEL_META[h.queue.status].label}
          detail={h.queue.status_reason ?? `${h.queue.pending_ready ?? "—"} listos`}
          title={`Worker ${h.queue.worker.active ? "activo" : "inactivo"} · ${h.queue.pending_ready ?? 0} listos · ${h.queue.delayed ?? 0} programados · ${h.queue.processing ?? 0} en proceso · ${h.queue.failed} fallidos`}
          href="/admin/colas"
        />
        <MiniTile
          icon={HardDrive}
          label="Disco"
          level={h.api.disk.status}
          headline={h.api.disk.used_pct != null ? `${h.api.disk.used_pct}% usado` : "—"}
          detail={
            h.api.disk.free_gb != null
              ? `${h.api.disk.free_gb} GB libres de ${h.api.disk.total_gb}`
              : "sin datos"
          }
          title={`Volumen de ${h.api.disk.path} · advertencia ≥${h.api.disk.warning_pct}% · crítico ≥${h.api.disk.critical_pct}%`}
        />
        <MiniTile
          icon={CircleDollarSign}
          label="Stripe"
          level={
            !h.stripe.configured ? "warning"
              : h.stripe.ping?.ok ? "ok" : "critical"
          }
          headline={
            !h.stripe.configured ? "Sin configurar"
              : h.stripe.ping?.ok ? `OK (${h.stripe.mode})` : "Sin respuesta"
          }
          detail={
            h.stripe.ping?.ok
              ? `ping ${h.stripe.ping.latency_ms} ms${h.stripe.webhook_configured ? "" : " · sin webhook"}`
              : h.stripe.configured ? "revisa conexión" : "pagos inactivos"
          }
        />
        <MiniTile
          icon={Globe}
          label="Peticiones hoy"
          level={h.requests.today.errors_5xx > 0 ? "warning" : "ok"}
          headline={nf.format(h.requests.today.total)}
          detail={`${h.requests.today.error_rate_pct}% err · media ${h.requests.today.avg_ms ?? "—"} ms`}
          title={`p95 ≈ ${h.requests.today.p95_ms ?? "—"} ms · p99 ≈ ${h.requests.today.p99_ms ?? "—"} ms (aproximados por buckets) · ${h.requests.today.errors_5xx}× 5xx`}
        />
        <MiniTile
          icon={Wifi}
          label="En línea ahora"
          level="ok"
          headline={String(h.presence.online_count + h.presence.guests_online)}
          detail={`${h.presence.online_count} usuarios · ${h.presence.guests_online} visitantes`}
        />

        {/* PostgreSQL — solo si el driver lo soporta */}
        {h.postgres.supported && (
          <MiniTile
            icon={Database}
            label="PostgreSQL"
            level={h.postgres.status}
            headline={
              h.postgres.connections.used_pct != null
                ? `${h.postgres.connections.used_pct}% conex.`
                : (h.postgres.size.pretty ?? "—")
            }
            detail={`${h.postgres.connections.used ?? "—"}/${h.postgres.connections.max ?? "—"} conex · ${h.postgres.size.pretty ?? "—"}`}
            title={`Cache hit ${h.postgres.cache_hit_ratio ?? "—"}% · índice ${h.postgres.index_hit_ratio ?? "—"}% · deadlocks ${h.postgres.deadlocks ?? "—"} · ${h.postgres.slow_active_queries ?? 0} consultas lentas activas`}
          />
        )}

        {/* CPU / memoria del host */}
        <MiniTile
          icon={Cpu}
          label="CPU / RAM"
          level={
            h.host.cpu.status === "critical" || h.host.memory.status === "critical"
              ? "critical"
              : h.host.cpu.status === "warning" || h.host.memory.status === "warning"
                ? "warning"
                : "ok"
          }
          headline={
            h.host.cpu.available && h.host.cpu.load_per_core_pct != null
              ? `CPU ${h.host.cpu.load_per_core_pct}%`
              : "CPU n/d"
          }
          detail={
            h.host.memory.used_pct != null
              ? `RAM ${h.host.memory.used_pct}% de ${h.host.memory.total_mb ? Math.round(h.host.memory.total_mb / 1024) + " GB" : "host"}`
              : h.host.memory.process_usage_mb != null
                ? `proceso ${h.host.memory.process_usage_mb} MB`
                : "RAM n/d"
          }
          title={
            h.host.cpu.available
              ? `Carga 1m ${h.host.cpu.load_1m} en ${h.host.cpu.cores} núcleos`
              : "load average no disponible en este SO (Windows)"
          }
        />

        {/* Último backup */}
        <MiniTile
          icon={Archive}
          label="Backups"
          level={
            h.backups.status === "not_configured" ? "warning" : (h.backups.status as HealthLevel)
          }
          headline={
            h.backups.status === "not_configured"
              ? "No configurado"
              : h.backups.last_result === "failed"
                ? "Último falló"
                : h.backups.age_hours != null
                  ? `hace ${h.backups.age_hours}h`
                  : "OK"
          }
          detail={
            h.backups.last_at
              ? new Date(h.backups.last_at).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
              : "sin backups registrados"
          }
          title={`Umbral de antigüedad: ${h.backups.stale_hours ?? 48} h. El scheduler o charbook:backup registran aquí cada ejecución.`}
        />
      </div>

      {/* ═══════ FILA 2: en vivo + alertas ═══════ */}
      <div className="grid gap-3 xl:grid-cols-3">
        {/* En vivo (detalle: quiénes + desde cuándo) */}
        <Card className="border-border/60 bg-card p-4">
          <PanelHeader
            icon={<Wifi className="h-3.5 w-3.5 text-emerald-500" />}
            title="En vivo ahora"
            aside={
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                hace {secondsAgo}s
              </span>
            }
          />
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-3xl font-bold tabular-nums leading-none">
              {h.presence.online_count + h.presence.guests_online}
            </span>
            <span className="text-xs text-muted-foreground">
              {h.presence.online_count} con cuenta · {h.presence.guests_online} visitantes
            </span>
          </div>
          {h.presence.online_users.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Nadie con cuenta navegando en este momento.
            </p>
          ) : (
            <div className="mt-3 max-h-40 space-y-1 overflow-y-auto pr-1">
              {h.presence.online_users.map((u) => (
                <Link
                  key={u.id}
                  href={u.username ? `/u/${u.username}` : "#"}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent/50"
                >
                  <span className="relative">
                    <span className="relative block h-6 w-6 overflow-hidden rounded-full border border-border/50">
                      {u.avatar ? (
                        <Image src={u.avatar} alt={u.name} fill sizes="24px" className="object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-primary/15 text-[9px] font-medium text-primary">
                          {u.name?.[0]?.toUpperCase() ?? "?"}
                        </span>
                      )}
                    </span>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-card bg-emerald-500" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs">{u.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground/60 tabular-nums">
                    {timeAgo(u.last_seen_at)}
                  </span>
                </Link>
              ))}
            </div>
          )}
          <p className="mt-2 border-t border-border/40 pt-2 text-[10px] text-muted-foreground/70">
            Hoy: {h.active_users.last_24h} activos · {h.active_users.new_this_week} nuevos esta semana · {nf.format(h.active_users.total)} totales
          </p>
        </Card>

        {/* Alertas con severidad, servicio, tiempos y "revisada" */}
        <Card className="border-border/60 bg-card p-4 xl:col-span-2">
          <PanelHeader
            icon={<ShieldAlert className={cn("h-3.5 w-3.5", activeAlerts.length ? "text-destructive" : "text-primary")} />}
            title="Alertas"
            aside={
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {activeAlerts.length} activas
                {ackedAlerts.length > 0 && ` · ${ackedAlerts.length} revisadas`}
              </span>
            }
          />
          {activeAlerts.length === 0 && ackedAlerts.length === 0 ? (
            <EmptyOk text="Sin alertas: todos los chequeos preventivos pasan." />
          ) : (
            <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {activeAlerts.map((a) => (
                <AlertRow
                  key={a.id}
                  alert={a}
                  pending={ackMutation.isPending}
                  onAck={() => ackMutation.mutate({ id: a.id, acked: true })}
                />
              ))}
              {ackedAlerts.length > 0 && (
                <details className="pt-1">
                  <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                    Revisadas ({ackedAlerts.length})
                  </summary>
                  <div className="mt-1.5 space-y-1.5 opacity-60">
                    {ackedAlerts.map((a) => (
                      <AlertRow
                        key={a.id}
                        alert={a}
                        pending={ackMutation.isPending}
                        onAck={() => ackMutation.mutate({ id: a.id, acked: false })}
                      />
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ═══════ FILA 3: errores del log + jobs fallidos ═══════ */}
      <div className="grid gap-3 xl:grid-cols-2">
        <Card className="border-border/60 bg-card p-4">
          <PanelHeader
            icon={<FileWarning className="h-3.5 w-3.5 text-amber-500" />}
            title="Últimos errores del log"
            aside={
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{h.errors.size_mb} MB</span>
                {h.errors.log_exists && h.errors.size_mb > 0 && (
                  <button
                    onClick={() => {
                      if (confirm("¿Vaciar el archivo de log? Los errores listados se perderán.")) {
                        clearLogsMutation.mutate();
                      }
                    }}
                    disabled={clearLogsMutation.isPending}
                    className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Vaciar log"
                    aria-label="Vaciar log"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            }
          />
          {h.errors.recent.length === 0 ? (
            <EmptyOk text="Sin errores recientes en el log." />
          ) : (
            <div className="mt-2 max-h-56 divide-y divide-border/50 overflow-y-auto pr-1">
              {h.errors.recent.map((e, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5">
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 rounded px-1 py-px text-[8px] font-bold",
                      e.level === "ERROR"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-rose-500/20 text-rose-500"
                    )}
                  >
                    {e.level}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-mono text-[11px] leading-snug text-foreground/90">
                      {e.message}
                    </p>
                    <p className="text-[9px] text-muted-foreground/60 tabular-nums">{e.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Jobs fallidos: SOLO informa fallos (la salud de la cola vive en su tarjeta) */}
        <Card className="border-border/60 bg-card p-4">
          <PanelHeader
            icon={<RotateCcw className="h-3.5 w-3.5 text-primary" />}
            title="Jobs fallidos"
            aside={
              <div className="flex items-center gap-1.5">
                <Link
                  href="/admin/colas"
                  className="text-[10px] text-primary hover:underline"
                >
                  Ver cola completa →
                </Link>
                {h.failed_jobs.total > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={retryMutation.isPending}
                      onClick={() => retryMutation.mutate(undefined)}
                    >
                      {retryMutation.isPending
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <RotateCcw className="h-3 w-3" />}
                      Reintentar todos
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={flushMutation.isPending}
                      onClick={() => {
                        if (confirm("¿Eliminar TODOS los jobs fallidos sin reintentarlos?")) {
                          flushMutation.mutate();
                        }
                      }}
                      aria-label="Vaciar jobs fallidos"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            }
          />
          {h.failed_jobs.jobs.length === 0 ? (
            <EmptyOk text="No hay jobs fallidos registrados." />
          ) : (
            <div className="mt-2 max-h-56 divide-y divide-border/50 overflow-y-auto pr-1">
              {h.failed_jobs.jobs.map((j) => (
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
                      title="Reintentar"
                      aria-label="Reintentar job"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("¿Descartar este job fallido?")) forgetMutation.mutate(j.uuid);
                      }}
                      disabled={forgetMutation.isPending}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      title="Descartar"
                      aria-label="Descartar job"
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

      {/* ═══════ FILA 4: gráficas ═══════ */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ChartCard
          icon={<Globe className="h-3.5 w-3.5 text-primary" />}
          title="Tráfico API"
          subtitle="peticiones por día"
          data={h.requests.by_day.map((d) => ({ date: d.date, count: d.total }))}
        />
        <ChartCard
          icon={<FileWarning className="h-3.5 w-3.5 text-destructive/70" />}
          title="Errores del log"
          subtitle="por día"
          data={h.charts.errors_by_day}
          tone="destructive"
        />
        <ChartCard
          icon={<UserPlus className="h-3.5 w-3.5 text-primary" />}
          title="Usuarios nuevos"
          subtitle="registros por día"
          data={h.charts.new_users_by_day}
        />
        <ChartCard
          icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />}
          title="Actividad lectora"
          subtitle="lectores·obra activos por día"
          data={h.charts.reader_activity_by_day}
        />
      </div>

      {/* ═══════ PostgreSQL en profundidad (solo si el driver lo soporta) ═══════ */}
      {h.postgres.supported && (
        <Card className="border-border/60 bg-card p-4">
          <PanelHeader
            icon={<Database className="h-3.5 w-3.5 text-primary" />}
            title="PostgreSQL"
            aside={
              <span className="text-[10px] text-muted-foreground">
                {h.postgres.size.pretty ?? "—"}
              </span>
            }
          />
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <PerfStat
              label="Conexiones"
              value={`${h.postgres.connections.used ?? "—"}/${h.postgres.connections.max ?? "—"}`}
            />
            <PerfStat label="Cache hit" value={h.postgres.cache_hit_ratio != null ? `${h.postgres.cache_hit_ratio}%` : "—"} />
            <PerfStat label="Índice hit" value={h.postgres.index_hit_ratio != null ? `${h.postgres.index_hit_ratio}%` : "—"} />
            <PerfStat label="Deadlocks" value={h.postgres.deadlocks != null ? String(h.postgres.deadlocks) : "—"} />
          </div>
          {h.postgres.largest_tables.length > 0 && (
            <>
              <p className="mt-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tablas más grandes
              </p>
              <div className="divide-y divide-border/50">
                {h.postgres.largest_tables.map((t) => (
                  <div key={t.name} className="flex items-center justify-between py-1 text-xs">
                    <span className="font-mono text-muted-foreground">{t.name}</span>
                    <span className="tabular-nums">{t.pretty}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {/* ═══════ FILA 5: integridad de archivos + rendimiento API ═══════ */}
      <div className="grid gap-3 xl:grid-cols-2">
        <FileIntegrityPanel
          files={h.files}
          scanning={scanMutation.isPending}
          onScan={() => scanMutation.mutate()}
        />

        <Card className="border-border/60 bg-card p-4">
          <PanelHeader
            icon={<Clock className="h-3.5 w-3.5 text-primary" />}
            title="Rendimiento de la API"
            aside={
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground" title="Percentiles aproximados a partir de buckets de duración — no son exactos al milisegundo.">
                  p95/p99 aproximados
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  disabled={clearMetricsMutation.isPending}
                  onClick={() => {
                    if (confirm("¿Vaciar las métricas de rendimiento (contadores, peticiones lentas y últimos 5xx)? Útil tras una prueba de carga; la acción queda auditada.")) {
                      clearMetricsMutation.mutate();
                    }
                  }}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Vaciar métricas
                </Button>
              </div>
            }
          />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <PerfStat label="Media hoy" value={h.requests.today.avg_ms != null ? `${h.requests.today.avg_ms} ms` : "—"} />
            <PerfStat label="p95 ≈" value={h.requests.today.p95_ms != null ? `${h.requests.today.p95_ms} ms` : "—"} />
            <PerfStat label="p99 ≈" value={h.requests.today.p99_ms != null ? `${h.requests.today.p99_ms} ms` : "—"} />
          </div>

          <p className="mt-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Peticiones lentas (&gt; {h.requests.slow_threshold_ms} ms)
          </p>
          {h.requests.slow_requests.length === 0 ? (
            <EmptyOk text="Ninguna petición lenta registrada." compact />
          ) : (
            <div className="max-h-28 divide-y divide-border/50 overflow-y-auto pr-1">
              {h.requests.slow_requests.map((r, i) => (
                <div key={i} className="flex items-center gap-2 py-1 text-[11px]">
                  <span className="shrink-0 rounded bg-amber-500/15 px-1 py-px font-bold text-amber-500 tabular-nums">
                    {r.ms} ms
                  </span>
                  <span className="shrink-0 font-medium text-muted-foreground">{r.method}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-foreground/90">/{r.path}</span>
                  <span className="shrink-0 text-[9px] text-muted-foreground/60 tabular-nums">
                    {new Date(r.time).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Últimos errores 5xx
          </p>
          {h.requests.last_5xx.length === 0 ? (
            <EmptyOk text="Ningún error 500 registrado." compact />
          ) : (
            <div className="max-h-28 divide-y divide-border/50 overflow-y-auto pr-1">
              {h.requests.last_5xx.map((e, i) => (
                <div key={i} className="flex items-center gap-2 py-1 text-[11px]">
                  <span className="shrink-0 rounded bg-destructive/15 px-1 py-px font-bold text-destructive">
                    {e.status}
                  </span>
                  <span className="shrink-0 font-medium text-muted-foreground">{e.method}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-foreground/90">/{e.path}</span>
                  <span className="shrink-0 text-[9px] text-muted-foreground/60 tabular-nums">
                    {new Date(e.time).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ═══════ FILA 6: servicios externos ═══════ */}
      <Card className="border-border/60 bg-card p-4">
        <PanelHeader
          icon={<ShieldCheck className="h-3.5 w-3.5 text-primary" />}
          title="Servicios externos configurados"
          aside={
            <span className="text-[10px] text-muted-foreground">
              solo se muestran los realmente configurados
            </span>
          }
        />
        <div className="mt-2.5 flex flex-wrap gap-2">
          {h.services.map((s) => {
            const level: HealthLevel =
              s.status === "ok" ? "ok" : s.status === "critical" ? "critical" : "ok";
            const isLive = s.status === "ok" || s.status === "critical";
            const meta = LEVEL_META[level];
            const Icon = s.status === "critical" ? XCircle : CheckCircle2;
            return (
              <span
                key={s.key}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs",
                  s.status === "critical" ? meta.chip : "border-border/60 bg-background"
                )}
                title={isLive ? "Comprobado con ping real" : "Configurado (sin ping automático)"}
              >
                <Icon className={cn("h-3 w-3", s.status === "critical" ? "text-destructive" : "text-emerald-500")} aria-hidden />
                <span className="font-medium">{s.label}</span>
                {s.detail && (
                  <span className="text-[10px] text-muted-foreground">· {s.detail}</span>
                )}
                {h.meilisearch && s.key === "meilisearch" && h.meilisearch.tasks_pending != null && h.meilisearch.tasks_pending > 0 && (
                  <span className="text-[10px] text-amber-500">
                    · {h.meilisearch.tasks_pending} tareas pendientes
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// Piezas UI
// ─────────────────────────────────────────────

function MiniTile({
  icon: Icon,
  label,
  level,
  headline,
  detail,
  title,
  href,
}: {
  icon: typeof Zap;
  label: string;
  level: HealthLevel;
  headline: string;
  detail: string;
  title?: string;
  href?: string;
}) {
  const meta = LEVEL_META[level];
  const StatusIcon = meta.icon;

  const body = (
    <Card
      className={cn(
        "h-full border-border/60 bg-card p-3 transition-colors",
        level === "critical" && "border-destructive/40",
        level === "degraded" && "border-orange-500/40",
        level === "warning" && "border-amber-500/40",
        href && "hover:border-primary/40"
      )}
      title={title}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1 text-muted-foreground">
          <Icon className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate text-[10px] font-medium uppercase tracking-wide">{label}</span>
        </div>
        <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", meta.text)} aria-label={meta.label} />
      </div>
      <div className="mt-1.5 truncate text-base font-bold leading-tight">{headline}</div>
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{detail}</p>
    </Card>
  );

  return href ? <Link href={href} className="block">{body}</Link> : body;
}

function PanelHeader({
  icon,
  title,
  aside,
}: {
  icon: React.ReactNode;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
}

function AlertRow({
  alert: a,
  pending,
  onAck,
}: {
  alert: SystemAlert;
  pending: boolean;
  onAck: () => void;
}) {
  const isCritical = a.severity === "critical";
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs",
        isCritical
          ? "border-destructive/40 bg-destructive/5"
          : "border-amber-500/30 bg-amber-500/5"
      )}
    >
      {isCritical ? (
        <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" aria-label="Crítica" />
      ) : (
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-label="Advertencia" />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("leading-snug", isCritical ? "text-destructive" : "text-amber-600 dark:text-amber-400")}>
          <span className="font-semibold">{a.service}:</span> {a.message}
        </p>
        <p className="mt-0.5 text-[9px] text-muted-foreground/70 tabular-nums">
          {a.first_seen ? `desde ${new Date(a.first_seen).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
          {a.link && (
            <>
              {" · "}
              <Link href={a.link} className="text-primary hover:underline">revisar</Link>
            </>
          )}
        </p>
      </div>
      <button
        onClick={onAck}
        disabled={pending}
        className="shrink-0 rounded border border-border/60 px-1.5 py-0.5 text-[9px] text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
        title={a.acked ? "Reactivar alerta" : "Marcar como revisada"}
      >
        {a.acked ? "Reactivar" : "Revisada"}
      </button>
    </div>
  );
}

function PerfStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

function FileIntegrityPanel({
  files,
  scanning,
  onScan,
}: {
  files: SystemHealth["files"];
  scanning: boolean;
  onScan: () => void;
}) {
  return (
    <Card className="border-border/60 bg-card p-4">
      <PanelHeader
        icon={<BookX className="h-3.5 w-3.5 text-destructive/70" />}
        title="Integridad de archivos"
        aside={
          <div className="flex items-center gap-2">
            {files.scanned && (
              <span className="text-[10px] text-muted-foreground tabular-nums" title={`Duración: ${files.duration_ms} ms`}>
                último análisis: {new Date(files.scanned_at).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <Button variant="outline" size="xs" disabled={scanning} onClick={onScan}>
              {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileScan className="h-3 w-3" />}
              Analizar ahora
            </Button>
          </div>
        }
      />

      {!files.scanned ? (
        <div className="mt-3 rounded-lg border border-dashed border-border/60 bg-card/40 px-3 py-4 text-center">
          <Search className="mx-auto mb-1.5 h-5 w-5 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            Aún no se ha ejecutado ningún análisis. Corre uno ahora o espera al
            análisis automático diario (05:00).
          </p>
        </div>
      ) : (
        <>
          {/* Resumen por tipo de problema */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {Object.entries(files.counts_by_type).map(([type, count]) => (
              <span
                key={type}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  count > 0
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                    : "border-border/50 bg-background text-muted-foreground/70"
                )}
              >
                {FILE_ISSUE_LABELS[type] ?? type}: {count}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background px-2 py-0.5 text-[10px] text-muted-foreground/70">
              {files.checked_files} archivos revisados
            </span>
          </div>

          {files.issues.length === 0 ? (
            <EmptyOk text="Todos los archivos revisados existen y son legibles (EPUB/PDF verificados por contenido)." />
          ) : (
            <div className="mt-2 max-h-44 divide-y divide-border/50 overflow-y-auto pr-1">
              {files.issues.map((b, i) => (
                <div key={`${b.id}-${b.type}-${i}`} className="flex items-center gap-2 py-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-xs font-medium">{b.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {FILE_ISSUE_LABELS[b.type] ?? b.type}
                      {b.detail && (
                        <span className="ml-1 font-mono text-[9px] text-muted-foreground/60">({b.detail})</span>
                      )}
                    </p>
                  </div>
                  <Link
                    href={b.is_creator_work ? "/admin/obras-subidas" : `/admin/libros/${b.slug}/editar`}
                    className="flex shrink-0 items-center gap-1 rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    Corregir <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Distribución real de almacenamiento (medida en el análisis) */}
          {Object.keys(files.storage_breakdown).length > 0 && (
            <div className="mt-2.5 border-t border-border/40 pt-2">
              <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Layers className="h-2.5 w-2.5" /> Uso de almacenamiento por carpeta
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground tabular-nums">
                {Object.entries(files.storage_breakdown).map(([dir, mb]) => (
                  <span key={dir}>
                    {dir}: <strong className="text-foreground/80">{mb} MB</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function ChartCard({
  icon,
  title,
  subtitle,
  data,
  tone = "primary",
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  data: DayCount[];
  tone?: "primary" | "destructive";
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((acc, d) => acc + d.count, 0);
  const barCls =
    tone === "destructive"
      ? "bg-destructive/60 hover:bg-destructive"
      : "bg-primary/60 hover:bg-primary";

  // "Recopilando datos desde…": si los primeros días están vacíos pero hay
  // datos recientes, la serie probablemente empezó a medirse hace poco.
  const firstWithData = data.findIndex((d) => d.count > 0);
  const collectingSince =
    total > 0 && firstWithData > Math.floor(data.length / 2)
      ? data[firstWithData]?.date
      : null;

  return (
    <Card className="border-border/60 bg-card p-4">
      <PanelHeader
        icon={icon}
        title={title}
        aside={<span className="text-sm font-bold tabular-nums">{nf.format(total)}</span>}
      />
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {subtitle} · {formatDay(data[0]?.date)} — {formatDay(data[data.length - 1]?.date)}
      </p>

      {total === 0 ? (
        <div className="mt-3 flex h-20 items-center justify-center rounded-md border border-dashed border-border/50">
          <p className="text-[11px] text-muted-foreground">Sin datos en este rango.</p>
        </div>
      ) : (
        <div className="mt-3 flex h-20 items-end gap-[3px]">
          {data.map((d) => (
            <div
              key={d.date}
              className="group relative flex h-full flex-1 items-end"
              title={`${formatDay(d.date)}: ${d.count}`}
            >
              <div
                className={cn("w-full rounded-t-[3px] transition-colors", barCls)}
                style={{ height: `${Math.max(d.count > 0 ? 6 : 2, (d.count / max) * 100)}%` }}
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-1 flex justify-between text-[9px] text-muted-foreground/60 tabular-nums">
        <span>{formatDay(data[0]?.date)}</span>
        {collectingSince && (
          <span className="text-primary/70">recopilando desde {formatDay(collectingSince)}</span>
        )}
        <span>{formatDay(data[data.length - 1]?.date)}</span>
      </div>
    </Card>
  );
}

function formatDay(date?: string): string {
  if (!date) return "";
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

function secondsSince(timestampMs: number): number {
  return Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
}

function timeAgo(iso: string): string {
  const secs = secondsSince(new Date(iso).getTime());
  if (secs < 60) return "ahora";
  const mins = Math.round(secs / 60);
  return `${mins} min`;
}

function EmptyOk({ text, compact }: { text: string; compact?: boolean }) {
  return (
    <div className={cn(
      "mt-2 flex items-center gap-2 rounded-lg border border-dashed border-emerald-500/30 bg-emerald-500/5 px-3",
      compact ? "py-1.5" : "py-2.5"
    )}>
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

