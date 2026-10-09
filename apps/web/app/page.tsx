import Link from "next/link";
import Image from "next/image";
import { Search, BookOpen, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookRow } from "@/components/book-row";
import { api } from "@/lib/api";

// Revalida los datos cada 60s en el server
export const revalidate = 60;

export default async function HomePage() {
  // 🚀 Server-side data fetching paralelo (carga rápida + SEO)
  const [featured, recent, popular, categories] = await Promise.all([
    api.books.featured().catch(() => ({ data: [] })),
    api.books.recent().catch(() => ({ data: [] })),
    api.books.popular().catch(() => ({ data: [] })),
    api.categories.list().catch(() => ({ data: [] })),
  ]);

  const heroBook = featured.data[0];

  return (
    <>
      {/* ========== HERO ========== */}
      <section className="relative overflow-hidden border-b border-border/40">
        {/* Glow decorations */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden
          style={{
            background:
              "radial-gradient(circle at 20% 30%, oklch(0.78 0.13 80 / 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 60%, oklch(0.65 0.18 250 / 0.12) 0%, transparent 50%)",
          }}
        />

        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:gap-12 md:px-6 md:py-24">
          <div className="space-y-6 animate-fade-in-up">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium tracking-wide text-primary">
              <Sparkles className="h-3 w-3" />
              Biblioteca Digital
            </span>

            <h1 className="font-serif text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              Miles de{" "}
              <span className="bg-gradient-to-r from-primary to-amber-300 bg-clip-text text-transparent">
                clásicos
              </span>{" "}
              en tu bolsillo
            </h1>

            <p className="max-w-md text-base text-muted-foreground md:text-lg">
              Descubre, lee y guarda obras maestras de la literatura universal.
              Acceso instantáneo desde cualquier dispositivo.
            </p>

            {/* Search bar */}
            <form
              action="/catalogo"
              method="get"
              className="relative max-w-md"
            >
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="search"
                placeholder="Buscar título, autor o tema..."
                className="h-12 rounded-full border-border/60 bg-card pl-11 pr-28 text-base shadow-lg shadow-black/10 focus-visible:ring-primary/50"
              />
              <Button
                type="submit"
                size="sm"
                className="absolute right-1.5 top-1/2 h-9 -translate-y-1/2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Buscar
              </Button>
            </form>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/catalogo">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Explorar catálogo
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
              >
                <Link href="/catalogo?access_type=free">Libros gratuitos</Link>
              </Button>
            </div>
          </div>

          {/* Libro destacado */}
          {heroBook && heroBook.cover && (
            <Link
              href={`/libro/${heroBook.slug}`}
              className="group relative mx-auto hidden w-full max-w-sm md:block"
            >
              <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-tr from-primary/30 via-amber-300/20 to-blue-500/20 opacity-60 blur-3xl transition-opacity group-hover:opacity-90" />
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border/60 shadow-2xl shadow-black/40 transition-transform duration-500 group-hover:scale-[1.02]">
                <Image
                  src={heroBook.cover}
                  alt={heroBook.title}
                  fill
                  sizes="(max-width: 768px) 0px, 400px"
                  priority
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-6">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    <Sparkles className="h-3 w-3" /> Destacado
                  </span>
                  <h3 className="mt-2 font-serif text-lg font-bold text-white">
                    {heroBook.title}
                  </h3>
                  <p className="text-sm text-white/70">{heroBook.author?.name}</p>
                </div>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* ========== CATEGORÍAS RÁPIDAS ========== */}
      {/* Solo categorías con obras, ordenadas por popularidad, máx. 12 —
          el catálogo completo tiene el filtro exhaustivo. */}
      {(() => {
        const topCategories = categories.data
          .filter((cat) => (cat.books_count ?? 0) > 0)
          .sort((a, b) => (b.books_count ?? 0) - (a.books_count ?? 0))
          .slice(0, 12);

        if (topCategories.length === 0) return null;

        return (
          <section className="mx-auto max-w-7xl px-4 pt-8 md:px-6">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Explora por categoría
              </h2>
              <Link
                href="/catalogo"
                className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Ver todas
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
              {topCategories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/catalogo?category=${cat.slug}`}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium transition-all hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
                >
                  <span>{cat.name}</span>
                  <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                    {cat.books_count}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })()}

      {/* ========== CARRUSELES ========== */}
      <BookRow
        emoji="✨"
        title="Destacados"
        subtitle="Las joyas seleccionadas por la biblioteca"
        books={featured.data}
        viewAllHref="/catalogo?sort=rating"
      />

      <BookRow
        emoji="🆕"
        title="Recién añadidos"
        subtitle="Lo último en llegar a tu biblioteca"
        books={recent.data}
        viewAllHref="/catalogo?sort=recent"
      />

      <BookRow
        emoji="🔥"
        title="Más populares"
        subtitle="Lo que están leyendo otros usuarios"
        books={popular.data}
        viewAllHref="/catalogo?sort=popular"
      />

      {/* ========== CTA FINAL ========== */}
      <section className="mx-auto my-16 max-w-4xl px-4 text-center md:my-24 md:px-6">
        <h2 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
          ¿Listo para empezar a leer?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground md:text-lg">
          Explora toda nuestra biblioteca. Todos los libros gratuitos están a un click.
        </p>
        <Button asChild size="lg" className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/catalogo">
            Ver catálogo completo <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground md:flex-row md:px-6">
          <p>© {new Date().getFullYear()} CharBook Library. Hecho con pasión por la lectura.</p>
          <div className="flex gap-4">
            <Link href="/catalogo" className="hover:text-foreground">Catálogo</Link>
            <Link href="/login" className="hover:text-foreground">Cuenta</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
