"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Lock } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { BookListItem } from "@/lib/types";
import { CommentsSection } from "@/components/social/comments-section";

/**
 * Bloque inferior estilo WEBTOON debajo del lector de cómic: recomendaciones
 * («Trending & Popular») + sección de comentarios (por obra o por episodio).
 * Fondo blanco para encajar con el lector webtoon.
 */
export function ReaderExtras({
  bookSlug,
  chapterId,
}: {
  bookSlug: string;
  chapterId?: number;
}) {
  const { data: popular = [] } = useQuery({
    queryKey: ["reader-popular"],
    queryFn: () =>
      apiClient
        .get<{ data: BookListItem[] }>("/books/popular")
        .then((r) => r.data.data ?? []),
    staleTime: 5 * 60_000,
  });

  // Lista de episodios (solo en lectura por capítulo).
  const { data: episodes = [] } = useQuery({
    queryKey: ["reader-episodes", bookSlug],
    queryFn: () =>
      apiClient
        .get<{ data: { id: number; number: number; title: string; cover_url?: string | null }[] }>(
          `/books/${bookSlug}/chapters`,
        )
        .then((r) => r.data.data ?? []),
    enabled: !!chapterId,
    staleTime: 5 * 60_000,
  });

  // Acceso por episodio (candado de CharCoins) — refleja los desbloqueos del lector.
  const { data: access = [] } = useQuery({
    queryKey: ["reader-access", bookSlug],
    queryFn: () =>
      apiClient
        .get<{ data: { number: number; access: boolean; coin_price: number }[] }>(`/books/${bookSlug}/access`)
        .then((r) => r.data.data ?? []),
    enabled: !!chapterId,
    staleTime: 60_000,
  });
  const lockedSet = new Set(access.filter((a) => !a.access).map((a) => a.number));

  // Siguiente episodio bloqueado → tarjeta para desbloquear (lleva al paywall con packs).
  const currentNumber = episodes.find((e) => e.id === chapterId)?.number;
  const nextNumber = currentNumber != null ? currentNumber + 1 : null;
  const nextEp = nextNumber != null ? episodes.find((e) => e.number === nextNumber) : undefined;
  const nextAccess = nextNumber != null ? access.find((a) => a.number === nextNumber) : undefined;
  const nextLocked = !!nextEp && !!nextAccess && !nextAccess.access;

  const target = chapterId ? { chapterId } : { bookSlug };

  return (
    <div className="border-t border-zinc-200 bg-white text-zinc-900">
      <div className="mx-auto w-full max-w-5xl px-4">
        {/* Siguiente episodio bloqueado → desbloquear (lleva al paywall con packs) */}
        {nextLocked && (
          <div className="pt-8">
            <Link
              href={`/libro/${bookSlug}/capitulo/${nextNumber}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 transition-colors hover:border-amber-400 hover:bg-amber-100"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                  <Lock className="h-5 w-5 text-amber-600" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-800">Siguiente episodio bloqueado</p>
                  <p className="truncate text-xs text-zinc-500">
                    {nextEp?.title ?? `Episodio ${nextNumber}`} · desbloquéalo con CharCoins para continuar.
                  </p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-black">
                {nextAccess?.coin_price ? `${nextAccess.coin_price} · ` : ""}Desbloquear
              </span>
            </Link>
          </div>
        )}

        {/* Episodios (arriba, ancho completo) */}
        {chapterId && episodes.length > 0 && (
          <div className="pt-8">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500">
              Episodios
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {episodes.map((ep) => (
                <Link
                  key={ep.id}
                  href={`/libro/${bookSlug}/capitulo/${ep.number}`}
                  className="group w-28 shrink-0"
                >
                  <div
                    className={
                      "relative aspect-[3/4] overflow-hidden rounded-md border-2 " +
                      (ep.id === chapterId ? "border-amber-500" : "border-zinc-200")
                    }
                  >
                    {ep.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ep.cover_url}
                        alt={ep.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-zinc-100 p-2 text-center text-[10px] font-medium text-zinc-500">
                        {ep.title}
                      </div>
                    )}
                    <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      #{ep.number}
                    </span>
                    {lockedSet.has(ep.number) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                        <Lock className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                  <p
                    className={
                      "mt-1 line-clamp-2 text-[11px] leading-tight " +
                      (ep.id === chapterId ? "font-semibold text-amber-600" : "text-zinc-600")
                    }
                  >
                    {ep.title}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Comentarios (izquierda) + Recomendados (barra derecha) */}
        <div className="lg:flex lg:gap-8">
          <div className="min-w-0 flex-1">
            <CommentsSection target={target} />
          </div>

          {popular.length > 0 && (
            <aside className="border-t border-zinc-100 pb-10 pt-6 lg:w-72 lg:shrink-0 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-8">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500">
                Recomendados
              </h3>
              <ul className="space-y-3">
                {popular.slice(0, 8).map((b) => (
                  <li key={b.id}>
                    <Link href={`/libro/${b.slug}`} className="group flex items-center gap-3">
                      <div className="h-16 w-12 shrink-0 overflow-hidden rounded bg-zinc-100">
                        {b.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={b.cover}
                            alt={b.title}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-xs font-semibold leading-tight text-zinc-800 group-hover:text-amber-600">
                          {b.title}
                        </p>
                        {b.author?.name && (
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-400">{b.author.name}</p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
