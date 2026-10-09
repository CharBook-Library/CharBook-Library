import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PremiumReader, type ReaderTocItem } from "@/components/reader/premium-reader";
import { ChapterPdf } from "@/components/reader/chapter-pdf";
import { ChapterPaywall } from "@/components/monetization/chapter-paywall";
import { BookViewTracker } from "@/components/book/book-view-tracker";
import { ComicViewer } from "../../leer/comic-viewer";
import { ComicPdfViewer } from "../../leer/comic-pdf-viewer";

/** Tipos de archivo que el lector puede mostrar inline (sin descarga). */
const IMAGE_TYPES = ["jpg", "jpeg", "png", "webp", "gif", "avif"];

interface PageProps {
  params: Promise<{ slug: string; number: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, number } = await params;
  try {
    const res = await api.books.chapter(slug, Number(number));
    return {
      title: `${res.data.title} · Capítulo ${res.data.number} · ${res.book.title}`,
    };
  } catch {
    return { title: "Capítulo no encontrado" };
  }
}

export default async function ChapterReaderPage({ params }: PageProps) {
  const { slug, number } = await params;

  let res;
  try {
    res = await api.books.chapter(slug, Number(number));
  } catch (e) {
    // 402 = capítulo de pago / acceso anticipado → mostrar paywall, no 404.
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("API 402")) {
      return <ChapterPaywall slug={slug} number={Number(number)} />;
    }
    notFound();
  }

  const { data: chapter, book, prev, next } = res!;

  // Capítulo de CÓMIC: si trae páginas, se lee como webtoon a pantalla completa.
  if (chapter.pages && chapter.pages.length > 0) {
    return (
      <>
        <BookViewTracker slug={slug} />
        <ComicViewer
          slug={slug}
          title={book.title}
          pages={chapter.pages}
          chapterId={chapter.id}
          chapterLabel={`Capítulo ${chapter.number}`}
          exitHref={`/libro/${slug}`}
          prevHref={prev ? `/libro/${slug}/capitulo/${prev.number}` : undefined}
          nextHref={next ? `/libro/${slug}/capitulo/${next.number}` : undefined}
        />
      </>
    );
  }

  // ¿El capítulo es un archivo que podemos mostrar inline (PDF/imagen)?
  // Si llegamos hasta aquí el capítulo es accesible (los de pago dan 402 →
  // paywall antes), así que mostramos la lectura directamente, sin "descargar".
  const fileType = (chapter.file_type ?? "").toLowerCase();
  const isPdf = fileType === "pdf";
  const isImage = IMAGE_TYPES.includes(fileType);
  const isMedia = !!chapter.file_url && (isPdf || isImage);

  // Episodio de CÓMIC en PDF → lector webtoon blanco a pantalla completa.
  if (isPdf && chapter.file_url && book.work_format === "comic") {
    return (
      <>
        <BookViewTracker slug={slug} />
        <ComicPdfViewer
          slug={slug}
          title={book.title}
          fileUrl={chapter.file_url}
          chapterId={chapter.id}
          chapterLabel={`Capítulo ${chapter.number}`}
          prevHref={prev ? `/libro/${slug}/capitulo/${prev.number}` : undefined}
          nextHref={next ? `/libro/${slug}/capitulo/${next.number}` : undefined}
          nextLabel={next ? `Capítulo ${next.number}: ${next.title}` : undefined}
        />
      </>
    );
  }

  // Tabla de contenido para el sidebar del lector — la pedimos del API en paralelo
  let toc: ReaderTocItem[] = [];
  try {
    const list = await api.books.chapters(slug);
    toc = list.data.map((c) => ({
      number: c.number,
      title: c.title,
      slug,
      active: c.number === chapter.number,
    }));
  } catch {
    // si no hay endpoint o falla, dejamos toc vacío y el lector mostrará "sin capítulos"
  }

  const prevHref = prev ? `/libro/${slug}/capitulo/${prev.number}` : undefined;
  const nextHref = next ? `/libro/${slug}/capitulo/${next.number}` : undefined;

  return (
    <PremiumReader
      bookSlug={slug}
      title={book.title}
      subtitle={book.author?.name}
      chapterLabel={`Capítulo ${chapter.number}`}
      toc={toc}
      backHref={`/libro/${slug}`}
      prevHref={prevHref}
      nextHref={nextHref}
      plainText={chapter.body ?? ""}
      mediaMode={isMedia}
    >
      <BookViewTracker slug={slug} />
      <header className={cn("mb-10 text-center", isMedia && "mx-auto max-w-3xl px-4")}>
        <p className="text-[11px] uppercase tracking-[0.2em] opacity-60 mb-3">
          Capítulo {chapter.number}
        </p>
        <h1 className="font-serif font-bold tracking-tight leading-tight text-[2em]">
          {chapter.title}
        </h1>
        {chapter.published_at && (
          <p className="mt-3 text-xs opacity-70">
            Publicado el{" "}
            {new Date(chapter.published_at).toLocaleDateString("es", {
              year: "numeric", month: "long", day: "numeric",
            })}
          </p>
        )}
        <div aria-hidden className="mt-8 flex items-center justify-center gap-2 opacity-40">
          <span className="h-px w-12 bg-current" />
          <BookOpen className="h-3 w-3" />
          <span className="h-px w-12 bg-current" />
        </div>
      </header>

      {/* Nota inicial del libro (solo capítulo 1) */}
      {chapter.number === 1 && book.author_note_start && (
        <blockquote className={cn("mb-10 rounded-md border-l-4 border-primary/60 bg-current/5 p-4 italic opacity-90", isMedia && "mx-auto max-w-3xl")}>
          <p className="text-[10px] uppercase tracking-wider text-primary mb-1.5 font-semibold not-italic">
            Nota del autor
          </p>
          <p className="text-[0.95em] leading-relaxed whitespace-pre-line">
            {book.author_note_start}
          </p>
        </blockquote>
      )}

      {/* Cuerpo del capítulo */}
      {isMedia ? (
        // Archivo PDF / imagen → se lee inline (modo continuo o doble página).
        <ChapterPdf
          fileUrl={chapter.file_url ?? undefined}
          images={isImage && chapter.file_url ? [chapter.file_url] : undefined}
        />
      ) : (
        <div className="whitespace-pre-line">
          {chapter.body ?? (
            <p className="opacity-60 italic">
              Este capítulo aún no tiene contenido escrito.
              {chapter.file_url && (
                <>
                  {" "}
                  El autor ha subido un archivo:{" "}
                  <a href={chapter.file_url} target="_blank" rel="noreferrer" className="text-primary underline">
                    descargar {chapter.file_type ?? "archivo"}
                  </a>
                </>
              )}
            </p>
          )}
        </div>
      )}

      {/* Nota del autor en el capítulo */}
      {chapter.author_note && (
        <blockquote className={cn("mt-10 rounded-md border-l-4 border-amber-500/60 bg-current/5 p-4 italic opacity-90", isMedia && "mx-auto max-w-3xl")}>
          <p className="text-[10px] uppercase tracking-wider text-amber-500 mb-1.5 font-semibold not-italic">
            Nota del autor
          </p>
          <p className="text-[0.95em] leading-relaxed whitespace-pre-line">
            {chapter.author_note}
          </p>
        </blockquote>
      )}

      {/* Despedida final */}
      {!next && book.author_note_end && (
        <blockquote className={cn("mt-10 rounded-md border-l-4 border-primary/60 bg-current/5 p-4 italic opacity-90", isMedia && "mx-auto max-w-3xl")}>
          <p className="text-[10px] uppercase tracking-wider text-primary mb-1.5 font-semibold not-italic">
            Despedida del autor
          </p>
          <p className="text-[0.95em] leading-relaxed whitespace-pre-line">
            {book.author_note_end}
          </p>
        </blockquote>
      )}

      {!next && (
        <div className={cn("mt-12 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center", isMedia && "mx-auto max-w-3xl")}>
          <p className="text-xs uppercase tracking-wider text-emerald-500 font-semibold">
            Fin de la obra
          </p>
          <p className="mt-2 text-sm opacity-80">¡Gracias por leer!</p>
        </div>
      )}
    </PremiumReader>
  );
}
