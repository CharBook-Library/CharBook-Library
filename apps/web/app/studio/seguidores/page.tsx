"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Heart, ChevronLeft, ChevronRight, Users, Search,
  MoreHorizontal, UserMinus, Ban, Trophy, BadgeCheck,
  BookOpen, ShieldOff, ChevronDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { FollowButton } from "@/components/social/follow-button";
import { CreatorBadge } from "@/components/creator/creator-badge";
import { studioApi, type StudioFollower } from "@/lib/api-creator";
import { cn } from "@/lib/utils";
import type { CreatorLevel } from "@/lib/types";

// El backend ya devuelve los seguidores ordenados por rango
// (destacados → verificados → resto); aquí solo los agrupamos en secciones.
const GROUPS: {
  key: string;
  match: (level: string | null) => boolean;
  label: string;
  icon: typeof Trophy;
  iconCls: string;
}[] = [
  {
    key: "featured",
    match: (l) => l === "featured",
    label: "Creadores destacados",
    icon: Trophy,
    iconCls: "text-amber-500",
  },
  {
    key: "verified",
    match: (l) => l === "verified",
    label: "Creadores verificados",
    icon: BadgeCheck,
    iconCls: "text-emerald-400",
  },
  {
    key: "readers",
    match: (l) => l !== "featured" && l !== "verified",
    label: "Lectores",
    icon: BookOpen,
    iconCls: "text-muted-foreground",
  },
];

export default function FollowersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showBlocked, setShowBlocked] = useState(false);

  // Debounce de la búsqueda (300 ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["studio-followers", { page, search }],
    queryFn: () => studioApi.followers(page, search),
  });

  const { data: blocked } = useQuery({
    queryKey: ["studio-blocked"],
    queryFn: () => studioApi.blocked(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["studio-followers"] });
    queryClient.invalidateQueries({ queryKey: ["studio-blocked"] });
    queryClient.invalidateQueries({ queryKey: ["studio-stats"] });
  };

  const removeMutation = useMutation({
    mutationFn: (userId: number) => studioApi.removeFollower(userId),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidate();
    },
    onError: () => toast.error("No se pudo quitar al seguidor"),
  });

  const blockMutation = useMutation({
    mutationFn: (userId: number) => studioApi.blockFollower(userId),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidate();
    },
    onError: () => toast.error("No se pudo bloquear"),
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: number) => studioApi.unblockFollower(userId),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidate();
    },
    onError: () => toast.error("No se pudo desbloquear"),
  });

  const followers = data?.data ?? [];

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" />
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Seguidores
          </h1>
          {data && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums">
              {data.meta.total}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Tu comunidad, ordenada por rango: primero los creadores destacados,
          luego los verificados y después el resto de lectores.
        </p>
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar seguidor por nombre o @usuario…"
          className="h-10 w-full rounded-md border border-border/60 bg-card pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30"
        />
      </div>

      {/* Lista agrupada por rango */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : followers.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-card/40 py-16 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search
              ? `Ningún seguidor coincide con “${search}”.`
              : "Aún nadie te sigue. Publica obras y participa en la comunidad para hacer crecer tu audiencia."}
          </p>
          {!search && (
            <Button asChild variant="outline" className="mt-4">
              <Link href="/comunidad">Explorar la comunidad</Link>
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          {GROUPS.map((group) => {
            const members = followers.filter((f) => group.match(f.creator_level));
            if (members.length === 0) return null;
            const Icon = group.icon;
            return (
              <section key={group.key}>
                <div className="mb-2.5 flex items-center gap-1.5">
                  <Icon className={cn("h-3.5 w-3.5", group.iconCls)} />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </h2>
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                    {members.length}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {members.map((f) => (
                    <FollowerCard
                      key={f.id}
                      follower={f}
                      onRemove={() => {
                        if (confirm(`¿Quitar a ${f.name} de tus seguidores? Podrá volver a seguirte si quiere.`)) {
                          removeMutation.mutate(f.id);
                        }
                      }}
                      onBlock={() => {
                        if (confirm(`¿Bloquear a ${f.name}? Dejará de seguirte y no podrá volver a hacerlo hasta que lo desbloquees.`)) {
                          blockMutation.mutate(f.id);
                        }
                      }}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Paginación */}
      {data && data.meta.last_page > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="px-3 text-muted-foreground">
            Página {data.meta.current_page} de {data.meta.last_page} ·{" "}
            {data.meta.total} seguidores
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.meta.last_page}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Bloqueados */}
      {(blocked?.length ?? 0) > 0 && (
        <section className="border-t border-border/60 pt-5">
          <button
            type="button"
            onClick={() => setShowBlocked((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <Ban className="h-3.5 w-3.5 text-destructive/70" />
            Usuarios bloqueados
            <span className="text-[10px] text-muted-foreground/60 tabular-nums">
              {blocked!.length}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                showBlocked && "rotate-180"
              )}
            />
          </button>

          {showBlocked && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {blocked!.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card/50 p-2.5"
                >
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border/60 opacity-60">
                    {b.avatar ? (
                      <Image
                        src={b.avatar}
                        alt={b.name}
                        fill
                        sizes="32px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-xs font-medium text-muted-foreground">
                        {b.name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-muted-foreground">
                      {b.name}
                    </p>
                    {b.username && (
                      <p className="truncate text-[10px] text-muted-foreground/60">
                        @{b.username}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={unblockMutation.isPending}
                    onClick={() => unblockMutation.mutate(b.id)}
                  >
                    <ShieldOff className="mr-1 h-3 w-3" />
                    Desbloquear
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
function FollowerCard({
  follower: f,
  onRemove,
  onBlock,
}: {
  follower: StudioFollower;
  onRemove: () => void;
  onBlock: () => void;
}) {
  const href = f.username ? `/u/${f.username}` : "#";

  return (
    <Card className="border-border/60 bg-card p-4">
      <div className="flex items-start gap-3">
        <Link href={href} className="shrink-0">
          <div className="relative h-11 w-11 overflow-hidden rounded-full border border-border/60 bg-muted">
            {f.avatar ? (
              <Image
                src={f.avatar}
                alt={f.name}
                fill
                sizes="44px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary/15 text-sm font-medium text-primary">
                {f.name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
          </div>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              href={href}
              className="line-clamp-1 text-sm font-medium hover:text-primary"
            >
              {f.name}
            </Link>
            <CreatorBadge level={f.creator_level as CreatorLevel} size="xs" iconOnly />
          </div>
          {f.username && (
            <Link
              href={href}
              className="block truncate text-xs text-muted-foreground hover:text-foreground"
            >
              @{f.username}
            </Link>
          )}
          {f.followed_at && (
            <p className="mt-1 text-[10px] text-muted-foreground/70">
              Te sigue desde{" "}
              {new Date(f.followed_at).toLocaleDateString("es", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {f.username && (
            <FollowButton
              username={f.username}
              initialState={f.is_following ? "following" : "none"}
              size="sm"
            />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Opciones para ${f.name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={onRemove}>
                <UserMinus className="h-3.5 w-3.5" />
                Quitar seguidor
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onBlock}
                className="text-destructive focus:text-destructive"
              >
                <Ban className="h-3.5 w-3.5" />
                Bloquear
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
