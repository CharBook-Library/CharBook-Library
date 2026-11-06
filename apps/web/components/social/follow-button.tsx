"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, UserCheck, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { socialApi } from "@/lib/api-social";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { FollowState } from "@/lib/types";

interface FollowButtonProps {
  /** Username del lector al que se quiere seguir. */
  username: string;
  /** Estado inicial venido del backend (SSR). */
  initialState: FollowState;
  /** Si el perfil es privado (afecta el copy del botón). */
  isPrivate?: boolean;
  initialCount?: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  className?: string;
}

/**
 * Botón Follow con 4 estados:
 *  - "self"       → no se renderiza (no puedes seguirte)
 *  - "following"  → "Siguiendo" (hover: "Dejar de seguir")
 *  - "pending"    → "Solicitud enviada" (hover: "Cancelar solicitud")
 *  - "none"       → "Seguir" si público, "Solicitar seguir" si privado
 */
export function FollowButton({
  username,
  initialState,
  isPrivate = false,
  initialCount = 0,
  size = "md",
  showCount = false,
  className,
}: FollowButtonProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const [state, setState] = useState<FollowState>(initialState);
  const [count, setCount] = useState(initialCount);
  const [hover, setHover] = useState(false);

  const mutation = useMutation({
    mutationFn: () => socialApi.follows.toggle(username),
    onMutate: async () => {
      const prev = { state, count };
      if (state === "following") {
        setState("none");
        setCount((c) => Math.max(0, c - 1));
      } else if (state === "pending") {
        setState("none");
      } else if (isPrivate) {
        setState("pending");
      } else {
        setState("following");
        setCount((c) => c + 1);
      }
      return prev;
    },
    onSuccess: (data) => {
      setState(data.state);
      setCount(data.followers_count);
      queryClient.invalidateQueries({ queryKey: ["profile", username] });
    },
    onError: (_err, _v, ctx) => {
      if (ctx) {
        setState(ctx.state);
        setCount(ctx.count);
      }
      toast.error("No se pudo actualizar el seguimiento");
    },
  });

  if (state === "self") return null;

  const handleClick = () => {
    if (!isAuthenticated) {
      toast("Inicia sesión para seguir lectores", {
        action: { label: "Login", onClick: () => router.push("/login") },
      });
      return;
    }
    mutation.mutate();
  };

  let label: string;
  let Icon: typeof UserPlus;
  let variant: "default" | "outline" | "secondary";

  if (state === "following") {
    label = hover ? "Dejar de seguir" : "Siguiendo";
    Icon = UserCheck;
    variant = "outline";
  } else if (state === "pending") {
    label = hover ? "Cancelar solicitud" : "Solicitud enviada";
    Icon = Clock;
    variant = "secondary";
  } else {
    label = isPrivate ? "Solicitar seguir" : "Seguir";
    Icon = UserPlus;
    variant = "default";
  }

  return (
    <Button
      variant={variant}
      size={size === "lg" ? "lg" : size === "sm" ? "sm" : "default"}
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={mutation.isPending}
      className={cn(
        "gap-2 transition-colors",
        state === "following" &&
          "border-border/60 hover:border-destructive/40 hover:text-destructive",
        state === "pending" &&
          "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/40",
        className
      )}
    >
      {mutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      <span>{label}</span>
      {showCount && count > 0 && (
        <span className="text-xs opacity-70">({count})</span>
      )}
    </Button>
  );
}
