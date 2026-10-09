"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  /** Valor (0-5, puede tener decimales si readonly). */
  value: number;
  /** Si true, no es interactivo. */
  readonly?: boolean;
  /** Callback cuando el usuario selecciona un valor (solo si NO readonly). */
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASS = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-7 w-7",
};

export function StarRating({
  value,
  readonly = false,
  onChange,
  size = "md",
  className,
}: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  return (
    <div
      className={cn("inline-flex items-center gap-0.5", className)}
      onMouseLeave={() => !readonly && setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = display >= n;
        const halfFilled = display >= n - 0.5 && display < n;

        return (
          <button
            key={n}
            type="button"
            disabled={readonly}
            onClick={() => !readonly && onChange?.(n)}
            onMouseEnter={() => !readonly && setHover(n)}
            className={cn(
              "rounded transition-transform",
              !readonly && "cursor-pointer hover:scale-110 active:scale-95",
              readonly && "cursor-default"
            )}
            aria-label={`${n} estrellas`}
          >
            <Star
              className={cn(
                SIZE_CLASS[size],
                "transition-colors",
                filled
                  ? "fill-primary text-primary"
                  : halfFilled
                    ? "fill-primary/40 text-primary"
                    : "fill-transparent text-muted-foreground/40"
              )}
              strokeWidth={1.5}
            />
          </button>
        );
      })}
    </div>
  );
}
