"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lector de PDF / imágenes con dos modos de lectura:
 *
 *  - "scroll"  → todas las páginas, una debajo de otra, SIN separación visible
 *                (estilo WEBTOON). Scroll de ventana suave, render virtualizado
 *                para rendir bien con PDFs grandes.
 *  - "spread"  → dos páginas individuales lado a lado, con navegación (estilo
 *                libro abierto, como la 2.ª imagen del lector EPUB).
 *
 * Funciona igual con `images[]` (webtoon / cómic) en vez de un PDF.
 *
 * Monetización: si `locked` y `previewPages` está definido, tras esas páginas
 * gratis se muestra el bloque `paywall` (CharCoins) y se detiene la lectura.
 */

export type PdfReaderMode = "scroll" | "spread";
type ReaderTheme = "light" | "sepia" | "dark";

export interface PdfReaderProps {
  /** URL original del archivo (se proxea mismo-origen para evitar CORS). */
  fileUrl?: string;
  /** Lista de imágenes (modo cómic/webtoon). Si se pasa, ignora `fileUrl`. */
  images?: string[];
  mode: PdfReaderMode;
  theme?: ReaderTheme;
  /** Páginas gratis antes del muro (solo aplica si `locked`). */
  previewPages?: number;
  /** El capítulo es de pago y no está desbloqueado por completo. */
  locked?: boolean;
  /** Bloque a renderizar tras las páginas gratis (CTA CharCoins). */
  paywall?: ReactNode;
  className?: string;
}

const WORKER_SRC = "/pdf.worker.min.mjs";
const MAX_DPR = 2; // limita memoria de canvas en pantallas Retina

// Tipos derivados de pdfjs-dist sin importar rutas internas frágiles.
type Pdfjs = typeof import("pdfjs-dist");
type PdfDoc = Awaited<ReturnType<Pdfjs["getDocument"]>["promise"]>;
type PdfRenderTask = ReturnType<Awaited<ReturnType<PdfDoc["getPage"]>>["render"]>;

function proxied(url: string): string {
  // URLs relativas o ya mismo-origen: úsalas tal cual.
  if (url.startsWith("/")) return url;
  try {
    const u = new URL(url);
    if (typeof window !== "undefined" && u.origin === window.location.origin) return url;
  } catch {
    return url;
  }
  return `/api/file-proxy?u=${encodeURIComponent(url)}`;
}

function themeBg(theme: ReaderTheme): string {
  switch (theme) {
    case "dark":
      return "#0a0a0b";
    case "sepia":
      return "#faf3e3";
    case "light":
      return "#ffffff";
    default:
      return "var(--background, #ffffff)";
  }
}

/**
 * Controles que aparecen al mover el mouse y se ocultan tras unos segundos sin
 * actividad (como un lector de libros normal). `ping()` se llama en mousemove.
 */
function useIdleControls(idleMs = 2600) {
  const [active, setActive] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timer.current = setTimeout(() => setActive(false), idleMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [idleMs]);

  const ping = useCallback(() => {
    setActive(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setActive(false), idleMs);
  }, [idleMs]);

  return { active, ping };
}

/** Zona lateral (izq/der) para pasar página al hacer clic; el ícono aparece al
 *  mover el mouse o al pasar por esa zona. */
function NavZone({
  side, onClick, active, theme, label,
}: {
  side: "left" | "right";
  onClick: () => void;
  active: boolean;
  theme: ReaderTheme;
  label: string;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  const chip =
    theme === "dark" ? "bg-zinc-800/85 text-zinc-100 border-zinc-700"
    : theme === "sepia" ? "bg-[#efe6cf]/90 text-[#3a2e1e] border-[#e6d9b9]"
    : "bg-card/90 text-foreground border-border/50";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "group absolute top-0 z-10 flex h-full w-1/4 items-center",
        side === "left" ? "left-0 justify-start pl-3" : "right-0 justify-end pr-3",
      )}
    >
      <span
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-lg backdrop-blur-sm transition-opacity duration-200",
          chip,
          active ? "opacity-90" : "opacity-0 group-hover:opacity-90",
        )}
      >
        <Icon className="h-6 w-6" />
      </span>
    </button>
  );
}

export function PdfReader(props: PdfReaderProps) {
  if (props.images && props.images.length > 0) {
    return <ImageReader {...props} images={props.images} />;
  }
  return <PdfDocReader {...props} />;
}

/* ════════════════════════ PDF (pdf.js) ════════════════════════ */

function PdfDocReader({
  fileUrl,
  mode,
  theme = "light",
  previewPages,
  locked = false,
  paywall,
  className,
}: PdfReaderProps) {
  const pdfRef = useRef<PdfDoc | null>(null);
  const activeTasks = useRef<Set<PdfRenderTask>>(new Set());
  // Caché de páginas ya rasterizadas (clave: pagina@ancho@dpr) → revisitar una
  // página es instantáneo y el cambio de página no re-renderiza desde cero.
  const pageCache = useRef<Map<string, ImageBitmap>>(new Map());
  const prefetching = useRef<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [numPages, setNumPages] = useState(0);
  const [aspect, setAspect] = useState(1 / 1.414); // ratio w/h por defecto (A4)
  const [containerWidth, setContainerWidth] = useState(0);

  // Rango de páginas renderizadas (virtualización por scroll, no por
  // IntersectionObserver: más predecible y barato con cientos de páginas).
  const [range, setRange] = useState({ start: 1, end: 4 });
  // Spread actual (par de páginas) en modo doble página.
  const [spreadIndex, setSpreadIndex] = useState(0);

  const bg = themeBg(theme);

  const lastPage = useMemo(() => {
    if (locked && previewPages && previewPages > 0) {
      return Math.min(numPages, previewPages);
    }
    return numPages;
  }, [locked, previewPages, numPages]);

  const showPaywall = locked && !!previewPages && previewPages < numPages && !!paywall;

  // ── Cargar documento ──
  useEffect(() => {
    if (!fileUrl) return;
    let cancelled = false;
    const tasks = activeTasks.current;
    const cache = pageCache.current;

    (async () => {
      setStatus("loading");
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
        const task = pdfjs.getDocument({ url: proxied(fileUrl) });
        const pdf = await task.promise;
        if (cancelled) {
          pdf.destroy();
          return;
        }
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        // Aspect ratio de la 1.ª página para los placeholders.
        try {
          const p1 = await pdf.getPage(1);
          const vp = p1.getViewport({ scale: 1 });
          if (!cancelled) setAspect(vp.width / vp.height);
        } catch {
          /* usa el A4 por defecto */
        }
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      tasks.forEach((t) => t.cancel());
      tasks.clear();
      cache.forEach((bmp) => bmp.close?.());
      cache.clear();
      pdfRef.current?.destroy();
      pdfRef.current = null;
    };
  }, [fileUrl]);

  // ── Medir ancho del contenedor (re-render al cambiar) ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w) setContainerWidth(Math.round(w));
    });
    ro.observe(el);
    setContainerWidth(Math.round(el.clientWidth));
    return () => ro.disconnect();
  }, [status]);

  // Guarda un bitmap en caché y acota su tamaño (memoria).
  const cachePut = useCallback((key: string, bmp: ImageBitmap) => {
    const cache = pageCache.current;
    cache.set(key, bmp);
    while (cache.size > 16) {
      const oldest = cache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      cache.get(oldest)?.close?.();
      cache.delete(oldest);
    }
  }, []);

  // Pre-renderiza una página fuera de pantalla y la cachea (lectura adelante).
  const prefetch = useCallback((pageNum: number, width: number, dpr: number) => {
    const pdf = pdfRef.current;
    if (!pdf || pageNum < 1 || pageNum > pdf.numPages || width <= 0) return;
    const key = `${pageNum}@${width}@${dpr}`;
    if (pageCache.current.has(key) || prefetching.current.has(key)) return;
    prefetching.current.add(key);
    setTimeout(async () => {
      try {
        const page = await pdf.getPage(pageNum);
        const base = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: (width / base.width) * dpr });
        const off = document.createElement("canvas");
        off.width = Math.floor(vp.width);
        off.height = Math.floor(vp.height);
        const ctx = off.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        cachePut(key, await createImageBitmap(off));
      } catch {
        /* cancelado / no soportado: el render normal seguirá funcionando */
      } finally {
        prefetching.current.delete(key);
      }
    }, 60);
  }, [cachePut]);

  // ── Render de una página en su canvas (consciente de página + ancho) ──
  // No re-renderiza si el canvas ya muestra esa página a ese ancho; usa la caché
  // cuando puede (instantáneo) y cancela el render previo del mismo canvas al
  // cambiar de página (evita parpadeos / carreras).
  const renderInto = useCallback(
    async (canvas: (HTMLCanvasElement & { __task?: PdfRenderTask }) | null, pageNum: number, cssWidth?: number) => {
      const pdf = pdfRef.current;
      if (!pdf || !canvas) return;

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const width = Math.round(cssWidth ?? canvas.parentElement?.clientWidth ?? containerWidth ?? 800);
      if (width <= 0) return;
      const want = `${pageNum}@${width}`;
      if (canvas.dataset.shown === want || canvas.dataset.rendering === want) return;
      canvas.dataset.rendering = want;

      // Cancela el render anterior de ESTE canvas (cambio de página).
      if (canvas.__task) {
        try { canvas.__task.cancel(); } catch { /* noop */ }
        activeTasks.current.delete(canvas.__task);
        canvas.__task = undefined;
      }

      const key = `${pageNum}@${width}@${dpr}`;
      const cached = pageCache.current.get(key);
      const ctx = canvas.getContext("2d");
      if (!ctx) { canvas.dataset.rendering = ""; return; }

      // 1) Cache hit → dibujo instantáneo.
      if (cached) {
        canvas.width = cached.width;
        canvas.height = cached.height;
        ctx.drawImage(cached, 0, 0);
        canvas.dataset.shown = want;
        canvas.dataset.rendering = "";
        prefetch(pageNum + 2, width, dpr);
        return;
      }

      // 2) Render con pdf.js + cacheo.
      try {
        const page = await pdf.getPage(pageNum);
        const base = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: (width / base.width) * dpr });
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        const task = page.render({ canvasContext: ctx, viewport: vp });
        canvas.__task = task;
        activeTasks.current.add(task);
        await task.promise;
        canvas.dataset.shown = want;
        try { cachePut(key, await createImageBitmap(canvas)); } catch { /* sin createImageBitmap */ }
        prefetch(pageNum + 2, width, dpr); // adelanta el siguiente spread
      } catch {
        canvas.dataset.shown = "";
      } finally {
        if (canvas.__task) {
          activeTasks.current.delete(canvas.__task);
          canvas.__task = undefined;
        }
        canvas.dataset.rendering = "";
      }
    },
    [containerWidth, cachePut, prefetch],
  );

  // ── Virtualización por scroll (modo continuo) ──
  // Calcula qué páginas renderizar según la posición de scroll de la ventana.
  // Asume alto uniforme (alto = ancho / aspect); con overscan de ~1.5 pantallas
  // el scroll se siente continuo sin tener cientos de canvas montados.
  const recomputeRange = useCallback(() => {
    const el = containerRef.current;
    if (!el || !containerWidth || lastPage === 0) return;
    const pageH = containerWidth / aspect;
    if (!pageH || !isFinite(pageH)) return;
    const docTop = el.getBoundingClientRect().top + window.scrollY;
    const vh = window.innerHeight || 800;
    const overscan = vh * 1.5;
    const fromY = window.scrollY - docTop - overscan;
    const toY = window.scrollY + vh - docTop + overscan;
    const start = Math.max(1, Math.floor(fromY / pageH) + 1);
    const end = Math.min(lastPage, Math.ceil(toY / pageH));
    setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [containerWidth, aspect, lastPage]);

  useEffect(() => {
    if (mode !== "scroll" || status !== "ready") return;
    // rAF evita setState síncrono en el efecto y da tiempo al layout.
    const raf = requestAnimationFrame(recomputeRange);
    const onScroll = () => recomputeRange();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [mode, status, recomputeRange]);

  /* ───────── Modo SCROLL (continuo / webtoon) ───────── */
  if (mode === "scroll") {
    return (
      <div
        ref={containerRef}
        className={cn("pdf-scroll mx-auto w-full", className)}
        style={{ background: bg, maxWidth: 1000 }}
      >
        {status === "loading" && <ReaderLoading theme={theme} />}
        {status === "error" && <ReaderError fileUrl={fileUrl} />}
        {status === "ready" &&
          Array.from({ length: lastPage }, (_, i) => i + 1).map((pageNum) => (
            <ScrollPage
              key={pageNum}
              pageNum={pageNum}
              aspect={aspect}
              isVisible={pageNum >= range.start && pageNum <= range.end}
              renderInto={renderInto}
            />
          ))}
        {showPaywall && status === "ready" && (
          <div className="px-3 py-6">{paywall}</div>
        )}
      </div>
    );
  }

  /* ───────── Modo SPREAD (dos páginas) ───────── */
  const previewLast = lastPage; // respeta el muro también en spread
  const contentSpreads = Math.max(1, Math.ceil(previewLast / 2));
  // Si hay muro, se añade un "spread" extra al final que muestra el CTA.
  const totalSpreads = showPaywall ? contentSpreads + 1 : contentSpreads;
  const atWall = showPaywall && spreadIndex === totalSpreads - 1;
  const leftPage = spreadIndex * 2 + 1;
  const rightPage = leftPage + 1 <= previewLast ? leftPage + 1 : null;

  const goPrev = () => setSpreadIndex((s) => Math.max(0, s - 1));
  const goNext = () =>
    setSpreadIndex((s) => Math.min(totalSpreads - 1, s + 1));

  return (
    <div
      ref={containerRef}
      className={cn("pdf-spread relative flex w-full flex-col items-center", className)}
      style={{ background: bg }}
    >
      {status === "loading" && <ReaderLoading theme={theme} />}
      {status === "error" && <ReaderError fileUrl={fileUrl} />}
      {status === "ready" && (
        <SpreadStage
          leftPage={leftPage}
          rightPage={rightPage}
          aspect={aspect}
          renderInto={renderInto}
          spreadIndex={spreadIndex}
          totalSpreads={totalSpreads}
          totalPages={numPages}
          onPrev={goPrev}
          onNext={goNext}
          theme={theme}
          atWall={atWall}
          paywall={paywall}
        />
      )}
    </div>
  );
}

/* ── Página individual en modo scroll ──
   El placeholder reserva el alto (aspect-ratio) aunque el canvas no esté
   montado, así el scroll no salta al virtualizar. */
function ScrollPage({
  pageNum,
  aspect,
  isVisible,
  renderInto,
}: {
  pageNum: number;
  aspect: number;
  isVisible: boolean;
  renderInto: (c: HTMLCanvasElement | null, n: number) => void;
}) {
  return (
    <div
      className="pdf-page relative block w-full"
      // marginBottom -1 elimina la línea fina entre páginas → se ven "pegadas".
      style={{ aspectRatio: String(aspect), marginBottom: -1 }}
    >
      {isVisible && (
        <canvas
          ref={(c) => renderInto(c, pageNum)}
          className="absolute inset-0 h-full w-full"
        />
      )}
    </div>
  );
}

/* ── Escenario de dos páginas (modo spread) ── */
function SpreadStage({
  leftPage,
  rightPage,
  aspect,
  renderInto,
  spreadIndex,
  totalSpreads,
  totalPages,
  onPrev,
  onNext,
  theme,
  atWall,
  paywall,
}: {
  leftPage: number;
  rightPage: number | null;
  aspect: number;
  renderInto: (c: HTMLCanvasElement | null, n: number, w?: number) => void;
  spreadIndex: number;
  totalSpreads: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  theme: ReaderTheme;
  atWall: boolean;
  paywall?: ReactNode;
}) {
  // Cada página se ajusta por altura disponible (contain), dos lado a lado.
  const stageRef = useRef<HTMLDivElement>(null);
  const [pageW, setPageW] = useState(0);

  // ← → pasan página (el PremiumReader cede estas teclas en modo doble página).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const compute = () => {
      const h = el.clientHeight;
      const w = el.clientWidth;
      const gap = 8;
      const pagesPerView = rightPage ? 2 : 1;
      // ancho que cabe por altura
      const byHeight = h * aspect;
      // ancho que cabe por anchura
      const byWidth = (w - gap * (pagesPerView + 1)) / pagesPerView;
      setPageW(Math.max(120, Math.floor(Math.min(byHeight, byWidth))));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect, rightPage]);

  const muted =
    theme === "dark" ? "text-zinc-400" : theme === "sepia" ? "text-[#6b5a40]" : "text-muted-foreground";

  const { active, ping } = useIdleControls();
  const canPrev = ! atWall && spreadIndex > 0;
  const canNext = ! atWall && spreadIndex < totalSpreads - 1;

  return (
    <div className="flex w-full flex-col" onMouseMove={ping}>
      <div
        ref={stageRef}
        className="relative flex items-center justify-center gap-2"
        style={{ height: "calc(100dvh - 9rem)" }}
      >
        {atWall ? (
          <div className="max-w-2xl px-3">{paywall}</div>
        ) : (
          <div className="flex items-stretch justify-center gap-2" style={{ height: "100%" }}>
            <SpreadCanvas pageNum={leftPage} width={pageW} aspect={aspect} renderInto={renderInto} />
            {rightPage && (
              <SpreadCanvas pageNum={rightPage} width={pageW} aspect={aspect} renderInto={renderInto} />
            )}
          </div>
        )}

        {/* Zonas laterales: pasar página al hacer clic (ícono al mover el mouse). */}
        {canPrev && <NavZone side="left" onClick={onPrev} active={active} theme={theme} label="Página anterior" />}
        {canNext && <NavZone side="right" onClick={onNext} active={active} theme={theme} label="Página siguiente" />}
      </div>

      {/* Navegación inferior (se desvanece al estar inactivo). */}
      <div
        className={cn(
          "flex items-center justify-center gap-6 py-3 text-xs transition-opacity duration-300",
          muted,
          active ? "opacity-100" : "opacity-0",
        )}
      >
        <button
          onClick={onPrev}
          disabled={spreadIndex === 0}
          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 hover:bg-accent/40 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>
        <span className="tabular-nums">
          {atWall ? (
            "CharCoins"
          ) : (
            <>
              {leftPage}
              {rightPage ? `–${rightPage}` : ""} / {totalPages}
            </>
          )}
        </span>
        <button
          onClick={onNext}
          disabled={spreadIndex >= totalSpreads - 1}
          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 hover:bg-accent/40 disabled:opacity-30"
        >
          Siguiente <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SpreadCanvas({
  pageNum,
  width,
  aspect,
  renderInto,
}: {
  pageNum: number;
  width: number;
  aspect: number;
  renderInto: (c: HTMLCanvasElement | null, n: number, w?: number) => void;
}) {
  return (
    <div
      className="relative shadow-lg"
      style={{ width, height: width / aspect }}
    >
      {width > 0 && (
        <canvas
          ref={(c) => renderInto(c, pageNum, width)}
          className="absolute inset-0 h-full w-full"
        />
      )}
    </div>
  );
}

/* ════════════════════════ Imágenes (webtoon / cómic) ════════════════════════ */

function ImageReader({
  images = [],
  mode,
  theme = "light",
  previewPages,
  locked = false,
  paywall,
  className,
}: PdfReaderProps) {
  const [spreadIndex, setSpreadIndex] = useState(0);
  const bg = themeBg(theme);
  const { active, ping } = useIdleControls();

  const lastIdx =
    locked && previewPages && previewPages > 0
      ? Math.min(images.length, previewPages)
      : images.length;
  const list = images.slice(0, lastIdx);
  const showPaywall = locked && !!previewPages && previewPages < images.length && !!paywall;

  // ← → pasan página en doble página (efecto incondicional: respeta hooks).
  useEffect(() => {
    if (mode !== "spread") return;
    const maxSpread = Math.max(0, Math.ceil(list.length / 2) - 1);
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.key === "ArrowLeft") setSpreadIndex((s) => Math.max(0, s - 1));
      else if (e.key === "ArrowRight") setSpreadIndex((s) => Math.min(maxSpread, s + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, list.length]);

  if (mode === "scroll") {
    return (
      <div
        className={cn("mx-auto w-full", className)}
        style={{ background: bg, maxWidth: 1000 }}
      >
        {list.map((src, i) => (
          // Webtoon: imágenes pegadas, sin separación. <img> normal (solo display).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt={`Página ${i + 1}`}
            loading="lazy"
            className="block w-full"
            style={{ marginBottom: -1 }}
          />
        ))}
        {showPaywall && <div className="px-3 py-6">{paywall}</div>}
      </div>
    );
  }

  // Spread de imágenes
  const total = Math.max(1, Math.ceil(list.length / 2));
  const left = spreadIndex * 2;
  const right = left + 1 < list.length ? left + 1 : null;
  const muted =
    theme === "dark" ? "text-zinc-400" : theme === "sepia" ? "text-[#6b5a40]" : "text-muted-foreground";

  const goPrev = () => setSpreadIndex((s) => Math.max(0, s - 1));
  const goNext = () => setSpreadIndex((s) => Math.min(total - 1, s + 1));

  return (
    <div className={cn("flex w-full flex-col", className)} style={{ background: bg }} onMouseMove={ping}>
      <div
        className="relative flex items-center justify-center gap-2"
        style={{ height: "calc(100dvh - 9rem)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={list[left]} alt={`Página ${left + 1}`} className="max-h-full w-auto object-contain shadow-lg" />
        {right !== null && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={list[right]} alt={`Página ${right + 1}`} className="max-h-full w-auto object-contain shadow-lg" />
        )}

        {spreadIndex > 0 && <NavZone side="left" onClick={goPrev} active={active} theme={theme} label="Página anterior" />}
        {spreadIndex < total - 1 && <NavZone side="right" onClick={goNext} active={active} theme={theme} label="Página siguiente" />}
      </div>
      <div
        className={cn(
          "flex items-center justify-center gap-6 py-3 text-xs transition-opacity duration-300",
          muted,
          active ? "opacity-100" : "opacity-0",
        )}
      >
        <button
          onClick={goPrev}
          disabled={spreadIndex === 0}
          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 hover:bg-accent/40 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>
        <span className="tabular-nums">
          {left + 1}
          {right !== null ? `–${right + 1}` : ""} / {list.length}
        </span>
        <button
          onClick={goNext}
          disabled={spreadIndex >= total - 1}
          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 hover:bg-accent/40 disabled:opacity-30"
        >
          Siguiente <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════ Estados ════════════════════════ */

function ReaderLoading({ theme }: { theme: ReaderTheme }) {
  const muted =
    theme === "dark" ? "text-zinc-400" : theme === "sepia" ? "text-[#6b5a40]" : "text-muted-foreground";
  return (
    <div className={cn("flex min-h-[60vh] flex-col items-center justify-center gap-3", muted)}>
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">Cargando documento…</p>
    </div>
  );
}

function ReaderError({ fileUrl }: { fileUrl?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-500" />
      <p className="text-sm opacity-80">No se pudo mostrar el documento.</p>
      {fileUrl && (
        <a href={fileUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
          Descargar archivo
        </a>
      )}
    </div>
  );
}

export default PdfReader;
