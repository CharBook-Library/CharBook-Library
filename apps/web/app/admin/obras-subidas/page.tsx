"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search, Upload, ChevronLeft, ChevronRight,
  EyeOff, Eye, AlertTriangle, Pin, Star, Flame,
  CheckCircle2, Clock, FileEdit, MoreHorizontal,
  ShieldAlert, PanelRight, ArrowUpDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { staffApi } from "@/lib/api-creator";
import { cn } from "@/lib/utils";
import { CreatorBadge } from "@/components/creator/creator-badge";
import { WorkAdminDrawer } from "@/components/admin/work-admin-drawer";
import type { AdminUploadedWork, AdminWorkAction } from "@/lib/types";

const STATUS_TABS = [
  { key: "all", label: "Todas" },
  { key: "published", label: "Publicadas" },
  { key: "review", label: "En revisión" },
  { key: "draft", label: "Borradores" },
];

const SORTS: { key: string; label: string }[] = [
  { key: "newest", label: "Más recientes" },
  { key: "oldest", label: "Más antiguas" },
  { key: "title", label: "Título (A–Z)" },
  { key: "views", label: "Más vistas" },
  { key: "readers", label: "Más leídas" },
];

export default function AdminUploadedWorksPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [visibility, setVisibility] = useState("");
  const [sort, setSort] = useState<"oldest" | "newest" | "title" | "views" | "readers">("newest");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openWorkId, setOpenWorkId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-uploaded-works", { status, visibility, sort, search, page }],
    queryFn: () =>
      staffApi.uploadedWorks.list({ status, visibility, sort, search, page }),
  });

  const moderateMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: AdminWorkAction }) =>
      staffApi.uploadedWorks.moderate(id, action),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["admin-uploaded-works"] });
      queryClient.invalidateQueries({ queryKey: ["admin-uploaded-work"] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? "No se pudo aplicar la acción"),
  });

  const works = data?.data ?? [];

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Obras subidas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Modera las obras publicadas por los creadores: ponlas en revisión,
          apruébalas u ocúltalas.
        </p>
      </div>

      {/* ───── Filtros ───── */}
      <div className="space-y-3">
        <div className="inline-flex rounded-lg border border-border/60 bg-card p-1">
          {STATUS_TABS.map((t) => {
            const active = status === t.key;
            return (
              <button
                key={t.key}
                onClick={() => { setStatus(t.key); setPage(1); }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por título..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10"
            />
          </div>

          <select
            value={visibility}
            onChange={(e) => { setVisibility(e.target.value); setPage(1); }}
            className="h-10 rounded-md border border-border/60 bg-card px-3 text-sm"
          >
            <option value="">Visibilidad: todas</option>
            <option value="public">Públicas</option>
            <option value="hidden">Ocultas</option>
            <option value="sensitive">Sensibles</option>
            <option value="featured">Destacadas</option>
          </select>

          <div className="relative">
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as typeof sort); setPage(1); }}
              className="h-10 rounded-md border border-border/60 bg-card pl-9 pr-3 text-sm"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>

          {data && (
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {data.meta.total} obra{data.meta.total === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {/* ───── Tabla ───── */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : works.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-card/40 py-16 text-center">
          <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No hay obras subidas con estos filtros.
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          {/* Cabecera de columnas (solo desktop) */}
          <div className="hidden md:grid grid-cols-[minmax(0,1fr)_110px_repeat(3,72px)_96px_44px] items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Obra</span>
            <span>Estado</span>
            <span className="text-right">Lectores</span>
            <span className="text-right">Lecturas</span>
            <span className="text-right">Favs</span>
            <span className="text-right">Subida</span>
            <span />
          </div>

          <div className="divide-y divide-border/60">
            {works.map((w) => (
              <WorkRow
                key={w.id}
                work={w}
                onOpen={() => setOpenWorkId(w.id)}
                onModerate={(action) => moderateMutation.mutate({ id: w.id, action })}
                moderating={moderateMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Paginación */}
      {data && data.meta.last_page > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="px-3 text-muted-foreground">
            Página {data.meta.current_page} de {data.meta.last_page} ·{" "}
            {data.meta.total} obras
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.meta.last_page}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Drawer de acciones */}
      {openWorkId !== null && (
        <WorkAdminDrawer
          workId={openWorkId}
          onClose={() => setOpenWorkId(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Fila de obra (estilo tabla + acciones rápidas)
// ─────────────────────────────────────────────
function WorkRow({
  work,
  onOpen,
  onModerate,
  moderating,
}: {
  work: AdminUploadedWork;
  onOpen: () => void;
  onModerate: (action: AdminWorkAction) => void;
  moderating: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_110px_repeat(3,72px)_96px_44px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/30",
        work.is_hidden && "opacity-60"
      )}
    >
      {/* Obra */}
      <button
        onClick={onOpen}
        className="flex min-w-0 items-center gap-3 text-left"
      >
        <div className="h-14 w-10 shrink-0 overflow-hidden rounded border border-border/60 bg-muted">
          {work.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={work.cover} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="line-clamp-1 text-sm font-medium">{work.title}</span>
            {work.is_hidden && <MiniFlag icon={EyeOff} label="Oculta" tone="danger" />}
            {work.is_sensitive && <MiniFlag icon={AlertTriangle} label="Sensible" tone="warning" />}
            {work.is_pinned && <MiniFlag icon={Pin} label="Fijada" tone="primary" />}
            {work.is_recommended && <MiniFlag icon={Star} label="Recomendada" tone="success" />}
            {work.is_trending && <MiniFlag icon={Flame} label="Tendencia" tone="rose" />}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {work.creator?.username ? (
              <span className="line-clamp-1">@{work.creator.username}</span>
            ) : (
              <span className="line-clamp-1">{work.creator?.name ?? "—"}</span>
            )}
            {work.creator && (
              <CreatorBadge level={work.creator.creator_level} size="xs" iconOnly />
            )}
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">
              {work.content_type
                ? capitalize(work.content_type.replace("_", " "))
                : "Sin tipo"}
            </span>
            {/* Estado en móvil (en desktop tiene su columna) */}
            <span className="md:hidden"><StatusPill status={work.submission_status} /></span>
          </div>
        </div>
      </button>

      {/* Estado */}
      <div className="hidden md:block">
        <StatusPill status={work.submission_status} />
      </div>

      {/* Métricas */}
      <Metric value={work.unique_readers_count ?? work.views_count} />
      <Metric value={work.total_readings_count ?? 0} />
      <Metric value={work.favorites_count} />

      {/* Fecha */}
      <span className="hidden md:block text-right text-xs text-muted-foreground tabular-nums">
        {new Date(work.created_at).toLocaleDateString("es", {
          day: "2-digit", month: "short", year: "2-digit",
        })}
      </span>

      {/* Acciones rápidas */}
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Acciones de moderación"
              disabled={moderating}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs">
              <ShieldAlert className="h-3.5 w-3.5" /> Moderación rápida
            </DropdownMenuLabel>
            {work.submission_status !== "review" && (
              <DropdownMenuItem onClick={() => onModerate("review")}>
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                Poner en revisión
              </DropdownMenuItem>
            )}
            {work.submission_status !== "published" && (
              <DropdownMenuItem onClick={() => onModerate("publish")}>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Aprobar y publicar
              </DropdownMenuItem>
            )}
            {work.is_hidden ? (
              <DropdownMenuItem onClick={() => onModerate("unhide")}>
                <Eye className="h-3.5 w-3.5" />
                Volver a mostrar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onModerate("hide")}>
                <EyeOff className="h-3.5 w-3.5 text-destructive" />
                Ocultar obra
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {work.creator?.username && (
              <DropdownMenuItem asChild>
                <Link href={`/u/${work.creator.username}`}>
                  Ver perfil del creador
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onOpen}>
              <PanelRight className="h-3.5 w-3.5" />
              Abrir panel completo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function Metric({ value }: { value: number }) {
  return (
    <span className="hidden md:block text-right text-sm font-medium tabular-nums">
      {Intl.NumberFormat("es", { notation: "compact" }).format(value)}
    </span>
  );
}

function MiniFlag({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof EyeOff;
  label: string;
  tone: "danger" | "warning" | "primary" | "success" | "rose";
}) {
  const cls = {
    danger: "bg-destructive/15 text-destructive border-destructive/30",
    warning: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    primary: "bg-primary/15 text-primary border-primary/30",
    success: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    rose: "bg-rose-500/15 text-rose-500 border-rose-500/30",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium", cls)}>
      <Icon className="h-2.5 w-2.5" /> {label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
    published: {
      label: "Publicada",
      cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
      Icon: CheckCircle2,
    },
    review: {
      label: "En revisión",
      cls: "bg-amber-500/15 text-amber-500 border-amber-500/30",
      Icon: Clock,
    },
    draft: {
      label: "Borrador",
      cls: "bg-muted text-muted-foreground border-border/60",
      Icon: FileEdit,
    },
  };
  const meta = map[status] ?? map.draft;
  const Icon = meta.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border",
        meta.cls
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
