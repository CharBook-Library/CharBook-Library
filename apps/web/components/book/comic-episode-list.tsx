"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Lock } from "lucide-react";
import type { ChapterSummary } from "@/lib/types";

type AccessInfo = { access: boolean; reason: string; coin_price: number };

const PREVIEW_COUNT = 5;

/**
 * Lista de episodios del cómic con candado/precio (CharCoins) por episodio y
 * botón "Leer más" cuando hay más de 5, para no ocupar toda la página.
 */
export function ComicEpisodeList({
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
      <ol className="space-y-2">
        {visible.map((ep) => {
          const acc = accessByNumber[ep.number];
          const locked = acc ? !acc.access : false;
          const showPrice =
            locked && acc?.reason !== "locked_sequential" && (acc?.coin_price ?? 0) > 0;

          return (
            <li key={ep.id}>
              <Link
                href={`/libro/${slug}/capitulo/${ep.number}`}
                className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/30"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {ep.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ep.cover_url}
                      alt={ep.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-muted-foreground/50">
                      #{ep.number}
                    </div>
                  )}
                  {locked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                      <Lock className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className={"line-clamp-1 font-medium " + (locked ? "text-muted-foreground" : "")}>
                    {ep.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ep.published_at
                      ? new Date(ep.published_at).toLocaleDateString("es", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : `Episodio ${ep.number}`}
                  </p>
                </div>

                {locked ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-primary">
                    {showPrice && (
                      <span className="text-xs font-semibold tabular-nums">{acc!.coin_price}</span>
                    )}
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span className="shrink-0 text-sm font-bold tabular-nums text-muted-foreground/50">
                    #{ep.number}
                  </span>
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
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <ChevronDown className="h-4 w-4" />
          Leer más ({remaining} episodio{remaining === 1 ? "" : "s"})
        </button>
      )}
    </>
  );
}
