"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ListPlus, Plus, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { socialApi } from "@/lib/api-social";
import { useAuth } from "@/hooks/use-auth";

interface AddToAnthologyButtonProps {
  bookId: number;
  size?: "sm" | "md" | "lg";
}

export function AddToAnthologyButton({
  bookId,
  size = "lg",
}: AddToAnthologyButtonProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: anthologies, isLoading } = useQuery({
    queryKey: ["my-anthologies"],
    queryFn: () => socialApi.anthologies.mine(),
    enabled: isAuthenticated && open,
  });

  const addMutation = useMutation({
    mutationFn: (slug: string) => socialApi.anthologies.addBook(slug, bookId),
    onSuccess: (anthology) => {
      toast.success(`Añadido a «${anthology.title}»`);
      setOpen(false);
    },
    onError: (err: { response?: { status?: number; data?: { message?: string } } }) => {
      if (err.response?.status === 422) {
        toast(err.response.data?.message ?? "Ese libro ya está en la antología.");
      } else {
        toast.error("No se pudo añadir el libro");
      }
    },
  });

  if (!isAuthenticated) {
    return (
      <Button
        variant="outline"
        size={size === "lg" ? "lg" : size === "sm" ? "sm" : "default"}
        onClick={() =>
          toast("Inicia sesión para usar antologías", {
            action: { label: "Login", onClick: () => router.push("/login") },
          })
        }
        className="gap-2 border-border/60"
      >
        <ListPlus className="h-4 w-4" />
        A una antología
      </Button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size === "lg" ? "lg" : size === "sm" ? "sm" : "default"}
          className="gap-2 border-border/60"
        >
          <ListPlus className="h-4 w-4" />
          A una antología
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Añadir a…</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : anthologies && anthologies.length > 0 ? (
          anthologies.map((a) => (
            <DropdownMenuItem
              key={a.id}
              disabled={addMutation.isPending}
              onSelect={(e) => {
                e.preventDefault();
                addMutation.mutate(a.slug);
              }}
              className="cursor-pointer justify-between gap-2"
            >
              <span className="line-clamp-1">{a.title}</span>
              {!a.is_public && (
                <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
              )}
            </DropdownMenuItem>
          ))
        ) : (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            Aún no tienes antologías.
          </p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/antologias">
            <Plus className="mr-2 h-4 w-4" />
            Crear nueva antología
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
