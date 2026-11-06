"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Category } from "@/lib/types";

interface CatalogFiltersProps {
  categories: Category[];
  total: number;
}

export function CatalogFilters({ categories, total }: CatalogFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");

  const currentCategory = searchParams.get("category") ?? "";
  const currentAccess = searchParams.get("access_type") ?? "";
  const currentLang = searchParams.get("language") ?? "";
  const currentSort = searchParams.get("sort") ?? "recent";

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    });
    // Reset page al cambiar filtros
    if (!("page" in patch)) next.delete("page");

    startTransition(() => {
      router.push(`/catalogo?${next.toString()}`);
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    update({ search: searchInput.trim() || null });
  };

  const clearAll = () => {
    setSearchInput("");
    startTransition(() => router.push("/catalogo"));
  };

  const activeCount = [
    searchParams.get("search"),
    currentCategory,
    currentAccess,
    currentLang,
  ].filter(Boolean).length;

  return (
    <div className="mb-6 space-y-4">
      {/* Search + sort */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar título, autor, ISBN..."
            className="h-11 rounded-full border-border/60 bg-card pl-10 pr-24 text-base"
          />
          <Button
            type="submit"
            size="sm"
            className="absolute right-1 top-1/2 h-9 -translate-y-1/2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Buscar
          </Button>
        </form>

        <select
          value={currentSort}
          onChange={(e) => update({ sort: e.target.value })}
          className="h-11 rounded-md border border-border/60 bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <option value="recent">Más recientes</option>
          <option value="popular">Más populares</option>
          <option value="rating">Mejor valorados</option>
          <option value="title">Título A-Z</option>
        </select>

        {/* Filtros — Sheet en móvil */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="relative h-11 gap-2 border-border/60">
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {activeCount > 0 && (
                <Badge className="ml-1 h-5 min-w-5 rounded-full bg-primary px-1.5 text-primary-foreground">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="font-serif text-2xl">Filtros</SheetTitle>
              <SheetDescription>
                Refina tu búsqueda en la biblioteca
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 py-6">
              <FilterGroup label="Categoría">
                <select
                  value={currentCategory}
                  onChange={(e) => update({ category: e.target.value })}
                  className="h-10 w-full rounded-md border border-border/60 bg-card px-3 text-sm"
                >
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name} ({c.books_count ?? 0})
                    </option>
                  ))}
                </select>
              </FilterGroup>

              <FilterGroup label="Tipo de acceso">
                <div className="flex gap-2">
                  {[
                    { v: "", label: "Todos" },
                    { v: "free", label: "Gratis" },
                    { v: "premium", label: "Premium" },
                  ].map((opt) => (
                    <Button
                      key={opt.v}
                      variant={currentAccess === opt.v ? "default" : "outline"}
                      size="sm"
                      onClick={() => update({ access_type: opt.v })}
                      className={
                        currentAccess === opt.v
                          ? "bg-primary text-primary-foreground"
                          : "border-border/60"
                      }
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </FilterGroup>

              <FilterGroup label="Idioma">
                <div className="flex gap-2">
                  {[
                    { v: "", label: "Todos" },
                    { v: "es", label: "Español" },
                    { v: "en", label: "Inglés" },
                  ].map((opt) => (
                    <Button
                      key={opt.v}
                      variant={currentLang === opt.v ? "default" : "outline"}
                      size="sm"
                      onClick={() => update({ language: opt.v })}
                      className={
                        currentLang === opt.v
                          ? "bg-primary text-primary-foreground"
                          : "border-border/60"
                      }
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </FilterGroup>

              {activeCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={clearAll}
                  className="w-full text-muted-foreground"
                >
                  <X className="mr-1.5 h-4 w-4" />
                  Limpiar todos los filtros
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Resumen + chips */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          <strong className="text-foreground">{total}</strong> libro{total === 1 ? "" : "s"}
        </span>
        {searchParams.get("search") && (
          <ActiveChip
            label={`"${searchParams.get("search")}"`}
            onRemove={() => {
              setSearchInput("");
              update({ search: null });
            }}
          />
        )}
        {currentCategory && (
          <ActiveChip
            label={`Categoría: ${currentCategory}`}
            onRemove={() => update({ category: null })}
          />
        )}
        {currentAccess && (
          <ActiveChip
            label={currentAccess === "free" ? "Gratis" : "Premium"}
            onRemove={() => update({ access_type: null })}
          />
        )}
        {currentLang && (
          <ActiveChip
            label={`Idioma: ${currentLang.toUpperCase()}`}
            onRemove={() => update({ language: null })}
          />
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function ActiveChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
    >
      {label}
      <X className="h-3 w-3" />
    </button>
  );
}
