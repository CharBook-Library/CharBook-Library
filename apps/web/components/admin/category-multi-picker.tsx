"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Folder, Loader2, Search, X } from "lucide-react";
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

/**
 * Selector múltiple de categorías para el panel admin:
 * agrupado por categoría principal, con buscador para no
 * mostrar todo el catálogo de golpe.
 */
export function CategoryMultiPicker({
  selectedIds,
  onChange,
  max = 5,
}: {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  max?: number;
}) {
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["categories-hierarchical"],
    queryFn: () =>
      apiClient
        .get<{ data: ParentCategory[] }>("/categories/hierarchical")
        .then((r) => r.data.data),
    staleTime: 5 * 60_000,
  });

  const parents = data ?? [];

  // Índice id → nombre (para pintar chips de seleccionadas)
  const nameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of parents) {
      map.set(p.id, p.name);
      for (const c of p.children) map.set(c.id, `${p.name} · ${c.name}`);
    }
    return map;
  }, [parents]);

  const q = query.trim().toLowerCase();

  // Con búsqueda: solo grupos con coincidencia (padre o hija), expandidos.
  const visibleGroups = useMemo(() => {
    if (!q) return parents.map((p) => ({ parent: p, children: p.children, forceOpen: false }));
    return parents
      .map((p) => {
        const parentMatch = p.name.toLowerCase().includes(q);
        const matching = p.children.filter((c) => c.name.toLowerCase().includes(q));
        if (!parentMatch && matching.length === 0) return null;
        return {
          parent: p,
          children: parentMatch ? p.children : matching,
          forceOpen: true,
        };
      })
      .filter(Boolean) as { parent: ParentCategory; children: SubCategory[]; forceOpen: boolean }[];
  }, [parents, q]);

  const toggle = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else if (selectedIds.length < max) {
      onChange([...selectedIds, id]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Cargando categorías…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-background">
      {/* Seleccionadas */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-border/40 p-2.5">
          {selectedIds.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary"
            >
              {nameById.get(id) ?? `#${id}`}
              <button
                type="button"
                onClick={() => toggle(id)}
                className="rounded-full p-0.5 hover:bg-primary/20"
                aria-label="Quitar categoría"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <span className="ml-auto self-center text-[10px] text-muted-foreground tabular-nums">
            {selectedIds.length} / {max}
          </span>
        </div>
      )}

      {/* Buscador */}
      <div className="relative border-b border-border/40">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca una categoría o subcategoría…"
          className="h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      {/* Grupos */}
      <div className="max-h-64 overflow-y-auto p-1.5">
        {visibleGroups.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            Sin resultados para “{query}”.
          </p>
        ) : (
          visibleGroups.map(({ parent, children, forceOpen }) => {
            const open = forceOpen || openGroups.has(parent.id);
            const parentSelected = selectedIds.includes(parent.id);
            const selectedInGroup =
              (parentSelected ? 1 : 0) +
              children.filter((c) => selectedIds.includes(c.id)).length;

            return (
              <div key={parent.id} className="rounded-md">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(parent.id)) next.delete(parent.id);
                        else next.add(parent.id);
                        return next;
                      });
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/50"
                  >
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                        !open && "-rotate-90"
                      )}
                    />
                    <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{parent.name}</span>
                    {selectedInGroup > 0 && (
                      <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary tabular-nums">
                        {selectedInGroup}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(parent.id)}
                    className={cn(
                      "mr-1 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                      parentSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 text-muted-foreground hover:border-primary/60 hover:text-foreground"
                    )}
                  >
                    {parentSelected ? "Quitar" : "Elegir"}
                  </button>
                </div>

                {open && children.length > 0 && (
                  <div className="mb-1 ml-7 flex flex-wrap gap-1 pb-1 pr-2">
                    {children.map((c) => {
                      const selected = selectedIds.includes(c.id);
                      return (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => toggle(c.id)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs transition-colors",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border/60 text-muted-foreground hover:border-primary/60 hover:text-foreground"
                          )}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
