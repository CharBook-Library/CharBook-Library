"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ThumbsUp, MessageCircle, Trash2, Loader2, Send, EyeOff } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { commentsApi, type WebtoonComment } from "@/lib/api-creator";
import { CreatorBadge } from "@/components/creator/creator-badge";
import { PlusBadge } from "@/components/premium/plus-badge";
import type { CreatorLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

type Target = { bookSlug: string } | { chapterId: number };
type Sort = "top" | "newest";

function relTime(iso: string): string {
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 604800) return `hace ${Math.floor(s / 86400)} d`;
  return d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

const keyFor = (t: Target, sort: Sort) =>
  "bookSlug" in t ? ["comments", "book", t.bookSlug, sort] : ["comments", "chapter", t.chapterId, sort];

export function CommentsSection({ target }: { target: Target }) {
  const { user, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [sort, setSort] = useState<Sort>("top");

  const queryKey = keyFor(target, sort);
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      "bookSlug" in target
        ? commentsApi.listForBook(target.bookSlug, sort)
        : commentsApi.listForChapter(target.chapterId, sort),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["comments"] });

  const comments = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <section className="w-full py-8 text-zinc-900">
      <h2 className="mb-4 text-lg font-bold tracking-tight">
        Comentarios <span className="ml-1 font-normal text-zinc-400">{total}</span>
      </h2>

      {isAuthenticated ? (
        <CommentBox target={target} onPosted={invalidate} />
      ) : (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
          <Link href="/login" className="font-medium text-amber-600 hover:underline">
            Inicia sesión
          </Link>{" "}
          para dejar un comentario.
        </p>
      )}

      <div className="mt-5 flex items-center gap-4 border-b border-zinc-200 text-sm">
        {(["top", "newest"] as Sort[]).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={cn(
              "-mb-px border-b-2 pb-2 font-medium transition-colors",
              sort === s ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-400 hover:text-zinc-600",
            )}
          >
            {s === "top" ? "Top" : "Más nuevos"}
          </button>
        ))}
      </div>

      <div className="divide-y divide-zinc-100">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-zinc-400">Cargando comentarios…</p>
        ) : comments.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400">Sé el primero en comentar.</p>
        ) : (
          comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              target={target}
              currentUserId={user?.id}
              isAdmin={(user as { is_admin?: boolean } | null)?.is_admin ?? false}
              onChanged={invalidate}
            />
          ))
        )}
      </div>
    </section>
  );
}

function CommentBox({
  target,
  parentId,
  onPosted,
  autoFocus,
  compact,
}: {
  target: Target;
  parentId?: number;
  onPosted: () => void;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const [body, setBody] = useState("");
  const [spoiler, setSpoiler] = useState(false);

  const post = useMutation({
    mutationFn: () => {
      const opts = { parent_id: parentId, is_spoiler: spoiler };
      return "bookSlug" in target
        ? commentsApi.createForBook(target.bookSlug, body.trim(), opts)
        : commentsApi.createForChapter(target.chapterId, body.trim(), opts);
    },
    onSuccess: () => {
      setBody("");
      setSpoiler(false);
      onPosted();
    },
    onError: () => toast.error("No se pudo publicar el comentario"),
  });

  return (
    <div className={cn("rounded-lg border border-zinc-200 bg-white p-3", compact && "mt-2")}>
      <textarea
        value={body}
        autoFocus={autoFocus}
        onChange={(e) => setBody(e.target.value.slice(0, 5000))}
        placeholder={parentId ? "Escribe una respuesta…" : "Deja un comentario"}
        rows={compact ? 2 : 3}
        className="w-full resize-none bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
      />
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setSpoiler((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium",
            spoiler ? "bg-amber-100 text-amber-700" : "text-zinc-400 hover:bg-zinc-100",
          )}
        >
          <EyeOff className="h-3 w-3" /> Spoiler
        </button>
        <button
          onClick={() => post.mutate()}
          disabled={post.isPending || !body.trim()}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-xs font-semibold text-white disabled:opacity-40"
        >
          {post.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Publicar
        </button>
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  target,
  currentUserId,
  isAdmin,
  onChanged,
  isReply,
}: {
  comment: WebtoonComment;
  target: Target;
  currentUserId?: number;
  isAdmin: boolean;
  onChanged: () => void;
  isReply?: boolean;
}) {
  const qc = useQueryClient();
  const [revealed, setRevealed] = useState(false);
  const [liked, setLiked] = useState(comment.liked_by_me);
  const [likes, setLikes] = useState(comment.likes_count);
  const [showReply, setShowReply] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  const canDelete = comment.user?.id === currentUserId || isAdmin;

  const like = useMutation({
    mutationFn: () => (liked ? commentsApi.unlike(comment.id) : commentsApi.like(comment.id)),
    onMutate: () => {
      setLiked((v) => !v);
      setLikes((n) => n + (liked ? -1 : 1));
    },
    onError: () => {
      setLiked(comment.liked_by_me);
      setLikes(comment.likes_count);
      toast.error("Inicia sesión para reaccionar");
    },
    onSuccess: (res) => setLikes(res.likes_count),
  });

  const del = useMutation({
    mutationFn: () => commentsApi.remove(comment.id),
    onSuccess: () => {
      toast.success("Comentario eliminado");
      onChanged();
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const repliesQuery = useQuery({
    queryKey: ["comment-replies", comment.id],
    queryFn: () => commentsApi.replies(comment.id),
    enabled: showReplies,
  });

  return (
    <div className={cn("py-4", isReply && "pl-10")}>
      <div className="flex items-start gap-3">
        <Avatar name={comment.user?.name} src={comment.user?.avatar} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-zinc-800">{comment.user?.name ?? "Usuario"}</span>
            <CreatorBadge level={(comment.user?.creator_level ?? undefined) as CreatorLevel | undefined} size="xs" />
            {comment.user?.is_premium_plus && <PlusBadge size="xs" />}
            <span className="text-xs text-zinc-400">· {relTime(comment.created_at)}</span>
          </div>

          {comment.is_spoiler && !revealed ? (
            <button
              onClick={() => setRevealed(true)}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-200"
            >
              <EyeOff className="h-3 w-3" /> Spoiler — toca para ver
            </button>
          ) : (
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-zinc-700">{comment.body}</p>
          )}

          <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
            <button onClick={() => like.mutate()} className={cn("inline-flex items-center gap-1.5 hover:text-zinc-800", liked && "font-semibold text-amber-600")}>
              <ThumbsUp className={cn("h-3.5 w-3.5", liked && "fill-amber-600")} /> {likes}
            </button>
            {!isReply && (
              <button onClick={() => setShowReply((v) => !v)} className="inline-flex items-center gap-1.5 hover:text-zinc-800">
                <MessageCircle className="h-3.5 w-3.5" /> Responder
              </button>
            )}
            {canDelete && (
              <button onClick={() => { if (confirm("¿Eliminar comentario?")) del.mutate(); }} className="inline-flex items-center gap-1.5 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {showReply && (
            <CommentBox
              target={target}
              parentId={comment.id}
              compact
              autoFocus
              onPosted={() => {
                setShowReply(false);
                setShowReplies(true);
                qc.invalidateQueries({ queryKey: ["comment-replies", comment.id] });
                onChanged();
              }}
            />
          )}

          {comment.replies_count > 0 && !isReply && (
            <button
              onClick={() => setShowReplies((v) => !v)}
              className="mt-2 text-xs font-medium text-amber-600 hover:underline"
            >
              {showReplies ? "Ocultar respuestas" : `Ver ${comment.replies_count} respuesta${comment.replies_count === 1 ? "" : "s"}`}
            </button>
          )}

          {showReplies && (
            <div className="mt-1">
              {repliesQuery.isLoading ? (
                <p className="py-2 text-xs text-zinc-400">Cargando…</p>
              ) : (
                (repliesQuery.data ?? []).map((r) => (
                  <CommentItem
                    key={r.id}
                    comment={r}
                    target={target}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    onChanged={onChanged}
                    isReply
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, src }: { name?: string; src?: string | null }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name ?? ""} className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-500">
      {(name ?? "?").charAt(0).toUpperCase()}
    </div>
  );
}
