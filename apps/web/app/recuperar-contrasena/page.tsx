"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, ArrowLeft, Mail, Lock, KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api-auth";

type Step = "email" | "code" | "done";

export default function RecoverPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const requestCode = useMutation({
    mutationFn: () => authApi.forgotPassword(email.trim().toLowerCase()),
    onSuccess: (r: any) => {
      toast.success(r.message);
      setStep("code");
    },
  });

  const reset = useMutation({
    mutationFn: () => authApi.resetPassword({
      email: email.trim().toLowerCase(),
      code,
      password,
      password_confirmation: confirm,
    }),
    onSuccess: () => {
      setStep("done");
      toast.success("Contraseña restablecida.");
    },
    onError: (err: any) => {
      const e = err.response?.data?.errors;
      const first = e ? Object.values(e)[0] as string[] : null;
      toast.error(first?.[0] ?? "Código incorrecto o expirado.");
    },
  });

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem-5rem)] items-center justify-center overflow-hidden px-4 py-12 md:py-20">
      <Link href="/login" className="absolute left-4 top-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground md:left-8 md:top-8">
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Volver al login</span>
      </Link>

      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border/40 bg-card/80 p-8 shadow-2xl backdrop-blur-xl md:p-10">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-300 shadow-lg">
            {step === "done" ? <CheckCircle2 className="h-7 w-7 text-white" /> : <KeyRound className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />}
          </div>
        </div>

        {step === "email" && (
          <>
            <div className="space-y-1.5 text-center">
              <h1 className="font-serif text-2xl font-bold">Recuperar contraseña</h1>
              <p className="text-sm text-muted-foreground">
                Te enviaremos un código de 6 dígitos a tu correo.
              </p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); requestCode.mutate(); }} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com" className={inputCls} autoFocus />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={requestCode.isPending}>
                {requestCode.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar código"}
              </Button>
            </form>
          </>
        )}

        {step === "code" && (
          <>
            <div className="space-y-1.5 text-center">
              <h1 className="font-serif text-2xl font-bold">Ingresa el código</h1>
              <p className="text-sm text-muted-foreground">
                Enviamos un código a <strong className="text-foreground/90">{email}</strong>.
              </p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); reset.mutate(); }} className="space-y-3">
              <input type="text" required value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000" className={`${inputCls} text-center tracking-[0.5em] text-lg`} autoFocus />
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nueva contraseña" className={`${inputCls} pl-10`} />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repite la nueva contraseña" className={`${inputCls} pl-10`} />
              </div>
              {confirm && password !== confirm && (
                <p className="text-[11px] text-destructive px-1">Las contraseñas no coinciden.</p>
              )}
              <Button type="submit" size="lg" className="w-full"
                disabled={reset.isPending || code.length !== 6 || password.length < 8 || password !== confirm}>
                {reset.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Restablecer contraseña"}
              </Button>
              <button type="button" onClick={() => requestCode.mutate()}
                className="text-xs text-muted-foreground hover:text-foreground mx-auto block">
                Volver a enviar código
              </button>
            </form>
          </>
        )}

        {step === "done" && (
          <>
            <div className="space-y-1.5 text-center">
              <h1 className="font-serif text-2xl font-bold">¡Listo!</h1>
              <p className="text-sm text-muted-foreground">
                Tu contraseña se restableció. Ya puedes iniciar sesión.
              </p>
            </div>
            <Button size="lg" className="w-full" onClick={() => router.push("/login")}>
              Iniciar sesión
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

const inputCls = "h-11 w-full rounded-md border border-border/60 bg-background pl-10 pr-3 text-sm outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/30";
