"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";
import type { ChapterSummary } from "@/lib/types";

type AccessInfo = { access: boolean; reason: string; coin_price: number };

const PREVIEW_COUNT = 15;

/**
 * Lista de capítulos de una serie. Muestra los primeros 15 y un botón
 * "Ver más..." que despliega el resto, para no ocupar toda la página
 * en obras con muchos capítulos.
 */
export function ChapterList({
  slug,
  chapters,
  accessByNumber,
}: {
  slug: string;
  chapters: ChapterSummary[];
  accessByNumber: Record<number, AccessInfo>;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? chapters : chapters.slice(0, PREVIEW_COUNT);
  const remaining = chapters.length - visible.length;

  return (
    <>
      <ol className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
        {visible.map((c) => {
          const acc = accessByNumber[c.number];
          const locked = acc ? !acc.access : false;
          // Solo el capítulo-puerta (de pago) muestra su precio; los que
          // están bloqueados "en cadena" solo llevan el candado.
          const showPrice =
            locked && acc?.reason !== "locked_sequential" && (acc?.coin_price ?? 0) > 0;
          return (
            <li key={c.id}>
              <Link
                href={`/libro/${slug}/capitulo/${c.number}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
              >
                <span
                  className={`rounded px-2 py-0.5 text-xs font-bold tabular-nums shrink-0 ${
                    locked ? "bg-primary/10 text-primary/80" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {c.number}
                </span>
                <span className={`line-clamp-1 flex-1 text-sm ${locked ? "text-muted-foreground" : ""}`}>
                  {c.title}
                </span>
                {locked ? (
                  <span className="flex items-center gap-1.5 shrink-0 text-primary">
                    {showPrice && (
                      <span className="text-xs font-semibold tabular-nums">{acc!.coin_price}</span>
                    )}
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                )}
              </Link>
            </li>
          );
        })}
      </ol>

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-card py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <ChevronDown className="h-4 w-4" />
          Ver más... ({remaining} capítulo{remaining === 1 ? "" : "s"})
        </button>
      )}
    </>
  );
}
