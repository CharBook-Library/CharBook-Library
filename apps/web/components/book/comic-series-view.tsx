import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BookImage, Eye, Heart, Play, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/social/favorite-button";
import { ReadingStatusButton } from "@/components/social/reading-status-button";
import { AddToAnthologyButton } from "@/components/anthology/add-to-anthology-button";
import { ReportButton } from "@/components/report/report-button";
import { DownloadWorkButton } from "@/components/book/download-work-button";
import { CreatorBadge } from "@/components/creator/creator-badge";
import { ComicEpisodeList } from "@/components/book/comic-episode-list";
import type { BookDetail, Category, ChapterSummary, CreatorLevel } from "@/lib/types";

type AccessInfo = { access: boolean; reason: string; coin_price: number };

type ComicBook = BookDetail & {
  allow_download?: boolean;
  age_rating?: "all" | "teen" | "mature" | "explicit" | null;
  tags?: string[];
  author_note_start?: string | null;
  pages_count?: number;
  creator?: {
    id: number;
    name: string;
    username: string | null;
    avatar: string | null;
    creator_level?: CreatorLevel;
  } | null;
};

/**
 * Página de aterrizaje de un CÓMIC estilo WEBTOON: hero con portada + arte de
 * fondo, datos y CTA de lectura, sinopsis y la lista de EPISODIOS con miniaturas.
 */
export function ComicSeriesView({
  book,
  chapters,
  slug,
  readHref,
  accessByNumber = {},
}: {
  book: ComicBook;
  chapters: ChapterSummary[];
  slug: string;
  readHref: string | null;
  accessByNumber?: Record<number, AccessInfo>;
}) {
  return (
    <div>
      {/* ═══════ HERO ═══════ */}
      <div className="relative overflow-hidden border-b border-border/60">
        {book.cover && (
          <div aria-hidden className="absolute inset-0">
            <Image src={book.cover} alt="" fill priority className="scale-110 object-cover opacity-25 blur-2xl" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
          </div>
        )}

        <div className="relative mx-auto max-w-5xl px-4 py-6 md:py-10">
          <Link
            href="/catalogo"
            className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Volver al catálogo
          </Link>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="relative aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-xl border border-border/60 shadow-2xl sm:w-44">
              {book.cover ? (
                <Image src={book.cover} alt={book.title} fill sizes="176px" className="object-cover" priority />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground/40">
                  <BookImage className="h-10 w-10" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
                  <BookImage className="h-3 w-3" /> Cómic
                </Badge>
                {book.categories?.slice(0, 2).map((c: Category) => (
                  <Link
                    key={c.id}
                    href={`/catalogo?category=${c.slug}`}
                    className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20"
                  >
                    {c.name}
                  </Link>
                ))}
                {book.age_rating && book.age_rating !== "all" && (
                  <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-500">
                    {book.age_rating === "teen" ? "13+" : book.age_rating === "mature" ? "18+" : "Explícito 18+"}
                  </Badge>
                )}
              </div>

              <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight md:text-5xl">
                {book.title}
              </h1>

              {book.creator ? (
                <Link
                  href={book.creator.username ? `/u/${book.creator.username}` : "#"}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm hover:text-primary"
                >
                  {book.creator.avatar && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={book.creator.avatar} alt="" className="h-5 w-5 rounded-full border border-border/60" />
                  )}
                  <span className="font-medium">{book.creator.name}</span>
                  <CreatorBadge level={book.creator.creator_level} size="xs" iconOnly />
                </Link>
              ) : book.author ? (
                <p className="mt-2 text-sm font-medium">{book.author.name}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  <span className="tabular-nums">{book.views_count.toLocaleString("es")}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5" />
                  <span className="tabular-nums">{book.favorites_count.toLocaleString("es")}</span>
                </span>
                {book.rating_count > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-medium tabular-nums text-foreground">{Number(book.rating_average).toFixed(1)}</span>
                  </span>
                )}
                {chapters.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <BookImage className="h-3.5 w-3.5" />
                    <span>{chapters.length} episodios</span>
                  </span>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {readHref && (
                  <Button asChild size="lg" className="bg-primary text-primary-foreground">
                    <Link href={readHref}>
                      <Play className="mr-1.5 h-4 w-4" /> Empezar a leer
                    </Link>
                  </Button>
                )}
                <ReadingStatusButton slug={book.slug} initialStatus={book.my_status} size="lg" />
                <FavoriteButton
                  slug={book.slug}
                  initialFavorited={book.is_favorited}
                  initialCount={book.favorites_count}
                  size="lg"
                />
                <AddToAnthologyButton bookId={book.id} size="lg" />
                {book.allow_download && <DownloadWorkButton slug={book.slug} title={book.title} />}
                <ReportButton targetType="book" targetId={book.id} variant="full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ SINOPSIS + EPISODIOS ═══════ */}
      <div className="mx-auto max-w-5xl px-4 py-8">
        {book.author_note_start && (
          <div className="mb-6 rounded-lg border-l-4 border-primary/60 bg-card p-4">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">Nota del autor</p>
            <p className="whitespace-pre-line text-sm italic leading-relaxed text-foreground/90">{book.author_note_start}</p>
          </div>
        )}

        <section className="space-y-3">
          <h2 className="font-serif text-xl font-bold">Sinopsis</h2>
          <p className="whitespace-pre-line leading-relaxed text-foreground/90">
            {book.description ?? "Sin descripción disponible."}
          </p>
        </section>

        {book.tags && book.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {book.tags.map((tag: string) => (
              <Link
                key={tag}
                href={`/catalogo?search=${encodeURIComponent(tag)}`}
                className="inline-flex items-center rounded-full border border-border/60 bg-card px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {chapters.length > 0 && (
          <section className="mt-10" id="episodios">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-2xl font-bold">Episodios</h2>
              <Badge variant="outline">{chapters.length}</Badge>
            </div>
            <ComicEpisodeList slug={slug} chapters={chapters} accessByNumber={accessByNumber} />
          </section>
        )}
      </div>
    </div>
  );
}
