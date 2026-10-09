import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  BookOpen, Heart, Star, Calendar, Globe,
  Eye, ArrowLeft, Layers, BookText, BookImage,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { DownloadWorkButton } from "@/components/book/download-work-button";
import { FavoriteButton } from "@/components/social/favorite-button";
import { ReadingStatusButton } from "@/components/social/reading-status-button";
import { AddToAnthologyButton } from "@/components/anthology/add-to-anthology-button";
import { ReviewsSection } from "@/components/social/reviews-section";
import { ComicSeriesView } from "@/components/book/comic-series-view";
import { ChapterList } from "@/components/book/chapter-list";
import { BuyButtons } from "@/components/affiliate/buy-buttons";
import { ReportButton } from "@/components/report/report-button";
import { CreatorBadge } from "@/components/creator/creator-badge";
import { BookViewTracker } from "@/components/book/book-view-tracker";
import type { BookDetail, Category, ChapterSummary, CreatorLevel } from "@/lib/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { data: book } = await api.books.get(slug);
    return {
      title: book.title,
      description:
        book.description?.slice(0, 160) ??
        `${book.title}. Léelo en CharBook Library.`,
      openGraph: {
        title: book.title,
        description: book.description?.slice(0, 200) ?? "",
        images: book.cover ? [book.cover] : [],
        type: "book",
      },
    };
  } catch {
    return { title: "Libro no encontrado" };
  }
}

const FORMAT_META: Record<string, { label: string; icon: typeof BookText; readLabel: string }> = {
  serie: { label: "Serie por capítulos", icon: Layers, readLabel: "Empezar a leer" },
  libro_completo: { label: "Libro completo", icon: BookText, readLabel: "Leer ahora" },
  comic: { label: "Cómic", icon: BookImage, readLabel: "Empezar a leer" },
};

type BookDetailPageData = BookDetail & {
  allow_download?: boolean;
  work_format?: "serie" | "libro_completo" | "comic" | null;
  age_rating?: "all" | "teen" | "mature" | "explicit" | null;
  tags?: string[];
  author_note_start?: string | null;
  author_note_end?: string | null;
  chapters_count?: number;
  pages_count?: number;
  creator?: {
    id: number;
    name: string;
    username: string | null;
    avatar: string | null;
    creator_level?: CreatorLevel;
  } | null;
};

export default async function BookDetailPage({ params }: PageProps) {
  const { slug } = await params;

  let book: BookDetailPageData;
  try {
    book = (await api.books.get(slug)).data;
  } catch {
    notFound();
  }

  let chapters: ChapterSummary[] = [];
  let accessByNumber: Record<number, { access: boolean; reason: string; coin_price: number }> = {};
  if (book.work_format === "serie" || book.work_format === "comic") {
    try {
      chapters = (await api.books.chapters(slug)).data;
    } catch {
      chapters = [];
    }
    // Estado de paywall/lectura secuencial por capítulo (para marcar bloqueos).
    // Aplica a serie Y cómic por episodios (misma economía de CharCoins).
    if (chapters.length > 0) {
      try {
        const acc = await api.books.access(slug);
        for (const a of acc.data) accessByNumber[a.number] = a;
      } catch {
        accessByNumber = {};
      }
    }
  }

  const formatMeta = book.work_format ? FORMAT_META[book.work_format] : null;

  const readHref =
    (book.work_format === "serie" || book.work_format === "comic") && chapters[0]
      ? `/libro/${slug}/capitulo/${chapters[0].number}`
      : book.work_format === "comic"
        ? `/libro/${slug}/leer`
        : null;

  // ═══════ CÓMIC: página de aterrizaje estilo WEBTOON ═══════
  if (book.work_format === "comic") {
    return (
      <div>
        <BookViewTracker slug={book.slug} />
        <ComicSeriesView
          book={book}
          chapters={chapters}
          slug={slug}
          readHref={readHref}
          accessByNumber={accessByNumber}
        />
        <div className="mx-auto max-w-5xl px-4 pb-12">
          <ReviewsSection
            slug={book.slug}
            ratingAverage={Number(book.rating_average)}
            ratingCount={book.rating_count}
            myReview={book.my_review}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <BookViewTracker slug={book.slug} />
      {/* ───── Back link ───── */}
      <Link
        href="/catalogo"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-3 w-3" /> Volver al catálogo
      </Link>

      {/* ═══════ LAYOUT PRINCIPAL — 2 columnas ═══════ */}
      <div className="grid gap-8 md:grid-cols-[260px_1fr] md:gap-10">
        {/* ── Columna izquierda: portada ── */}
        <div>
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-border/60 shadow-lg">
            {book.cover ? (
              <Image
                src={book.cover}
                alt={book.title}
                fill
                sizes="260px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground/40">
                <BookOpen className="h-12 w-12" />
              </div>
            )}
            {book.access_type === "premium" && (
              <div className="absolute top-2 right-2 rounded bg-amber-500/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950">
                Premium
              </div>
            )}
          </div>

          {/* Affiliate links (compra externa) debajo de portada en desktop */}
          {book.affiliate_links && book.affiliate_links.length > 0 && (
            <div className="mt-4 hidden md:block">
              <BuyButtons links={book.affiliate_links} />
            </div>
          )}
        </div>

        {/* ── Columna derecha: info ── */}
        <div>
          {/* Badges de formato y edad */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {formatMeta && (
              <Badge variant="outline" className="border-primary/40 text-primary gap-1">
                <formatMeta.icon className="h-3 w-3" />
                {formatMeta.label}
              </Badge>
            )}
            {book.age_rating && book.age_rating !== "all" && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-500 text-[10px]">
                {book.age_rating === "teen" ? "13+" :
                 book.age_rating === "mature" ? "18+" : "Explícito 18+"}
              </Badge>
            )}
            {book.access_type === "free" && (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 text-[10px]">
                Gratis
              </Badge>
            )}
          </div>

          {/* Título */}
          <h1 className="font-serif text-3xl font-bold tracking-tight leading-tight md:text-4xl">
            {book.title}
          </h1>
          {book.subtitle && (
            <p className="mt-2 text-base text-muted-foreground italic">
              {book.subtitle}
            </p>
          )}

          {/* Autor / Creador */}
          <div className="mt-3 flex items-center gap-2 text-sm flex-wrap">
            {book.creator ? (
              <Link
                href={book.creator.username ? `/u/${book.creator.username}` : "#"}
                className="inline-flex items-center gap-1.5 hover:text-primary"
              >
                {book.creator.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={book.creator.avatar}
                    alt=""
                    className="h-5 w-5 rounded-full border border-border/60"
                  />
                )}
                <span className="font-medium">{book.creator.name}</span>
                <CreatorBadge level={book.creator.creator_level} size="xs" iconOnly />
              </Link>
            ) : book.author ? (
              <span className="font-medium">{book.author.name}</span>
            ) : null}
            {book.publication_year && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-muted-foreground">{book.publication_year}</span>
              </>
            )}
            {book.language && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-muted-foreground uppercase text-xs">
                  {book.language}
                </span>
              </>
            )}
          </div>

          {/* Stats compactos */}
          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              <span className="tabular-nums">{book.views_count.toLocaleString("es")}</span>
              <span className="sr-only">lectores unicos</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              <span className="tabular-nums">{book.favorites_count.toLocaleString("es")}</span>
            </span>
            {book.rating_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="tabular-nums font-medium text-foreground">
                  {Number(book.rating_average).toFixed(1)}
                </span>
                <span>({book.rating_count})</span>
              </span>
            )}
            {book.work_format === "serie" && (
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                <span>{chapters.length} cap.</span>
              </span>
            )}
          </div>

          {/* ───── CTAs ───── */}
          <div className="mt-6 flex flex-wrap gap-2">
            {readHref ? (
              <Button asChild size="lg" className="bg-primary text-primary-foreground">
                <Link href={readHref}>
                  <BookOpen className="mr-1.5 h-4 w-4" />
                  {formatMeta?.readLabel ?? "Leer"}
                </Link>
              </Button>
            ) : book.file_link ? (
              <Button asChild size="lg" className="bg-primary text-primary-foreground">
                <Link href={`/leer/${slug}`}>
                  <BookOpen className="mr-1.5 h-4 w-4" />
                  Leer ahora
                </Link>
              </Button>
            ) : null}

            {/* Descarga en un solo archivo — solo si el creador la habilitó. */}
            {book.allow_download && (
              <DownloadWorkButton slug={book.slug} title={book.title} />
            )}

            <ReadingStatusButton
              slug={book.slug}
              initialStatus={book.my_status}
              size="lg"
            />
            <FavoriteButton
              slug={book.slug}
              initialFavorited={book.is_favorited}
              initialCount={book.favorites_count}
              size="lg"
            />
            <AddToAnthologyButton bookId={book.id} size="lg" />
            <ReportButton targetType="book" targetId={book.id} variant="full" />
          </div>

          {/* Tags */}
          {book.tags && book.tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
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

          {/* Categorías */}
          {book.categories && book.categories.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {book.categories.map((c: Category) => (
                <Link
                  key={c.id}
                  href={`/catalogo?category=${c.slug}`}
                  className="inline-flex items-center rounded bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}

          {/* ───── Nota inicial del autor ───── */}
          {book.author_note_start && (
            <div className="mt-6 rounded-lg border-l-4 border-primary/60 bg-card p-4">
              <p className="text-[10px] uppercase tracking-wider text-primary mb-1.5 font-semibold">
                Nota del autor
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-line italic text-foreground/90">
                {book.author_note_start}
              </p>
            </div>
          )}

          {/* ───── Descripción ───── */}
          <div className="mt-8 space-y-3">
            <h2 className="font-serif text-xl font-bold">Sinopsis</h2>
            <p className="whitespace-pre-line leading-relaxed text-foreground/90">
              {book.description ?? "Sin descripción disponible."}
            </p>
            {book.synopsis && (
              <div className="mt-4">
                <h3 className="font-serif text-base font-bold mb-1.5">Detalle</h3>
                <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                  {book.synopsis}
                </p>
              </div>
            )}
          </div>

          {/* ───── Capítulos (si serie) ───── */}
          {book.work_format === "serie" && chapters.length > 0 && (
            <section className="mt-8" id="capitulos">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-serif text-xl font-bold">
                  Capítulos
                </h2>
                <Badge variant="outline">{chapters.length}</Badge>
              </div>
              <ChapterList
                slug={slug}
                chapters={chapters}
                accessByNumber={accessByNumber}
              />
            </section>
          )}

          {/* ───── Información técnica ───── */}
          <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
            {book.created_at && (
              <InfoCell icon={<Calendar className="h-3 w-3" />} label="Publicado">
                {new Date(book.created_at).toLocaleDateString("es", {
                  year: "numeric", month: "short", day: "numeric",
                })}
              </InfoCell>
            )}
            {book.language && (
              <InfoCell icon={<Globe className="h-3 w-3" />} label="Idioma">
                {book.language.toUpperCase()}
              </InfoCell>
            )}
            {book.pages && (
              <InfoCell icon={<BookText className="h-3 w-3" />} label="Páginas">
                {book.pages}
              </InfoCell>
            )}
            {(book.isbn_13 || book.isbn_10) && (
              <InfoCell icon={<ShieldCheck className="h-3 w-3" />} label="ISBN">
                {book.isbn_13 ?? book.isbn_10}
              </InfoCell>
            )}
            {book.publisher && (
              <InfoCell icon={<BookOpen className="h-3 w-3" />} label="Editorial">
                {book.publisher}
              </InfoCell>
            )}
          </section>

          {/* Affiliate links en mobile */}
          {book.affiliate_links && book.affiliate_links.length > 0 && (
            <div className="mt-6 md:hidden">
              <BuyButtons links={book.affiliate_links} />
            </div>
          )}
        </div>
      </div>

      {/* ═══════ NOTA FINAL ═══════ */}
      {book.author_note_end && (
        <div className="mt-10 rounded-lg border-l-4 border-primary/60 bg-card p-4 max-w-3xl mx-auto">
          <p className="text-[10px] uppercase tracking-wider text-primary mb-1.5 font-semibold">
            Despedida del autor
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-line italic text-foreground/90">
            {book.author_note_end}
          </p>
        </div>
      )}

      {/* ═══════ RESEÑAS ═══════ */}
      <section className="mt-12">
        <ReviewsSection
          slug={book.slug}
          ratingAverage={Number(book.rating_average)}
          ratingCount={book.rating_count}
          myReview={book.my_review}
        />
      </section>
    </div>
  );
}

function InfoCell({
  icon, label, children,
}: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/60 bg-card/60 p-2.5">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
        {icon} {label}
      </p>
      <p className="text-foreground/90 font-medium line-clamp-1">{children}</p>
    </div>
  );
}
