import Link from "next/link";
import Image from "next/image";
import { Library, Lock } from "lucide-react";
import type { AnthologyCard as AnthologyCardType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AnthologyCardProps {
  anthology: AnthologyCardType;
  className?: string;
}

/** Tarjeta de antología con montaje de portadas (lomos apilados). */
export function AnthologyCard({ anthology, className }: AnthologyCardProps) {
  const covers = anthology.cover_books ?? [];

  return (
    <Link
      href={`/antologias/${anthology.slug}`}
      className={cn(
        "group block overflow-hidden rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/40",
        className
      )}
    >
      {/* Montaje de portadas */}
      <div className="relative flex h-32 items-end gap-1 overflow-hidden bg-gradient-to-br from-primary/15 to-blue-500/10 px-3 pt-4">
        {covers.length > 0 ? (
          covers.slice(0, 4).map((cover, i) => (
            <div
              key={i}
              className="relative aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-t-sm border border-border/40 shadow-md transition-transform group-hover:-translate-y-1"
              style={{ transitionDelay: `${i * 40}ms` }}
            >
              <Image
                src={cover}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
              />
            </div>
          ))
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Library className="h-8 w-8 text-primary/40" />
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-center gap-1.5">
          <h3 className="line-clamp-1 font-serif text-base font-bold tracking-tight">
            {anthology.title}
          </h3>
          {anthology.is_mine && !anthology.is_public && (
            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {anthology.books_count}{" "}
          {anthology.books_count === 1 ? "libro" : "libros"}
        </p>
      </div>
    </Link>
  );
}
