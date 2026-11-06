"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import { BookOpen, ArrowLeft, Mail, Lock, Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api-auth";
import { setClientToken } from "@/lib/auth";

type TwoFactorMethod = "totp" | "email" | "recovery";
type AuthError = AxiosError<{
  message?: string;
  errors?: { email?: string[]; code?: string[] };
}>;

function availableMethods(raw: string[]): TwoFactorMethod[] {
  const supported = raw.filter(
    (method): method is TwoFactorMethod =>
      method === "totp" || method === "email" || method === "recovery",
  );
  if (!supported.includes("recovery")) supported.push("recovery");
  return [...new Set(supported)];
}

export default function LoginPage() {
  // useSearchParams() forces a CSR bailout during prerender, so it must live
  // under a Suspense boundary or `next build` aborts the static export.
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const oauthChallenge = params.get("oauth_challenge");
  const oauthMethods = availableMethods((params.get("oauth_methods") ?? "").split(","));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);

  // ===== 2FA challenge =====
  const [challenge, setChallenge] = useState<string | null>(oauthChallenge);
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaMethods, setTwoFaMethods] = useState<TwoFactorMethod[]>(oauthMethods);
  const [twoFaMethod, setTwoFaMethod] = useState<TwoFactorMethod>(
    oauthMethods.includes("totp") ? "totp" : (oauthMethods[0] ?? "recovery"),
  );

  const login = useMutation({
    mutationFn: () => authApi.login({ email, password, remember }),
    onSuccess: (res) => {
      if ("two_factor_required" in res) {
        setChallenge(res.challenge);
        const methods = availableMethods(res.methods);
        setTwoFaMethods(methods);
        setTwoFaMethod(methods.includes("totp") ? "totp" : (methods[0] ?? "recovery"));
        toast.info("Verificación de dos pasos requerida.");
        return;
      }
      setClientToken(res.token);
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      toast.success(`¡Hola, ${res.data.name}!`);
      router.push(next);
      router.refresh();
    },
    onError: (err: AuthError) => {
      const msg = err.response?.data?.errors?.email?.[0]
        ?? err.response?.data?.message
        ?? "No se pudo iniciar sesión.";
      toast.error(msg);
    },
  });

  const sendEmailCode = useMutation({
    mutationFn: () => authApi.sendTwoFactorEmailCode(challenge!),
    onSuccess: () => toast.success("Código enviado a tu correo. Revisa tu bandeja."),
  });

  const verify2fa = useMutation({
    mutationFn: () => authApi.verifyTwoFactor({ challenge: challenge!, code: twoFaCode, method: twoFaMethod }),
    onSuccess: (res) => {
      setClientToken(res.token);
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      toast.success("Sesión iniciada.");
      router.push(next);
      router.refresh();
    },
    onError: (err: AuthError) => {
      toast.error(err.response?.data?.errors?.code?.[0] ?? "Código incorrecto.");
    },
  });

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem-5rem)] items-center justify-center overflow-hidden px-4 py-12 md:py-20">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10"
        style={{ background:
          "radial-gradient(circle at 30% 40%, oklch(0.78 0.13 80 / 0.2) 0%, transparent 50%), radial-gradient(circle at 70% 70%, oklch(0.65 0.18 250 / 0.15) 0%, transparent 50%)",
        }}
      />

      <Link href="/" className="absolute left-4 top-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:left-8 md:top-8">
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Inicio</span>
      </Link>

      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border/40 bg-card/80 p-8 shadow-2xl shadow-black/20 backdrop-blur-xl md:p-10">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-300 shadow-lg shadow-primary/30">
            <BookOpen className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
          </div>
        </div>

        {!challenge ? (
          <>
            <div className="space-y-2 text-center">
              <h1 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
                Inicia sesión
              </h1>
              <p className="text-sm text-muted-foreground">
                ¿Aún no tienes cuenta?{" "}
                <Link href="/registrarse" className="font-medium text-primary underline">
                  Crea una
                </Link>
              </p>
            </div>

            {/* Google */}
            <Button asChild size="lg" className="h-11 w-full bg-white text-black shadow-md hover:bg-zinc-100">
              <a href={`/auth/google/start?next=${encodeURIComponent(next)}`}>
                <GoogleIcon className="mr-2.5 h-5 w-5" />
                Continuar con Google
              </a>
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/60" /></div>
              <div className="relative flex justify-center"><span className="bg-card px-2 text-xs uppercase tracking-wider text-muted-foreground">o con tu correo</span></div>
            </div>

            <form
              className="space-y-3"
              onSubmit={(e) => { e.preventDefault(); login.mutate(); }}
            >
              <FieldIcon icon={Mail}>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com" className={inputCls} autoComplete="email" />
              </FieldIcon>

              <FieldIcon icon={Lock}>
                <input type={showPwd ? "text" : "password"} required value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña"
                  className={inputCls} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPwd ? "Ocultar" : "Mostrar"}>
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </FieldIcon>

              <div className="flex items-center justify-between text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border" />
                  <span className="text-muted-foreground">Recordarme</span>
                </label>
                <Link href="/recuperar-contrasena" className="text-primary hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
                {login.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
              </Button>
            </form>
          </>
        ) : (
          // ===== 2FA challenge =====
          <>
            <div className="space-y-2 text-center">
              <KeyRound className="mx-auto h-10 w-10 text-primary" />
              <h1 className="font-serif text-2xl font-bold tracking-tight">
                Verificación en dos pasos
              </h1>
              <p className="text-sm text-muted-foreground">
                Tu cuenta tiene 2FA activa. Elige el método e ingresa el código.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5 justify-center">
              {twoFaMethods.map((m) => (
                <button key={m} type="button" onClick={() => setTwoFaMethod(m)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    twoFaMethod === m ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground"
                  }`}>
                  {m === "totp" ? "App autenticadora" : m === "email" ? "Correo" : "Código de recuperación"}
                </button>
              ))}
            </div>

            {twoFaMethod === "email" && (
              <Button type="button" variant="outline" size="sm" className="w-full"
                onClick={() => sendEmailCode.mutate()} disabled={sendEmailCode.isPending}>
                {sendEmailCode.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3 mr-1.5" />}
                Enviarme un código al correo
              </Button>
            )}

            <form className="space-y-3"
              onSubmit={(e) => { e.preventDefault(); verify2fa.mutate(); }}>
              <input type="text" value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)}
                placeholder={twoFaMethod === "recovery" ? "XXXXX-XXXXX" : "000000"}
                className={`${inputCls} text-center tracking-widest`} autoFocus />
              <Button type="submit" size="lg" className="w-full" disabled={verify2fa.isPending || !twoFaCode}>
                {verify2fa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
              </Button>
            </form>

            <button type="button" onClick={() => { setChallenge(null); setTwoFaCode(""); }}
              className="text-xs text-muted-foreground hover:text-foreground mx-auto block">
              ← Volver al inicio de sesión
            </button>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground/80">
          Al continuar aceptas nuestros{" "}
          <Link href="/terminos" className="underline hover:text-foreground">Términos</Link>{" "}
          y{" "}
          <Link href="/privacidad" className="underline hover:text-foreground">Privacidad</Link>.
        </p>
      </div>
    </div>
  );
}

const inputCls = "h-11 w-full rounded-md border border-border/60 bg-background pl-10 pr-3 text-sm outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/30";

function FieldIcon({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      {children}
    </div>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
