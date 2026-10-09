"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { BookCard } from "./book-card";
import { Button } from "@/components/ui/button";
import type { BookListItem } from "@/lib/types";

interface BookRowProps {
  title: string;
  subtitle?: string;
  books: BookListItem[];
  viewAllHref?: string;
  emoji?: string;
}

/**
 * Carrusel horizontal scrolleable estilo Netflix.
 * Mobile-first: scroll-snap touch nativo. Desktop: botones de navegación.
 */
export function BookRow({
  title,
  subtitle,
  books,
  viewAllHref,
  emoji,
}: BookRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === "left" ? -el.clientWidth * 0.8 : el.clientWidth * 0.8;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  if (!books.length) return null;

  return (
    <section className="my-10 md:my-14">
      <div className="mx-auto mb-5 flex max-w-7xl items-end justify-between gap-4 px-4 md:px-6">
        <div className="min-w-0">
          <h2 className="font-serif text-xl font-bold tracking-tight md:text-3xl">
            {emoji && <span className="mr-2">{emoji}</span>}
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {viewAllHref && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-primary hover:bg-primary/10 hover:text-primary"
            >
              <Link href={viewAllHref}>
                Ver todo <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
          <div className="hidden gap-1 md:flex">
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll("left")}
              aria-label="Anterior"
              className="h-8 w-8 rounded-full border-border/60"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll("right")}
              aria-label="Siguiente"
              className="h-8 w-8 rounded-full border-border/60"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="scrollbar-hide mx-auto flex max-w-7xl gap-4 overflow-x-auto scroll-smooth px-4 pb-2 md:gap-5 md:px-6"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {books.map((book) => (
          <div key={book.id} style={{ scrollSnapAlign: "start" }}>
            <BookCard book={book} />
          </div>
        ))}
      </div>
    </section>
  );
}
