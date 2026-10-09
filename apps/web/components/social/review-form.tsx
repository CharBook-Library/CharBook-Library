"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { StarRating } from "./star-rating";
import { socialApi } from "@/lib/api-social";

interface ReviewFormProps {
  slug: string;
  initial?: {
    rating: number;
    title: string | null;
    comment: string | null;
  } | null;
  onSaved?: () => void;
  onDeleted?: () => void;
}

export function ReviewForm({ slug, initial, onSaved, onDeleted }: ReviewFormProps) {
  const queryClient = useQueryClient();

  const [rating, setRating] = useState<number>(initial?.rating ?? 0);
  const [title, setTitle] = useState<string>(initial?.title ?? "");
  const [comment, setComment] = useState<string>(initial?.comment ?? "");

  const upsert = useMutation({
    mutationFn: () =>
      socialApi.reviews.upsert(slug, {
        rating,
        title: title.trim() || null,
        comment: comment.trim() || null,
      }),
    onSuccess: () => {
      toast.success(initial ? "Reseña actualizada" : "Reseña publicada");
      queryClient.invalidateQueries({ queryKey: ["reviews", slug] });
      queryClient.invalidateQueries({ queryKey: ["book", slug] });
      onSaved?.();
    },
    onError: () => toast.error("No se pudo guardar la reseña"),
  });

  const remove = useMutation({
    mutationFn: () => socialApi.reviews.deleteMine(slug),
    onSuccess: () => {
      toast.success("Reseña eliminada");
      queryClient.invalidateQueries({ queryKey: ["reviews", slug] });
      queryClient.invalidateQueries({ queryKey: ["book", slug] });
      setRating(0);
      setTitle("");
      setComment("");
      onDeleted?.();
    },
    onError: () => toast.error("No se pudo eliminar la reseña"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error("Selecciona al menos 1 estrella");
      return;
    }
    upsert.mutate();
  };

  return (
    <Card className="space-y-4 border-border/60 bg-card p-5">
      <div className="space-y-1">
        <h3 className="font-serif text-lg font-bold">
          {initial ? "Tu reseña" : "Escribe una reseña"}
        </h3>
        <p className="text-xs text-muted-foreground">
          Comparte tu opinión con otros lectores.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Rating */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tu valoración *
          </label>
          <div className="flex items-center gap-3">
            <StarRating value={rating} onChange={setRating} size="lg" />
            {rating > 0 && (
              <span className="text-sm text-muted-foreground">
                {rating} / 5
              </span>
            )}
          </div>
        </div>

        {/* Título */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Título <span className="text-muted-foreground/50">(opcional)</span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Una obra maestra"
            maxLength={200}
          />
        </div>

        {/* Comentario */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Comentario <span className="text-muted-foreground/50">(opcional)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="¿Qué te pareció el libro? Sin spoilers porfa..."
            className="w-full rounded-md border border-border/60 bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
          <p className="text-right text-[10px] text-muted-foreground/60">
            {comment.length}/5000
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          {initial && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("¿Eliminar tu reseña?")) remove.mutate();
              }}
              disabled={remove.isPending}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Eliminar
            </Button>
          )}
          <Button
            type="submit"
            disabled={upsert.isPending}
            className="ml-auto bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {upsert.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {initial ? "Actualizar reseña" : "Publicar reseña"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
