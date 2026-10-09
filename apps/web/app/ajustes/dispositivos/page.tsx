"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Smartphone, Monitor, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { accountApi } from "@/lib/api-auth";

export default function DispositivosPage() {
  const queryClient = useQueryClient();
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: () => accountApi.getSessions(),
  });

  const revoke = useMutation({
    mutationFn: (id: number) => accountApi.revokeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
      toast.success("Sesión cerrada.");
    },
  });

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <Monitor className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-medium">Sesiones activas</h2>
          <p className="text-xs text-muted-foreground">Estos son los dispositivos donde tu cuenta está iniciada.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Sin sesiones activas.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s: any) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3">
              <div className="flex items-start gap-3 min-w-0">
                <Smartphone className="h-4 w-4 text-muted-foreground mt-1" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{s.name || "Sesión"}</p>
                    {s.current && <Badge variant="outline" className="border-green-500/40 text-green-500 text-[10px]">Esta sesión</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {s.last_used_at ? `Última actividad: ${new Date(s.last_used_at).toLocaleString()}` : "Nunca usada"}
                  </p>
                </div>
              </div>
              {!s.current && (
                <Button size="sm" variant="ghost" onClick={() => revoke.mutate(s.id)}>
                  <LogOut className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
