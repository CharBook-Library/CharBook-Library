"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check, ChevronDown, CornerDownRight, Folder,
  Loader2, Search, X,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface SubCategory {
  id: number;
  name: string;
  slug: string;
}

interface ParentCategory {
  id: number;
  name: string;
  slug: string;
  children: SubCategory[];
}

interface CategoryPickerProps {
  parentId: number | null;
  subId: number | null;
  onChange: (parentId: number | null, subId: number | null) => void;
  required?: boolean;
  /** Si true muestra error de sub vacía cuando parent está elegido. */
  showSubError?: boolean;
}

/**
 * Selector de categoría con BUSCADOR:
 * escribe "novela" y encuentra directamente la subcategoría, sin tener
 * que recorrer dos selects gigantes. Seleccionar una subcategoría fija
 * también su categoría principal automáticamente.
 */
export function CategoryPicker({
  parentId,
  subId,
  onChange,
  required,
  showSubError,
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["categories-hierarchical"],
    queryFn: () =>
      apiClient
        .get<{ data: ParentCategory[] }>("/categories/hierarchical")
        .then((r) => r.data.data),
    staleTime: 5 * 60_000,
  });

  const parents = useMemo(() => data ?? [], [data]);

  const selectedParent = useMemo(
    () => parents.find((p) => p.id === parentId) ?? null,
    [parents, parentId]
  );
  const selectedSub = useMemo(
    () => selectedParent?.children.find((c) => c.id === subId) ?? null,
    [selectedParent, subId]
  );

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Enfocar el buscador al abrir
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const q = query.trim().toLowerCase();

  // Resultados filtrados: grupos con padre o hijas que coinciden.
  const results = useMemo(() => {
    if (!q) {
      return parents.map((p) => ({ parent: p, children: p.children }));
    }
    return parents
      .map((p) => {
        const parentMatch = p.name.toLowerCase().includes(q);
        const matching = p.children.filter((c) =>
          c.name.toLowerCase().includes(q)
        );
        if (!parentMatch && matching.length === 0) return null;
        return { parent: p, children: parentMatch ? p.children : matching };
      })
      .filter(Boolean) as { parent: ParentCategory; children: SubCategory[] }[];
  }, [parents, q]);

  const pickParent = (p: ParentCategory) => {
    onChange(p.id, null);
    // Si no tiene hijas ya está completo; si tiene, dejamos abierto para elegir sub.
    if (p.children.length === 0) {
      setOpen(false);
      setQuery("");
    } else {
      setQuery("");
    }
  };

  const pickSub = (p: ParentCategory, c: SubCategory) => {
    onChange(p.id, c.id);
    setOpen(false);
    setQuery("");
  };

  const clear = () => {
    onChange(null, null);
    setQuery("");
  };

  const needsSub =
    !!selectedParent && selectedParent.children.length > 0 && !subId;
  const complete = !!selectedParent && (!needsSub || !!subId);

  if (isLoading) {
    return (
      <div className="flex h-11 items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Cargando categorías…
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1 flex items-center gap-1.5 text-xs font-medium">
        <Folder className="h-3.5 w-3.5 text-muted-foreground" />
        Categoría
        {required && <span className="text-destructive">*</span>}
      </label>

      {/* Control principal */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-md border bg-background px-3 text-left text-sm outline-none transition-colors",
          "focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30",
          showSubError && needsSub
            ? "border-destructive/60"
            : complete
              ? "border-emerald-500/50"
              : "border-border/60"
        )}
      >
        {selectedParent ? (
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              {selectedParent.name}
            </span>
            {selectedSub ? (
              <>
                <CornerDownRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                <span className="truncate text-xs">{selectedSub.name}</span>
              </>
            ) : needsSub ? (
              <span className="truncate text-xs text-muted-foreground">
                elige subcategoría…
              </span>
            ) : null}
          </span>
        ) : (
          <span className="flex-1 text-muted-foreground">
            Busca y elige la categoría de tu obra…
          </span>
        )}

        {selectedParent && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); clear(); }}
            className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Quitar categoría"
          >
            <X className="h-3 w-3" />
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {showSubError && needsSub && (
        <p className="mt-1 text-[11px] text-destructive">
          Esta categoría tiene subcategorías: elige una.
        </p>
      )}

      {/* Panel desplegable */}
      {open && (
        <div className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-lg border border-border/60 bg-popover shadow-xl">
          {/* Buscador */}
          <div className="relative border-b border-border/40">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
              placeholder='Escribe para buscar, ej. "novela", "romance"…'
              className="h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>

          {/* Si el padre elegido necesita sub, atajo arriba */}
          {needsSub && !q && (
            <div className="border-b border-border/40 bg-primary/5 p-2">
              <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                Subcategorías de {selectedParent!.name}
              </p>
              <div className="flex flex-wrap gap-1">
                {selectedParent!.children.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickSub(selectedParent!, c)}
                    className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs hover:border-primary/60 hover:text-primary"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resultados */}
          <div className="max-h-72 overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <p className="px-3 py-5 text-center text-xs text-muted-foreground">
                Sin resultados para “{query}”.
              </p>
            ) : (
              results.map(({ parent, children }) => (
                <div key={parent.id}>
                  <button
                    type="button"
                    onClick={() => pickParent(parent)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/60",
                      parent.id === parentId && "bg-primary/5"
                    )}
                  >
                    <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate font-medium">
                      {highlight(parent.name, q)}
                    </span>
                    {parent.children.length === 0 && (
                      <span className="text-[10px] text-muted-foreground/60">
                        sin subcategorías
                      </span>
                    )}
                    {parent.id === parentId && !subId && (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    )}
                  </button>

                  {children.length > 0 && (
                    <div className="mb-1 ml-6 flex flex-wrap gap-1 pb-1 pr-2">
                      {children.map((c) => {
                        const active = c.id === subId;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => pickSub(parent, c)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border/60 text-muted-foreground hover:border-primary/60 hover:text-foreground"
                            )}
                          >
                            {highlight(c.name, q)}
                            {active && <Check className="h-2.5 w-2.5" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Resalta la parte del nombre que coincide con la búsqueda. */
function highlight(name: string, q: string): React.ReactNode {
  if (!q) return name;
  const idx = name.toLowerCase().indexOf(q);
  if (idx === -1) return name;
  return (
    <>
      {name.slice(0, idx)}
      <mark className="rounded-sm bg-primary/25 text-inherit">
        {name.slice(idx, idx + q.length)}
      </mark>
      {name.slice(idx + q.length)}
    </>
  );
}
