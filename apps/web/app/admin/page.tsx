"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, Archive, BookOpen, CheckCircle2, ChevronRight,
  CircleDollarSign, Clock, CreditCard, Download, Eye, FileClock,
  Flag, Library, Plus, RefreshCw, ShieldAlert, TrendingUp, UserCog, UserPlus, Users,
} from "lucide-react";
import { adminApi, type DashboardSummary } from "@/lib/api-admin";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("es");
const money = new Intl.NumberFormat("es", { style: "currency", currency: "USD" });

const SYSTEM_META: Record<string, { label: string; cls: string; text: string }> = {
  ok: { label: "Operativo", cls: "border-emerald-500/30 bg-emerald-500/5", text: "text-emerald-500" },
  warning: { label: "Advertencia", cls: "border-amber-500/30 bg-amber-500/5", text: "text-amber-500" },
  degraded: { label: "Degradado", cls: "border-orange-500/30 bg-orange-500/5", text: "text-orange-500" },
  critical: { label: "Crítico", cls: "border-destructive/30 bg-destructive/5", text: "text-destructive" },
  unknown: { label: "Desconocido", cls: "border-border/60 bg-card", text: "text-muted-foreground" },
};

// Nombres legibles de los componentes de salud (las claves crudas del API
// —"database", "queue"…— se veían como un amontonamiento de etiquetas técnicas).
const COMPONENT_LABELS: Record<string, string> = {
  database: "Base de datos",
  cache: "Caché",
  queue: "Colas",
  scheduler: "Programador",
  storage: "Almacenamiento",
  backups: "Backups",
  redis: "Redis",
  mail: "Correo",
  host: "Servidor",
  search: "Búsqueda",
};

const componentLabel = (key: string) =>
  COMPONENT_LABELS[key] ?? key.replace(/_/g, " ");

export default function AdminDashboardPage() {
  const { data, isLoading, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: adminApi.dashboard,
    refetchInterval: 60_000, // el backend cachea 60s; refrescamos al mismo ritmo
    refetchIntervalInBackground: false,
    // Al volver al panel tras resolver un reporte/obra/solicitud, los conteos
    // deben reflejar la realidad de inmediato (el backend ya invalida su caché
    // en esas acciones). Sin esto se seguían viendo "pendientes" fantasma.
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Centro de control</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estado del sistema, cola de trabajo del staff y crecimiento de CharBook.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-border/60"
          >
            <RefreshCw className={cn("mr-1.5 h-4 w-4", isFetching && "animate-spin")} />
            {isFetching ? "Actualizando…" : "Actualizar"}
          </Button>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/admin/libros/nuevo">
              <Plus className="mr-1.5 h-4 w-4" />
              Nuevo libro
            </Link>
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <DashboardSkeleton />
      ) : (
        <DashboardBody data={data} updatedAt={dataUpdatedAt} />
      )}
    </div>
  );
}

function DashboardBody({ data, updatedAt }: { data: DashboardSummary; updatedAt: number }) {
  const sys = SYSTEM_META[data.system.status] ?? SYSTEM_META.unknown;

  // Los componentes sanos se resumen en un contador; solo los que fallan
  // ocupan espacio visual.
  const componentEntries = Object.entries(data.system.components ?? {});
  const totalComponents = componentEntries.length;
  const degradedComponents = componentEntries.filter(
    ([, level]) => level === "critical" || level === "warning" || level === "degraded"
  );
  const healthyComponents = totalComponents - degradedComponents.length;

  // Cola de trabajo: solo items accionables > 0, ordenados por urgencia.
  const attention: {
    icon: React.ElementType; label: string; value: number; href: string; danger?: boolean;
  }[] = [
    { icon: Flag, label: "Reportes por revisar", value: data.moderation.reports_open, href: "/admin/reportes" },
    { icon: FileClock, label: "Obras por revisar", value: data.moderation.works_pending_review, href: "/admin/obras-subidas" },
    { icon: UserCog, label: "Solicitudes de creador", value: data.moderation.creator_applications_pending, href: "/admin/solicitudes-creador" },
    { icon: CreditCard, label: "Suscripciones con pago vencido", value: data.monetization.past_due_subscriptions, href: "/admin/monetizacion", danger: true },
    { icon: AlertTriangle, label: "Retiros fallidos", value: data.monetization.payouts_failed, href: "/admin/monetizacion", danger: true },
  ].filter((a) => a.value > 0);

  return (
    <>
      {/* ═══════ Estado del sistema ═══════ */}
      {/* Antes se listaban TODOS los componentes como etiquetas con la clave
          cruda ("database", "queue"…), sanos y con fallo mezclados: al hacer
          wrap quedaba un amontonamiento ilegible. Ahora los sanos se resumen en
          un contador y solo se destacan los que tienen incidencia. */}
      <Link href="/admin/sistema" className="block">
        <Card className={cn("border p-4 transition-colors hover:border-primary/40", sys.cls)}>
          <div className="flex items-start gap-3">
            {data.system.status === "ok" ? (
              <CheckCircle2 className={cn("h-6 w-6 shrink-0", sys.text)} />
            ) : (
              <ShieldAlert className={cn("h-6 w-6 shrink-0", sys.text)} />
            )}
            <div className="min-w-0 flex-1">
              <p className={cn("text-base font-bold leading-tight", sys.text)}>
                Sistema: {sys.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.system.active_alerts === 0
                  ? "Sin alertas activas"
                  : `${data.system.active_alerts} alerta(s) activa(s)`}
                {data.system.critical_alerts > 0 && ` · ${data.system.critical_alerts} crítica(s)`}
                {totalComponents > 0 &&
                  ` · ${healthyComponents} de ${totalComponents} componentes operativos`}
              </p>
            </div>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
          </div>

          {degradedComponents.length > 0 && (
            <div className="mt-3 border-t border-border/40 pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Componentes con incidencia
              </p>
              <div className="flex flex-wrap gap-1.5">
                {degradedComponents.map(([key, level]) => (
                  <span
                    key={key}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                      level === "critical"
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-500"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        level === "critical" ? "bg-destructive" : "bg-amber-500"
                      )}
                    />
                    {componentLabel(key)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      </Link>

      {/* ═══════ Requiere atención (solo si hay algo) ═══════ */}
      {/* Si no queda nada pendiente se muestra una confirmación explícita, para
          que el admin sepa que la cola está vacía y no que el bloque falló. */}
      {attention.length === 0 ? (
        <Card className="flex items-center gap-2.5 border-emerald-500/25 bg-emerald-500/5 p-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <p className="text-xs text-muted-foreground">
            Sin trabajo pendiente: no hay reportes, obras ni solicitudes por revisar.
          </p>
        </Card>
      ) : (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Requiere atención
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {attention.map((a) => (
              <Link key={a.label} href={a.href}>
                <Card className={cn(
                  "flex items-center gap-3 border p-3 transition-colors",
                  a.danger
                    ? "border-destructive/30 bg-destructive/5 hover:border-destructive/50"
                    : "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                )}>
                  <a.icon className={cn("h-5 w-5 shrink-0", a.danger ? "text-destructive" : "text-amber-500")} />
                  <div className="min-w-0">
                    <div className="text-xl font-bold tabular-nums leading-none">{nf.format(a.value)}</div>
                    <div className="mt-1 truncate text-[10px] text-muted-foreground">{a.label}</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ KPIs ═══════ */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          icon={Users} label="Usuarios" value={nf.format(data.users.total)}
          sub={`${data.users.online_now} en línea · ${data.users.suspended} suspendidos`} accent
        />
        <Kpi
          icon={UserPlus} label="Nuevos usuarios" value={`+${nf.format(data.users.new_today)}`}
          sub={`hoy · ${nf.format(data.users.new_7d)} en 7d · ${nf.format(data.users.new_30d)} en 30d`}
        />
        <Kpi
          icon={Library} label="Libros publicados" value={nf.format(data.content.books_published)}
          sub={`${nf.format(data.content.books_total)} totales · ${data.content.books_pending_review} por revisar`}
        />
        <Kpi
          icon={CircleDollarSign} label="Ingresos (30d)" value={money.format(data.monetization.revenue_30d_usd)}
          sub={`hoy ${money.format(data.monetization.revenue_today_usd)} · ${data.monetization.active_subscriptions} subs activas`}
        />
        <Kpi
          icon={Eye} label="Vistas a libros" value={nf.format(data.engagement.views_total)}
          sub={`${nf.format(data.engagement.reads_valid_7d)} lecturas válidas (7d)`}
        />
        <Kpi
          icon={Download} label="Descargas" value={nf.format(data.engagement.downloads_total)}
        />
        <Kpi
          icon={Users} label="Autores" value={nf.format(data.content.authors_total)}
          sub={`${data.content.categories_total} categorías`}
        />
        <Kpi
          icon={CreditCard} label="Suscripciones activas" value={nf.format(data.monetization.active_subscriptions)}
          sub={data.monetization.past_due_subscriptions > 0 ? `${data.monetization.past_due_subscriptions} con pago vencido` : "sin pagos vencidos"}
        />
      </div>

      {/* ═══════ Tendencias ═══════ */}
      <div className="grid gap-3 lg:grid-cols-2">
        <TrendCard
          icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />}
          title="Nuevos usuarios"
          points={data.trends.new_users_by_day.map((d) => ({ date: d.date, value: d.count }))}
          format={(v) => nf.format(v)}
        />
        <TrendCard
          icon={<CircleDollarSign className="h-3.5 w-3.5 text-primary" />}
          title="Ingresos de plataforma"
          points={data.trends.revenue_by_day.map((d) => ({ date: d.date, value: d.amount }))}
          format={(v) => money.format(v)}
        />
      </div>

      {/* ═══════ Actividad administrativa reciente ═══════ */}
      <Card className="border-border/60 bg-card p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-sm font-semibold">Actividad administrativa reciente</h2>
          <Link href="/admin/auditoria" className="ml-auto text-[11px] text-primary hover:underline">
            Ver auditoría
          </Link>
        </div>
        {data.recent_admin_actions.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">Sin acciones administrativas registradas aún.</p>
        ) : (
          <div className="mt-2 divide-y divide-border/50">
            {data.recent_admin_actions.map((a, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 text-xs">
                <span className="font-mono text-[10px] text-muted-foreground">{a.action}</span>
                {a.entity_label && <span className="truncate text-muted-foreground">→ {a.entity_label}</span>}
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70">
                  {a.admin_name ?? "sistema"} · {new Date(a.created_at).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Accesos rápidos */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 bg-card p-5">
          <BookOpen className="mb-3 h-6 w-6 text-primary" />
          <h2 className="font-serif text-lg font-bold">Añade un libro</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sube PDFs o EPUBs propios. Portada a R2 público, archivo a R2 privado con URLs firmadas.
          </p>
          <Button asChild size="sm" className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/admin/libros/nuevo">Subir libro</Link>
          </Button>
        </Card>
        <Card className="border-border/60 bg-card p-5">
          <Archive className="mb-3 h-6 w-6 text-primary" />
          <h2 className="font-serif text-lg font-bold">Salud del sistema</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            PostgreSQL, colas, backups, CPU/memoria y métricas de la API en detalle.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary">
            <Link href="/admin/sistema">Ver salud del sistema</Link>
          </Button>
        </Card>
      </div>

      <p className="text-right text-[10px] text-muted-foreground/60">
        Actualizado {new Date(updatedAt).toLocaleTimeString("es")}
      </p>
    </>
  );
}

function Kpi({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <Card className={cn("border-border/60 p-4 transition-colors hover:border-primary/40", accent ? "bg-primary/5" : "bg-card")}>
      <Icon className={cn("mb-2 h-5 w-5", accent ? "text-primary" : "text-muted-foreground")} />
      <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {sub && <div className="mt-1 text-[10px] text-muted-foreground/80">{sub}</div>}
    </Card>
  );
}

function TrendCard({
  icon, title, points, format,
}: {
  icon: React.ReactNode; title: string;
  points: { date: string; value: number }[]; format: (v: number) => string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((acc, p) => acc + p.value, 0);

  return (
    <Card className="border-border/60 bg-card p-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="ml-auto text-sm font-bold tabular-nums">{format(total)}</span>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">últimos {points.length} días</p>
      {total === 0 ? (
        <div className="mt-3 flex h-20 items-center justify-center rounded-md border border-dashed border-border/50">
          <p className="text-[11px] text-muted-foreground">Sin datos en este rango.</p>
        </div>
      ) : (
        <div className="mt-3 flex h-20 items-end gap-[3px]">
          {points.map((p) => (
            <div
              key={p.date}
              className="group relative flex h-full flex-1 items-end"
              title={`${new Date(p.date).toLocaleDateString("es", { day: "numeric", month: "short" })}: ${format(p.value)}`}
            >
              <div
                className="w-full rounded-t-[3px] bg-primary/60 transition-colors hover:bg-primary"
                style={{ height: `${Math.max(p.value > 0 ? 6 : 2, (p.value / max) * 100)}%` }}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  );
}
