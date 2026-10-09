"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ListOrdered, Settings2, Sun, Moon, Coffee, Maximize2, Minimize2,
  Bookmark, BookmarkCheck, Heart, MessageSquare, Play, Pause, Square,
  Minus, Plus, X, RotateCcw, Search, Share2, Eye, Info, Clock,
  Loader2, AlertTriangle, Hash, Gauge, Mic2, Focus, Highlighter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EpubReaderProps {
  fileUrl: string;
  slug: string;
  title: string;
  author?: string | null;
}

type Theme = "light" | "sepia" | "dark" | "midnight";
type FontFamily = "serif" | "sans" | "dyslexic";
type NavItem = { label: string; href: string };
type Bookmark = { cfi: string; chapter: string; pct: number; created: number };

const THEMES = {
  light:    { body: "#fbfbf9", page: "#ffffff", text: "#1a1a1a", muted: "#6b7280", border: "rgba(0,0,0,0.10)",  chrome: "rgba(255,255,255,0.92)" },
  sepia:    { body: "#f4ecd8", page: "#fdf6e3", text: "#5b4636", muted: "#8b7355", border: "rgba(91,70,54,0.18)", chrome: "rgba(244,236,216,0.92)" },
  dark:     { body: "#0f172a", page: "#13161d", text: "#e8e6e3", muted: "#94a3b8", border: "rgba(255,255,255,0.10)", chrome: "rgba(15,18,25,0.88)" },
  midnight: { body: "#000000", page: "#0a0a0a", text: "#d1d5db", muted: "#737373", border: "rgba(255,255,255,0.08)", chrome: "rgba(0,0,0,0.92)" },
} as const;

const FONT_FAMILIES: Record<FontFamily, string> = {
  serif: "Georgia, Cambria, 'Times New Roman', serif",
  sans: "Inter, system-ui, -apple-system, sans-serif",
  dyslexic: "'OpenDyslexic', Verdana, sans-serif",
};

// ───────── Cursores SVG personalizados por zona ─────────
// Cada cursor es un SVG inline con fondo redondeado ámbar y un icono que indica
// la acción de cada zona. El hotspot (X Y) está centrado en 16 16.
const svgCursor = (svg: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 16 16, pointer`;

const CURSOR_LEFT = svgCursor(
  `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>
    <circle cx='16' cy='16' r='14' fill='rgba(245,158,11,0.92)' stroke='rgba(0,0,0,0.35)' stroke-width='1.5'/>
    <path d='M19 8 L11 16 L19 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/>
  </svg>`
);

const CURSOR_RIGHT = svgCursor(
  `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>
    <circle cx='16' cy='16' r='14' fill='rgba(245,158,11,0.92)' stroke='rgba(0,0,0,0.35)' stroke-width='1.5'/>
    <path d='M13 8 L21 16 L13 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/>
  </svg>`
);

// Cursor central: discreto, indica que al clickear se abren las opciones
const CURSOR_CENTER = svgCursor(
  `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 22 22'>
    <circle cx='11' cy='11' r='9' fill='rgba(255,255,255,0.85)' stroke='rgba(0,0,0,0.4)' stroke-width='1.2'/>
    <circle cx='11' cy='11' r='2.5' fill='rgba(245,158,11,1)'/>
  </svg>`
);

const PREFS_KEY = "charbook:reader-prefs-epub";
const DEFAULT_PREFS = {
  theme: "dark" as Theme,
  fontSize: 110,
  fontFamily: "serif" as FontFamily,
  lineHeight: 170,
  ttsRate: 1.0,
  ttsVoice: "" as string,
};

function loadPrefs() {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") }; }
  catch { return DEFAULT_PREFS; }
}
function savePrefs(p: typeof DEFAULT_PREFS) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch {}
}

export default function EpubReader({ fileUrl, slug, title, author }: EpubReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<any>(null);
  const renditionRef = useRef<any>(null);

  // ===== Estado lectura =====
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [chapterTitle, setChapterTitle] = useState("");
  const [toc, setToc] = useState<NavItem[]>([]);

  // ===== UI: chrome se muestra solo con tap en el centro =====
  const [chromeVisible, setChromeVisible] = useState(false);

  // ===== Cursor auto-hide tras 2.5s sin movimiento =====
  const [cursorVisible, setCursorVisible] = useState(true);
  const cursorTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const show = () => {
      setCursorVisible(true);
      if (cursorTimerRef.current) window.clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = window.setTimeout(() => setCursorVisible(false), 2500);
    };
    // Disparadores: mover el mouse, scroll, teclas (también dentro del iframe)
    window.addEventListener("mousemove", show);
    window.addEventListener("pointermove", show);
    window.addEventListener("keydown", show);
    window.addEventListener("wheel", show, { passive: true });
    show(); // mostrar al montar
    // Iframe del EPUB → emite "mousemove" via contents
    const att = () => {
      try {
        const contents = renditionRef.current?.getContents?.() ?? [];
        contents.forEach((c: any) => {
          c?.document?.addEventListener?.("mousemove", show);
          c?.document?.addEventListener?.("keydown", show);
        });
      } catch {}
    };
    att();
    renditionRef.current?.on?.("rendered", att);
    return () => {
      window.removeEventListener("mousemove", show);
      window.removeEventListener("pointermove", show);
      window.removeEventListener("keydown", show);
      window.removeEventListener("wheel", show as any);
      if (cursorTimerRef.current) window.clearTimeout(cursorTimerRef.current);
    };
  }, [ready]);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [gotoOpen, setGotoOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [favorited, setFavorited] = useState(false);

  // ===== Bookmarks (lista) =====
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const currentCfi = useRef<string>("");

  // ===== TTS =====
  const [ttsState, setTtsState] = useState<"idle" | "playing" | "paused">("idle");
  const [ttsProgress, setTtsProgress] = useState(0);   // 0..1
  const [ttsText, setTtsText] = useState("");          // texto completo siendo leído
  const [ttsCurrentWord, setTtsCurrentWord] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // ===== Búsqueda =====
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ cfi: string; excerpt: string }[]>([]);
  const [searching, setSearching] = useState(false);

  // ===== Preferencias =====
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const updatePrefs = useCallback((patch: Partial<typeof DEFAULT_PREFS>) => {
    setPrefs((p) => { const n = { ...p, ...patch }; savePrefs(n); return n; });
  }, []);
  useEffect(() => setPrefs(loadPrefs()), []);

  // ===== Cargar voces TTS =====
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  // ===== Carga del EPUB =====
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ePub = (await import("epubjs")).default;
        if (cancelled || !viewerRef.current) return;

        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status} al descargar el libro.`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        const book = (ePub as any)(buf);
        bookRef.current = book;

        const rendition = book.renderTo(viewerRef.current, {
          width: "100%", height: "100%",
          spread: "auto",
          allowScriptedContent: false,
        });
        renditionRef.current = rendition;

        applyEpubTheme(rendition, loadPrefs());

        const savedCfi = localStorage.getItem(`charbook:reader-cfi:${slug}`);
        await rendition.display(savedCfi ?? undefined);

        book.ready.then(async () => {
          await book.locations.generate(1024);
          setTotalPages(book.locations.length() ?? 0);
        }).catch(() => {});

        const nav = await book.loaded.navigation;
        const flat: NavItem[] = [];
        const walk = (items: any[]) => items?.forEach((i) => {
          if (i.label && i.href) flat.push({ label: i.label.trim(), href: i.href });
          if (i.subitems) walk(i.subitems);
        });
        walk(nav.toc ?? []);
        setToc(flat);

        rendition.on("relocated", (loc: any) => {
          const cfi = loc.start.cfi;
          currentCfi.current = cfi;
          localStorage.setItem(`charbook:reader-cfi:${slug}`, cfi);
          const pct = Math.round((loc.start.percentage ?? 0) * 100);
          setProgress(pct);
          try {
            const idx = book.locations.locationFromCfi(cfi);
            if (typeof idx === "number") setPageIndex(idx);
          } catch {}
          const item = book.spine.get(loc.start.href);
          if (item) {
            const ni = book.navigation?.get(item.href);
            if (ni?.label) setChapterTitle(ni.label.trim());
          }
        });

        setReady(true);
      } catch (e: any) {
        setError(e.message ?? "Error desconocido");
      }
    })();

    return () => {
      cancelled = true;
      try {
        renditionRef.current?.destroy();
        bookRef.current?.destroy();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, slug]);

  // ===== Re-aplicar prefs al rendition =====
  useEffect(() => {
    if (!renditionRef.current) return;
    applyEpubTheme(renditionRef.current, prefs);
  }, [prefs.theme, prefs.fontSize, prefs.fontFamily, prefs.lineHeight]);

  // ===== Propagar cursor:none al documento interno del iframe del EPUB =====
  useEffect(() => {
    try {
      const contents = renditionRef.current?.getContents?.() ?? [];
      contents.forEach((c: any) => {
        const doc = c?.document;
        if (!doc?.body) return;
        doc.body.style.cursor = cursorVisible ? "" : "none";
      });
    } catch {}
  }, [cursorVisible, ready, progress]);

  // ===== Atajos teclado (siguen activos siempre) =====
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      switch (e.key) {
        case "ArrowLeft": renditionRef.current?.prev(); break;
        case "ArrowRight": renditionRef.current?.next(); break;
        case "t": case "T": setTocOpen((v) => !v); setChromeVisible(true); break;
        case "s": case "S": setSettingsOpen((v) => !v); setChromeVisible(true); break;
        case "b": case "B": addBookmark(); break;
        case "/": e.preventDefault(); setSearchOpen(true); setChromeVisible(true); break;
        case "f": case "F": toggleFullscreen(); break;
        case "d": case "D":
          updatePrefs({ theme: prefs.theme === "dark" ? "light" : "dark" }); break;
        case "+": case "=":
          updatePrefs({ fontSize: Math.min(180, prefs.fontSize + 10) }); break;
        case "-": case "_":
          updatePrefs({ fontSize: Math.max(70, prefs.fontSize - 10) }); break;
        case "Escape":
          setTocOpen(false); setSettingsOpen(false); setCommentsOpen(false);
          setBookmarksOpen(false); setSearchOpen(false); setGotoOpen(false);
          setChromeVisible(false);
          break;
      }
    };
    window.addEventListener("keyup", onKey);
    renditionRef.current?.on?.("keyup", onKey);
    return () => window.removeEventListener("keyup", onKey);
  }, [prefs.theme, prefs.fontSize, updatePrefs]);

  // ===== Pantalla completa =====
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
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // ===== Modelo de interacción =====
  // Las 3 zonas se renderizan como overlays absolutos por encima del iframe
  // del EPUB. Los clicks DENTRO del iframe no llegan a nuestro contenedor, así
  // que necesitamos zonas reales que reciban el pointer event.
  const tapPrev = () => { renditionRef.current?.prev(); setChromeVisible(false); };
  const tapNext = () => { renditionRef.current?.next(); setChromeVisible(false); };
  const tapCenter = () => setChromeVisible((v) => !v);

  // Re-attacha listeners al iframe del EPUB cada vez que se renderiza una
  // nueva página. epub.js recrea el documento del iframe en cada `display()`,
  // por eso los listeners "globales" se pierden tras la primera página y los
  // overlays HTML pueden quedar tapados por el iframe nuevo.
  useEffect(() => {
    if (!renditionRef.current) return;
    const onDocClick = (e: MouseEvent) => {
      // Si TTS está activo y se clickeó una palabra dentro del overlay
      // central (que tiene pointer-events:none), dejamos que esos clicks
      // los procese la lógica de saltar audio. Para el click de mostrar
      // chrome, simplemente toggleamos.
      const w = window.innerWidth;
      const x = e.clientX ?? w / 2;
      if (x < w * 0.25) tapPrev();
      else if (x > w * 0.75) tapNext();
      else tapCenter();
    };
    const attachToAllContents = () => {
      try {
        const contents = renditionRef.current?.getContents?.() ?? [];
        contents.forEach((c: any) => {
          const doc: Document | undefined = c?.document;
          if (!doc) return;
          const prev = (doc as any).__charBookChromeClick;
          if (prev) doc.removeEventListener("click", prev, true);
          (doc as any).__charBookChromeClick = onDocClick;
          doc.addEventListener("click", onDocClick, true);
        });
      } catch {}
    };
    const onRendered = () => {
      // Pequeño delay porque a veces el document del iframe nuevo aún no
      // está disponible inmediatamente al evento.
      setTimeout(attachToAllContents, 50);
    };
    attachToAllContents();
    renditionRef.current.on?.("rendered", onRendered);
    renditionRef.current.on?.("relocated", onRendered);
    return () => {
      try { renditionRef.current?.off?.("rendered", onRendered); } catch {}
      try { renditionRef.current?.off?.("relocated", onRendered); } catch {}
      try {
        const contents = renditionRef.current?.getContents?.() ?? [];
        contents.forEach((c: any) => {
          const doc: Document | undefined = c?.document;
          const h = doc && (doc as any).__charBookChromeClick;
          if (doc && h) doc.removeEventListener("click", h, true);
        });
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ===== Bookmarks =====
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`charbook:bookmarks:${slug}`);
      setBookmarks(raw ? JSON.parse(raw) : []);
    } catch {}
    setFavorited(localStorage.getItem(`charbook:fav:${slug}`) === "1");
  }, [slug]);
  const saveBookmarks = (arr: Bookmark[]) => {
    setBookmarks(arr);
    localStorage.setItem(`charbook:bookmarks:${slug}`, JSON.stringify(arr));
  };
  const addBookmark = () => {
    if (!currentCfi.current) return;
    if (bookmarks.some((b) => b.cfi === currentCfi.current)) return;
    saveBookmarks([
      { cfi: currentCfi.current, chapter: chapterTitle || "Capítulo", pct: progress, created: Date.now() },
      ...bookmarks,
    ]);
  };
  const removeBookmark = (cfi: string) => saveBookmarks(bookmarks.filter((b) => b.cfi !== cfi));
  const isBookmarked = bookmarks.some((b) => b.cfi === currentCfi.current);

  const toggleFav = () => {
    const n = !favorited;
    localStorage.setItem(`charbook:fav:${slug}`, n ? "1" : "0");
    setFavorited(n);
  };

  // ===== TTS con onboundary para progreso animado =====
  const ttsCharOffsetRef = useRef(0);
  const ttsTextRef = useRef("");
  // Estado vivo (lo leen los callbacks de SpeechSynthesis)
  const ttsStateRef = useRef<"idle" | "playing" | "paused">("idle");
  useEffect(() => { ttsStateRef.current = ttsState; }, [ttsState]);

  // ===== Posición del audiolibro persistida por libro =====
  // Guardamos { char, chapter, pct, updated } para poder reanudar después.
  type AudioPos = { char: number; chapter: string; pct: number; updated: number };
  const audioPosKey = `charbook:audio-pos:${slug}`;
  const [savedAudioPos, setSavedAudioPos] = useState<AudioPos | null>(null);
  const lastSaveRef = useRef(0);
  // Ref vivo del chapterTitle para que los cleanups asíncronos lo lean siempre
  const chapterTitleRef = useRef("");
  useEffect(() => { chapterTitleRef.current = chapterTitle; }, [chapterTitle]);

  const saveAudioPos = useCallback(() => {
    try {
      const pos: AudioPos = {
        char: ttsCharOffsetRef.current,
        chapter: chapterTitleRef.current,
        pct: Math.round((ttsCharOffsetRef.current / Math.max(1, ttsTextRef.current.length)) * 100),
        updated: Date.now(),
      };
      localStorage.setItem(audioPosKey, JSON.stringify(pos));
      setSavedAudioPos(pos);
    } catch {}
  }, [audioPosKey]);

  const clearSavedAudioPos = useCallback(() => {
    try { localStorage.removeItem(audioPosKey); } catch {}
    setSavedAudioPos(null);
  }, [audioPosKey]);

  // Cargar posición guardada al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(audioPosKey);
      if (raw) setSavedAudioPos(JSON.parse(raw));
    } catch {}
  }, [audioPosKey]);

  /**
   * Extracción de texto SUPER ligera: solo lee innerText (que ya está
   * pre-renderizado por el navegador). Tarda < 1 ms en cualquier capítulo.
   * NO muta el DOM en absoluto. Devuelve también los text nodes y sus offsets
   * para poder localizar palabras con Range API más adelante.
   */
  const extractTextLight = (doc: Document): {
    text: string;
    textNodes: Text[];
    nodeOffsets: number[]; // offset acumulado de cada text node en el texto plano
  } => {
    const text = doc.body.innerText || "";
    const textNodes: Text[] = [];
    const nodeOffsets: number[] = [];
    let acc = 0;

    // Recorremos text nodes en orden documento, alineando offsets con innerText.
    // innerText colapsa espacios → reconstruimos usando textContent + colapso.
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = (node as Text).parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (tag === "script" || tag === "style" || tag === "noscript") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const t = n as Text;
      const len = (t.textContent ?? "").length;
      if (!len) continue;
      textNodes.push(t);
      nodeOffsets.push(acc);
      acc += len;
    }
    return { text, textNodes, nodeOffsets };
  };

  /**
   * Encuentra un Range que cubre los caracteres [start, start+len) usando los
   * text nodes pre-recolectados. No muta el DOM.
   */
  const findRange = (
    doc: Document,
    textNodes: Text[],
    nodeOffsets: number[],
    start: number,
    len: number
  ): Range | null => {
    if (!textNodes.length) return null;
    // binary search del nodo inicial
    let lo = 0, hi = textNodes.length - 1, startIdx = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (nodeOffsets[mid] <= start) { startIdx = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    const startNode = textNodes[startIdx];
    const startOffset = Math.max(0, Math.min((startNode.textContent ?? "").length, start - nodeOffsets[startIdx]));

    // end
    const endTarget = start + Math.max(1, len);
    lo = startIdx; hi = textNodes.length - 1; let endIdx = startIdx;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (nodeOffsets[mid] < endTarget) { endIdx = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    const endNode = textNodes[endIdx];
    const endOffset = Math.max(0, Math.min((endNode.textContent ?? "").length, endTarget - nodeOffsets[endIdx]));

    try {
      const r = doc.createRange();
      r.setStart(startNode, startOffset);
      r.setEnd(endNode, endOffset);
      return r;
    } catch { return null; }
  };

  /** Asegura un div overlay absoluto dentro del iframe para el highlight. */
  const ensureHighlightOverlay = (doc: Document): HTMLElement => {
    let el = doc.getElementById("tts-highlight-overlay") as HTMLElement | null;
    if (!el) {
      el = doc.createElement("div");
      el.id = "tts-highlight-overlay";
      el.style.cssText = `
        position: absolute;
        pointer-events: none;
        background: rgba(245, 158, 11, 0.40);
        border-radius: 3px;
        transition: left 0.12s linear, top 0.12s linear, width 0.12s linear, height 0.12s linear;
        z-index: 9999;
        display: none;
        mix-blend-mode: multiply;
      `;
      doc.body.appendChild(el);
    }
    return el;
  };

  /** Limpieza ligera: solo oculta el overlay. NO toca text nodes (nunca los mutó). */
  const cleanupInstrumentation = useCallback(() => {
    try {
      const contents = renditionRef.current?.getContents?.() ?? [];
      for (const c of contents) {
        const doc: Document | undefined = c?.document;
        if (!doc) continue;
        const el = doc.getElementById("tts-highlight-overlay");
        if (el) el.style.display = "none";
      }
    } catch {}
  }, []);

  // ===== Estado de TTS por sesión =====
  // Cuando arrancamos un TTS, guardamos los text nodes y offsets del iframe
  // actual para poder localizar palabras con Range API sin mutar el DOM.
  const ttsDocRef = useRef<Document | null>(null);
  const ttsTextNodesRef = useRef<Text[]>([]);
  const ttsNodeOffsetsRef = useRef<number[]>([]);

  /** Resalta el rango [absoluteChar, absoluteChar+len) usando un overlay absoluto. */
  const highlightCharRange = useCallback((absoluteChar: number, len: number) => {
    const doc = ttsDocRef.current;
    if (!doc) return;
    const range = findRange(doc, ttsTextNodesRef.current, ttsNodeOffsetsRef.current, absoluteChar, len);
    if (!range) return;
    try {
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const overlay = ensureHighlightOverlay(doc);
      // El rect está en coords del iframe — el overlay está posicionado en el body absoluto
      overlay.style.left = `${rect.left + (doc.defaultView?.scrollX ?? 0)}px`;
      overlay.style.top = `${rect.top + (doc.defaultView?.scrollY ?? 0)}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.style.display = "block";
    } catch {}
  }, []);

  const clearHighlight = useCallback(() => {
    try {
      const contents = renditionRef.current?.getContents?.() ?? [];
      for (const c of contents) {
        const doc: Document | undefined = c?.document;
        if (!doc) continue;
        const el = doc.getElementById("tts-highlight-overlay");
        if (el) el.style.display = "none";
      }
    } catch {}
  }, []);

  /**
   * Divide el texto en chunks por oración/párrafo de ~150-400 caracteres.
   * Mejor que pasarle todo el capítulo de una al TTS: arranca al instante
   * porque solo procesa el primer chunk.
   */
  const splitIntoChunks = (text: string): { start: number; text: string }[] => {
    const chunks: { start: number; text: string }[] = [];
    const re = /[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const piece = m[0];
      const start = m.index;
      // Si la oración es muy larga, partimos por comas
      if (piece.length > 400) {
        let off = 0;
        for (const sub of piece.split(/(?<=,)\s+/)) {
          if (sub.trim()) chunks.push({ start: start + off, text: sub });
          off += sub.length + 1;
        }
      } else if (piece.trim()) {
        chunks.push({ start, text: piece });
      }
    }
    return chunks;
  };

  // Refs para encadenar chunks
  const chunksRef = useRef<{ start: number; text: string }[]>([]);
  const chunkIdxRef = useRef(0);

  /** Habla un chunk específico y encadena el siguiente en su onend. */
  const speakChunk = useCallback((chunkIdx: number) => {
    const ss = window.speechSynthesis;
    if (!ss) return;
    const chunks = chunksRef.current;
    if (chunkIdx >= chunks.length) {
      setTtsState("idle"); setTtsProgress(1); clearHighlight(); return;
    }
    const chunk = chunks[chunkIdx];
    chunkIdxRef.current = chunkIdx;

    // Estado limpio: si quedó pausado de antes, resume. Si quedó hablando,
    // cancel. Sin solapar el utterance anterior con el nuevo.
    if (ss.paused) ss.resume();
    if (ss.speaking || ss.pending) ss.cancel();

    // Pequeño delay para que el navegador procese el cancel ANTES del speak.
    // Sin esto Chrome a veces "trags" el siguiente speak() junto con el cancel.
    setTimeout(() => {
      // Doble check: si entretanto el usuario detuvo, no arrancamos
      if (ttsStateRef.current === "idle" && chunkIdx > 0) return;

      const utter = new SpeechSynthesisUtterance(chunk.text);

      // Voz: si la guardada no existe en este navegador, dejamos voice=null
      // (default del sistema), que es lo más seguro para que suene algo.
      let chosenLang = "es-ES";
      try {
        const allVoices = ss.getVoices();
        if (prefs.ttsVoice) {
          const v = allVoices.find((vv) => vv.name === prefs.ttsVoice);
          if (v) { utter.voice = v; chosenLang = v.lang; }
        }
        // Si no hay voz explícita, buscar una en español por defecto
        if (!utter.voice && allVoices.length) {
          const esVoice = allVoices.find((vv) => vv.lang.startsWith("es"));
          if (esVoice) { utter.voice = esVoice; chosenLang = esVoice.lang; }
        }
      } catch {}
      utter.lang = chosenLang;
      utter.rate = prefs.ttsRate || 1;
      utter.pitch = 1;
      utter.volume = 1;

      utter.onend = () => {
        if (ttsStateRef.current === "idle") return;
        speakChunk(chunkIdx + 1);
      };
      utter.onerror = (ev) => {
        // Chrome emite onerror "canceled" cuando hacemos cancel manual — ignorar
        if ((ev as any).error === "canceled" || (ev as any).error === "interrupted") return;
        if (ttsStateRef.current !== "idle") speakChunk(chunkIdx + 1);
      };
      utter.onboundary = (ev) => {
        if (typeof ev.charIndex !== "number") return;
        const absoluteChar = chunk.start + ev.charIndex;
        ttsCharOffsetRef.current = absoluteChar;
        const total = ttsTextRef.current.length;
        const pct = Math.min(1, absoluteChar / Math.max(1, total));
        setTtsProgress(pct);
        const slice = ttsTextRef.current.slice(absoluteChar, absoluteChar + (ev.charLength ?? 20));
        const word = slice.split(/\s/)[0] ?? "";
        if (word) setTtsCurrentWord(word);
        highlightCharRange(absoluteChar, ev.charLength ?? word.length);
        try {
          const pos = {
            char: absoluteChar,
            chapter: chapterTitleRef.current,
            pct: Math.round(pct * 100),
            updated: Date.now(),
          };
          localStorage.setItem(audioPosKey, JSON.stringify(pos));
        } catch {}
      };

      utterRef.current = utter;
      ss.speak(utter);
      setTtsState("playing");
    }, 60);
  }, [prefs.ttsVoice, prefs.ttsRate, highlightCharRange, clearHighlight, audioPosKey]);

  /** Reanuda la lectura desde un offset absoluto. Encuentra el chunk correspondiente. */
  const speakFrom = useCallback((text: string, fromChar: number) => {
    const chunks = chunksRef.current;
    if (!chunks.length) return;
    // Encuentra el primer chunk cuyo start ≥ fromChar (o el que lo contiene)
    let idx = 0;
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].start + chunks[i].text.length > fromChar) { idx = i; break; }
    }
    speakChunk(idx);
  }, [speakChunk]);

  const startTts = (fromChar = 0) => {
    if (!window.speechSynthesis) { alert("Tu navegador no soporta lectura por voz."); return; }

    // Si las voces aún no están cargadas, espera al evento voiceschanged
    // hasta 1.5 s y luego intenta de todos modos.
    const ss = window.speechSynthesis;
    if (ss.getVoices().length === 0) {
      let done = false;
      const proceed = () => {
        if (done) return; done = true;
        ss.removeEventListener?.("voiceschanged", proceed);
        // Si tras esperar siguen sin voces (caso Opera GX, Brave con shields),
        // avisar al usuario que su navegador no tiene voces TTS instaladas.
        if (ss.getVoices().length === 0) {
          const ua = navigator.userAgent;
          const isOpera = /OPR\//.test(ua) || /Opera/.test(ua);
          const msg = isOpera
            ? "🎙️ Opera GX no carga las voces de Windows por defecto.\n\nSoluciones:\n  • Usa Chrome, Edge o Firefox\n  • O en opera://settings/ activa \"Permitir que los sitios reproduzcan sonido\"\n\nEl audiolibro está disponible en otros navegadores."
            : "Tu navegador no tiene voces de TTS instaladas.\n\nPrueba en Chrome, Edge o Firefox que sí tienen voces integradas.";
          alert(msg);
          return;
        }
        startTts(fromChar);
      };
      ss.addEventListener?.("voiceschanged", proceed);
      setTimeout(proceed, 1500);
      return;
    }

    try {
      const contents = renditionRef.current?.getContents?.() ?? [];
      if (!contents.length) {
        setTimeout(() => startTts(fromChar), 500);
        return;
      }

      // Usamos solo el primer iframe visible (la página actual). innerText es
      // instantáneo y nos da el texto ya colapsado como lo vería el usuario.
      const c = contents[0];
      const doc: Document | undefined = c?.document;
      if (!doc) {
        setTimeout(() => startTts(fromChar), 500);
        return;
      }

      const { text, textNodes, nodeOffsets } = extractTextLight(doc);
      if (!text.trim()) {
        // El body del iframe todavía no tiene texto — reintenta
        setTimeout(() => startTts(fromChar), 500);
        return;
      }

      ttsDocRef.current = doc;
      ttsTextNodesRef.current = textNodes;
      ttsNodeOffsetsRef.current = nodeOffsets;
      ttsTextRef.current = text;
      setTtsText(text);

      // Trocea en oraciones y arranca con la primera → instantáneo
      chunksRef.current = splitIntoChunks(text);
      ttsCharOffsetRef.current = fromChar;
      setTtsProgress(0);
      setTtsCurrentWord("");
      ensureHighlightOverlay(doc); // crea el div del highlight si no existe

      speakFrom(text, fromChar);
    } catch (e) {
      console.error("[TTS]", e);
      setTtsState("idle");
    }
  };

  // Cuando el usuario cambia de página mientras el TTS suena, reiniciamos
  // el audiolibro automáticamente con el texto de la nueva página.
  useEffect(() => {
    if (ttsState === "idle") return;
    // Espera un tick para que epub.js renderice la nueva página
    const t = setTimeout(() => startTts(0), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterTitle]);

  // ===== Reiniciar TTS cuando cambia voz o velocidad MID-PLAYBACK =====
  // El SpeechSynthesis API no permite cambiar voice/rate de un utterance en
  // curso. Hay que cancelar y reiniciar desde el offset actual.
  useEffect(() => {
    if (ttsState === "idle") return;
    const text = ttsTextRef.current;
    if (!text) return;
    // Reanuda desde la palabra actual aproximada
    const offset = ttsCharOffsetRef.current;
    speakFrom(text, offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.ttsVoice, prefs.ttsRate]);
  const pauseTts = () => {
    if (ttsState === "playing") {
      window.speechSynthesis.pause();
      setTtsState("paused");
      saveAudioPos(); // guarda la pausa actual para reanudar después
    } else if (ttsState === "paused") {
      window.speechSynthesis.resume();
      setTtsState("playing");
    }
  };
  const stopTts = () => {
    window.speechSynthesis.cancel();
    setTtsState("idle");
    setTtsProgress(0);
    setTtsCurrentWord("");
    clearHighlight();
    cleanupInstrumentation();
    // El usuario detuvo manualmente → limpiamos la posición guardada
    clearSavedAudioPos();
  };

  // ===== Cleanup SIMPLE y RESETEO al montar =====
  // Estrategia:
  //  - Al desmontar: guardamos posición + cancel().
  //  - Al perder visibilidad: pausa y guarda.
  //  - Al MONTAR el lector (cada vez que entras), forzamos un reset duro del
  //    speechSynthesis para limpiar cualquier estado zombie de la sesión
  //    anterior. Eso garantiza que el siguiente speak() arranque limpio.
  useEffect(() => {
    // NO llamamos cancel() al montar — eso puede interferir con el primer
    // speak() de la sesión. Solo reseteamos el estado React.
    setTtsState("idle");
    ttsStateRef.current = "idle";

    const stopAndSave = () => {
      try {
        if (ttsStateRef.current !== "idle") {
          try {
            const pos = {
              char: ttsCharOffsetRef.current,
              chapter: chapterTitleRef.current,
              pct: Math.round((ttsCharOffsetRef.current / Math.max(1, ttsTextRef.current.length)) * 100),
              updated: Date.now(),
            };
            localStorage.setItem(audioPosKey, JSON.stringify(pos));
          } catch {}
        }
        try { window.speechSynthesis?.cancel(); } catch {}
      } catch {}
    };

    const onVisChange = () => {
      try {
        if (document.hidden && ttsStateRef.current === "playing") {
          window.speechSynthesis.pause();
          saveAudioPos();
          setTtsState("paused");
        }
      } catch {}
    };

    window.addEventListener("beforeunload", stopAndSave);
    window.addEventListener("pagehide", stopAndSave);
    document.addEventListener("visibilitychange", onVisChange);

    return () => {
      stopAndSave();
      window.removeEventListener("beforeunload", stopAndSave);
      window.removeEventListener("pagehide", stopAndSave);
      document.removeEventListener("visibilitychange", onVisChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioPosKey]);

  // ===== Búsqueda en EPUB =====
  const runSearch = async () => {
    const q = searchQuery.trim();
    if (!q || !bookRef.current) return;
    setSearching(true);
    try {
      const book = bookRef.current;
      const spineItems = book.spine?.spineItems ?? [];
      const results: { cfi: string; excerpt: string }[] = [];
      for (const item of spineItems) {
        const loaded = await item.load(book.load.bind(book));
        try {
          const found = item.find(q) ?? [];
          for (const f of found) {
            results.push({ cfi: f.cfi, excerpt: f.excerpt });
            if (results.length >= 80) break;
          }
        } catch {}
        item.unload();
        if (results.length >= 80) break;
      }
      setSearchResults(results);
    } catch (e) { console.warn("Búsqueda fallida:", e); }
    setSearching(false);
  };

  // ===== Tiempo estimado restante =====
  const estimatedRemaining = useMemo(() => {
    if (!totalPages || pageIndex >= totalPages) return null;
    const pagesLeft = totalPages - pageIndex;
    // ~40s por página de epub a velocidad media
    const seconds = pagesLeft * 40;
    if (seconds < 60) return `${seconds}s`;
    const m = Math.round(seconds / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}min`;
  }, [pageIndex, totalPages]);

  // ===== Compartir =====
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); alert("Enlace copiado."); }
    } catch {}
  };

  // ===== Render =====
  const theme = THEMES[prefs.theme];
  const fadeCls = chromeVisible ? "opacity-100" : "opacity-0 pointer-events-none";

  if (error) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center px-6 text-center" style={{ background: theme.body, color: theme.text }}>
        <AlertTriangle className="mb-4 h-12 w-12 text-amber-500" />
        <h1 className="font-serif text-2xl font-bold">No se pudo cargar el libro</h1>
        <p className="mt-3 max-w-md text-sm opacity-80">{error}</p>
        <Link href={`/libro/${slug}`} className="mt-6 rounded-md bg-primary px-4 py-2 text-primary-foreground">
          Volver al detalle
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed inset-0 overflow-hidden transition-colors duration-300",
        !cursorVisible && "reader-hide-cursor"
      )}
      style={{ background: theme.body, color: theme.text }}
    >
      {/* Cuando el cursor está oculto, todos los descendientes (incluido el
          iframe del EPUB) heredan cursor:none. */}
      <style>{`
        .reader-hide-cursor, .reader-hide-cursor * { cursor: none !important; }
      `}</style>

      {/* ═══════ ZONA DE LECTURA ═══════
          El iframe del EPUB queda con pointer-events:none para que los clicks
          y el cursor SVG vayan SIEMPRE a las zonas overlay de abajo, incluso
          tras cambiar de página (cuando epub.js recrea el iframe con su
          propio stacking context). */}
      <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
        {!ready && (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-7 w-7 animate-spin opacity-60" />
              <p className="text-xs opacity-60">Cargando libro…</p>
            </div>
          </div>
        )}
        <div className="mx-auto h-full w-full max-w-5xl px-2 sm:px-6 md:px-12 py-4">
          <div ref={viewerRef} className="h-full w-full rounded-lg shadow-2xl"
            style={{ background: theme.page, pointerEvents: "none" }} />
        </div>
      </div>

      {/* ═══════ ZONAS DE INTERACCIÓN OVERLAY ═══════
          z-35 está por debajo de los controles (z-40) y por encima del iframe
          del EPUB (que tiene pointer-events:none). Cursor SVG por zona. */}
      <button
        onClick={tapPrev}
        aria-label="Página anterior"
        title="Página anterior"
        className="absolute top-0 bottom-0 left-0 w-[25%] group"
        style={{ cursor: CURSOR_LEFT, background: "transparent", pointerEvents: "auto", zIndex: 35 }}
      >
        <span className="absolute top-1/2 left-4 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full opacity-0 group-hover:opacity-60 transition-opacity"
          style={{ background: theme.chrome, border: `1px solid ${theme.border}`, color: theme.text }}>
          <ChevronLeft className="h-5 w-5" />
        </span>
      </button>

      <button
        onClick={tapCenter}
        aria-label="Mostrar/ocultar controles"
        title="Mostrar / ocultar controles"
        className="absolute top-0 bottom-0 left-[25%] right-[25%] group"
        style={{ cursor: CURSOR_CENTER, background: "transparent", pointerEvents: "auto", zIndex: 35 }}
      >
        <span className="absolute top-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] opacity-0 group-hover:opacity-70 transition-opacity backdrop-blur-md"
          style={{ background: theme.chrome, border: `1px solid ${theme.border}`, color: theme.text }}>
          <Eye className="h-3 w-3" />
          Toca para opciones
        </span>
      </button>

      <button
        onClick={tapNext}
        aria-label="Página siguiente"
        title="Página siguiente"
        className="absolute top-0 bottom-0 right-0 w-[25%] group"
        style={{ cursor: CURSOR_RIGHT, background: "transparent", pointerEvents: "auto", zIndex: 35 }}
      >
        <span className="absolute top-1/2 right-4 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full opacity-0 group-hover:opacity-60 transition-opacity"
          style={{ background: theme.chrome, border: `1px solid ${theme.border}`, color: theme.text }}>
          <ChevronRight className="h-5 w-5" />
        </span>
      </button>

      {/* ═══════ TOP-LEFT: VOLVER (solo si chrome visible) ═══════
          Usa window.location en vez de <Link> de Next.js para forzar una
          recarga completa de la página. Es la ÚNICA forma garantizada de
          detener el speechSynthesis del navegador (que es global a la
          pestaña y no respeta el unmount de React de forma confiable). */}
      <div data-no-tap className={cn("absolute left-4 top-4 z-40 transition-opacity duration-300", fadeCls)}>
        <button
          onClick={() => {
            // Guarda posición ANTES de cualquier cosa
            try {
              if (ttsStateRef.current !== "idle") {
                const pos = {
                  char: ttsCharOffsetRef.current,
                  chapter: chapterTitleRef.current,
                  pct: Math.round((ttsCharOffsetRef.current / Math.max(1, ttsTextRef.current.length)) * 100),
                  updated: Date.now(),
                };
                localStorage.setItem(audioPosKey, JSON.stringify(pos));
              }
            } catch {}
            try { window.speechSynthesis?.cancel(); } catch {}
            // Recarga dura — destruye el motor TTS de raíz
            window.location.href = `/libro/${slug}`;
          }}
          title="Volver al detalle"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md hover:scale-110 transition-transform"
          style={{ background: theme.chrome, color: theme.text, border: `1px solid ${theme.border}` }}>
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      {/* ═══════ TOP-RIGHT: BOTONES PRINCIPALES ═══════ */}
      <div data-no-tap className={cn(
        "absolute right-4 top-4 z-40 flex flex-col gap-2 transition-opacity duration-300", fadeCls
      )}>
        <ChromeBtn icon={Settings2} title="Ajustes (S)" onClick={() => setSettingsOpen(true)} theme={theme} />
        <ChromeBtn icon={ListOrdered} title="Índice (T)" onClick={() => setTocOpen(true)} theme={theme} />
        <ChromeBtn icon={Search} title="Buscar (/)" onClick={() => setSearchOpen(true)} theme={theme} />
        <ChromeBtn icon={Hash} title="Ir a página" onClick={() => setGotoOpen(true)} theme={theme} />
        <ChromeBtn icon={fullscreen ? Minimize2 : Maximize2} title="Pantalla completa (F)" onClick={toggleFullscreen} theme={theme} />
      </div>

      {/* ═══════ MID-RIGHT: ACCIONES ═══════ */}
      <div data-no-tap className={cn(
        "absolute right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 transition-opacity duration-300", fadeCls
      )}>
        <PillBtn icon={isBookmarked ? BookmarkCheck : Bookmark} label={isBookmarked ? "Guardado" : "Marcador (B)"} onClick={addBookmark} active={isBookmarked} theme={theme} />
        <PillBtn icon={Bookmark} label={`Marcadores (${bookmarks.length})`} onClick={() => setBookmarksOpen(true)} theme={theme} />
        <PillBtn icon={Heart} label={favorited ? "En favoritos" : "Favorito"} onClick={toggleFav} active={favorited} theme={theme} activeClass="text-rose-500" />
        <PillBtn icon={MessageSquare} label="Notas" onClick={() => setCommentsOpen(true)} theme={theme} />
        <PillBtn icon={Share2} label="Compartir" onClick={share} theme={theme} />
      </div>

      {/* ═══════ TOP-CENTER: INFO RESUMEN ═══════ */}
      <div data-no-tap className={cn(
        "absolute left-1/2 -translate-x-1/2 top-4 z-40 transition-opacity duration-300", fadeCls
      )}>
        <div className="rounded-full px-4 py-1.5 backdrop-blur-md text-xs flex items-center gap-3"
          style={{ background: theme.chrome, border: `1px solid ${theme.border}` }}>
          <span className="font-serif font-semibold truncate max-w-[260px]">{title}</span>
          {chapterTitle && (
            <>
              <span className="opacity-30">·</span>
              <span className="opacity-70 truncate max-w-[180px]">{chapterTitle}</span>
            </>
          )}
          {estimatedRemaining && (
            <>
              <span className="opacity-30">·</span>
              <span className="inline-flex items-center gap-1 opacity-70">
                <Clock className="h-3 w-3" /> {estimatedRemaining}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ═══════ BOTTOM: BARRA DE NAV PRINCIPAL + PROGRESS ═══════ */}
      <div data-no-tap className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(680px,calc(100vw-2rem))] transition-opacity duration-300", fadeCls
      )}>
        <div className="rounded-2xl backdrop-blur-md overflow-hidden"
          style={{ background: theme.chrome, border: `1px solid ${theme.border}` }}>
          <div className="flex items-center gap-2 px-3 py-2.5">
            <button onClick={() => {
              const idx = currentChapterIdx(toc, chapterTitle);
              const prevC = toc[Math.max(0, idx - 1)];
              if (prevC) renditionRef.current?.display(prevC.href);
            }}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs opacity-80 hover:opacity-100"
              title="Capítulo anterior">
              <ChevronsLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Capítulo</span>
            </button>

            <button onClick={() => renditionRef.current?.prev()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-black/10"
              title="Página anterior (←)">
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button onClick={() => renditionRef.current?.next()}
              className="flex-1 text-center text-xs leading-tight rounded-md py-1 hover:bg-black/10"
              title="Avanzar">
              <div className="font-bold tabular-nums" style={{ color: "#f59e0b" }}>
                {totalPages > 0 ? `${pageIndex + 1} de ${totalPages}` : `${progress}%`}
              </div>
              <div className="opacity-70 text-[10px]">Toca el centro para avanzar</div>
            </button>

            <button onClick={() => renditionRef.current?.next()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-black/10"
              title="Página siguiente (→)">
              <ChevronRight className="h-4 w-4" />
            </button>

            <button onClick={() => {
              const idx = currentChapterIdx(toc, chapterTitle);
              const nextC = toc[Math.min(toc.length - 1, idx + 1)];
              if (nextC) renditionRef.current?.display(nextC.href);
            }}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs opacity-80 hover:opacity-100"
              title="Capítulo siguiente">
              <span className="hidden sm:inline">Capítulo</span>
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Barra progreso del libro */}
          <div className="h-1 w-full" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full transition-[width] duration-300"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg,#f59e0b,#fcd34d)" }} />
          </div>
        </div>
      </div>

      {/* ═══════ AUDIOLIBRO: barra de progreso animada ═══════ */}
      {ttsState !== "idle" && (
        <div data-no-tap className={cn(
          "absolute bottom-24 left-1/2 -translate-x-1/2 z-40 w-[min(720px,calc(100vw-2rem))] transition-opacity duration-300",
          fadeCls
        )}>
          <div className="rounded-2xl backdrop-blur-md overflow-hidden p-3"
            style={{ background: theme.chrome, border: `1px solid ${theme.border}` }}>
            <div className="flex items-center gap-3">
              <button onClick={pauseTts}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: "#f59e0b", color: "#1a1a1a" }}>
                {ttsState === "playing" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button onClick={stopTts}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/10">
                <Square className="h-3.5 w-3.5" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-[10px] opacity-80 mb-1">
                  <span className="uppercase tracking-wider font-bold">Audiolibro</span>
                  <span className="tabular-nums">{Math.round(ttsProgress * 100)}%</span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.10)" }}>
                  <div
                    className="h-full rounded-full transition-[width] duration-150 ease-out"
                    style={{
                      width: `${ttsProgress * 100}%`,
                      background: "linear-gradient(90deg,#f59e0b,#fde68a,#f59e0b)",
                      backgroundSize: "200% 100%",
                      animation: "tts-shimmer 2s linear infinite",
                    }}
                  />
                </div>
                {ttsCurrentWord && (
                  <div className="mt-1.5 text-[11px] opacity-80 truncate">
                    <span className="opacity-50 mr-1">▶</span>
                    <span style={{ color: "#f59e0b" }} className="font-semibold">{ttsCurrentWord}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <style>{`@keyframes tts-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        </div>
      )}

      {/* TTS botón de inicio (con opción de reanudar si hay posición guardada) */}
      {ttsState === "idle" && (
        <div data-no-tap className={cn(
          "absolute bottom-24 left-4 z-40 transition-opacity duration-300 flex items-center gap-2", fadeCls
        )}>
          {savedAudioPos && savedAudioPos.pct > 0 && savedAudioPos.pct < 100 ? (
            <>
              <button
                onClick={() => startTts(savedAudioPos.char)}
                className="inline-flex items-center gap-2 rounded-full backdrop-blur-md px-4 py-2 hover:scale-105 transition-transform"
                style={{ background: theme.chrome, border: `1px solid ${theme.border}` }}
                title={`Reanudar desde donde quedó (${savedAudioPos.pct}%)`}
              >
                <Play className="h-3.5 w-3.5" style={{ color: "#f59e0b" }} />
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-xs font-medium">Reanudar audio</span>
                  <span className="text-[9px] opacity-70 tabular-nums">{savedAudioPos.pct}% · {savedAudioPos.chapter || "guardado"}</span>
                </div>
              </button>
              <button
                onClick={() => { clearSavedAudioPos(); startTts(0); }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md hover:scale-110 transition-transform"
                style={{ background: theme.chrome, border: `1px solid ${theme.border}` }}
                title="Empezar de nuevo desde el principio"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button onClick={() => startTts(0)}
              className="inline-flex items-center gap-2 rounded-full backdrop-blur-md px-4 py-2 hover:scale-105 transition-transform"
              style={{ background: theme.chrome, border: `1px solid ${theme.border}` }}
              title="Escuchar (audiolibro)">
              <Play className="h-3.5 w-3.5" style={{ color: "#f59e0b" }} />
              <span className="text-xs font-medium">Audiolibro</span>
            </button>
          )}
        </div>
      )}

      {/* ═══════ SIDEBARS ═══════ */}
      {tocOpen && (
        <SidePanel onClose={() => setTocOpen(false)} title="Índice" theme={theme} side="left">
          {toc.length === 0 ? (
            <p className="text-sm opacity-60">Este libro no tiene tabla de contenidos.</p>
          ) : (
            <ul className="space-y-0.5">
              {toc.map((c, i) => {
                const isCurrent = c.label.trim() === chapterTitle.trim();
                return (
                  <li key={i}>
                    <button
                      onClick={() => { renditionRef.current?.display(c.href); setTocOpen(false); setChromeVisible(false); }}
                      className={cn(
                        "w-full rounded-md p-2 text-left text-sm hover:bg-black/10 transition-colors flex items-start gap-2",
                        isCurrent && "bg-amber-500/10 text-amber-500 font-medium"
                      )}>
                      <span className="opacity-50 text-[10px] mt-0.5 tabular-nums min-w-[18px]">{i + 1}</span>
                      <span className="flex-1 leading-snug">{c.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SidePanel>
      )}

      {bookmarksOpen && (
        <SidePanel onClose={() => setBookmarksOpen(false)} title={`Marcadores (${bookmarks.length})`} theme={theme} side="left">
          {bookmarks.length === 0 ? (
            <p className="text-sm opacity-60">Pulsa B o el botón de marcador para guardar tu posición.</p>
          ) : (
            <ul className="space-y-2">
              {bookmarks.map((b) => (
                <li key={b.cfi} className="rounded-md border p-2.5" style={{ borderColor: theme.border }}>
                  <button onClick={() => { renditionRef.current?.display(b.cfi); setBookmarksOpen(false); setChromeVisible(false); }}
                    className="w-full text-left">
                    <p className="text-sm font-medium truncate">{b.chapter}</p>
                    <p className="text-[11px] opacity-60 mt-0.5">
                      {b.pct}% · {new Date(b.created).toLocaleDateString()}
                    </p>
                  </button>
                  <button onClick={() => removeBookmark(b.cfi)}
                    className="mt-1 text-[10px] opacity-50 hover:text-rose-500">Eliminar</button>
                </li>
              ))}
            </ul>
          )}
        </SidePanel>
      )}

      {searchOpen && (
        <SidePanel onClose={() => setSearchOpen(false)} title="Buscar en el libro" theme={theme} side="left">
          <div className="space-y-3">
            <form onSubmit={(e) => { e.preventDefault(); runSearch(); }} className="flex gap-2">
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Palabra o frase…" autoFocus
                className="flex-1 rounded-md border bg-transparent px-3 py-1.5 text-sm outline-none"
                style={{ borderColor: theme.border, color: theme.text }} />
              <button type="submit" disabled={!searchQuery.trim() || searching}
                className="rounded-md bg-amber-500 px-3 py-1.5 text-xs text-white disabled:opacity-50">
                {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Buscar"}
              </button>
            </form>
            {searchResults.length === 0 && searchQuery && !searching && (
              <p className="text-xs opacity-60">Sin resultados.</p>
            )}
            {searchResults.length > 0 && (
              <ul className="space-y-1.5">
                {searchResults.map((r, i) => (
                  <li key={i}>
                    <button onClick={() => { renditionRef.current?.display(r.cfi); setSearchOpen(false); setChromeVisible(false); }}
                      className="w-full text-left rounded-md p-2 text-xs hover:bg-black/10 border"
                      style={{ borderColor: theme.border }}>
                      …{r.excerpt}…
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SidePanel>
      )}

      {gotoOpen && (
        <SidePanel onClose={() => setGotoOpen(false)} title="Ir a página" theme={theme} side="left">
          <p className="text-xs opacity-70 mb-2">Total estimado: {totalPages || "?"}</p>
          <input type="number" min={1} max={totalPages}
            placeholder="Número de página"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none mb-2"
            style={{ borderColor: theme.border, color: theme.text }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const n = parseInt((e.target as HTMLInputElement).value, 10);
                if (n >= 1 && n <= totalPages) {
                  const cfi = bookRef.current?.locations?.cfiFromLocation(n - 1);
                  if (cfi) { renditionRef.current?.display(cfi); setGotoOpen(false); setChromeVisible(false); }
                }
              }
            }}
            autoFocus />
          <p className="text-[10px] opacity-50">Pulsa Enter para ir.</p>
        </SidePanel>
      )}

      {settingsOpen && (
        <SidePanel onClose={() => setSettingsOpen(false)} title="Ajustes de lectura" theme={theme} side="right">
          <div className="space-y-5">
            <SettingGroup label="Tema">
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { key: "light", icon: Sun, name: "Claro" },
                  { key: "sepia", icon: Coffee, name: "Sepia" },
                  { key: "dark", icon: Moon, name: "Oscuro" },
                  { key: "midnight", icon: Moon, name: "Medianoche" },
                ] as const).map((t) => (
                  <button key={t.key} onClick={() => updatePrefs({ theme: t.key })}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border p-2 text-xs transition-all",
                      prefs.theme === t.key ? "border-amber-500 bg-amber-500/10" : ""
                    )}
                    style={{ borderColor: prefs.theme === t.key ? undefined : theme.border }}>
                    <t.icon className="h-3.5 w-3.5" /> {t.name}
                  </button>
                ))}
              </div>
            </SettingGroup>

            <SettingGroup label="Fuente">
              <div className="grid grid-cols-3 gap-1.5">
                {(["serif", "sans", "dyslexic"] as const).map((f) => (
                  <button key={f} onClick={() => updatePrefs({ fontFamily: f })}
                    className={cn(
                      "rounded-md border p-2 text-xs",
                      prefs.fontFamily === f ? "border-amber-500 bg-amber-500/10" : ""
                    )}
                    style={{ borderColor: prefs.fontFamily === f ? undefined : theme.border }}>
                    {f === "serif" ? "Serif" : f === "sans" ? "Sans" : "Mono"}
                  </button>
                ))}
              </div>
            </SettingGroup>

            <SettingGroup label={`Tamaño: ${prefs.fontSize}%`}>
              <SliderRow value={prefs.fontSize} min={70} max={180} step={5}
                onMinus={() => updatePrefs({ fontSize: Math.max(70, prefs.fontSize - 5) })}
                onPlus={() => updatePrefs({ fontSize: Math.min(180, prefs.fontSize + 5) })}
                onChange={(v) => updatePrefs({ fontSize: v })}
                borderColor={theme.border} />
            </SettingGroup>

            <SettingGroup label={`Interlineado: ${prefs.lineHeight}%`}>
              <SliderRow value={prefs.lineHeight} min={130} max={220} step={5}
                onMinus={() => updatePrefs({ lineHeight: Math.max(130, prefs.lineHeight - 5) })}
                onPlus={() => updatePrefs({ lineHeight: Math.min(220, prefs.lineHeight + 5) })}
                onChange={(v) => updatePrefs({ lineHeight: v })}
                borderColor={theme.border} />
            </SettingGroup>

            <SettingGroup label="Audiolibro">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Gauge className="h-3.5 w-3.5 opacity-60" />
                  <span className="text-[11px] opacity-70">Velocidad: {prefs.ttsRate.toFixed(2)}x</span>
                </div>
                <input type="range" min={0.5} max={2} step={0.05} value={prefs.ttsRate}
                  onChange={(e) => updatePrefs({ ttsRate: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500" />
                <div className="flex items-center gap-2">
                  <Mic2 className="h-3.5 w-3.5 opacity-60" />
                  <span className="text-[11px] opacity-70">Voz</span>
                </div>
                <select value={prefs.ttsVoice} onChange={(e) => updatePrefs({ ttsVoice: e.target.value })}
                  className="w-full rounded-md border bg-transparent px-2 py-1.5 text-xs"
                  style={{ borderColor: theme.border, color: theme.text }}>
                  <option value="">Predeterminada (sistema)</option>
                  {voices.filter((v) => v.lang.startsWith("es") || v.lang.startsWith("en")).map((v) => (
                    <option key={v.name} value={v.name}>{v.name} · {v.lang}</option>
                  ))}
                </select>
              </div>
            </SettingGroup>

            <button onClick={() => updatePrefs(DEFAULT_PREFS)}
              className="inline-flex items-center gap-1.5 text-xs opacity-60 hover:opacity-100">
              <RotateCcw className="h-3 w-3" /> Restablecer ajustes
            </button>

            <div className="border-t pt-3 text-[11px] opacity-70" style={{ borderColor: theme.border }}>
              <p className="mb-1 font-semibold uppercase tracking-wider text-[9px]">Atajos</p>
              <ul className="space-y-0.5">
                <li><kbd>← →</kbd> página</li>
                <li><kbd>T</kbd> índice · <kbd>S</kbd> ajustes</li>
                <li><kbd>B</kbd> añadir marcador · <kbd>/</kbd> buscar</li>
                <li><kbd>F</kbd> pantalla completa · <kbd>D</kbd> tema</li>
                <li><kbd>+ −</kbd> zoom · <kbd>Esc</kbd> cerrar</li>
              </ul>
              <p className="mt-2 text-[10px] italic">
                Toca el centro del libro para mostrar/ocultar los controles.
                Lados izquierdo/derecho pasan página.
              </p>
            </div>
          </div>
        </SidePanel>
      )}

      {commentsOpen && (
        <SidePanel onClose={() => setCommentsOpen(false)} title="Notas y comentarios" theme={theme} side="right">
          <LocalComments slug={slug} theme={theme} />
        </SidePanel>
      )}
    </div>
  );
}

// ───────── Helpers ─────────
function currentChapterIdx(toc: NavItem[], chapterTitle: string): number {
  const t = chapterTitle.trim().toLowerCase();
  const i = toc.findIndex((c) => c.label.trim().toLowerCase() === t);
  return i === -1 ? 0 : i;
}

function applyEpubTheme(rendition: any, prefs: typeof DEFAULT_PREFS) {
  const t = THEMES[prefs.theme];
  const styles = {
    body: {
      color: t.text,
      background: t.page,
      "font-family": FONT_FAMILIES[prefs.fontFamily],
      "line-height": `${prefs.lineHeight}%`,
      padding: "0 24px",
    },
    "a, a:visited": { color: prefs.theme === "dark" || prefs.theme === "midnight" ? "#fbbf24" : "#a16207" },
    "h1, h2, h3, h4, h5, h6": { color: t.text },
    "p": { "line-height": `${prefs.lineHeight}%`, "margin-bottom": "0.6em" },
  };
  try {
    rendition.themes.default(styles);
    rendition.themes.fontSize(`${prefs.fontSize}%`);
  } catch {}
}

// ───────── Subcomponentes ─────────
function ChromeBtn({
  icon: Icon, title, onClick, theme,
}: { icon: any; title: string; onClick: () => void; theme: any }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition-all hover:scale-110"
      style={{ background: theme.chrome, color: theme.text, border: `1px solid ${theme.border}` }}
    >
      <Icon className="h-4.5 w-4.5" />
    </button>
  );
}

function PillBtn({
  icon: Icon, label, onClick, theme, active, activeClass,
}: { icon: any; label: string; onClick: () => void; theme: any; active?: boolean; activeClass?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium backdrop-blur-md hover:scale-105 transition-transform",
        active && activeClass
      )}
      style={{ background: theme.chrome, color: theme.text, border: `1px solid ${theme.border}` }}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function SidePanel({
  onClose, title, theme, side, children,
}: { onClose: () => void; title: string; theme: any; side: "left" | "right"; children: React.ReactNode }) {
  return (
    <div data-no-tap className="fixed inset-0 z-[80]">
      <button onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in" aria-label="Cerrar" />
      <aside
        className={cn(
          "absolute top-0 bottom-0 w-[min(380px,90vw)] overflow-y-auto border p-5 shadow-2xl",
          side === "left" ? "left-0 animate-in slide-in-from-left" : "right-0 animate-in slide-in-from-right"
        )}
        style={{ background: theme.body, color: theme.text, borderColor: theme.border }}
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-lg" style={{ fontFamily: FONT_FAMILIES.serif }}>{title}</h2>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-black/10">
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

function SliderRow({
  value, min, max, step, onMinus, onPlus, onChange, borderColor,
}: { value: number; min: number; max: number; step: number; onMinus: () => void; onPlus: () => void; onChange: (v: number) => void; borderColor: string }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onMinus} className="inline-flex h-7 w-7 items-center justify-center rounded-md border hover:bg-black/10"
        style={{ borderColor }}>
        <Minus className="h-3 w-3" />
      </button>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="flex-1 accent-amber-500" />
      <button onClick={onPlus} className="inline-flex h-7 w-7 items-center justify-center rounded-md border hover:bg-black/10"
        style={{ borderColor }}>
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

function LocalComments({ slug, theme }: { slug: string; theme: any }) {
  const key = `charbook:notes:${slug}`;
  const [notes, setNotes] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    try { setNotes(JSON.parse(localStorage.getItem(key) ?? "[]")); } catch {}
  }, [key]);
  const save = (arr: string[]) => { setNotes(arr); localStorage.setItem(key, JSON.stringify(arr)); };
  const add = () => { if (!draft.trim()) return; save([draft.trim(), ...notes]); setDraft(""); };
  return (
    <div className="space-y-3">
      <p className="text-xs opacity-70">Tus notas se guardan localmente en este dispositivo.</p>
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
        placeholder="Apunta una cita o idea sobre este pasaje…"
        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
        style={{ borderColor: theme.border, color: theme.text }} />
      <button onClick={add} disabled={!draft.trim()}
        className="rounded-md bg-amber-500 px-3 py-1.5 text-xs text-white disabled:opacity-50 hover:bg-amber-600">
        Añadir nota
      </button>
      {notes.length > 0 && (
        <ul className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: theme.border }}>
          {notes.map((n, i) => (
            <li key={i} className="rounded-md border p-2.5 text-sm leading-relaxed flex items-start justify-between gap-2"
              style={{ borderColor: theme.border }}>
              <p className="whitespace-pre-line flex-1">{n}</p>
              <button onClick={() => save(notes.filter((_, j) => j !== i))} className="opacity-50 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
