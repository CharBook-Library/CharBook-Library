"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  BookText,
  Eye,
  EyeOff,
  Heart,
  Star,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  Clock,
  FileEdit,
  Pencil,
  Trash2,
  ExternalLink,
  Send,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { worksApi } from "@/lib/api-creator";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { MyWork, WorkSubmissionStatus } from "@/lib/types";

type FilterStatus = "all" | "draft" | "review" | "published";

const EMPTY_WORKS: MyWork[] = [];

const TABS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "published", label: "Publicadas" },
  { value: "review", label: "En revisión" },
  { value: "draft", label: "Borradores" },
];

export default function MyWorksPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<FilterStatus>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["my-works", status, page],
    queryFn: () => worksApi.mine(status, page),
    enabled: !!user,
    placeholderData: (previous) => previous,
  });

  const works = data?.data ?? EMPTY_WORKS;
  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return works;
    return works.filter((work) => work.title.toLowerCase().includes(term));
  }, [search, works]);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Studio
          </p>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight tracking-tight md:text-3xl">
            Mis Obras
          </h1>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/studio/obras/nueva">
            <Plus className="mr-1.5 h-4 w-4" />
            Nueva Obra
          </Link>
        </Button>
      </header>

      <div className="mt-6 flex flex-col gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <nav className="flex gap-1 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
          {TABS.map((tab) => {
            const active = status === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => {
                  setStatus(tab.value);
                  setPage(1);
                }}
                className={cn(
                  "relative whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en mis obras..."
            className="h-9 w-full rounded-md border border-border/60 bg-background pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </div>
      </div>

      <div className="mt-4">
        {/* `!user` también muestra skeleton: en SSR no hay usuario (auth es
            client-side), así el primer render del cliente coincide con el del
            servidor y se evita el error de hydration. */}
        {isLoading || !user ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState status={status} hasQuery={!!search.trim()} />
        ) : (
          <>
            <div className="hidden grid-cols-[1fr_120px_80px_80px_80px_80px_40px] gap-4 border-b border-border/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
              <span>Obra</span>
              <span>Estado</span>
              <span className="text-right">Lectores</span>
              <span className="text-right">Lecturas</span>
              <span className="text-right">Favs</span>
              <span className="text-right">Rating</span>
              <span></span>
            </div>

            <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card md:border-x-0 md:border-b-0 md:border-t-0">
              {filtered.map((w) => (
                <WorkListItem key={w.id} work={w} />
              ))}
            </ul>

            {data && data.meta.last_page > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2 text-muted-foreground">
                  Página {data.meta.current_page} de {data.meta.last_page}
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
          </>
        )}
      </div>
    </div>
  );
}

// ───────────────── WorkListItem con acciones ─────────────────
function WorkListItem({ work }: { work: MyWork }) {
  const s = STATUS[work.submission_status];
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["my-works"] });
  };

  const statusMutation = useMutation({
    mutationFn: (newStatus: "draft" | "published") =>
      worksApi.update(work.id, { submission_status: newStatus }),
    onSuccess: (_, newStatus) => {
      toast.success(
        newStatus === "published" ? "Obra publicada" : "Obra pasada a borrador"
      );
      invalidate();
    },
    onError: () => toast.error("No se pudo actualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => worksApi.remove(work.id),
    onSuccess: () => {
      toast.success("Obra eliminada");
      invalidate();
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const isPublished =
    work.submission_status === "published" && !!work.is_published;
  const busy = statusMutation.isPending || deleteMutation.isPending;

  return (
    <li className="grid grid-cols-1 gap-3 px-4 py-3 transition-colors hover:bg-accent/40 md:grid-cols-[1fr_120px_80px_80px_80px_80px_40px] md:items-center md:gap-4">
      <Link
        href={`/studio/obras/${work.id}/editar`}
        className="flex items-center gap-3 min-w-0"
      >
        <div className="h-14 w-10 shrink-0 overflow-hidden rounded border border-border/60 bg-muted">
          {work.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={work.cover} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-medium hover:text-primary">
            {work.title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {work.content_type
              ? capitalize(work.content_type.replace("_", " "))
              : "Sin tipo"}
            {" · "}
            {timeAgo(work.updated_at)}
          </p>
        </div>
      </Link>

      <div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
            s.cls
          )}
        >
          <s.icon className="h-2.5 w-2.5" />
          {s.label}
        </span>
      </div>

      <Metric icon={<Eye className="h-3 w-3" />} value={work.unique_readers_count ?? work.views_count} />
      <Metric icon={<BookText className="h-3 w-3" />} value={work.total_readings_count ?? 0} />
      <Metric icon={<Heart className="h-3 w-3" />} value={work.favorites_count} />
      <Metric
        icon={<Star className="h-3 w-3" />}
        value={work.rating_count > 0 ? work.rating_average.toFixed(1) : "—"}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Acciones"
            disabled={busy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs uppercase tracking-wider">
            {work.title}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {isPublished && (
            <DropdownMenuItem asChild>
              <Link
                href={`/libro/${work.slug}`}
                target="_blank"
                className="cursor-pointer"
              >
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Ver publicada
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem asChild>
            <Link
              href={`/studio/obras/${work.id}/editar`}
              className="cursor-pointer"
            >
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Editar obra
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {isPublished ? (
            <DropdownMenuItem
              onClick={() => statusMutation.mutate("draft")}
              className="cursor-pointer"
            >
              <EyeOff className="mr-2 h-3.5 w-3.5" />
              Pasar a borrador
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => statusMutation.mutate("published")}
              className="cursor-pointer"
            >
              <Send className="mr-2 h-3.5 w-3.5" />
              Publicar
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => {
              if (
                confirm(
                  `Eliminar "${work.title}"? Esta acción no se puede deshacer.`
                )
              ) {
                deleteMutation.mutate();
              }
            }}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Eliminar obra
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function Metric({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: number | string;
}) {
  return (
    <div className="flex items-center justify-start gap-1 text-xs tabular-nums text-muted-foreground md:justify-end">
      <span className="text-muted-foreground/60">{icon}</span>
      <span>{value}</span>
    </div>
  );
}

function EmptyState({
  status,
  hasQuery,
}: {
  status: FilterStatus;
  hasQuery: boolean;
}) {
  if (hasQuery) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-card/40 py-12 text-center">
        <Search className="mx-auto h-7 w-7 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">
          No se encontraron obras con esa búsqueda.
        </p>
      </div>
    );
  }

  if (status === "all") {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-card/40 py-16 text-center">
        <BookText className="mx-auto h-9 w-9 text-muted-foreground/50" />
        <h3 className="mt-4 font-serif text-lg font-bold">Aún sin obras</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Cuando publiques tu primera obra aparecerá aquí.
        </p>
        <Button asChild className="mt-5">
          <Link href="/studio/obras/nueva">
            <Plus className="mr-1.5 h-4 w-4" />
            Crear mi primera obra
          </Link>
        </Button>
      </div>
    );
  }

  const copy = {
    published: "No tienes obras publicadas todavía.",
    review: "No tienes obras en revisión.",
    draft: "No tienes borradores guardados.",
  }[status];

  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-card/40 py-12 text-center">
      <p className="text-sm text-muted-foreground">{copy}</p>
    </div>
  );
}

const STATUS: Record<
  WorkSubmissionStatus,
  { label: string; cls: string; icon: typeof Clock }
> = {
  draft: {
    label: "Borrador",
    cls: "bg-muted text-muted-foreground border border-border/60",
    icon: FileEdit,
  },
  review: {
    label: "En revisión",
    cls: "bg-amber-500/10 text-amber-500 border border-amber-500/30",
    icon: Clock,
  },
  published: {
    label: "Publicado",
    cls: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30",
    icon: CheckCircle2,
  },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
