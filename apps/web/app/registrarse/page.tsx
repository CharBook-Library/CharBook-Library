"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, ArrowLeft, Mail, Lock, User, AtSign, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api-auth";
import { setClientToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function RegisterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const reg = useMutation({
    mutationFn: () =>
      authApi.register({
        name: name.trim(),
        username: username.trim() || undefined,
        email: email.trim().toLowerCase(),
        password,
        password_confirmation: confirm,
      }),
    onSuccess: async (res) => {
      if ("token" in res) {
        // 1) Persiste el token
        setClientToken(res.token);
        // 2) Fuerza a useAuth a re-leer al usuario (la query se vuelve enabled
        //    porque ya hay token)
        await queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
        // 3) Toast + redirección al inicio (ya autenticado)
        toast.success(`¡Bienvenid@, ${res.data.name}!`, {
          description: "Revisa tu correo para verificar la cuenta.",
        });
        router.push("/");
        router.refresh();
      }
    },
    onError: (err: any) => {
      const errors = err.response?.data?.errors;
      const first = errors ? Object.values(errors)[0] as string[] : null;
      toast.error(first?.[0] ?? err.response?.data?.message ?? "No se pudo registrar.");
    },
  });

  const pwdStrength = passwordStrength(password);
  const canSubmit =
    name.length >= 2 && email.includes("@") && password.length >= 8 &&
    password === confirm && accepted;

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem-5rem)] items-center justify-center overflow-hidden px-4 py-12 md:py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10"
        style={{ background:
          "radial-gradient(circle at 30% 40%, oklch(0.78 0.13 80 / 0.2) 0%, transparent 50%), radial-gradient(circle at 70% 70%, oklch(0.65 0.18 250 / 0.15) 0%, transparent 50%)",
        }}
      />

      <Link href="/" className="absolute left-4 top-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground md:left-8 md:top-8">
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Inicio</span>
      </Link>

      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border/40 bg-card/80 p-8 shadow-2xl shadow-black/20 backdrop-blur-xl md:p-10">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-300 shadow-lg shadow-primary/30">
            <BookOpen className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
          </div>
        </div>

        <div className="space-y-1 text-center">
          <h1 className="font-serif text-2xl font-bold tracking-tight md:text-3xl">
            Crear tu cuenta
          </h1>
          <p className="text-sm text-muted-foreground">
            ¿Ya tienes una?{" "}
            <Link href="/login" className="font-medium text-primary underline">
              Inicia sesión
            </Link>
          </p>
        </div>

        <Button asChild size="lg" className="h-11 w-full bg-white text-black shadow-md hover:bg-zinc-100">
          <a href={`${API_URL}/auth/google`}>
            <GoogleIcon className="mr-2.5 h-5 w-5" />
            Continuar con Google
          </a>
        </Button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/60" /></div>
          <div className="relative flex justify-center"><span className="bg-card px-2 text-xs uppercase tracking-wider text-muted-foreground">o regístrate con tu correo</span></div>
        </div>

        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); reg.mutate(); }}>
          <FieldIcon icon={User}>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre público" className={inputCls} autoComplete="name" />
          </FieldIcon>

          <FieldIcon icon={AtSign}>
            <input type="text" value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="usuario (opcional)" className={inputCls} maxLength={30} autoComplete="username" />
          </FieldIcon>

          <FieldIcon icon={Mail}>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com" className={inputCls} autoComplete="email" />
          </FieldIcon>

          <FieldIcon icon={Lock}>
            <input type={showPwd ? "text" : "password"} required value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña (mín. 8, letras y números)"
              className={inputCls} autoComplete="new-password" />
            <button type="button" onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </FieldIcon>

          {password.length > 0 && (
            <div className="flex gap-1 px-1">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`h-1 flex-1 rounded ${
                  i < pwdStrength.level ? pwdStrength.color : "bg-muted"
                }`} />
              ))}
            </div>
          )}

          <FieldIcon icon={Lock}>
            <input type={showPwd ? "text" : "password"} required value={confirm}
              onChange={(e) => setConfirm(e.target.value)} placeholder="Repite la contraseña"
              className={inputCls} autoComplete="new-password" />
          </FieldIcon>

          {confirm && password !== confirm && (
            <p className="text-[11px] text-destructive px-1">Las contraseñas no coinciden.</p>
          )}

          <label className="flex items-start gap-2 cursor-pointer text-xs text-muted-foreground">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-border" />
            <span>
              Acepto los <Link href="/terminos" className="underline hover:text-foreground">Términos</Link>{" "}
              y la <Link href="/privacidad" className="underline hover:text-foreground">Política de Privacidad</Link>.
            </span>
          </label>

          <Button type="submit" size="lg" className="w-full" disabled={!canSubmit || reg.isPending}>
            {reg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear cuenta"}
          </Button>
        </form>
      </div>
    </div>
  );
}

const inputCls = "h-11 w-full rounded-md border border-border/60 bg-background pl-10 pr-3 text-sm outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/30";

function FieldIcon({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      {children}
    </div>
  );
}

function passwordStrength(pwd: string) {
  let level = 0;
  if (pwd.length >= 8) level++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) level++;
  if (/\d/.test(pwd)) level++;
  if (/[^a-zA-Z0-9]/.test(pwd) && pwd.length >= 12) level++;
  const colors = ["bg-destructive", "bg-orange-500", "bg-amber-500", "bg-green-500"];
  return { level, color: colors[level - 1] || "bg-muted" };
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
