"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  Heart,
  MessageSquare,
  Star,
  ArrowUpRight,
  Plus,
  BookText,
  CheckCircle2,
  Clock,
  FileEdit,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { worksApi } from "@/lib/api-creator";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { MyWork, WorkSubmissionStatus } from "@/lib/types";

const EMPTY_WORKS: MyWork[] = [];

export default function StudioDashboardPage() {
  const { user, isLoading: loadingUser } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["my-works", "all"],
    queryFn: () => worksApi.mine("all"),
    enabled: !!user,
  });

  const works = data?.data ?? EMPTY_WORKS;

  // Agregados
  const totals = useMemo(
    () =>
      works.reduce(
        (acc, w) => ({
          readers: acc.readers + (w.unique_readers_count ?? w.views_count),
          readings: acc.readings + (w.total_readings_count ?? 0),
          favs: acc.favs + w.favorites_count,
          reviews: acc.reviews + w.rating_count,
          published: acc.published + (w.is_published ? 1 : 0),
        }),
        { readers: 0, readings: 0, favs: 0, reviews: 0, published: 0 }
      ),
    [works]
  );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      {/* ───────── HEADER ───────── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Dashboard
          </p>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight tracking-tight md:text-3xl">
            {loadingUser ? <Skeleton className="h-8 w-48" /> : `Hola, ${user?.name}`}
          </h1>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/studio/obras/nueva">
            <Plus className="mr-1.5 h-4 w-4" />
            Nueva Obra
          </Link>
        </Button>
      </header>

      {/* ───────── KPIs ───────── */}
      <section className="mt-6 grid grid-cols-2 gap-3 md:mt-8 md:grid-cols-5 md:gap-4">
        <KpiTile
          label="Obras publicadas"
          value={totals.published}
          icon={<BookText className="h-4 w-4" />}
          loading={isLoading}
        />
        <KpiTile
          label="Lectores unicos"
          value={totals.readers}
          icon={<Eye className="h-4 w-4" />}
          loading={isLoading}
        />
        <KpiTile
          label="Lecturas totales"
          value={totals.readings}
          icon={<BookText className="h-4 w-4" />}
          loading={isLoading}
        />
        <KpiTile
          label="Favoritos"
          value={totals.favs}
          icon={<Heart className="h-4 w-4" />}
          loading={isLoading}
        />
        <KpiTile
          label="Reseñas"
          value={totals.reviews}
          icon={<MessageSquare className="h-4 w-4" />}
          loading={isLoading}
        />
      </section>

      {/* ───────── EMPTY STATE (sin obras) ───────── */}
      {!isLoading && works.length === 0 ? (
        <EmptyDashboard />
      ) : (
        <>
          {/* ───────── ÚLTIMAS OBRAS ───────── */}
          <section className="mt-10">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="font-serif text-lg font-bold tracking-tight">
                  Tus obras recientes
                </h2>
                <p className="text-xs text-muted-foreground">
                  Las últimas obras que has publicado o estás trabajando.
                </p>
              </div>
              <Link
                href="/studio/obras"
                className="hidden text-xs font-medium text-muted-foreground hover:text-foreground sm:inline-flex sm:items-center sm:gap-1"
              >
                Ver todas <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="rounded-lg border border-border/60 bg-card">
              {isLoading ? (
                <ul className="divide-y divide-border/60">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <li key={i} className="p-4">
                      <Skeleton className="h-12 w-full" />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="divide-y divide-border/60">
                  {works.slice(0, 5).map((w) => (
                    <WorkRow key={w.id} work={w} />
                  ))}
                </ul>
              )}
            </div>

            <Link
              href="/studio/obras"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground sm:hidden"
            >
              Ver todas <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </section>

          {/* ───────── PRÓXIMOS PASOS / CHECKLIST ───────── */}
          <ChecklistSection works={works} hasUsername={!!user?.username} />
        </>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────
// Componentes
// ───────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  icon,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <span className="text-muted-foreground/70">{icon}</span>
      </div>
      <div className="mt-2 font-serif text-2xl font-bold tabular-nums md:text-3xl">
        {loading ? <Skeleton className="h-8 w-12" /> : value.toLocaleString("es")}
      </div>
    </div>
  );
}

function WorkRow({ work }: { work: MyWork }) {
  const statusInfo = STATUS[work.submission_status];
  return (
    <li>
      <Link
        href={`/studio/obras/${work.id}/editar`}
        className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/40"
      >
        <div className="h-14 w-10 shrink-0 overflow-hidden rounded border border-border/60 bg-muted">
          {work.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={work.cover}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="line-clamp-1 text-sm font-medium">{work.title}</p>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                statusInfo.cls
              )}
            >
              <statusInfo.icon className="h-2.5 w-2.5" />
              {statusInfo.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {work.content_type ? capitalize(work.content_type.replace("_", " ")) : "Sin tipo"}
            {" · "}
            Actualizado {timeAgo(work.updated_at)}
          </p>
        </div>
        <div className="hidden items-center gap-5 text-xs text-muted-foreground sm:flex">
          <StatCol icon={<Eye className="h-3 w-3" />} value={work.unique_readers_count ?? work.views_count} />
          <StatCol icon={<Heart className="h-3 w-3" />} value={work.favorites_count} />
          <StatCol icon={<Star className="h-3 w-3" />} value={work.rating_average.toFixed(1)} />
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
      </Link>
    </li>
  );
}

function StatCol({ icon, value }: { icon: React.ReactNode; value: number | string }) {
  return (
    <div className="flex items-center gap-1 tabular-nums">
      <span className="text-muted-foreground/60">{icon}</span>
      <span>{value}</span>
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div className="mt-10 rounded-lg border border-dashed border-border/60 bg-card/40 p-10 text-center">
      <BookText className="mx-auto h-8 w-8 text-muted-foreground/50" />
      <h3 className="mt-4 font-serif text-lg font-bold">
        Tu Studio está listo
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Aún no has publicado ninguna obra. Empieza por la primera y nosotros
        nos encargamos del resto.
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

function ChecklistSection({
  works,
  hasUsername,
}: {
  works: MyWork[];
  hasUsername: boolean;
}) {
  const items = [
    { label: "Crea tu primer perfil completo", done: hasUsername, href: "/ajustes/perfil" },
    { label: "Publica tu primera obra", done: works.length > 0, href: "/studio/obras/nueva" },
    {
      label: "Recibe tu primera reseña",
      done: works.some((w) => w.rating_count > 0),
      href: "/studio/comentarios",
    },
    {
      label: "Personaliza tu Atelier público",
      done: false,
      href: "/studio/anuncios",
    },
  ];
  const completed = items.filter((i) => i.done).length;

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="font-serif text-lg font-bold tracking-tight">
            Próximos pasos
          </h2>
          <p className="text-xs text-muted-foreground">
            {completed} de {items.length} completados
          </p>
        </div>
      </div>
      <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
        {items.map((it) => (
          <li key={it.label}>
            <Link
              href={it.href}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  it.done
                    ? "border-emerald-400 bg-emerald-400/20 text-emerald-400"
                    : "border-border"
                )}
              >
                {it.done && <CheckCircle2 className="h-3 w-3" />}
              </span>
              <span
                className={cn(
                  "flex-1 text-sm",
                  it.done && "text-muted-foreground line-through"
                )}
              >
                {it.label}
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground/40" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ───────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────

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
