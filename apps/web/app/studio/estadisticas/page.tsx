"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, BookText, Eye, Heart, MessageSquare,
  Star, Users, BookOpen, Layers, BookImage, Plus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { studioApi, type StudioWorkStats } from "@/lib/api-creator";
import { cn } from "@/lib/utils";

const nf = Intl.NumberFormat("es", { notation: "compact" });

export default function StatsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["studio-stats"],
    queryFn: () => studioApi.stats(),
  });

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-6">
        <Skeleton className="h-9 w-56" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const totals = data?.totals;
  const works = data?.works ?? [];
  const maxViews = Math.max(1, ...works.map((w) => w.views));

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Estadísticas
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          El rendimiento de todas tus obras, en un vistazo.
        </p>
      </div>

      {works.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-card/40 py-16 text-center">
          <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Aún no has publicado obras — cuando lo hagas, aquí verás sus números.
          </p>
          <Button asChild className="mt-4">
            <Link href="/studio/obras/nueva">
              <Plus className="mr-1.5 h-4 w-4" />
              Crear mi primera obra
            </Link>
          </Button>
        </Card>
      ) : (
        <>
          {/* ───── KPIs ───── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile
              icon={Eye}
              label="Vistas totales"
              value={nf.format(totals?.views ?? 0)}
            />
            <StatTile
              icon={BookText}
              label="Lecturas"
              value={nf.format(totals?.readings ?? 0)}
            />
            <StatTile
              icon={Heart}
              label="Favoritos"
              value={nf.format(totals?.favorites ?? 0)}
            />
            <StatTile
              icon={Users}
              label="Seguidores"
              value={nf.format(totals?.followers ?? 0)}
            />
            <StatTile
              icon={MessageSquare}
              label="Comentarios"
              value={nf.format(totals?.comments ?? 0)}
            />
            <StatTile
              icon={Star}
              label="Valoración media"
              value={
                (totals?.rating_count ?? 0) > 0
                  ? `${totals!.rating_average.toFixed(1)} ★`
                  : "—"
              }
              hint={
                (totals?.rating_count ?? 0) > 0
                  ? `${totals!.rating_count} valoraciones`
                  : "Sin valoraciones aún"
              }
            />
            <StatTile
              icon={BookOpen}
              label="Obras publicadas"
              value={String(totals?.published ?? 0)}
              hint={`${totals?.drafts ?? 0} borradores · ${totals?.in_review ?? 0} en revisión`}
            />
            <StatTile
              icon={BarChart3}
              label="Obras totales"
              value={String(totals?.works ?? 0)}
            />
          </div>

          {/* ───── Rendimiento por obra ───── */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-serif text-lg font-bold">Rendimiento por obra</h2>
              <span className="text-xs text-muted-foreground">
                Ordenadas por vistas
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
              <div className="hidden md:grid grid-cols-[minmax(0,1fr)_repeat(4,84px)] items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Obra · vistas</span>
                <span className="text-right">Lecturas</span>
                <span className="text-right">Favoritos</span>
                <span className="text-right">Capítulos</span>
                <span className="text-right">Valoración</span>
              </div>
              <div className="divide-y divide-border/60">
                {works.map((w) => (
                  <WorkStatsRow key={w.id} work={w} maxViews={maxViews} />
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="border-border/60 bg-card p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums leading-none">
        {value}
      </div>
      {hint && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>
      )}
    </Card>
  );
}

const FORMAT_ICON = {
  serie: Layers,
  libro_completo: BookText,
  comic: BookImage,
} as const;

function WorkStatsRow({
  work,
  maxViews,
}: {
  work: StudioWorkStats;
  maxViews: number;
}) {
  const FormatIcon = work.work_format
    ? FORMAT_ICON[work.work_format] ?? BookText
    : BookText;
  const pct = Math.max(2, Math.round((work.views / maxViews) * 100));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_repeat(4,84px)] items-center gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="h-12 w-9 shrink-0 overflow-hidden rounded border border-border/60 bg-muted">
          {work.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={work.cover} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/studio/obras/${work.id}/editar`}
              className="line-clamp-1 text-sm font-medium hover:text-primary"
            >
              {work.title}
            </Link>
            <FormatIcon className="h-3 w-3 shrink-0 text-muted-foreground/60" />
            {work.submission_status !== "published" && (
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                {work.submission_status === "review" ? "En revisión" : "Borrador"}
              </span>
            )}
          </div>
          {/* Barra de vistas (relativa a la obra más vista) */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-medium tabular-nums">
              {nf.format(work.views)}
            </span>
          </div>
        </div>
      </div>

      <Cell value={nf.format(work.readings)} />
      <Cell value={nf.format(work.favorites)} />
      <Cell value={String(work.chapters_count)} />
      <Cell
        value={
          work.rating_count > 0 ? `${work.rating_average.toFixed(1)} ★` : "—"
        }
      />
    </div>
  );
}

function Cell({ value }: { value: string }) {
  return (
    <span className={cn("hidden md:block text-right text-sm tabular-nums text-foreground/90")}>
      {value}
    </span>
  );
}
