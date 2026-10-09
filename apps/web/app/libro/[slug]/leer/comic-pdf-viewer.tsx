"use client";

import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { PdfReader } from "@/components/reader/pdf-reader";
import { ReaderExtras } from "@/components/reader/reader-extras";

/**
 * Lector de cómic en PDF leído como WEBTOON: página normal que hace scroll con la
 * ventana (NO un overlay `fixed`, porque `PdfReader` virtualiza según el scroll de
 * la ventana — si se mete en un contenedor con scroll propio solo cargan las
 * primeras páginas). Fondo BLANCO. Sirve para un cómic de una sola lectura o para
 * un EPISODIO (capítulo) con navegación anterior/siguiente y comentarios propios.
 */
export function ComicPdfViewer({
  slug,
  title,
  fileUrl,
  chapterId,
  chapterLabel,
  prevHref,
  nextHref,
  nextLabel,
}: {
  slug: string;
  title: string;
  fileUrl: string;
  chapterId?: number;
  chapterLabel?: string;
  prevHref?: string;
  nextHref?: string;
  nextLabel?: string;
}) {
  return (
    <div className="min-h-dvh bg-white text-zinc-900">
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-200 bg-white/95 px-4 py-2.5 backdrop-blur">
        <Link
          href={`/libro/${slug}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Salir
        </Link>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-800">
          {chapterLabel ? `${title} · ${chapterLabel}` : title}
        </p>
      </div>

      {/* Webtoon: pdf.js en modo scroll continuo (sin separación), centrado. */}
      <PdfReader fileUrl={fileUrl} mode="scroll" theme="light" className="mx-auto" />

      {/* Navegación entre episodios (capítulos) — recuadro "siguiente episodio". */}
      {(prevHref || nextHref) && (
        <div className="mx-auto max-w-2xl px-4 py-6">
          {nextHref && (
            <Link
              href={nextHref}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:border-amber-400 hover:bg-amber-50"
            >
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-zinc-400">Siguiente episodio</p>
                <p className="truncate text-sm font-semibold text-zinc-800">{nextLabel ?? "Continuar"}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-amber-600" />
            </Link>
          )}
          {prevHref && (
            <Link href={prevHref} className="mt-2 inline-flex h-8 items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800">
              <ChevronLeft className="h-4 w-4" /> Episodio anterior
            </Link>
          )}
        </div>
      )}

      {/* Recomendaciones + episodios + comentarios (estilo WEBTOON) */}
      <ReaderExtras bookSlug={slug} chapterId={chapterId} />
    </div>
  );
}
