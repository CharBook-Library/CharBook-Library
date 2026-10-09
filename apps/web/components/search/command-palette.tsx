"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Loader2, ArrowUp, ArrowDown, CornerDownLeft, Sparkles } from "lucide-react";
import { useSearch } from "./search-context";
import { useDebounce } from "@/hooks/use-debounce";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { ApiCollection, BookListItem } from "@/lib/types";

const RECENT_KEY = "charbook:search:recent";
const MAX_RECENT = 5;

export function CommandPalette() {
  const router = useRouter();
  const { open, setOpen } = useSearch();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 200);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // ===== Carga búsquedas recientes desde localStorage =====
  // ===== Focus input al abrir =====
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  // ===== Fetch con TanStack Query =====
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["search-instant", debounced],
    queryFn: () =>
      apiClient
        .get<ApiCollection<BookListItem>>(`/books/search-instant`, {
          params: { q: debounced },
        })
        .then((r) => r.data),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  const results = data?.data ?? [];
  const activeIdx = results.length ? Math.min(selectedIdx, results.length - 1) : 0;

  // ===== Guarda búsqueda reciente =====
  const saveRecent = useCallback((term: string) => {
    setRecent((prev) => {
      const next = [term, ...prev.filter((t) => t !== term)].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // ===== Selecciona y navega =====
  const goToBook = useCallback(
    (book: BookListItem) => {
      saveRecent(query.trim());
      setOpen(false);
      router.push(`/libro/${book.slug}`);
    },
    [query, router, setOpen, saveRecent]
  );

  const submitSearch = useCallback(
    (term: string) => {
      if (!term.trim()) return;
      saveRecent(term.trim());
      setOpen(false);
      router.push(`/catalogo?search=${encodeURIComponent(term.trim())}`);
    },
    [router, setOpen, saveRecent]
  );

  // ===== Navegación con teclado =====
  const handleInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[activeIdx]) goToBook(results[activeIdx]);
      else submitSearch(query);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[10vh] sm:pt-[15vh]"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in-up"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-2xl shadow-black/40 animate-fade-in-up">
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
          {isLoading || isFetching ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
          ) : (
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={handleInputKey}
            placeholder="Buscar libros, autores, temas..."
            className="flex-1 bg-transparent text-base placeholder:text-muted-foreground/60 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            Esc
          </kbd>
        </div>

        {/* Resultados / estados */}
        <div className="max-h-[60vh] overflow-y-auto">
          {debounced.length < 2 ? (
            <RecentSearches recent={recent} onSelect={submitSearch} />
          ) : results.length === 0 && !isLoading ? (
            <EmptyState query={debounced} onCatalogSearch={() => submitSearch(query)} />
          ) : (
            <ul className="py-2">
              {results.map((book, i) => (
                <li key={book.id}>
                  <button
                    type="button"
                    onClick={() => goToBook(book)}
                    onMouseEnter={() => setSelectedIdx(i)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      i === activeIdx
                        ? "bg-primary/10"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded border border-border/40 bg-muted">
                      {book.cover && (
                        <Image
                          src={book.cover}
                          alt={book.title}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{book.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {book.author?.name}
                        {book.publication_year && ` · ${book.publication_year}`}
                      </div>
                    </div>
                    {book.access_type === "free" ? (
                      <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                        Gratis
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                        Premium
                      </span>
                    )}
                  </button>
                </li>
              ))}

              {/* Ver más resultados en catálogo */}
              <li>
                <button
                  type="button"
                  onClick={() => submitSearch(query)}
                  className="mt-1 flex w-full items-center justify-between gap-2 border-t border-border/40 px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                >
                  <span>
                    Ver todos los resultados de <strong>{`"${query}"`}</strong>
                  </span>
                  <CornerDownLeft className="h-3.5 w-3.5" />
                </button>
              </li>
            </ul>
          )}
        </div>

        {/* Footer con hints */}
        <div className="flex items-center justify-between gap-2 border-t border-border/40 bg-card/50 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" />
            <span>Tolerante a typos</span>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <ShortcutHint icon={<ArrowUp className="h-3 w-3" />} label="" />
            <ShortcutHint icon={<ArrowDown className="h-3 w-3" />} label="navegar" />
            <ShortcutHint icon={<CornerDownLeft className="h-3 w-3" />} label="abrir" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Sub-components =====

function RecentSearches({
  recent,
  onSelect,
}: {
  recent: string[];
  onSelect: (term: string) => void;
}) {
  if (recent.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        <p>Escribe al menos 2 caracteres para buscar</p>
        <p className="mt-1 text-[11px] opacity-60">
          Encuentra libros incluso con errores de escritura
        </p>
      </div>
    );
  }
  return (
    <div className="py-2">
      <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Búsquedas recientes
      </div>
      {recent.map((term) => (
        <button
          key={term}
          type="button"
          onClick={() => onSelect(term)}
          className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-accent/50"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          {term}
        </button>
      ))}
    </div>
  );
}

function EmptyState({
  query,
  onCatalogSearch,
}: {
  query: string;
  onCatalogSearch: () => void;
}) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="font-serif text-base font-bold">
        Sin resultados para {`"${query}"`}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Intenta con otros términos.
      </p>
      <button
        type="button"
        onClick={onCatalogSearch}
        className="mt-4 text-xs text-primary hover:underline"
      >
        Buscar en todo el catálogo →
      </button>
    </div>
  );
}

function ShortcutHint({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="inline-flex h-4 items-center justify-center rounded border border-border/60 bg-background px-1 text-[10px]">
        {icon}
      </kbd>
      {label}
    </span>
  );
}
