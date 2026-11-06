"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Loader2, UserPlus, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { socialApi } from "@/lib/api-social";
import type { IncomingFollowRequest } from "@/lib/types";

export default function SolicitudesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["follow-requests", "incoming"],
    queryFn: () => socialApi.followRequests.incoming(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["follow-requests"] });
    queryClient.invalidateQueries({ queryKey: ["follow-requests-count"] });
  };

  const acceptMutation = useMutation({
    mutationFn: (id: number) => socialApi.followRequests.accept(id),
    onSuccess: () => {
      toast.success("Solicitud aceptada");
      invalidate();
    },
    onError: () => toast.error("No se pudo aceptar la solicitud"),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => socialApi.followRequests.reject(id),
    onSuccess: () => {
      toast.success("Solicitud rechazada");
      invalidate();
    },
    onError: () => toast.error("No se pudo rechazar la solicitud"),
  });

  return (
    <div className="container max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Solicitudes de seguimiento
        </h1>
        <p className="text-sm text-muted-foreground">
          Personas que quieren seguirte. Tu perfil es privado, así que necesitan tu
          aprobación para ver tu actividad.
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : !data?.data.length ? (
        <Card className="border-dashed border-border/60 py-16 text-center">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No tienes solicitudes pendientes
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {data.data.map((req: IncomingFollowRequest) => {
            const isAccepting =
              acceptMutation.isPending && acceptMutation.variables === req.id;
            const isRejecting =
              rejectMutation.isPending && rejectMutation.variables === req.id;
            const isBusy = isAccepting || isRejecting;

            return (
              <li key={req.id}>
                <Card className="border-border/60 bg-card p-4 flex items-start gap-4">
                  <Link
                    href={`/u/${req.requester.username ?? req.requester.id}`}
                    className="shrink-0"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={req.requester.avatar ?? undefined} />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {req.requester.name?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/u/${req.requester.username ?? req.requester.id}`}
                        className="font-semibold hover:text-primary truncate"
                      >
                        {req.requester.name}
                      </Link>
                      {req.requester.username && (
                        <span className="text-xs text-muted-foreground">
                          @{req.requester.username}
                        </span>
                      )}
                    </div>
                    {req.requester.bio && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {req.requester.bio}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70 flex items-center gap-1">
                      <UserPlus className="h-3 w-3" />
                      quiere seguirte
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => acceptMutation.mutate(req.id)}
                      disabled={isBusy}
                      className="bg-primary text-primary-foreground"
                    >
                      {isAccepting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline ml-1">Aceptar</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectMutation.mutate(req.id)}
                      disabled={isBusy}
                      className="border-border/60 hover:border-destructive/40 hover:text-destructive"
                    >
                      {isRejecting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline ml-1">Rechazar</span>
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
