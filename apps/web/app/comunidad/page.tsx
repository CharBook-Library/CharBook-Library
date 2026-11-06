"use client";

import { useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Users, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityCard } from "@/components/community/activity-card";
import { ReaderSearch } from "@/components/community/reader-search";
import { socialApi } from "@/lib/api-social";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type Scope = "following" | "discover";

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-1/4 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="mt-3 flex gap-3 rounded-xl border border-border/50 p-3">
            <div className="h-20 w-14 animate-pulse rounded-md bg-muted" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CommunityPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [scope, setScope] = useState<Scope>("following");

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["feed", scope],
    queryFn: ({ pageParam = 1 }) => socialApi.feed.index(scope, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.current_page < last.meta.last_page
        ? last.meta.current_page + 1
        : undefined,
    enabled: isAuthenticated,
  });

  if (authLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <Users className="mx-auto mb-6 h-14 w-14 text-primary" />
        <h1 className="font-serif text-2xl font-bold">La comunidad de CharBook</h1>
        <p className="mt-3 text-muted-foreground">
          Inicia sesión para seguir lectores y ver qué están leyendo.
        </p>
        <Button asChild className="mt-8">
          <Link href="/login?from=/comunidad">Iniciar sesión</Link>
        </Button>
      </div>
    );
  }

  const activities = data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>Comunidad</span>
        </div>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight md:text-4xl">
          Qué leen los demás
        </h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ===== Feed ===== */}
        <div>
          {/* Tabs */}
          <div className="mb-5 inline-flex rounded-xl border border-border/60 bg-card p-1">
            {([
              { id: "following", label: "Siguiendo", icon: Users },
              { id: "discover", label: "Descubrir", icon: Sparkles },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setScope(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                  scope === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <FeedSkeleton />
          ) : activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
              {hasNextPage && (
                <div className="pt-2 text-center">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Cargar más
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 py-16 text-center">
              {scope === "following" ? (
                <>
                  <Users className="h-10 w-10 text-muted-foreground" />
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Aún no sigues a nadie con actividad. Explora «Descubrir» o busca
                    lectores.
                  </p>
                  <Button variant="outline" onClick={() => setScope("discover")}>
                    <Sparkles className="mr-2 h-4 w-4" /> Ir a Descubrir
                  </Button>
                </>
              ) : (
                <>
                  <Sparkles className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Todavía no hay actividad en la comunidad.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* ===== Aside ===== */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <ReaderSearch />
        </aside>
      </div>
    </div>
  );
}
