"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MessageSquare, ChevronLeft, ChevronRight, Trash2,
  ExternalLink, ThumbsUp, CornerDownRight, AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { commentsApi, studioApi, worksApi, type StudioComment } from "@/lib/api-creator";
import { cn } from "@/lib/utils";

export default function CommentsPage() {
  const queryClient = useQueryClient();
  const [workId, setWorkId] = useState<number | "">("");
  const [sort, setSort] = useState<"newest" | "top">("newest");
  const [page, setPage] = useState(1);

  const { data: worksData } = useQuery({
    queryKey: ["studio-works-filter"],
    queryFn: () => worksApi.mine("all"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["studio-comments", { workId, sort, page }],
    queryFn: () =>
      studioApi.comments({
        work_id: workId === "" ? undefined : workId,
        sort,
        page,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => commentsApi.remove(id),
    onSuccess: () => {
      toast.success("Comentario eliminado");
      queryClient.invalidateQueries({ queryKey: ["studio-comments"] });
      queryClient.invalidateQueries({ queryKey: ["studio-stats"] });
    },
    onError: () => toast.error("No se pudo eliminar el comentario"),
  });

  const comments = data?.data ?? [];

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Comentarios
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Todos los comentarios que reciben tus obras y capítulos, en una sola
          bandeja.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={workId}
          onChange={(e) => {
            setWorkId(e.target.value === "" ? "" : Number(e.target.value));
            setPage(1);
          }}
          className="h-10 max-w-xs rounded-md border border-border/60 bg-card px-3 text-sm"
        >
          <option value="">Todas mis obras</option>
          {worksData?.data.map((w) => (
            <option key={w.id} value={w.id}>{w.title}</option>
          ))}
        </select>

        <div className="inline-flex rounded-lg border border-border/60 bg-card p-1">
          {([
            { key: "newest", label: "Recientes" },
            { key: "top", label: "Más votados" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => { setSort(t.key); setPage(1); }}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                sort === t.key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {data && (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {data.meta.total} comentario{data.meta.total === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-card/40 py-16 text-center">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Aún no hay comentarios{workId !== "" ? " en esta obra" : ""}.
            Cuando tus lectores comenten, aparecerán aquí.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              onDelete={() => {
                if (confirm("¿Eliminar este comentario de tu obra?")) {
                  deleteMutation.mutate(c.id);
                }
              }}
              deleting={deleteMutation.isPending}
            />
          ))}
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
            Página {data.meta.current_page} de {data.meta.last_page}
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
    </div>
  );
}

// ─────────────────────────────────────────────
function CommentRow({
  comment,
  onDelete,
  deleting,
}: {
  comment: StudioComment;
  onDelete: () => void;
  deleting: boolean;
}) {
  const t = comment.target;
  const contextHref = t?.book_slug
    ? t.type === "chapter" && t.chapter_number != null
      ? `/libro/${t.book_slug}/capitulo/${t.chapter_number}`
      : `/libro/${t.book_slug}`
    : null;

  return (
    <Card className="border-border/60 bg-card p-4">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border/60 bg-muted">
          {comment.user?.avatar ? (
            <Image
              src={comment.user.avatar}
              alt={comment.user.name}
              fill
              sizes="36px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/15 text-xs font-medium text-primary">
              {comment.user?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Cabecera */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {comment.user?.username ? (
              <Link
                href={`/u/${comment.user.username}`}
                className="font-medium text-foreground hover:text-primary"
              >
                {comment.user.name}
              </Link>
            ) : (
              <span className="font-medium">{comment.user?.name ?? "Usuario"}</span>
            )}
            {comment.is_reply && (
              <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                <CornerDownRight className="h-3 w-3" /> respuesta
              </span>
            )}
            {comment.is_spoiler && (
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                <AlertTriangle className="h-2.5 w-2.5" /> Spoiler
              </span>
            )}
            <span className="text-muted-foreground">
              {comment.created_at
                ? new Date(comment.created_at).toLocaleDateString("es", {
                    day: "numeric", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })
                : ""}
            </span>
          </div>

          {/* Cuerpo */}
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {comment.body}
          </p>

          {/* Contexto + métricas */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {t && (
              <span className="inline-flex min-w-0 items-center gap-1">
                en{" "}
                <strong className="truncate font-medium text-foreground/80">
                  {t.book_title ?? "obra eliminada"}
                </strong>
                {t.type === "chapter" && t.chapter_number != null && (
                  <span className="shrink-0">
                    · Cap. {t.chapter_number}
                    {t.chapter_title ? ` — ${t.chapter_title}` : ""}
                  </span>
                )}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" /> {comment.likes_count}
            </span>
            {comment.replies_count > 0 && (
              <span>{comment.replies_count} respuesta{comment.replies_count === 1 ? "" : "s"}</span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex shrink-0 items-center gap-0.5">
          {contextHref && (
            <Link
              href={contextHref}
              target="_blank"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-primary"
              title="Ver en contexto"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
          <button
            onClick={onDelete}
            disabled={deleting}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            title="Eliminar comentario"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}
