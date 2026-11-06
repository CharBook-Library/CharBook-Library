"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy,
  BadgeCheck,
  Book,
  Users,
  Search,
  Flame,
  Sparkles,
  Star,
  Heart,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CreatorBadge } from "@/components/creator/creator-badge";
import { cn } from "@/lib/utils";
import type {
  CreatorBookCard,
  CreatorDirectoryEntry,
  CreatorsDirectory,
} from "@/lib/types";

interface CategoryItem {
  id: number;
  name: string;
  slug: string;
  books_count: number;
}

type BooksSort = "trending" | "new_creators" | "top_rated" | "most_saved";

const SORT_TABS: { key: BooksSort; label: string; icon: typeof Flame }[] = [
  { key: "trending", label: "Tendencias de la semana", icon: Flame },
  { key: "new_creators", label: "Nuevos creadores", icon: Sparkles },
  { key: "top_rated", label: "Mejor reseñados", icon: Star },
  { key: "most_saved", label: "Más guardados", icon: Heart },
];

export default function CreatorsDirectoryPage() {
  const [sort, setSort] = useState<BooksSort>("trending");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: directory, isLoading: loadingDir } = useQuery({
    queryKey: ["creators-directory"],
    queryFn: () =>
      apiClient.get<CreatorsDirectory>("/creators").then((r) => r.data),
  });

  const { data: categories } = useQuery({
    queryKey: ["creators-categories"],
    queryFn: () =>
      apiClient
        .get<{ data: CategoryItem[] }>("/creators/categories")
        .then((r) => r.data.data),
  });

  const { data: booksData, isLoading: loadingBooks } = useQuery({
    queryKey: ["creators-books", { sort, activeCategory, page }],
    queryFn: () =>
      apiClient
        .get<{
          data: CreatorBookCard[];
          meta: { current_page: number; last_page: number; total: number };
        }>("/creators/books", {
          params: {
            sort,
            page,
            ...(activeCategory ? { category: activeCategory } : {}),
          },
        })
        .then((r) => r.data),
  });

  const books = booksData?.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <header className="border-b border-border/60 pb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Directorio
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight md:text-4xl">
          Creadores
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
          Descubre las obras de la comunidad y a los autores que las firman.
        </p>
      </header>

      {/* ═══ 2 columnas: obras (izq) + directorio compacto (der) ═══ */}
      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_290px] lg:items-start lg:gap-10">
        {/* ─────────── IZQUIERDA: OBRAS ─────────── */}
        <section className="min-w-0">
          <div className="mb-4 flex items-center gap-2 border-b border-border/60 pb-3">
            <Book className="h-4 w-4 text-primary" />
            <h2 className="font-serif text-lg font-bold tracking-tight">
              Obras de creadores
            </h2>
            {booksData && (
              <span className="text-xs text-muted-foreground tabular-nums">
                · {booksData.meta.total}
              </span>
            )}
          </div>

          {/* Secciones / orden */}
          <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex gap-2 whitespace-nowrap pb-1">
              {SORT_TABS.map((t) => {
                const Icon = t.icon;
                const active = sort === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => { setSort(t.key); setPage(1); }}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categorías */}
          <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex gap-2 whitespace-nowrap pb-1">
              <CategoryChip
                active={activeCategory === null}
                onClick={() => { setActiveCategory(null); setPage(1); }}
                label="Todas"
              />
              {categories
                ?.filter((cat) => cat.books_count > 0)
                .map((cat) => (
                  <CategoryChip
                    key={cat.id}
                    active={activeCategory === cat.slug}
                    onClick={() => { setActiveCategory(cat.slug); setPage(1); }}
                    label={cat.name}
                    count={cat.books_count}
                  />
                ))}
            </div>
          </div>

          {/* Grid de obras */}
          {loadingBooks ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[2/3] rounded-md" />
              ))}
            </div>
          ) : books.length === 0 ? (
            <EmptyHint
              text={
                activeCategory
                  ? "No hay obras de creadores en esta categoría todavía."
                  : "Aún no hay obras de creadores publicadas."
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {books.map((b) => (
                <BookTile key={b.id} book={b} sort={sort} />
              ))}
            </div>
          )}

          {/* Paginación */}
          {booksData && booksData.meta.last_page > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2 text-xs">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-3 text-muted-foreground">
                Página {booksData.meta.current_page} de {booksData.meta.last_page}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= booksData.meta.last_page}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </section>

        {/* ─────────── DERECHA: DIRECTORIO COMPACTO ─────────── */}
        <CreatorsSidebar
          featured={directory?.featured ?? []}
          verified={directory?.verified ?? []}
          loading={loadingDir}
        />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────
// Sidebar discreto: destacados + verificados con buscador
// ───────────────────────────────────────────────────────
function CreatorsSidebar({
  featured,
  verified,
  loading,
}: {
  featured: CreatorDirectoryEntry[];
  verified: CreatorDirectoryEntry[];
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const match = (c: CreatorDirectoryEntry) =>
    !q ||
    c.name.toLowerCase().includes(q) ||
    (c.username ?? "").toLowerCase().includes(q);

  const filteredFeatured = useMemo(() => featured.filter(match), [featured, q]);
  const filteredVerified = useMemo(() => verified.filter(match), [verified, q]);
  const noResults = q && filteredFeatured.length === 0 && filteredVerified.length === 0;

  return (
    <aside className="mt-10 lg:sticky lg:top-20 lg:mt-0">
      <div className="rounded-xl border border-border/60 bg-card/50 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Creadores
        </h2>

        {/* Buscador */}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar creador…"
            className="h-8 w-full rounded-md border border-border/50 bg-background pl-8 pr-2.5 text-xs outline-none placeholder:text-muted-foreground/50 focus-visible:border-primary/40"
          />
        </div>

        {loading ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 rounded-md" />
            ))}
          </div>
        ) : noResults ? (
          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Sin resultados para “{query}”.
          </p>
        ) : (
          <>
            {/* Destacados — el recuadro siempre está, aunque no haya */}
            {(filteredFeatured.length > 0 || !q) && (
              <SidebarGroup
                icon={<Trophy className="h-3 w-3 text-amber-500" />}
                label="Destacados"
              >
                {filteredFeatured.length > 0 ? (
                  filteredFeatured.map((c) => (
                    <SidebarCreatorRow key={c.id} entry={c} />
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-border/50 px-2 py-2.5 text-center text-[10px] text-muted-foreground/70">
                    Aún no hay autores destacados.
                  </p>
                )}
              </SidebarGroup>
            )}

            {/* Verificados — el recuadro siempre está, aunque no haya */}
            {(filteredVerified.length > 0 || !q) && (
              <SidebarGroup
                icon={<BadgeCheck className="h-3 w-3 text-emerald-400" />}
                label="Verificados"
              >
                {filteredVerified.length > 0 ? (
                  filteredVerified.map((c) => (
                    <SidebarCreatorRow key={c.id} entry={c} />
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-border/50 px-2 py-2.5 text-center text-[10px] text-muted-foreground/70">
                    Aún no hay autores verificados.
                  </p>
                )}
              </SidebarGroup>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function SidebarGroup({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {icon}
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarCreatorRow({ entry }: { entry: CreatorDirectoryEntry }) {
  const href = entry.username ? `/u/${entry.username}` : "#";

  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-accent/50"
    >
      <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-border/50">
        {entry.avatar ? (
          <Image
            src={entry.avatar}
            alt={entry.name}
            fill
            sizes="28px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/15 text-[10px] font-medium text-primary">
            {entry.name?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-xs font-medium group-hover:text-primary">
            {entry.name}
          </span>
          <CreatorBadge level={entry.creator_level} size="xs" iconOnly />
        </div>
        {entry.username && (
          <span className="block truncate text-[10px] text-muted-foreground/70">
            @{entry.username}
          </span>
        )}
      </div>
      <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground/60 tabular-nums">
        <Users className="h-2.5 w-2.5" />
        {entry.stats.followers}
      </span>
    </Link>
  );
}

// ───────────────────────────────────────────────────────
function CategoryChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border/60 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {label}
      {count != null && (
        <span className="rounded px-1 text-[10px] tabular-nums text-muted-foreground/60">
          {count}
        </span>
      )}
    </button>
  );
}

// ───────────────────────────────────────────────────────
// BookTile — con dato contextual según la sección activa
// ───────────────────────────────────────────────────────
function BookTile({ book, sort }: { book: CreatorBookCard; sort: BooksSort }) {
  const contextStat = (() => {
    switch (sort) {
      case "trending":
        return (book.weekly_views ?? 0) > 0
          ? { icon: Flame, text: `${book.weekly_views} esta semana` }
          : null;
      case "top_rated":
        return book.rating_count > 0
          ? { icon: Star, text: `${book.rating_average.toFixed(1)} ★ (${book.rating_count})` }
          : null;
      case "most_saved":
        return (book.favorites_count ?? 0) > 0
          ? { icon: Heart, text: `${book.favorites_count} guardados` }
          : null;
      default:
        return null;
    }
  })();

  return (
    <div className="group block">
      <Link href={`/libro/${book.slug}`} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-md border border-border/60 bg-muted">
          {book.cover ? (
            <Image
              src={book.cover}
              alt={book.title}
              fill
              sizes="(max-width: 640px) 50vw, 220px"
              className="object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
              <Book className="h-8 w-8" />
            </div>
          )}
          {book.access_type === "premium" && (
            <span className="absolute right-1.5 top-1.5 rounded bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-950">
              Premium
            </span>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-xs font-medium leading-snug group-hover:text-primary">
          {book.title}
        </p>
      </Link>

      {book.creator?.username ? (
        <Link
          href={`/u/${book.creator.username}`}
          className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <span className="line-clamp-1">{book.creator.name}</span>
          <CreatorBadge level={book.creator.creator_level} size="xs" iconOnly />
        </Link>
      ) : book.creator?.name ? (
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="line-clamp-1">{book.creator.name}</span>
          <CreatorBadge level={book.creator.creator_level} size="xs" iconOnly />
        </div>
      ) : null}

      {contextStat && (
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-primary/80">
          <contextStat.icon className="h-2.5 w-2.5" />
          {contextStat.text}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────
function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-card/40 py-8 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
