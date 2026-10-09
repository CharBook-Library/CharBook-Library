"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookMarked, BookOpen, CheckCircle2, ChevronDown, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { socialApi } from "@/lib/api-social";
import { useAuth } from "@/hooks/use-auth";
import type { ReadingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReadingStatusButtonProps {
  slug: string;
  initialStatus: ReadingStatus | null;
  size?: "sm" | "md" | "lg";
}

const LABELS: Record<ReadingStatus, string> = {
  want_to_read: "Quiero leer",
  reading: "Leyendo",
  read: "Leído",
};

const ICONS: Record<ReadingStatus, typeof BookMarked> = {
  want_to_read: BookMarked,
  reading: BookOpen,
  read: CheckCircle2,
};

export function ReadingStatusButton({
  slug,
  initialStatus,
  size = "lg",
}: ReadingStatusButtonProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<ReadingStatus | null>(initialStatus);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["feed"] });
    queryClient.invalidateQueries({ queryKey: ["my-shelf"] });
  };

  const setMutation = useMutation({
    mutationFn: (next: ReadingStatus) => socialApi.readingStatus.set(slug, next),
    onSuccess: (res) => {
      setStatus(res.status);
      toast.success(`Marcado como «${LABELS[res.status]}»`);
      invalidate();
    },
    onError: () => toast.error("No se pudo actualizar el estado"),
  });

  const removeMutation = useMutation({
    mutationFn: () => socialApi.readingStatus.remove(slug),
    onSuccess: () => {
      setStatus(null);
      toast.success("Quitado de tus estantes");
      invalidate();
    },
    onError: () => toast.error("No se pudo quitar"),
  });

  const busy = setMutation.isPending || removeMutation.isPending;
  const btnSize = size === "lg" ? "lg" : size === "sm" ? "sm" : "default";

  if (!isAuthenticated) {
    return (
      <Button
        variant="outline"
        size={btnSize}
        onClick={() =>
          toast("Inicia sesión para gestionar tu lectura", {
            action: { label: "Login", onClick: () => router.push("/login") },
          })
        }
        className="gap-2 border-border/60"
      >
        <BookMarked className="h-4 w-4" />
        Añadir a estantes
      </Button>
    );
  }

  const ActiveIcon = status ? ICONS[status] : BookMarked;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={status ? "default" : "outline"}
          size={btnSize}
          disabled={busy}
          className={cn("gap-2", !status && "border-border/60")}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ActiveIcon className="h-4 w-4" />
          )}
          {status ? LABELS[status] : "Añadir a estantes"}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {(Object.keys(LABELS) as ReadingStatus[]).map((s) => {
          const Icon = ICONS[s];
          return (
            <DropdownMenuItem
              key={s}
              onSelect={(e) => {
                e.preventDefault();
                setMutation.mutate(s);
              }}
              className="cursor-pointer gap-2"
            >
              <Icon className="h-4 w-4" />
              {LABELS[s]}
              {status === s && (
                <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
        {status && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                removeMutation.mutate();
              }}
              className="cursor-pointer gap-2 text-destructive focus:text-destructive"
            >
              <X className="h-4 w-4" />
              Quitar de estantes
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
