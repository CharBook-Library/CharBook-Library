"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MailCheck, Loader2, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api-auth";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  onAllow: () => void;
  children: (props: { onClick: (e: React.MouseEvent) => void; disabled: boolean }) => React.ReactNode;
  reason?: string;
}

/**
 * VerifiedGate: envuelve un botón que requiere correo verificado.
 * Si el user no está verificado, abre un modal con el flujo de código por correo.
 */
export function VerifiedGate({ onAllow, children, reason }: Props) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  const sendCode = useMutation({
    mutationFn: () => authApi.sendEmailVerification(),
    onSuccess: () => toast.success("Código enviado a tu correo. Revisa tu bandeja."),
  });
  const verify = useMutation({
    mutationFn: () => authApi.verifyEmail(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      toast.success("Correo verificado.");
      setOpen(false);
      onAllow();
    },
    onError: (e: any) => toast.error(e.response?.data?.errors?.code?.[0] ?? "Código incorrecto."),
  });

  const handleClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault();
      window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
      return;
    }
    if (!user?.is_email_verified) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    onAllow();
  };

  // Cierra con ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {children({ onClick: handleClick, disabled: false })}

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
            aria-label="Cerrar"
          />

          {/* Card */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-2xl animate-in zoom-in-95 fade-in">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
              <ShieldAlert className="h-6 w-6 text-amber-500" />
            </div>

            <h2 className="font-serif text-xl font-bold tracking-tight">
              Verifica tu correo
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Necesitamos confirmar tu correo electrónico {reason ?? "para esta acción"}.
              {user?.email && (
                <> Te enviaremos un código a <strong className="text-foreground/90">{user.email}</strong>.</>
              )}
            </p>

            <div className="mt-5 space-y-3">
              {!sendCode.isSuccess ? (
                <Button onClick={() => sendCode.mutate()} disabled={sendCode.isPending} className="w-full">
                  {sendCode.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MailCheck className="h-4 w-4 mr-2" />}
                  Enviarme código de verificación
                </Button>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Ingresa el código de 6 dígitos que te enviamos:
                  </p>
                  <input
                    type="text" value={code} autoFocus
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="h-12 w-full rounded-md border border-border/60 bg-background px-3 text-center text-lg tracking-[0.4em] outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/30"
                  />
                  <Button onClick={() => verify.mutate()}
                    disabled={verify.isPending || code.length !== 6} className="w-full">
                    {verify.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Verificar y continuar
                  </Button>
                  <button onClick={() => sendCode.mutate()} className="text-xs text-muted-foreground hover:text-foreground block mx-auto">
                    Volver a enviar código
                  </button>
                </>
              )}
            </div>

            <div className="mt-4 border-t border-border/40 pt-3">
              <Button variant="ghost" size="sm" asChild className="w-full">
                <Link href="/ajustes/seguridad" onClick={() => setOpen(false)}>
                  Más opciones en Ajustes
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
