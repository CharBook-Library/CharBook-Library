"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Shield, Smartphone, Mail, Fingerprint, Key, KeyRound, Loader2, Copy, Check,
  Plus, Trash2, AlertCircle, ShieldCheck, X, MailCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { authApi, twoFactorApi, passkeyApi, type PasskeyDevice } from "@/lib/api-auth";
import { useAuth } from "@/hooks/use-auth";

// Lectura de errores de la API: lógica pura extraída a lib/api-errors.ts para
// poder probarla con el runner existente sin dependencias de UI.
import {
  FALLBACK_RESEND_GUARD_SECONDS,
  apiStatus,
  passwordSetupError,
  retryAfterFromError,
  type ApiError,
} from "@/lib/api-errors";

type WebAuthnRegistrationCredential = PublicKeyCredential & {
  response: AuthenticatorAttestationResponse & {
    publicKey?: ArrayBuffer;
    transports?: string[];
  };
};

type IconComponent = ComponentType<{ className?: string; strokeWidth?: number }>;

function apiFieldError(error: unknown, field: string, fallback: string): string {
  const apiError = error as ApiError;
  return apiError.response?.data?.errors?.[field]?.[0]
    ?? apiError.response?.data?.message
    ?? apiError.message
    ?? fallback;
}

export default function SeguridadPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ===== Estado TOTP setup =====
  const [totpSetup, setTotpSetup] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  // ===== Estado verificar email =====
  const [emailCode, setEmailCode] = useState("");
  const [emailVerifyOpen, setEmailVerifyOpen] = useState(false);
  const [emailMfaCode, setEmailMfaCode] = useState("");
  const [emailMfaPending, setEmailMfaPending] = useState(false);
  const [disablePendingMethod, setDisablePendingMethod] = useState<string | null>(null);
  const [disableCode, setDisableCode] = useState("");

  // ===== Estado cambiar contraseña =====
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  // ===== Crear la PRIMERA contraseña (cuentas que hoy entran solo con Google) =====
  // Por defecto asumimos el flujo conservador (cuenta con contraseña) hasta que
  // /api/user confirme lo contrario: nunca mostramos el flujo débil por error.
  const hasPassword = user?.has_password ?? true;
  const [setupStep, setSetupStep] = useState<"idle" | "code">("idle");
  const [setupCode, setSetupCode] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Reloj de 1s solo mientras hay algo que contar (expiración o reenvío).
  useEffect(() => {
    if (codeExpiresAt === null && resendAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [codeExpiresAt, resendAt]);

  // El código vive solo en memoria: al salir de la pantalla se borra.
  useEffect(() => {
    return () => {
      setSetupCode("");
      setNewPwd("");
      setConfirmPwd("");
    };
  }, []);

  const codeSecondsLeft = codeExpiresAt ? Math.max(0, Math.ceil((codeExpiresAt - now) / 1000)) : 0;
  const resendSecondsLeft = resendAt ? Math.max(0, Math.ceil((resendAt - now) / 1000)) : 0;

  /**
   * Descarta respuestas tardías: cada envío incrementa el contador y solo el
   * más reciente puede tocar el estado. Sin esto, una respuesta lenta de un
   * intento anterior podría pisar lo que el usuario ve ahora.
   */
  const setupSeq = useRef(0);

  const resetSetupFlow = () => {
    setupSeq.current += 1; // invalida cualquier respuesta en vuelo
    setSetupStep("idle");
    setSetupCode("");
    setSetupError(null);
    setCodeExpiresAt(null);
    setResendAt(null);
  };

  const requestPasswordCode = useMutation({
    mutationFn: async () => {
      const seq = ++setupSeq.current;
      const data = await import("@/lib/api-auth").then((m) => m.accountApi.requestPasswordChallenge());
      return { seq, data };
    },
    onSuccess: ({ seq, data }) => {
      if (seq !== setupSeq.current) return; // respuesta obsoleta
      setSetupStep("code");
      setSetupError(null);
      // Dos relojes independientes, cada uno con su propia fuente:
      // cuándo caduca el código…
      setCodeExpiresAt(Date.now() + (data.expires_in_minutes ?? 10) * 60_000);
      // …y cuándo el servidor permite pedir otro (0 = ya se puede).
      const retryAfter = typeof data.retry_after_seconds === "number"
        ? data.retry_after_seconds
        : FALLBACK_RESEND_GUARD_SECONDS;
      setResendAt(retryAfter > 0 ? Date.now() + retryAfter * 1000 : null);
      toast.success("Código enviado a tu correo.");
    },
    onError: (e: unknown) => {
      setSetupError(passwordSetupError(e));
      // Si el servidor dice cuánto esperar (cuerpo o cabecera Retry-After), se
      // respeta ese valor REAL; si no dice nada, solo la guarda de interfaz.
      const real = retryAfterFromError(e);
      if (real !== null) {
        setResendAt(real > 0 ? Date.now() + real * 1000 : null);
      } else if (apiStatus(e) === 429 || apiStatus(e) === 422) {
        setResendAt(Date.now() + FALLBACK_RESEND_GUARD_SECONDS * 1000);
      }
    },
  });

  // ===== Passkeys =====
  const passkeysQuery = useQuery({
    queryKey: ["passkeys"],
    queryFn: () => passkeyApi.list().catch(() => []),
  });

  // ===== Mutations =====
  const setupTotp = useMutation({
    mutationFn: () => twoFactorApi.setupTotp(),
    onSuccess: (data) => setTotpSetup(data),
  });

  const confirmTotp = useMutation({
    mutationFn: () => twoFactorApi.confirmTotp(totpCode),
    onSuccess: (data) => {
      setRecoveryCodes(data.recovery_codes);
      setTotpSetup(null);
      setTotpCode("");
      // Refresca el user en cache → el botón "Activar" se cambia a "Desactivar" solo
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      toast.success("App autenticadora activada.");
    },
    onError: (err: unknown) => toast.error(apiFieldError(err, "code", "Codigo incorrecto.")),
  });

  const enableEmailMfa = useMutation({
    mutationFn: () => twoFactorApi.enableEmail(),
    onSuccess: (data) => {
      if (data.requires_confirmation) {
        setEmailMfaPending(true);
        toast.success("Codigo enviado al correo. Confirma para activar 2FA.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      toast.success("Verificación por correo activada.");
    },
    onError: (err: unknown) => toast.error(apiFieldError(err, "email", "No se pudo enviar el codigo.")),
  });

  const confirmEmailMfa = useMutation({
    mutationFn: () => twoFactorApi.confirmEmail(emailMfaCode),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      setEmailMfaPending(false);
      setEmailMfaCode("");
      if (data.recovery_codes) setRecoveryCodes(data.recovery_codes);
      toast.success("Verificacion por correo activada.");
    },
    onError: (err: unknown) => toast.error(apiFieldError(err, "code", "Codigo incorrecto.")),
  });

  const sendDisableEmailCode = useMutation({
    mutationFn: () => twoFactorApi.sendAccountEmailCode(),
    onSuccess: () => {
      setDisablePendingMethod("email");
      setDisableCode("");
      toast.success("Codigo enviado al correo para confirmar la desactivacion.");
    },
    onError: (err: unknown) => toast.error(apiFieldError(err, "email", "No se pudo enviar el codigo.")),
  });

  const disable2fa = useMutation({
    mutationFn: (input: {
      method: string;
      password?: string;
      verification_method?: "totp" | "email" | "recovery";
      code?: string;
    }) => twoFactorApi.disable(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      toast.success("Método desactivado.");
      setCurrentPwd("");
      setDisableCode("");
      setDisablePendingMethod(null);
    },
    onError: (err: unknown) => toast.error(
      apiFieldError(err, "password", apiFieldError(err, "code", "No se pudo desactivar."))
    ),
  });

  function requestDisable(method: string) {
    if (currentPwd.trim()) {
      disable2fa.mutate({ method, password: currentPwd });
      return;
    }

    if (method === "email") {
      sendDisableEmailCode.mutate();
      return;
    }

    setDisablePendingMethod(method);
    setDisableCode("");
    toast.info("Ingresa un codigo 2FA para confirmar la desactivacion.");
  }

  const sendEmailVerification = useMutation({
    mutationFn: () => authApi.sendEmailVerification(),
    onSuccess: () => {
      setEmailVerifyOpen(true);
      toast.success("Código enviado al correo. Revisa tu bandeja.");
    },
  });
  const verifyEmail = useMutation({
    mutationFn: () => authApi.verifyEmail(emailCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      toast.success("Correo verificado.");
      setEmailVerifyOpen(false);
      setEmailCode("");
    },
    onError: (err: unknown) => toast.error(apiFieldError(err, "code", "Codigo incorrecto.")),
  });

  const removePasskey = useMutation({
    mutationFn: (id: number) => passkeyApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["passkeys"] });
      toast.success("Passkey eliminada.");
    },
  });

  const registerPasskey = useMutation({
    mutationFn: async (label: string) => {
      // 1) Pedir opciones al server
      const opts = await passkeyApi.options();
      // 2) Pedir credenciales al navegador (WebAuthn)
      const pkOptions: PublicKeyCredentialCreationOptions = {
        challenge: Uint8Array.from(atob(opts.challenge), c => c.charCodeAt(0)),
        rp: opts.rp,
        user: {
          id: Uint8Array.from(atob(opts.user.id), c => c.charCodeAt(0)),
          name: opts.user.name,
          displayName: opts.user.displayName,
        },
        pubKeyCredParams: opts.pubKeyCredParams,
        authenticatorSelection: opts.authenticatorSelection,
        timeout: opts.timeout,
        attestation: opts.attestation,
      };
      const cred = await navigator.credentials.create({ publicKey: pkOptions }) as WebAuthnRegistrationCredential | null;
      if (!cred) throw new Error("No se pudo crear la credencial.");
      // 3) Guardar en server
      const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
      const pubKey = btoa(String.fromCharCode(...new Uint8Array(cred.response.publicKey ?? cred.response.attestationObject)));
      return passkeyApi.store({
        credential_id: credId,
        public_key: pubKey,
        label,
        device_type: (cred.response.transports?.[0] === "internal") ? "platform" : "cross-platform",
        transports: (cred.response.transports ?? []).join(","),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["passkeys"] });
      toast.success("Passkey registrada.");
    },
    onError: (e: unknown) => toast.error(apiFieldError(e, "credential", "No se pudo registrar la passkey.")),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      import("@/lib/api-auth").then(m => m.accountApi.changePassword(
        // Cuenta CON contraseña: se exige la actual y jamás se manda email_code.
        // Cuenta SIN contraseña: se manda el código y nunca current_password.
        hasPassword
          ? {
              current_password: currentPwd,
              password: newPwd,
              password_confirmation: confirmPwd,
            }
          : {
              email_code: setupCode,
              password: newPwd,
              password_confirmation: confirmPwd,
            }
      )),
    onSuccess: (data) => {
      const revoked = data?.revoked_sessions ?? 0;
      // Refresca /api/user para que has_password pase a true y la tarjeta
      // vuelva sola al flujo normal.
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      toast.success(
        hasPassword
          ? "Contraseña actualizada."
          : "Contraseña creada. Ya puedes entrar también con correo y contraseña."
      );
      if (revoked > 0) {
        toast.info(
          revoked === 1
            ? "Se cerró 1 sesión activa por seguridad."
            : `Se cerraron ${revoked} sesiones activas por seguridad.`
        );
      }
      // Limpieza total del material sensible.
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      resetSetupFlow();
    },
    onError: (err: unknown) => {
      if (!hasPassword) {
        // Se conservan las contraseñas ya escritas para poder reintentar.
        setSetupError(passwordSetupError(err));
        return;
      }
      const apiError = err as ApiError;
      const first = apiError.response?.data?.errors ? Object.values(apiError.response.data.errors)[0] : null;
      toast.error(first?.[0] ?? "No se pudo cambiar.");
    },
  });

  // ===== Render =====
  return (
    <div className="space-y-6">
      {/* Email verificación */}
      {user && !user.is_email_verified && (
        <Card id="verificar-correo" className="scroll-mt-24 border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">Verifica tu correo electrónico</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tu correo aún no está verificado. Verifícalo para poder publicar obras y recibir notificaciones.
              </p>
              {!emailVerifyOpen ? (
                <Button size="sm" className="mt-3" onClick={() => sendEmailVerification.mutate()}
                  disabled={sendEmailVerification.isPending}>
                  {sendEmailVerification.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Enviarme código"}
                </Button>
              ) : (
                <div className="mt-3 flex gap-2 items-center">
                  <input type="text" value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000" className="h-9 w-32 rounded-md border border-border/60 bg-background px-3 text-center text-sm" />
                  <Button size="sm" onClick={() => verifyEmail.mutate()}
                    disabled={emailCode.length !== 6 || verifyEmail.isPending}>
                    {verifyEmail.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verificar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEmailVerifyOpen(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Correo ya verificado — solo confirmación, sin opción de código */}
      {user && user.is_email_verified && (
        <Card className="border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-3">
            <MailCheck className="h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <p className="text-sm font-medium">Correo verificado</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {user.email} está confirmado. Ya puedes publicar obras y recibir notificaciones.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Contraseña */}
      <SectionCard
        icon={Key}
        title={hasPassword ? "Contraseña" : "Crear contraseña"}
        desc={
          hasPassword
            ? "Cambia tu contraseña periódicamente."
            : "Tu cuenta entra con Google. Para crear una contraseña confirmaremos que eres tú con un código enviado a tu correo."
        }
      >
        {hasPassword ? (
          /* ───── Flujo normal: quien ya tiene contraseña demuestra que la conoce ───── */
          <form onSubmit={(e) => { e.preventDefault(); changePassword.mutate(); }} className="space-y-2.5">
            <PasswordInput value={currentPwd} onChange={setCurrentPwd} placeholder="Contraseña actual" />
            <PasswordInput value={newPwd} onChange={setNewPwd} placeholder="Nueva contraseña" />
            <PasswordInput value={confirmPwd} onChange={setConfirmPwd} placeholder="Confirma la nueva" />
            <Button
              type="submit"
              size="sm"
              disabled={changePassword.isPending || !currentPwd || newPwd.length < 8 || newPwd !== confirmPwd}
            >
              {changePassword.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Actualizar"}
            </Button>
          </form>
        ) : setupStep === "idle" ? (
          /* ───── Paso 1: solicitar el código ───── */
          <div className="space-y-3">
            {!user?.is_email_verified && (
              <p className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-500">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Necesitas verificar tu correo antes de crear una contraseña.
              </p>
            )}
            {setupError && <p className="text-xs text-destructive">{setupError}</p>}
            <Button
              size="sm"
              onClick={() => requestPasswordCode.mutate()}
              disabled={requestPasswordCode.isPending || resendSecondsLeft > 0 || !user?.is_email_verified}
            >
              {requestPasswordCode.isPending
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : resendSecondsLeft > 0 ? `Espera ${resendSecondsLeft}s` : "Enviarme el código"}
            </Button>
          </div>
        ) : (
          /* ───── Paso 2: introducir código + nueva contraseña ───── */
          <form onSubmit={(e) => { e.preventDefault(); changePassword.mutate(); }} className="space-y-2.5">
            <div>
              <input
                type="text"
                value={setupCode}
                onChange={(e) => { setSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setSetupError(null); }}
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                aria-label="Código de verificación de 6 dígitos"
                className="h-9 w-32 rounded-md border border-border/60 bg-background px-3 text-center text-sm tracking-[0.3em]"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {codeSecondsLeft > 0
                  ? `El código caduca en ${Math.floor(codeSecondsLeft / 60)}:${String(codeSecondsLeft % 60).padStart(2, "0")}.`
                  : "El código pudo caducar. Solicita uno nuevo si falla."}
              </p>
            </div>

            <PasswordInput value={newPwd} onChange={setNewPwd} placeholder="Nueva contraseña" />
            <PasswordInput value={confirmPwd} onChange={setConfirmPwd} placeholder="Confirma la nueva" />

            {setupError && <p className="text-xs text-destructive">{setupError}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={
                  changePassword.isPending
                  || setupCode.length !== 6
                  || newPwd.length < 8
                  || newPwd !== confirmPwd
                }
              >
                {changePassword.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Crear contraseña"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => requestPasswordCode.mutate()}
                disabled={requestPasswordCode.isPending || resendSecondsLeft > 0}
              >
                {resendSecondsLeft > 0 ? `Reenviar en ${resendSecondsLeft}s` : "Reenviar código"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={resetSetupFlow}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </SectionCard>

      {/* 2FA */}
      <SectionCard
        icon={Shield}
        title="Verificación en dos pasos"
        desc="Añade una capa extra de seguridad al iniciar sesión."
      >
        <div className="space-y-3">
          {/* TOTP */}
          <MethodRow
            icon={Smartphone}
            title="App autenticadora (TOTP)"
            desc="Google Authenticator, Authy, 1Password — códigos de 6 dígitos."
            active={user?.two_factor_methods?.includes("totp")}
            onActivate={() => setupTotp.mutate()}
            onDeactivate={() => requestDisable("totp")}
            disabled={setupTotp.isPending}
          />

          {totpSetup && (
            <Card className="border-primary/40 bg-primary/5 p-4 space-y-3">
              <p className="text-sm font-medium">Escanea con tu app autenticadora:</p>
              <div className="flex items-center gap-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(totpSetup.otpauth_url)}`}
                  alt="QR" className="h-40 w-40 rounded bg-white p-2"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground mb-1">¿No puedes escanear? Ingresa este secreto manualmente:</p>
                  <code className="block text-xs break-all rounded bg-background border border-border/40 p-2">{totpSetup.secret}</code>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Ingresa el código que muestra la app para confirmar:</p>
              <div className="flex gap-2">
                <input type="text" value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" className="h-9 w-32 rounded-md border border-border/60 bg-background px-3 text-center text-sm" />
                <Button size="sm" onClick={() => confirmTotp.mutate()}
                  disabled={totpCode.length !== 6 || confirmTotp.isPending}>
                  {confirmTotp.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setTotpSetup(null); setTotpCode(""); }}>
                  Cancelar
                </Button>
              </div>
            </Card>
          )}

          {recoveryCodes && (
            <Card className="border-green-500/40 bg-green-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <p className="text-sm font-medium">Guarda estos códigos de recuperación</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Úsalos si pierdes el acceso a tu app. Cada código solo funciona una vez.
              </p>
              <ul className="grid grid-cols-2 gap-1.5 mb-3">
                {recoveryCodes.map((c) => (
                  <li key={c}><code className="block rounded bg-background border border-border/40 p-1.5 text-xs text-center">{c}</code></li>
                ))}
              </ul>
              <Button size="sm" variant="outline" onClick={() => {
                navigator.clipboard.writeText(recoveryCodes.join("\n"));
                toast.success("Copiados.");
              }}>
                <Copy className="h-3 w-3 mr-1.5" />
                Copiar todos
              </Button>
            </Card>
          )}

          {/* Email */}
          <MethodRow
            icon={Mail}
            title="Código por correo"
            desc="Recibirás un código de 6 dígitos en cada login."
            active={user?.two_factor_methods?.includes("email")}
            onActivate={() => enableEmailMfa.mutate()}
            onDeactivate={() => requestDisable("email")}
            disabled={enableEmailMfa.isPending}
          />

          {emailMfaPending && !user?.two_factor_methods?.includes("email") && (
            <Card className="border-primary/40 bg-primary/5 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Confirma el codigo enviado a tu correo</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  El metodo por correo solo se activa despues de validar el codigo de 6 digitos.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input type="text" value={emailMfaCode}
                  onChange={(e) => setEmailMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" className="h-9 w-full rounded-md border border-border/60 bg-background px-3 text-center text-sm tracking-widest sm:w-36" />
                <Button size="sm" onClick={() => confirmEmailMfa.mutate()}
                  disabled={emailMfaCode.length !== 6 || confirmEmailMfa.isPending}>
                  {confirmEmailMfa.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  setEmailMfaPending(false);
                  setEmailMfaCode("");
                }}>
                  Cancelar
                </Button>
              </div>
            </Card>
          )}

          {disablePendingMethod && (
            <Card className="border-destructive/40 bg-destructive/5 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Confirma la desactivacion</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {disablePendingMethod === "email"
                    ? "Te enviamos un codigo al correo para confirmar este cambio."
                    : "Ingresa un codigo de tu app autenticadora para confirmar este cambio."}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input type="text" value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" className="h-9 w-full rounded-md border border-border/60 bg-background px-3 text-center text-sm tracking-widest sm:w-36" />
                <Button size="sm" variant="destructive" onClick={() => disable2fa.mutate({
                  method: disablePendingMethod,
                  verification_method: disablePendingMethod === "email" ? "email" : "totp",
                  code: disableCode,
                })}
                  disabled={disableCode.length !== 6 || disable2fa.isPending}>
                  {disable2fa.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Desactivar"}
                </Button>
                {disablePendingMethod === "email" && (
                  <Button size="sm" variant="outline" onClick={() => sendDisableEmailCode.mutate()}
                    disabled={sendDisableEmailCode.isPending}>
                    Reenviar codigo
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => {
                  setDisablePendingMethod(null);
                  setDisableCode("");
                }}>
                  Cancelar
                </Button>
              </div>
            </Card>
          )}

          {/* Passkeys */}
          <MethodRow
            icon={Fingerprint}
            title="Huella / FaceID / PIN del dispositivo"
            desc="Usa el método nativo del dispositivo (Touch ID, Face ID, Windows Hello, PIN)."
            active={(passkeysQuery.data?.length ?? 0) > 0}
            onActivate={() => {
              const label = prompt("Nombre para este dispositivo (ej. iPhone, MacBook):", "Mi dispositivo");
              if (label) registerPasskey.mutate(label);
            }}
            onDeactivate={undefined}
            disabled={registerPasskey.isPending}
          />

          {/* Lista passkeys registradas */}
          {(passkeysQuery.data?.length ?? 0) > 0 && (
            <ul className="space-y-1.5">
              {passkeysQuery.data!.map((pk: PasskeyDevice) => (
                <li key={pk.id} className="flex items-center justify-between rounded-md border border-border/40 bg-card/40 px-3 py-2">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <Fingerprint className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{pk.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {pk.device_type === "platform" ? "Nativo del dispositivo" : "Llave externa"}
                        {pk.last_used_at && ` · usada ${new Date(pk.last_used_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removePasskey.mutate(pk.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {/* Llave física separada (mismo flow WebAuthn pero con label distinto) */}
          <MethodRow
            icon={KeyRound}
            title="Llave de seguridad física (YubiKey, Titan…)"
            desc="Llaves USB/NFC compatibles con FIDO2."
            active={false}
            onActivate={() => {
              const label = prompt("Nombre para la llave:", "YubiKey");
              if (label) registerPasskey.mutate(label);
            }}
            onDeactivate={undefined}
          />
        </div>
      </SectionCard>
    </div>
  );
}

function SectionCard({ icon: Icon, title, desc, children }: { icon: IconComponent; title: string; desc: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <Icon className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-medium">{title}</h2>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

function MethodRow({ icon: Icon, title, desc, active, onActivate, onDeactivate, disabled }: {
  icon: IconComponent; title: string; desc: string; active?: boolean;
  onActivate: () => void; onDeactivate?: () => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card/30 px-3 py-3">
      <div className="flex items-start gap-3 min-w-0">
        <Icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{title}</p>
            {active && <Badge variant="outline" className="border-green-500/40 text-green-500 text-[10px] gap-1">
              <Check className="h-2.5 w-2.5" /> Activo
            </Badge>}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
      {active && onDeactivate ? (
        <Button size="sm" variant="ghost" onClick={onDeactivate}>Desactivar</Button>
      ) : (
        <Button size="sm" variant="outline" onClick={onActivate} disabled={disabled}>
          <Plus className="h-3 w-3 mr-1" />
          Activar
        </Button>
      )}
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input type="password" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="h-9 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30" />
  );
}
