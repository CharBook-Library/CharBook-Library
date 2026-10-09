"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "./star-rating";
import { CreatorBadge } from "@/components/creator/creator-badge";
import { PlusBadge } from "@/components/premium/plus-badge";
import { ReviewForm } from "./review-form";
import { ReportButton } from "@/components/report/report-button";
import { socialApi } from "@/lib/api-social";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import type { Review } from "@/lib/types";

interface ReviewsSectionProps {
  slug: string;
  ratingAverage: number;
  ratingCount: number;
  myReview: {
    id: number;
    rating: number;
    title: string | null;
    comment: string | null;
  } | null;
}

export function ReviewsSection({
  slug,
  ratingAverage,
  ratingCount,
  myReview: initialMyReview,
}: ReviewsSectionProps) {
  const { isAuthenticated } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["reviews", slug, page],
    queryFn: () => socialApi.reviews.list(slug, page),
  });

  const reviews: Review[] = data?.data ?? [];
  const hasMyReview = reviews.some((r) => r.is_mine) || !!initialMyReview;
  const mine = reviews.find((r) => r.is_mine) ?? null;
  const others = reviews.filter((r) => !r.is_mine);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold tracking-tight">Reseñas</h2>
          <div className="mt-1 flex items-center gap-2">
            <StarRating value={ratingAverage} readonly size="md" />
            <span className="text-sm font-medium">
              {ratingAverage > 0 ? ratingAverage.toFixed(1) : "—"}
            </span>
            <span className="text-sm text-muted-foreground">
              ({ratingCount} {ratingCount === 1 ? "reseña" : "reseñas"})
            </span>
          </div>
        </div>

        {!showForm &&
          (isAuthenticated ? (
            <Button
              onClick={() => setShowForm(true)}
              variant={hasMyReview ? "outline" : "default"}
              className={
                hasMyReview
                  ? "border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }
            >
              {hasMyReview ? (
                <>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Editar mi reseña
                </>
              ) : (
                <>
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                  Escribir reseña
                </>
              )}
            </Button>
          ) : (
            <Button asChild variant="outline" className="border-border/60">
              <Link href="/login">Inicia sesión para reseñar</Link>
            </Button>
          ))}
      </div>

      {showForm && (
        <ReviewForm
          slug={slug}
          initial={mine ?? initialMyReview}
          onSaved={() => setShowForm(false)}
          onDeleted={() => setShowForm(false)}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-card/50 py-10 text-center">
          <p className="font-serif text-lg">Aún no hay reseñas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            ¡Sé el primero en compartir tu opinión!
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {mine && <ReviewCard review={mine} isMine />}
          {others.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}

      {data && data.meta.last_page > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="border-border/60"
          >
            Anterior
          </Button>
          <span className="px-3 text-sm text-muted-foreground">
            {data.meta.current_page} / {data.meta.last_page}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.meta.last_page}
            onClick={() => setPage((p) => p + 1)}
            className="border-border/60"
          >
            Más reseñas <ChevronDown className="ml-1 h-3 w-3 rotate-[-90deg]" />
          </Button>
        </div>
      )}
    </section>
  );
}

function ReviewCard({ review, isMine }: { review: Review; isMine?: boolean }) {
  const queryClient = useQueryClient();
  const date = new Date(review.created_at).toLocaleDateString("es", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const deleteAsStaff = useMutation({
    mutationFn: () =>
      apiClient.delete(`/admin/reviews/${review.id}`).then((r) => r.data),
    onSuccess: () => {
      toast.success("Reseña eliminada");
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["book"] });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const userHref = review.user?.username ? `/u/${review.user.username}` : null;

  return (
    <Card
      className={
        "border-border/60 bg-card p-5 transition-colors " +
        (isMine ? "border-primary/40 bg-primary/5" : "")
      }
    >
      <div className="flex items-start gap-3">
        {userHref ? (
          <Link href={userHref} className="shrink-0">
            <Avatar className="h-10 w-10 transition-transform hover:scale-105">
              <AvatarImage src={review.user?.avatar ?? undefined} alt={review.user?.name} />
              <AvatarFallback className="bg-primary/20 text-xs text-primary">
                {review.user?.name?.[0]?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
        ) : (
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={review.user?.avatar ?? undefined} alt={review.user?.name} />
            <AvatarFallback className="bg-primary/20 text-xs text-primary">
              {review.user?.name?.[0]?.toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {userHref ? (
              <Link
                href={userHref}
                className="font-semibold hover:text-primary transition-colors"
              >
                {review.user?.name ?? "Anónimo"}
              </Link>
            ) : (
              <span className="font-semibold">{review.user?.name ?? "Anónimo"}</span>
            )}

            <CreatorBadge level={review.user?.creator_level} size="xs" />
            {review.user?.is_premium_plus && <PlusBadge size="xs" />}

            {isMine && (
              <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                TÚ
              </span>
            )}
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{date}</span>

            <div className="ml-auto flex items-center gap-1">
              {!isMine && (
                <ReportButton targetType="review" targetId={review.id} variant="icon" />
              )}
              {review.can_delete_as_staff && !isMine && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("¿Eliminar esta reseña como staff?")) {
                      deleteAsStaff.mutate();
                    }
                  }}
                  disabled={deleteAsStaff.isPending}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  title="Eliminar como staff"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-1">
            <StarRating value={review.rating} readonly size="sm" />
          </div>

          {review.title && (
            <h4 className="mt-2 font-serif text-base font-bold">{review.title}</h4>
          )}
          {review.comment && (
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {review.comment}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
