import Link from "next/link";
import Image from "next/image";
import { Star, Lock } from "lucide-react";
import type { BookListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BookCardProps {
  book: BookListItem;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-32 sm:w-36",
  md: "w-40 sm:w-44 md:w-48",
  lg: "w-48 sm:w-56 md:w-64",
} as const;

/** SVG fallback dataURI con título embebido (para covers que no cargan). */
function fallbackCover(title: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300">
    <rect width="200" height="300" fill="#1a2540"/>
    <rect x="14" y="14" width="172" height="272" fill="none" stroke="#c9a961" stroke-width="1"/>
    <text x="100" y="155" font-family="Georgia,serif" font-size="13" fill="#c9a961" text-anchor="middle">
      ${title.slice(0, 22).replace(/[<>&]/g, "")}
    </text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function BookCard({ book, size = "md", className }: BookCardProps) {
  const cover = book.cover ?? fallbackCover(book.title);

  return (
    <Link
      href={`/libro/${book.slug}`}
      className={cn(
        "group block flex-shrink-0",
        sizeClasses[size],
        className
      )}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-border/40 bg-card shadow-lg shadow-black/20 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/60 group-hover:shadow-primary/20">
        <Image
          src={cover}
          alt={book.title}
          fill
          sizes="(max-width: 640px) 160px, (max-width: 1024px) 200px, 240px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Badge premium/free */}
        <div className="absolute top-2 right-2">
          {book.access_type === "premium" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">
              <Lock className="h-2.5 w-2.5" /> Premium
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-emerald-500/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              Gratis
            </span>
          )}
        </div>

        {/* Rating overlay */}
        {book.rating_count > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-xs text-primary backdrop-blur-sm">
            <Star className="h-3 w-3 fill-primary" />
            <span className="font-semibold">{book.rating_average.toFixed(1)}</span>
          </div>
        )}

        {/* Gradient bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
      </div>

      <div className="mt-3 space-y-1 px-0.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight transition-colors group-hover:text-primary">
          {book.title}
        </h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {book.author?.name}
        </p>
      </div>
    </Link>
  );
}
