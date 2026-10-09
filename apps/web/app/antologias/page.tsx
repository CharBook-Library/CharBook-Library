"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Library, Plus, Loader2, Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnthologyCard } from "@/components/anthology/anthology-card";
import { socialApi } from "@/lib/api-social";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export default function MyAnthologiesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const { data: anthologies, isLoading } = useQuery({
    queryKey: ["my-anthologies"],
    queryFn: () => socialApi.anthologies.mine(),
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      socialApi.anthologies.create({ title: title.trim(), is_public: isPublic }),
    onSuccess: (anthology) => {
      toast.success("Antología creada");
      queryClient.invalidateQueries({ queryKey: ["my-anthologies"] });
      router.push(`/antologias/${anthology.slug}`);
    },
    onError: () => toast.error("No se pudo crear la antología"),
  });

  if (authLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <Library className="mx-auto mb-6 h-14 w-14 text-primary" />
        <h1 className="font-serif text-2xl font-bold">Tus antologías</h1>
        <p className="mt-3 text-muted-foreground">
          Inicia sesión para crear listas curadas de libros.
        </p>
        <Button asChild className="mt-8">
          <Link href="/login?from=/antologias">Iniciar sesión</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Library className="h-4 w-4" />
            <span>Mis antologías</span>
          </div>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight md:text-4xl">
            Listas curadas
          </h1>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva antología
          </Button>
        )}
      </div>

      {/* Formulario de creación */}
      {creating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim().length < 2) {
              toast.error("Dale un título a tu antología.");
              return;
            }
            createMutation.mutate();
          }}
          className="mb-8 space-y-4 rounded-xl border border-border/60 bg-card p-5"
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Título (p. ej. «Clásicos que cambian la vida»)"
            className="h-10"
            autoFocus
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  isPublic
                    ? "border-primary bg-primary/5"
                    : "border-border/60 text-muted-foreground"
                )}
              >
                <Globe className="h-3.5 w-3.5" /> Pública
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  !isPublic
                    ? "border-primary bg-primary/5"
                    : "border-border/60 text-muted-foreground"
                )}
              >
                <Lock className="h-3.5 w-3.5" /> Privada
              </button>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCreating(false);
                  setTitle("");
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Crear
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Listado */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-xl border border-border/60 bg-card"
            />
          ))}
        </div>
      ) : anthologies && anthologies.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {anthologies.map((a) => (
            <AnthologyCard key={a.id} anthology={a} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 py-16 text-center">
          <Library className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aún no tienes antologías. Crea la primera para empezar a curar.
          </p>
        </div>
      )}
    </div>
  );
}
