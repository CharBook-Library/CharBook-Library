"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  Feather, Users, UserPlus, BookOpen, CheckCircle2, BookHeart,
  MessageSquareQuote, Star, Lock, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BookCard } from "@/components/book-card";
import { CreatorBadge } from "@/components/creator/creator-badge";
import { socialApi } from "@/lib/api-social";
import { cn } from "@/lib/utils";
import type { PublicProfile } from "@/lib/types";

type TabKey =
  | "works"
  | "followers"
  | "following"
  | "reading"
  | "read"
  | "favorites"
  | "reviews";

interface Props {
  profile: PublicProfile;
  isPrivate: boolean;
}

export function ProfileTabs({ profile, isPrivate }: Props) {
  const showWorks = profile.is_creator;
  const defaultTab: TabKey = showWorks ? "works" : "reading";
  const [tab, setTab] = useState<TabKey>(defaultTab);

  // Las listas de seguidores/siguiendo se piden bajo demanda
  const username = profile.username ?? "";

  const followersQuery = useQuery({
    queryKey: ["profile-followers", username],
    queryFn: () => socialApi.profiles.followers(username, 1),
    enabled: tab === "followers" && !!username,
    staleTime: 30_000,
  });

  const followingQuery = useQuery({
    queryKey: ["profile-following", username],
    queryFn: () => socialApi.profiles.following(username, 1),
    enabled: tab === "following" && !!username,
    staleTime: 30_000,
  });

  // Tabs visibles dinámicamente (ocultamos "Obras" si no es creador)
  const TABS: { key: TabKey; label: string; icon: typeof Users; count: number; hideWhenPrivate?: boolean }[] = [
    { key: "works", label: "Obras", icon: Feather, count: profile.stats.books_as_creator },
    { key: "followers", label: "Seguidores", icon: Users, count: profile.stats.followers },
    { key: "following", label: "Siguiendo", icon: UserPlus, count: profile.stats.following },
    { key: "reading", label: "Leyendo", icon: BookOpen, count: profile.stats.reading, hideWhenPrivate: true },
    { key: "read", label: "Leídos", icon: CheckCircle2, count: profile.stats.read, hideWhenPrivate: true },
    { key: "favorites", label: "Favoritos", icon: BookHeart, count: profile.stats.favorites, hideWhenPrivate: true },
    { key: "reviews", label: "Reseñas", icon: MessageSquareQuote, count: profile.stats.reviews, hideWhenPrivate: true },
  ];

  const visibleTabs = TABS.filter((t) => {
    if (t.key === "works" && !showWorks) return false;
    if (isPrivate && t.hideWhenPrivate) return false;
    return true;
  });

  return (
    <div className="mt-10">
      {/* Sticky tab bar */}
      <div className="sticky top-16 z-20 -mx-4 border-y border-border/60 bg-background/95 px-4 backdrop-blur-md md:-mx-6 md:px-6">
        <nav
          className="flex gap-1 overflow-x-auto scrollbar-thin py-2"
          role="tablist"
          aria-label="Secciones del perfil"
        >
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                <span
                  className={cn(
                    "ml-1 rounded px-1.5 text-[10px] tabular-nums",
                    active ? "bg-primary/20" : "bg-accent text-muted-foreground"
                  )}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenido del tab */}
      <div className="mt-6">
        {tab === "works" && (
          <Section title={`Obras de ${profile.name}`} icon={Feather} accent="amber">
            {profile.creator_books.length === 0 ? (
              <EmptyText>Aún no ha publicado obras.</EmptyText>
            ) : (
              <BookGrid books={profile.creator_books} />
            )}
          </Section>
        )}

        {tab === "followers" && (
          <UsersListPanel
            isLoading={followersQuery.isLoading}
            users={followersQuery.data?.data ?? []}
            emptyText={`Nadie sigue a ${profile.name} todavía.`}
            isPrivate={isPrivate}
          />
        )}

        {tab === "following" && (
          <UsersListPanel
            isLoading={followingQuery.isLoading}
            users={followingQuery.data?.data ?? []}
            emptyText={`${profile.name} no sigue a nadie todavía.`}
            isPrivate={isPrivate}
          />
        )}

        {tab === "reading" && (
          <Section title="Leyendo ahora" icon={BookOpen}>
            {isPrivate ? <PrivateNote name={profile.name} /> :
              profile.currently_reading.length === 0
                ? <EmptyText>Sin lecturas en curso.</EmptyText>
                : <BookGrid books={profile.currently_reading} />}
          </Section>
        )}

        {tab === "read" && (
          <Section title="Leídos" icon={CheckCircle2}>
            {isPrivate ? <PrivateNote name={profile.name} /> :
              profile.read_books.length === 0
                ? <EmptyText>Aún no ha terminado ninguna lectura.</EmptyText>
                : <BookGrid books={profile.read_books} />}
          </Section>
        )}

        {tab === "favorites" && (
          <Section title="Favoritos" icon={BookHeart}>
            {isPrivate ? <PrivateNote name={profile.name} /> :
              profile.favorite_books.length === 0
                ? <EmptyText>No ha añadido libros favoritos.</EmptyText>
                : <BookGrid books={profile.favorite_books} />}
          </Section>
        )}

        {tab === "reviews" && (
          <Section title="Reseñas" icon={MessageSquareQuote}>
            {isPrivate ? <PrivateNote name={profile.name} /> :
              profile.recent_reviews.length === 0
                ? <EmptyText>Todavía no ha escrito reseñas.</EmptyText>
                : (
                  <ul className="space-y-4">
                    {profile.recent_reviews.map((review) => (
                      <li key={review.id} className="rounded-xl border border-border/60 bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            {review.book && (
                              <Link
                                href={`/libro/${review.book.slug}`}
                                className="font-medium hover:text-primary"
                              >
                                {review.book.title}
                              </Link>
                            )}
                            {review.title && (
                              <p className="mt-0.5 text-sm font-medium text-foreground/90">
                                {review.title}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  "h-4 w-4",
                                  i < review.rating
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground/30"
                                )}
                              />
                            ))}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {review.comment}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
          </Section>
        )}
      </div>
    </div>
  );
}

// ───────── helpers visuales ─────────

function Section({
  title, icon: Icon, accent, children,
}: { title: string; icon: typeof Users; accent?: "amber"; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-5 flex items-center gap-2">
        <Icon className={cn("h-5 w-5", accent === "amber" ? "text-amber-500" : "text-primary")} />
        <h2 className="font-serif text-xl font-bold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function BookGrid({ books }: { books: any[] }) {
  return (
    <div className="flex flex-wrap gap-4">
      {books.map((book) => <BookCard key={book.id} book={book} size="sm" />)}
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function PrivateNote({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/60 py-12 text-center">
      <Lock className="h-7 w-7 text-muted-foreground/60" />
      <p className="text-sm text-muted-foreground">
        Esta sección es privada. Sigue a {name} para verla.
      </p>
    </div>
  );
}

function UsersListPanel({
  isLoading, users, emptyText, isPrivate,
}: {
  isLoading: boolean;
  users: { id: number; name: string; username: string | null; avatar: string | null; bio: string | null; creator_level?: string }[];
  emptyText: string;
  isPrivate: boolean;
}) {
  if (isPrivate) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/60 py-12 text-center">
        <Lock className="h-7 w-7 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">
          La red de seguimiento es privada.
        </p>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (users.length === 0) {
    return <EmptyText>{emptyText}</EmptyText>;
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {users.map((u) => (
        <li key={u.id}>
          <Link
            href={u.username ? `/u/${u.username}` : "#"}
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/30"
          >
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border/60">
              {u.avatar ? (
                <Image src={u.avatar} alt={u.name} fill sizes="40px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/15 text-sm font-medium text-primary">
                  {u.name?.[0]?.toUpperCase() ?? "U"}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-medium">{u.name}</p>
                {u.creator_level && u.creator_level !== "none" && (
                  <CreatorBadge level={u.creator_level as any} size="sm" />
                )}
              </div>
              {u.username && (
                <p className="truncate text-[11px] text-muted-foreground">@{u.username}</p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
