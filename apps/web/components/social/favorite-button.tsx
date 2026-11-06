"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { socialApi } from "@/lib/api-social";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  slug: string;
  /** Estado inicial del backend (SSR). */
  initialFavorited: boolean;
  initialCount?: number;
  size?: "sm" | "md" | "lg" | "icon";
  variant?: "outline" | "ghost" | "default";
  showCount?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function FavoriteButton({
  slug,
  initialFavorited,
  initialCount = 0,
  size = "md",
  variant = "outline",
  showCount = false,
  showLabel = true,
  className,
}: FavoriteButtonProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const [isFav, setIsFav] = useState(initialFavorited);
  const [count, setCount] = useState(initialCount);

  const mutation = useMutation({
    mutationFn: () => socialApi.favorites.toggle(slug),
    onMutate: async () => {
      // Optimistic update
      const prev = { isFav, count };
      setIsFav(!isFav);
      setCount((c) => c + (isFav ? -1 : 1));
      return prev;
    },
    onSuccess: (data) => {
      // Sincroniza con respuesta real del servidor
      setIsFav(data.is_favorited);
      setCount(data.favorites_count);
      toast.success(data.is_favorited ? "Añadido a favoritos" : "Eliminado de favoritos");
      // Invalidar queries que dependen de favoritos
      queryClient.invalidateQueries({ queryKey: ["my-favorites"] });
    },
    onError: (err, _v, ctx) => {
      // Revertir optimista
      if (ctx) {
        setIsFav(ctx.isFav);
        setCount(ctx.count);
      }
      toast.error("No se pudo actualizar el favorito");
    },
  });

  const handleClick = () => {
    if (!isAuthenticated) {
      toast("Inicia sesión para guardar favoritos", {
        action: {
          label: "Login",
          onClick: () => router.push("/login"),
        },
      });
      return;
    }
    mutation.mutate();
  };

  // Modo "icon" → solo botón cuadrado
  if (size === "icon") {
    return (
      <Button
        variant={variant}
        size="icon"
        onClick={handleClick}
        disabled={mutation.isPending}
        className={cn(
          "transition-colors",
          isFav && "border-rose-500/40 text-rose-500 hover:bg-rose-500/10",
          className
        )}
        title={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
      >
        <Heart className={cn("h-4 w-4", isFav && "fill-rose-500")} />
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size === "lg" ? "lg" : size === "sm" ? "sm" : "default"}
      onClick={handleClick}
      disabled={mutation.isPending}
      className={cn(
        "gap-2 transition-colors",
        isFav
          ? "border-rose-500/40 text-rose-500 hover:bg-rose-500/10"
          : "border-border/60",
        className
      )}
    >
      {mutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className={cn("h-4 w-4", isFav && "fill-rose-500")} />
      )}
      {showLabel && (
        <span>{isFav ? "En favoritos" : "Añadir a favoritos"}</span>
      )}
      {showCount && count > 0 && (
        <span className="text-xs opacity-70">({count})</span>
      )}
    </Button>
  );
}
