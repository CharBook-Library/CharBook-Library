"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  MessageCircle,
  Share2,
  Star,
  BookOpen,
  BookMarked,
  CheckCircle2,
  Send,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { socialApi } from "@/lib/api-social";
import { useAuth } from "@/hooks/use-auth";
import { ReportButton } from "@/components/report/report-button";
import { PlusBadge } from "@/components/premium/plus-badge";
import type { Activity, ActivityType } from "@/lib/types";
import { cn } from "@/lib/utils";

const VERB: Record<ActivityType, string> = {
  started_reading: "empezó a leer",
  finished_reading: "terminó de leer",
  want_to_read: "quiere leer",
  reviewed: "reseñó",
  favorited: "añadió a favoritos",
};

const VERB_ICON: Record<ActivityType, typeof BookOpen> = {
  started_reading: BookOpen,
  finished_reading: CheckCircle2,
  want_to_read: BookMarked,
  reviewed: Star,
  favorited: Heart,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function ActivityCard({ activity }: { activity: Activity }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();

  const [liked, setLiked] = useState(activity.liked_by_me);
  const [likes, setLikes] = useState(activity.likes_count);
  const [shared, setShared] = useState(activity.shared_by_me);
  const [shares, setShares] = useState(activity.shares_count);
  const [comments, setComments] = useState(activity.comments_count);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");

  const Icon = VERB_ICON[activity.type];
  const actor = activity.actor;
  const book = activity.book;

  const requireAuth = () => {
    if (!isAuthenticated) {
      toast("Inicia sesión para interactuar", {
        action: { label: "Login", onClick: () => router.push("/login") },
      });
      return false;
    }
    return true;
  };

  const likeMutation = useMutation({
    mutationFn: () => socialApi.activities.like(activity.id),
    onMutate: () => {
      setLiked((v) => !v);
      setLikes((c) => c + (liked ? -1 : 1));
    },
    onSuccess: (res) => {
      setLiked(res.liked_by_me);
      setLikes(res.likes_count);
    },
    onError: () => {
      setLiked(activity.liked_by_me);
      setLikes(activity.likes_count);
      toast.error("No se pudo dar me gusta");
    },
  });

  const shareMutation = useMutation({
    mutationFn: () => socialApi.activities.share(activity.id),
    onSuccess: (res) => {
      setShared(res.shared_by_me);
      setShares(res.shares_count);
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard
          .writeText(`${window.location.origin}/comunidad/a/${activity.id}`)
          .catch(() => {});
      }
      toast.success(res.shared_by_me ? "Compartido · enlace copiado" : "Compartir deshecho");
    },
    onError: () => toast.error("No se pudo compartir"),
  });

  // Comentarios (carga diferida)
  const { data: commentList, isLoading: loadingComments } = useQuery({
    queryKey: ["activity-comments", activity.id],
    queryFn: () => socialApi.activities.comments(activity.id).then((r) => r.data),
    enabled: showComments,
  });

  const commentMutation = useMutation({
    mutationFn: () => socialApi.activities.comment(activity.id, draft.trim()),
    onSuccess: () => {
      setDraft("");
      setComments((c) => c + 1);
      queryClient.invalidateQueries({ queryKey: ["activity-comments", activity.id] });
    },
    onError: () => toast.error("No se pudo comentar"),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: number) =>
      socialApi.activities.deleteComment(activity.id, commentId),
    onSuccess: () => {
      setComments((c) => Math.max(0, c - 1));
      queryClient.invalidateQueries({ queryKey: ["activity-comments", activity.id] });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  return (
    <article className="rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-border md:p-5">
      {/* Cabecera: actor + acción */}
      <div className="flex items-start gap-3">
        <Link
          href={actor?.username ? `/u/${actor.username}` : "#"}
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border/60"
        >
          {actor?.avatar ? (
            <Image src={actor.avatar} alt={actor.name} fill sizes="40px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-primary/15 text-sm text-primary">
              {actor?.name?.[0]?.toUpperCase() ?? "U"}
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug">
            <Link
              href={actor?.username ? `/u/${actor.username}` : "#"}
              className="font-semibold hover:text-primary"
            >
              {actor?.name}
            </Link>{" "}
            {actor?.is_premium_plus && (
              <>
                <PlusBadge size="xs" className="align-middle" />{" "}
              </>
            )}
            <span className="text-muted-foreground">{VERB[activity.type]}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
            {timeAgo(activity.created_at)}
            {activity.type === "reviewed" && activity.meta?.rating != null && (
              <span className="ml-1 inline-flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-3 w-3",
                      i < (activity.meta?.rating ?? 0)
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30"
                    )}
                  />
                ))}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Libro */}
      {book && (
        <Link
          href={`/libro/${book.slug}`}
          className="mt-3 flex gap-3 rounded-xl border border-border/50 bg-background/40 p-3 transition-colors hover:border-primary/40"
        >
          <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md border border-border/40 shadow-sm">
            {book.cover && (
              <Image src={book.cover} alt={book.title} fill sizes="56px" className="object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 font-serif font-bold leading-tight">{book.title}</div>
            {book.author && (
              <div className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                {book.author.name}
              </div>
            )}
          </div>
        </Link>
      )}

      {/* Barra de reacciones */}
      <div className="mt-3 flex items-center gap-1 text-muted-foreground">
        <button
          type="button"
          onClick={() => requireAuth() && likeMutation.mutate()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-accent",
            liked && "text-rose-500"
          )}
        >
          <Heart className={cn("h-4 w-4", liked && "fill-rose-500")} />
          {likes > 0 && <span className="tabular-nums">{likes}</span>}
        </button>

        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-accent"
        >
          <MessageCircle className="h-4 w-4" />
          {comments > 0 && <span className="tabular-nums">{comments}</span>}
        </button>

        <button
          type="button"
          onClick={() => requireAuth() && shareMutation.mutate()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-accent",
            shared && "text-primary"
          )}
        >
          <Share2 className="h-4 w-4" />
          {shares > 0 && <span className="tabular-nums">{shares}</span>}
        </button>
      </div>

      {/* Comentarios */}
      {showComments && (
        <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
          {isAuthenticated && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim().length === 0) return;
                commentMutation.mutate();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escribe un comentario..."
                maxLength={1000}
                className="h-9 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
              <Button
                type="submit"
                size="icon"
                disabled={commentMutation.isPending || draft.trim().length === 0}
                aria-label="Comentar"
              >
                {commentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          )}

          {loadingComments ? (
            <p className="py-2 text-center text-xs text-muted-foreground">Cargando…</p>
          ) : (
            <ul className="space-y-3">
              {commentList?.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <div className="relative mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full border border-border/60">
                    {c.user?.avatar ? (
                      <Image src={c.user.avatar} alt={c.user.name} fill sizes="28px" className="object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-primary/15 text-xs text-primary">
                        {c.user?.name?.[0]?.toUpperCase() ?? "U"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 rounded-xl bg-background/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Link
                          href={c.user?.username ? `/u/${c.user.username}` : "#"}
                          className="truncate text-sm font-medium hover:text-primary"
                        >
                          {c.user?.name}
                        </Link>
                        {c.user?.is_premium_plus && <PlusBadge size="xs" />}
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {timeAgo(c.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-foreground/90">
                      {c.body}
                    </p>
                  </div>
                  {c.is_mine || user?.id === c.user?.id ? (
                    <button
                      type="button"
                      onClick={() => deleteCommentMutation.mutate(c.id)}
                      className="mt-1 text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Eliminar comentario"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : isAuthenticated ? (
                    <div className="mt-1">
                      <ReportButton targetType="comment" targetId={c.id} variant="icon" />
                    </div>
                  ) : null}
                </li>
              ))}
              {commentList && commentList.length === 0 && (
                <p className="py-1 text-center text-xs text-muted-foreground">
                  Sé el primero en comentar.
                </p>
              )}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}
