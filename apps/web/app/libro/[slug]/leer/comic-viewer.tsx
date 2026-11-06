"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, X, Maximize2, ScrollText,
  Book, ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReaderExtras } from "@/components/reader/reader-extras";

interface ComicPagePublic {
  id: number;
  image_url: string | null;
  position: number;
  width: number | null;
  height: number | null;
}

interface ComicViewerProps {
  slug: string;
  title: string;
  pages: ComicPagePublic[];
  /** Destino del botón "Salir" (por defecto, la ficha del libro). */
  exitHref?: string;
  /** Navegación entre capítulos (serie de cómic). */
  prevHref?: string;
  nextHref?: string;
  chapterLabel?: string;
  /** Si es un capítulo, su id (comentarios por episodio). */
  chapterId?: number;
}

type ViewMode = "single" | "scroll";

export function ComicViewer({ slug, title, pages, exitHref, prevHref, nextHref, chapterLabel, chapterId }: ComicViewerProps) {
  const exit = exitHref ?? `/libro/${slug}`;
  // Los capítulos de cómic se abren en webtoon (scroll continuo) por defecto.
  const [mode, setMode] = useState<ViewMode>(chapterLabel ? "scroll" : "single");
  const [current, setCurrent] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);

  const total = pages.length;
  const currentPage = pages[current];

  const next = useCallback(() => setCurrent((c) => Math.min(total - 1, c + 1)), [total]);
  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextUrl = pages[current + 1]?.image_url;
    if (!nextUrl) return;
    const image = new window.Image();
    image.decoding = "async";
    image.src = nextUrl;
  }, [current, pages]);

  // Atajos de teclado
  useEffect(() => {
    if (mode !== "single") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        // Cerrar chrome si estaba abierto
        setChromeVisible((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, next, prev]);

  // Auto-ocultar chrome después de inactividad
  useEffect(() => {
    if (mode !== "single") return;
    const timer = setTimeout(() => setChromeVisible(false), 3500);
    return () => clearTimeout(timer);
  }, [current, mode]);

  if (total === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-zinc-900">
        <div className="text-center">
          <Book className="mx-auto h-12 w-12 text-zinc-400" />
          <p className="mt-4 text-sm">Este cómic aún no tiene páginas.</p>
          <Link href={exit} className="mt-4 inline-block text-xs text-zinc-500 hover:text-zinc-900 underline">
            Volver al libro
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-white text-zinc-900"
      onMouseMove={() => setChromeVisible(true)}
    >
      {/* ═══════ TOPBAR ═══════ */}
      <header
        className={cn(
          "absolute inset-x-0 top-0 z-30 transition-opacity duration-300",
          chromeVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between gap-3 bg-gradient-to-b from-white/95 to-transparent px-4 py-3">
          <Link
            href={exit}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-black/5 px-3 text-xs font-medium hover:bg-black/10"
          >
            <X className="h-3.5 w-3.5" />
            Salir
          </Link>

          <div className="text-center min-w-0 flex-1 px-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 truncate">
              {chapterLabel ? `${title} · ${chapterLabel}` : title}
            </p>
            <p className="text-xs font-bold tabular-nums">
              <span className="text-amber-600">{current + 1}</span>
              <span className="text-zinc-400 mx-1">/</span>
              <span>{total}</span>
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMode(mode === "single" ? "scroll" : "single")}
              aria-label={mode === "single" ? "Modo scroll continuo" : "Modo página única"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-black/5 hover:bg-black/10"
              title={mode === "single" ? "Cambiar a scroll continuo" : "Cambiar a página única"}
            >
              {mode === "single" ? <ScrollText className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {mode === "single" && (
          <div className="h-0.5 bg-zinc-200">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${((current + 1) / total) * 100}%` }}
            />
          </div>
        )}
      </header>

      {/* ═══════ MODO PÁGINA ÚNICA ═══════ */}
      {mode === "single" ? (
        <>
          <main className="flex h-screen items-center justify-center px-12 md:px-20">
            {currentPage?.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentPage.image_url}
                alt={`Página ${current + 1}`}
                className="max-h-screen max-w-full object-contain"
                decoding="async"
                fetchPriority="high"
                draggable={false}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-zinc-400">
                <ImageIcon className="h-8 w-8" />
                <p className="text-xs">Página no disponible</p>
              </div>
            )}
          </main>

          {/* Click zones invisibles para navegación táctil */}
          <button
            type="button"
            onClick={prev}
            disabled={current === 0}
            aria-label="Página anterior"
            className="absolute inset-y-0 left-0 z-20 w-1/3 cursor-w-resize disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={next}
            disabled={current === total - 1}
            aria-label="Página siguiente"
            className="absolute inset-y-0 right-0 z-20 w-1/3 cursor-e-resize disabled:cursor-not-allowed"
          />

          {/* Botones visuales de navegación (siempre visibles en desktop) */}
          <button
            type="button"
            onClick={prev}
            disabled={current === 0}
            aria-label="Anterior"
            className={cn(
              "absolute left-3 top-1/2 z-30 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/5 backdrop-blur transition-opacity hover:bg-black/10 disabled:opacity-20",
              chromeVisible ? "opacity-100" : "opacity-30 hover:opacity-100"
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={next}
            disabled={current === total - 1}
            aria-label="Siguiente"
            className={cn(
              "absolute right-3 top-1/2 z-30 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/5 backdrop-blur transition-opacity hover:bg-black/10 disabled:opacity-20",
              chromeVisible ? "opacity-100" : "opacity-30 hover:opacity-100"
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Fin */}
          {current === total - 1 && (
            <div className="absolute inset-x-0 bottom-6 z-30 flex justify-center pointer-events-none">
              <div className="pointer-events-auto rounded-full bg-emerald-500/90 px-4 py-1.5 text-xs font-bold uppercase tracking-wider shadow-lg backdrop-blur">
                ✓ Fin de la obra
              </div>
            </div>
          )}
        </>
      ) : (
        /* ═══════ MODO SCROLL CONTINUO ═══════ */
        <div className="min-h-screen overflow-y-auto pt-16 pb-10">
          {/* Webtoon: páginas pegadas (sin separación visible) y a todo el ancho. */}
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-0">
            {pages.map((page, idx) => (
              <div key={page.id} className="w-full">
                {page.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={page.image_url}
                    alt={`Página ${idx + 1}`}
                    className="block w-full align-top"
                    loading={idx > 1 ? "lazy" : "eager"}
                    decoding="async"
                    draggable={false}
                  />
                ) : (
                  <div className="aspect-[2/3] w-full bg-white/5 flex items-center justify-center text-white/30">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
              </div>
            ))}

            <div className="mt-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-400">
              ✓ Has llegado al final
            </div>

            {(prevHref || nextHref) && (
              <div className="mt-4 flex items-center gap-2">
                {prevHref && (
                  <Link
                    href={prevHref}
                    className="inline-flex h-9 items-center gap-1 rounded-md bg-zinc-200 px-3 text-xs hover:bg-zinc-300"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                  </Link>
                )}
                {nextHref && (
                  <Link
                    href={nextHref}
                    className="inline-flex h-9 items-center gap-1 rounded-md bg-amber-500 px-3 text-xs font-semibold text-black hover:bg-amber-500"
                  >
                    Siguiente capítulo <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            )}

            <Link
              href={exit}
              className="mt-3 text-xs text-zinc-500 hover:text-zinc-900 underline"
            >
              {chapterLabel ? "Volver a la obra" : "Volver al libro"}
            </Link>
          </div>

          {/* Recomendaciones + comentarios (estilo WEBTOON) */}
          <ReaderExtras bookSlug={slug} chapterId={chapterId} />
        </div>
      )}
    </div>
  );
}
