"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Menu, Settings2, Sun, Moon, Coffee, Maximize2, Minimize2,
  Bookmark, BookmarkCheck, Heart, MessageSquare, Play, Pause, Square,
  Type, Minus, Plus, AlignJustify, Sparkles, X, ChevronLeft, ChevronRight,
  ListOrdered, RotateCcw, GalleryVertical, Columns2, Lock, Headphones, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEntitlements } from "@/hooks/use-entitlements";
import { AiAudiobookButton, AiSummaryButton } from "@/components/reader/ai-audiobook-button";

// ───────── Tipos públicos ─────────
export interface ReaderTocItem {
  number: number;
  title: string;
  slug?: string;
  active?: boolean;
}

interface Props {
  /** Slug del libro — usado como key en localStorage. */
  bookSlug: string;
  /** Título grande mostrado en el chrome. */
  title: string;
  /** Autor / atribución mostrada bajo el título. */
  subtitle?: string;
  /** Capítulo actual (para mostrar en breadcrumb). */
  chapterLabel?: string;
  /** Tabla de contenido (capítulos del libro). */
  toc?: ReaderTocItem[];
  /** Link al detalle del libro. */
  backHref: string;
  /** Hrefs para flechas izquierda/derecha (capítulo anterior/siguiente). */
  prevHref?: string;
  nextHref?: string;
  /** Texto plano del capítulo — usado para TTS. Si se omite intenta leer del DOM. */
  plainText?: string;
  /**
   * El contenido es un archivo (PDF/imágenes) en vez de texto: activa el
   * selector de modo de lectura (continuo / doble página) y usa ancho completo.
   */
  mediaMode?: boolean;
  /** Contenido principal (HTML/JSX del capítulo). */
  children: React.ReactNode;
}

// ───────── Preferencias persistidas ─────────
// Temas básicos (todos) + premium (Premium / Premium Plus).
type Theme = "light" | "sepia" | "dark" | "noche" | "crema";
const BASIC_THEMES: Theme[] = ["light", "sepia", "dark"];
const PREMIUM_THEMES: Theme[] = ["noche", "crema"];
// Fuentes básicas (todos) + premium.
type FontFamily = "serif" | "sans" | "dyslexic" | "garamond" | "literata" | "humanist";
const BASIC_FONTS: FontFamily[] = ["serif", "sans", "dyslexic"];
const PREMIUM_FONTS: FontFamily[] = ["garamond", "literata", "humanist"];
/** Stacks CSS para las fuentes premium (sin cargar webfonts: usa fuentes del sistema). */
const PREMIUM_FONT_STACKS: Partial<Record<FontFamily, string>> = {
  garamond: '"EB Garamond","Iowan Old Style",Garamond,"Palatino Linotype",Georgia,serif',
  literata: 'Literata,"Iowan Old Style",Palatino,"Book Antiqua",Georgia,serif',
  humanist: 'Optima,Candara,"Gill Sans","Segoe UI",system-ui,sans-serif',
};
/** Modo de lectura para PDF / imágenes: continuo (webtoon) o doble página. */
export type PageMode = "scroll" | "spread";
interface ReaderPrefs {
  theme: Theme;
  fontSize: number; // 80..160 (%)
  fontFamily: FontFamily;
  lineHeight: number; // 140..220 (%)
  columnWidth: number; // 480..960 px
  align: "left" | "justify";
  pageMode: PageMode; // solo aplica en capítulos con archivo (PDF/imágenes)
}

const DEFAULT_PREFS: ReaderPrefs = {
  theme: "light",
  fontSize: 100,
  fontFamily: "serif",
  lineHeight: 185,
  columnWidth: 720,
  align: "left",
  pageMode: "scroll",
};

// ───────── Contexto para el contenido multimedia (PDF/imágenes) ─────────
// El hijo (lector de PDF) lee el modo de página y el tema actuales sin que el
// server component tenga que conocerlos.
interface ReaderModeCtx {
  pageMode: PageMode;
  // El PdfReader solo entiende temas básicos; los premium se mapean antes (noche→dark, crema→sepia).
  theme: "light" | "sepia" | "dark";
}
const ReaderModeContext = createContext<ReaderModeCtx>({ pageMode: "scroll", theme: "light" });
export function useReaderMode(): ReaderModeCtx {
  return useContext(ReaderModeContext);
}

const PREFS_KEY = "charbook:reader-prefs";

function loadPrefs(): ReaderPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(p: ReaderPrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch {}
}

// ───────── Componente ─────────
export function PremiumReader({
  bookSlug, title, subtitle, chapterLabel,
  toc = [], backHref, prevHref, nextHref,
  plainText, mediaMode = false, children,
}: Props) {
  const router = useRouter();
  // === Estado de UI ===
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  // === Preferencias ===
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS);
  const updatePrefs = (patch: Partial<ReaderPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      savePrefs(next);
      return next;
    });
  };
  useEffect(() => setPrefs(loadPrefs()), []);

  // === TTS ===
  const [ttsState, setTtsState] = useState<"idle" | "playing" | "paused">("idle");
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // === Refs DOM ===
  const containerRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);

  // === Detectar progreso de scroll del artículo ===
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max <= 0 ? 100 : Math.min(100, Math.max(0, (window.scrollY / max) * 100));
      setProgress(p);
      // Continuar donde quedó: guarda cada 2s aprox
      const key = `charbook:read-pos:${bookSlug}:${chapterLabel ?? "intro"}`;
      try { localStorage.setItem(key, String(window.scrollY)); } catch {}
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [bookSlug, chapterLabel]);

  // === Restaurar posición al cargar ===
  useEffect(() => {
    const key = `charbook:read-pos:${bookSlug}:${chapterLabel ?? "intro"}`;
    const saved = parseInt(localStorage.getItem(key) ?? "0", 10);
    if (saved > 100) {
      setTimeout(() => window.scrollTo({ top: saved, behavior: "instant" as any }), 100);
    }
    // Estado favorito/marcador en localStorage por slug+capítulo
    const favKey = `charbook:fav:${bookSlug}`;
    setFavorited(localStorage.getItem(favKey) === "1");
    const bookKey = `charbook:bookmark:${bookSlug}:${chapterLabel ?? "intro"}`;
    setBookmarked(localStorage.getItem(bookKey) === "1");
  }, [bookSlug, chapterLabel]);

  // === Mostrar los controles al mover el mouse / con cualquier actividad y
  // ocultarlos tras unos segundos sin actividad — en CUALQUIER lectura (texto,
  // PDF o imágenes). Es lo que pidió el usuario: que en toda lectura los iconos
  // aparezcan al mover el mouse y se escondan solos. ===
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const hideSoon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setChromeHidden(true), 2600);
    };
    const reveal = () => {
      setChromeHidden(false);
      hideSoon();
    };
    hideSoon(); // arranca visible y se esconde si no hay actividad
    window.addEventListener("mousemove", reveal, { passive: true });
    window.addEventListener("keydown", reveal);
    window.addEventListener("touchstart", reveal, { passive: true });
    window.addEventListener("pointerdown", reveal, { passive: true });
    // En PDF/imágenes el scroll ES la forma de leer (webtoon) → también revela.
    if (mediaMode) window.addEventListener("scroll", reveal, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", reveal);
      window.removeEventListener("keydown", reveal);
      window.removeEventListener("touchstart", reveal);
      window.removeEventListener("pointerdown", reveal);
      if (mediaMode) window.removeEventListener("scroll", reveal);
    };
  }, [mediaMode]);

  // Prefetch del capítulo anterior/siguiente → al pulsar ← → o las zonas
  // laterales el cambio es casi instantáneo (navegación client-side).
  useEffect(() => {
    if (prevHref) router.prefetch(prevHref);
    if (nextHref) router.prefetch(nextHref);
  }, [prevHref, nextHref, router]);

  // === Atajos teclado ===
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      // En doble página el lector de PDF gestiona ← → para pasar página.
      const spreadNav = mediaMode && prefs.pageMode === "spread";
      switch (e.key) {
        case "ArrowLeft": if (!spreadNav && prevHref) router.push(prevHref); break;
        case "ArrowRight": if (!spreadNav && nextHref) router.push(nextHref); break;
        case "m": case "M":
          if (mediaMode) updatePrefs({ pageMode: prefs.pageMode === "scroll" ? "spread" : "scroll" });
          break;
        case "t": case "T": setTocOpen((v) => !v); break;
        case "s": case "S": setSettingsOpen((v) => !v); break;
        case "f": case "F": toggleFullscreen(); break;
        case "d": case "D":
          updatePrefs({ theme: prefs.theme === "dark" ? "light" : "dark" });
          break;
        case "+": case "=": updatePrefs({ fontSize: Math.min(160, prefs.fontSize + 10) }); break;
        case "-": case "_": updatePrefs({ fontSize: Math.max(80, prefs.fontSize - 10) }); break;
        case "Escape":
          setTocOpen(false); setSettingsOpen(false); setCommentsOpen(false);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevHref, nextHref, prefs.theme, prefs.fontSize, prefs.pageMode, mediaMode, router]);

  // === Zoom con Ctrl+rueda ===
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -5 : 5;
      updatePrefs({ fontSize: Math.max(80, Math.min(160, prefs.fontSize + delta)) });
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [prefs.fontSize]);

  // === Fullscreen ===
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setFullscreen(false);
    }
  };
  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // === TTS ===
  const startTts = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      alert("Tu navegador no soporta lectura por voz.");
      return;
    }
    const text = plainText ?? articleRef.current?.innerText ?? "";
    if (!text) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "es-ES";
    utter.rate = 1.0;
    utter.onend = () => setTtsState("idle");
    utter.onerror = () => setTtsState("idle");
    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
    setTtsState("playing");
  };
  const pauseTts = () => {
    if (ttsState === "playing") { window.speechSynthesis.pause(); setTtsState("paused"); }
    else if (ttsState === "paused") { window.speechSynthesis.resume(); setTtsState("playing"); }
  };
  const stopTts = () => { window.speechSynthesis.cancel(); setTtsState("idle"); };
  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch {} }, []);

  // === Toggle favorito + bookmark (local) ===
  const toggleFav = () => {
    const key = `charbook:fav:${bookSlug}`;
    const next = !favorited;
    localStorage.setItem(key, next ? "1" : "0");
    setFavorited(next);
  };
  const toggleBookmark = () => {
    const key = `charbook:bookmark:${bookSlug}:${chapterLabel ?? "intro"}`;
    const next = !bookmarked;
    localStorage.setItem(key, next ? "1" : "0");
    setBookmarked(next);
  };

  // === Entitlements: temas y tipografías premium (Premium / Premium Plus) ===
  const { can: canFeature } = useEntitlements();
  const canPremiumThemes = canFeature("premium_themes");
  const canExtraFonts = canFeature("extra_fonts");
  // Defensa: si el usuario perdió el plan, no aplicamos opciones premium guardadas.
  const effectiveTheme: Theme =
    !canPremiumThemes && PREMIUM_THEMES.includes(prefs.theme) ? "light" : prefs.theme;
  const effectiveFont: FontFamily =
    prefs.fontFamily === "dyslexic" // "Mono" retirado → cae a serif
      ? "serif"
      : !canExtraFonts && PREMIUM_FONTS.includes(prefs.fontFamily)
        ? "serif"
        : prefs.fontFamily;

  // === Estilos según tema ===
  const themeStyles = useMemo(() => {
    switch (effectiveTheme) {
      case "dark":
        return { bg: "bg-zinc-950", text: "text-zinc-100", muted: "text-zinc-400", border: "border-zinc-800", card: "bg-zinc-900" };
      case "sepia":
        return { bg: "bg-[#faf3e3]", text: "text-[#3a2e1e]", muted: "text-[#6b5a40]", border: "border-[#e6d9b9]", card: "bg-[#f6ecd2]" };
      case "noche": // premium — negro OLED, descanso nocturno
        return { bg: "bg-black", text: "text-zinc-200", muted: "text-zinc-500", border: "border-zinc-800", card: "bg-zinc-950" };
      case "crema": // premium — crema cálida, alto confort
        return { bg: "bg-[#f4ecd8]", text: "text-[#322c1f]", muted: "text-[#6e6450]", border: "border-[#e2d6ba]", card: "bg-[#efe5cb]" };
      default:
        return { bg: "bg-background", text: "text-foreground", muted: "text-muted-foreground", border: "border-border/60", card: "bg-card" };
    }
  }, [effectiveTheme]);

  const fontFamilyCls =
    effectiveFont === "serif" ? "font-serif"
    : effectiveFont === "sans" ? "font-sans"
    : ""; // fuentes premium → se aplican vía style (fontFamily); "Mono" retirado
  const fontFamilyStyle = PREMIUM_FONT_STACKS[effectiveFont];

  return (
    <ReaderModeContext.Provider value={{ pageMode: prefs.pageMode, theme: effectiveTheme === "noche" ? "dark" : effectiveTheme === "crema" ? "sepia" : effectiveTheme }}>
    <div
      ref={containerRef}
      className={cn("min-h-screen transition-colors duration-300", themeStyles.bg, themeStyles.text)}
    >
      {/* ═══════ BARRA DE PROGRESO (fija arriba) ═══════ */}
      <div className="fixed top-0 left-0 right-0 z-[60] h-1 bg-black/10">
        <div
          className="h-full bg-gradient-to-r from-primary via-amber-400 to-primary transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ═══════ TOOLBAR SUPERIOR ═══════ */}
      <header
        className={cn(
          "fixed top-1 left-0 right-0 z-50 transition-transform duration-300 backdrop-blur-md",
          chromeHidden && !tocOpen && !settingsOpen ? "-translate-y-full" : "translate-y-0",
          themeStyles.bg.replace("bg-", "bg-") + "/80"
        )}
      >
        <div className={cn("flex h-14 items-center justify-between gap-2 px-3 md:px-5 border-b", themeStyles.border)}>
          {/* Izquierda */}
          <div className="flex items-center gap-1 min-w-0">
            <Link
              href={backHref}
              className={cn("inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent/40", themeStyles.muted)}
              aria-label="Volver al libro"
              title="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <button
              onClick={() => setTocOpen(true)}
              className={cn("inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent/40", themeStyles.muted)}
              aria-label="Índice"
              title="Índice (T)"
            >
              <ListOrdered className="h-4 w-4" />
            </button>
            <div className="ml-2 min-w-0">
              <p className={cn("text-[10px] uppercase tracking-wider", themeStyles.muted)}>
                {chapterLabel ?? "Leyendo"}
              </p>
              <h1 className={cn("truncate text-sm font-bold leading-tight font-serif", themeStyles.text)}>
                {title}
              </h1>
            </div>
          </div>

          {/* Derecha */}
          <div className="flex items-center gap-0.5">
            {/* TTS */}
            {ttsState === "idle" ? (
              <ToolbarBtn icon={Play} label="Escuchar (audiolibro)" onClick={startTts} muted={themeStyles.muted} />
            ) : (
              <>
                <ToolbarBtn icon={ttsState === "playing" ? Pause : Play} label="Pausa/Reanudar" onClick={pauseTts} active muted={themeStyles.muted} />
                <ToolbarBtn icon={Square} label="Detener" onClick={stopTts} muted={themeStyles.muted} />
              </>
            )}
            <ToolbarBtn icon={bookmarked ? BookmarkCheck : Bookmark} label="Marcador" onClick={toggleBookmark} active={bookmarked} muted={themeStyles.muted} />
            <ToolbarBtn icon={Heart} label="Favorito" onClick={toggleFav} active={favorited} muted={themeStyles.muted} className={favorited ? "text-rose-500" : ""} />
            <ToolbarBtn icon={MessageSquare} label="Comentarios" onClick={() => setCommentsOpen(true)} muted={themeStyles.muted} />
            {/* Audiolibro IA + Resumen IA (Premium Plus) — placeholders, sin motor real aún. */}
            <AiAudiobookButton muted={themeStyles.muted} />
            <AiSummaryButton muted={themeStyles.muted} />
            <div className={cn("mx-1 hidden h-5 w-px md:block", themeStyles.border.replace("border-", "bg-"))} />
            {/* Modo de lectura (solo para PDF/imágenes): continuo ↔ doble página */}
            {mediaMode && (
              <ToolbarBtn
                icon={prefs.pageMode === "scroll" ? GalleryVertical : Columns2}
                label="Modo de lectura"
                onClick={() => updatePrefs({ pageMode: prefs.pageMode === "scroll" ? "spread" : "scroll" })}
                muted={themeStyles.muted}
                active={prefs.pageMode === "spread"}
                title={prefs.pageMode === "scroll" ? "Modo: continuo → doble página (M)" : "Modo: doble página → continuo (M)"}
              />
            )}
            <ToolbarBtn
              icon={prefs.theme === "dark" ? Sun : prefs.theme === "sepia" ? Moon : Coffee}
              label="Cambiar tema"
              onClick={() => {
                const next: Theme = prefs.theme === "light" ? "sepia" : prefs.theme === "sepia" ? "dark" : "light";
                updatePrefs({ theme: next });
              }}
              muted={themeStyles.muted}
              title="Tema (D)"
            />
            <ToolbarBtn icon={Settings2} label="Ajustes" onClick={() => setSettingsOpen(true)} muted={themeStyles.muted} title="Ajustes (S)" />
            <ToolbarBtn
              icon={fullscreen ? Minimize2 : Maximize2}
              label="Pantalla completa"
              onClick={toggleFullscreen}
              muted={themeStyles.muted}
              title="Pantalla completa (F)"
            />
          </div>
        </div>
      </header>

      {/* ═══════ ZONAS LATERALES (cambiar de capítulo) ═══════ */}
      {/* Zonas amplias a izquierda/derecha: aparecen con el resto de controles,
          revelan la flecha al pasar el mouse y cambian de capítulo al hacer clic
          (navegación client-side, sin recargar). En PDF/imágenes a doble página
          las zonas para pasar de página las gestiona el lector de páginas. */}
      {!(mediaMode && prefs.pageMode === "spread") && (
        <EdgeNav
          prevHref={prevHref}
          nextHref={nextHref}
          hidden={chromeHidden && !tocOpen && !settingsOpen}
          theme={themeStyles}
        />
      )}

      {/* ═══════ CONTENIDO CENTRAL ═══════ */}
      {/* En modo multimedia (PDF/imágenes) usamos ancho completo y sin estilos de
          texto, para que el lector de páginas ocupe todo el espacio disponible. */}
      <article
        ref={articleRef}
        className={cn(
          "transition-all duration-300",
          mediaMode
            ? "mx-auto w-full px-0 pb-16 pt-16 md:pt-20"
            : cn("mx-auto px-4 pb-20 pt-24 md:pt-28", fontFamilyCls),
        )}
        style={
          mediaMode
            ? undefined
            : {
                maxWidth: `${prefs.columnWidth}px`,
                fontSize: `${prefs.fontSize}%`,
                lineHeight: `${prefs.lineHeight}%`,
                textAlign: prefs.align,
                fontFeatureSettings: '"liga", "calt"',
                ...(fontFamilyStyle ? { fontFamily: fontFamilyStyle } : {}),
              }
        }
      >
        {children}
      </article>

      {/* ═══════ INFO INFERIOR (página X/Y, atajos) ═══════ */}
      <div
        className={cn(
          "fixed bottom-3 left-1/2 -translate-x-1/2 z-40 transition-opacity duration-300",
          chromeHidden ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        <div className={cn(
          "flex items-center gap-3 rounded-full border px-4 py-1.5 text-[10px] uppercase tracking-wider backdrop-blur-md",
          themeStyles.border, themeStyles.card, themeStyles.muted
        )}>
          <span>{Math.round(progress)}%</span>
          <span className="opacity-40">·</span>
          <span className="hidden sm:inline">← → cambiar capítulo</span>
          <span className="hidden md:inline opacity-40">·</span>
          <span className="hidden md:inline">T índice · S ajustes · F pantalla completa</span>
        </div>
      </div>

      {/* ═══════ SIDEBAR ÍNDICE ═══════ */}
      <SidePanel open={tocOpen} onClose={() => setTocOpen(false)} title="Índice" theme={themeStyles}>
        {toc.length === 0 ? (
          <p className={cn("text-sm", themeStyles.muted)}>Este libro no tiene capítulos.</p>
        ) : (
          <ul className="space-y-1">
            {toc.map((c) => (
              <li key={c.number}>
                <Link
                  href={c.slug ? `/libro/${bookSlug}/capitulo/${c.number}` : "#"}
                  onClick={() => setTocOpen(false)}
                  className={cn(
                    "flex items-start gap-2 rounded-md p-2 transition-colors hover:bg-accent/40",
                    c.active && "bg-primary/10 text-primary"
                  )}
                >
                  <span className="mt-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-accent text-[10px] font-bold tabular-nums px-1">
                    {c.number}
                  </span>
                  <span className="text-sm leading-snug">{c.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SidePanel>

      {/* ═══════ SIDEBAR AJUSTES ═══════ */}
      <SidePanel open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Ajustes de lectura" theme={themeStyles} side="right">
        <div className="space-y-5">
          {/* Modo de lectura (solo PDF/imágenes) */}
          {mediaMode && (
            <SettingGroup label="Modo de lectura">
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { key: "scroll", icon: GalleryVertical, name: "Continuo" },
                  { key: "spread", icon: Columns2, name: "Doble página" },
                ] as const).map((m) => (
                  <button key={m.key} onClick={() => updatePrefs({ pageMode: m.key })}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-md border p-2 text-[10px]",
                      prefs.pageMode === m.key ? "border-primary bg-primary/10" : themeStyles.border
                    )}>
                    <m.icon className="h-4 w-4" /> {m.name}
                  </button>
                ))}
              </div>
            </SettingGroup>
          )}

          {/* Tema */}
          <SettingGroup label="Tema">
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { key: "light", icon: Sun, name: "Claro" },
                { key: "sepia", icon: Coffee, name: "Sepia" },
                { key: "dark", icon: Moon, name: "Oscuro" },
              ] as const).map((t) => (
                <button key={t.key} onClick={() => updatePrefs({ theme: t.key })}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md border p-2 text-[10px]",
                    effectiveTheme === t.key ? "border-primary bg-primary/10" : themeStyles.border
                  )}>
                  <t.icon className="h-4 w-4" /> {t.name}
                </button>
              ))}
            </div>
            <PremiumPicker
              label="Temas premium"
              unlocked={canPremiumThemes}
              options={[
                { key: "noche", icon: Moon, name: "Noche" },
                { key: "crema", icon: Coffee, name: "Crema" },
              ]}
              activeKey={effectiveTheme}
              onPick={(k) => updatePrefs({ theme: k as Theme })}
              border={themeStyles.border}
            />
          </SettingGroup>

          {/* Fuente */}
          <SettingGroup label="Fuente">
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { key: "serif", name: "Serif" },
                { key: "sans", name: "Sans" },
              ] as const).map((f) => (
                <button key={f.key} onClick={() => updatePrefs({ fontFamily: f.key })}
                  className={cn(
                    "rounded-md border p-2 text-xs",
                    effectiveFont === f.key ? "border-primary bg-primary/10" : themeStyles.border
                  )}>
                  {f.name}
                </button>
              ))}
            </div>
            <PremiumPicker
              label="Tipografías premium"
              unlocked={canExtraFonts}
              options={[
                { key: "garamond", name: "Garamond" },
                { key: "literata", name: "Literata" },
                { key: "humanist", name: "Humanista" },
              ]}
              activeKey={effectiveFont}
              onPick={(k) => updatePrefs({ fontFamily: k as FontFamily })}
              border={themeStyles.border}
            />
          </SettingGroup>

          {/* Tamaño */}
          <SettingGroup label={`Tamaño: ${prefs.fontSize}%`}>
            <SliderRow
              icon={Type}
              value={prefs.fontSize}
              min={80} max={160} step={5}
              onMinus={() => updatePrefs({ fontSize: Math.max(80, prefs.fontSize - 5) })}
              onPlus={() => updatePrefs({ fontSize: Math.min(160, prefs.fontSize + 5) })}
              onChange={(v) => updatePrefs({ fontSize: v })}
            />
          </SettingGroup>

          {/* Interlineado */}
          <SettingGroup label={`Interlineado: ${prefs.lineHeight}%`}>
            <SliderRow
              icon={AlignJustify}
              value={prefs.lineHeight}
              min={140} max={220} step={5}
              onMinus={() => updatePrefs({ lineHeight: Math.max(140, prefs.lineHeight - 5) })}
              onPlus={() => updatePrefs({ lineHeight: Math.min(220, prefs.lineHeight + 5) })}
              onChange={(v) => updatePrefs({ lineHeight: v })}
            />
          </SettingGroup>

          {/* Ancho columna */}
          <SettingGroup label={`Ancho: ${prefs.columnWidth}px`}>
            <SliderRow
              icon={AlignJustify}
              value={prefs.columnWidth}
              min={480} max={960} step={20}
              onMinus={() => updatePrefs({ columnWidth: Math.max(480, prefs.columnWidth - 20) })}
              onPlus={() => updatePrefs({ columnWidth: Math.min(960, prefs.columnWidth + 20) })}
              onChange={(v) => updatePrefs({ columnWidth: v })}
            />
          </SettingGroup>

          {/* Justificado */}
          <SettingGroup label="Alineación">
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { key: "left", name: "Izquierda" },
                { key: "justify", name: "Justificado" },
              ] as const).map((a) => (
                <button key={a.key} onClick={() => updatePrefs({ align: a.key })}
                  className={cn(
                    "rounded-md border p-2 text-xs",
                    prefs.align === a.key ? "border-primary bg-primary/10" : themeStyles.border
                  )}>
                  {a.name}
                </button>
              ))}
            </div>
          </SettingGroup>

          {/* Reset */}
          <button onClick={() => updatePrefs(DEFAULT_PREFS)}
            className={cn("inline-flex items-center gap-1.5 text-xs hover:text-foreground", themeStyles.muted)}>
            <RotateCcw className="h-3 w-3" /> Restablecer ajustes
          </button>

          <div className={cn("border-t pt-3 text-[11px]", themeStyles.border, themeStyles.muted)}>
            <p className="mb-1 font-semibold uppercase tracking-wider text-[9px]">Atajos</p>
            <ul className="space-y-0.5">
              <li><kbd>← →</kbd> capítulos</li>
              <li><kbd>T</kbd> índice · <kbd>S</kbd> ajustes</li>
              <li><kbd>F</kbd> pantalla completa</li>
              <li><kbd>D</kbd> claro/oscuro</li>
              <li><kbd>+ −</kbd> zoom de texto</li>
              <li><kbd>Ctrl + rueda</kbd> zoom</li>
              <li><kbd>Esc</kbd> cerrar paneles</li>
            </ul>
          </div>
        </div>
      </SidePanel>

      {/* ═══════ SIDEBAR COMENTARIOS (placeholder local) ═══════ */}
      <SidePanel open={commentsOpen} onClose={() => setCommentsOpen(false)} title="Notas y comentarios" theme={themeStyles} side="right">
        <LocalComments slugKey={`${bookSlug}:${chapterLabel ?? "intro"}`} mutedCls={themeStyles.muted} borderCls={themeStyles.border} />
      </SidePanel>
    </div>
    </ReaderModeContext.Provider>
  );
}

// ───────── Subcomponentes ─────────

/**
 * Zonas de navegación a izquierda/derecha para cambiar de capítulo.
 * Área de clic amplia (no hay que apuntar a un botón pequeño); la flecha se
 * resalta al pasar el mouse. Se ocultan junto con el resto de controles cuando
 * el lector está inactivo y usan navegación client-side (Link) para ser rápidas.
 */
function EdgeNav({
  prevHref, nextHref, hidden, theme,
}: { prevHref?: string; nextHref?: string; hidden: boolean; theme: any }) {
  const chip = cn(
    "inline-flex h-12 w-12 items-center justify-center rounded-full border opacity-40 shadow-sm transition-all duration-200 group-hover:opacity-100 group-hover:scale-110",
    theme.border, theme.card, theme.muted
  );
  const zone = cn(
    "group fixed top-14 bottom-0 z-40 flex w-16 items-center transition-opacity duration-300 md:w-20",
    hidden ? "opacity-0 pointer-events-none" : "opacity-100"
  );
  return (
    <>
      {prevHref && (
        <Link href={prevHref} aria-label="Capítulo anterior" title="Anterior (←)"
          className={cn(zone, "left-0 justify-start pl-2")}>
          <span className={chip}><ChevronLeft className="h-5 w-5" /></span>
        </Link>
      )}
      {nextHref && (
        <Link href={nextHref} aria-label="Capítulo siguiente" title="Siguiente (→)"
          className={cn(zone, "right-0 justify-end pr-2")}>
          <span className={chip}><ChevronRight className="h-5 w-5" /></span>
        </Link>
      )}
    </>
  );
}

function ToolbarBtn({
  icon: Icon, label, onClick, active, muted, className, title,
}: { icon: any; label: string; onClick: () => void; active?: boolean; muted: string; className?: string; title?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-accent/40",
        active ? "text-primary bg-primary/10" : muted,
        className
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function SidePanel({
  open, onClose, title, theme, side = "left", children,
}: { open: boolean; onClose: () => void; title: string; theme: any; side?: "left" | "right"; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]" aria-modal>
      <button onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" aria-label="Cerrar" />
      <aside
        className={cn(
          "absolute top-0 bottom-0 w-[min(360px,90vw)] p-5 overflow-y-auto border shadow-2xl",
          theme.card, theme.text, theme.border,
          side === "left" ? "left-0 animate-in slide-in-from-left" : "right-0 animate-in slide-in-from-right"
        )}
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent/40">
            <X className="h-4 w-4" />
          </button>
        </header>
        {children}
      </aside>
    </div>
  );
}

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      {children}
    </div>
  );
}

/** Sub-bloque de opciones PREMIUM (temas/tipografías): bloqueado para usuarios gratis. */
function PremiumPicker({
  label, unlocked, options, activeKey, onPick, border,
}: {
  label: string;
  unlocked: boolean;
  options: Array<{ key: string; name: string; icon?: any }>;
  activeKey: string;
  onPick: (key: string) => void;
  border: string;
}) {
  return (
    <div className="mt-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</span>
        {!unlocked && (
          <Link href="/premium" className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary hover:underline">
            <Lock className="h-2.5 w-2.5" /> Desbloquear
          </Link>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((o) => {
          const Icon = o.icon;
          const active = activeKey === o.key;
          return (
            <button
              key={o.key}
              type="button"
              disabled={!unlocked}
              title={!unlocked ? "Disponible con Premium" : o.name}
              onClick={() => unlocked && onPick(o.key)}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-md border p-2 text-[10px] transition-colors",
                active ? "border-primary bg-primary/10" : border,
                !unlocked && "cursor-not-allowed opacity-50",
              )}
            >
              {!unlocked && <Lock className="absolute right-1 top-1 h-2.5 w-2.5 text-primary" />}
              {Icon && <Icon className="h-4 w-4" />}
              {o.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SliderRow({
  icon: Icon, value, min, max, step, onMinus, onPlus, onChange,
}: { icon: any; value: number; min: number; max: number; step: number; onMinus: () => void; onPlus: () => void; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onMinus} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-current/20 hover:bg-accent/40">
        <Minus className="h-3 w-3" />
      </button>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="flex-1 accent-current"
      />
      <button onClick={onPlus} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-current/20 hover:bg-accent/40">
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

function LocalComments({ slugKey, mutedCls, borderCls }: { slugKey: string; mutedCls: string; borderCls: string }) {
  const storageKey = `charbook:notes:${slugKey}`;
  const [notes, setNotes] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    try { setNotes(JSON.parse(localStorage.getItem(storageKey) ?? "[]")); } catch {}
  }, [storageKey]);
  const save = (arr: string[]) => {
    setNotes(arr);
    localStorage.setItem(storageKey, JSON.stringify(arr));
  };
  const addNote = () => {
    if (!draft.trim()) return;
    save([draft.trim(), ...notes]);
    setDraft("");
  };
  return (
    <div className="space-y-3">
      <p className={cn("text-xs", mutedCls)}>
        Tus notas se guardan localmente en este dispositivo.
      </p>
      <textarea
        value={draft} onChange={(e) => setDraft(e.target.value)}
        rows={3} placeholder="Apunta una idea, una cita o un comentario sobre esta página…"
        className={cn("w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none", borderCls)}
      />
      <button onClick={addNote} disabled={!draft.trim()}
        className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
        Añadir nota
      </button>
      {notes.length > 0 && (
        <ul className={cn("mt-3 space-y-2 border-t pt-3", borderCls)}>
          {notes.map((n, i) => (
            <li key={i} className={cn("rounded-md border p-2.5 text-sm leading-relaxed", borderCls)}>
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-line">{n}</p>
                <button onClick={() => save(notes.filter((_, j) => j !== i))} className="opacity-60 hover:opacity-100">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
