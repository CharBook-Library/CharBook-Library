"use client";

import { apiClient } from "./api-client";

export interface RegisterInput {
  name: string;
  username?: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface LoginInput {
  email: string;
  password: string;
  remember?: boolean;
}

export interface LoginResponse {
  data: { id: number; name: string; email: string; avatar: string | null };
  token: string;
}

export interface TwoFactorChallenge {
  two_factor_required: true;
  challenge: string;
  methods: string[];
}

export interface PasskeyDevice {
  id: number;
  label: string;
  device_type?: string | null;
  last_used_at?: string | null;
}

export interface PasskeyRegistrationOptions {
  challenge: string;
  rp: PublicKeyCredentialRpEntity;
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: PublicKeyCredentialParameters[];
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  timeout?: number;
  attestation?: AttestationConveyancePreference;
}

export const authApi = {
  // ===== Login / registro / logout =====
  register: (input: RegisterInput) =>
    apiClient.post<LoginResponse>("/auth/register", input).then((r) => r.data),

  login: (input: LoginInput) =>
    apiClient
      .post<LoginResponse | TwoFactorChallenge>("/auth/login", input)
      .then((r) => r.data),

  logout: () => apiClient.post("/auth/logout").then((r) => r.data),

  // ===== Reset de contraseña =====
  forgotPassword: (email: string) =>
    apiClient.post<{ message: string }>("/auth/forgot-password", { email }).then((r) => r.data),

  resetPassword: (input: { email: string; code: string; password: string; password_confirmation: string }) =>
    apiClient.post<{ message: string }>("/auth/reset-password", input).then((r) => r.data),

  // ===== Verificación de email =====
  sendEmailVerification: () =>
    apiClient.post<{ message: string }>("/auth/email/send-verification").then((r) => r.data),
  verifyEmail: (code: string) =>
    apiClient.post<{ message: string }>("/auth/email/verify", { code }).then((r) => r.data),

  // ===== 2FA durante login =====
  sendTwoFactorEmailCode: (challenge: string) =>
    apiClient.post<{ message: string }>("/auth/two-factor/challenge", { challenge, method: "email" })
      .then((r) => r.data),

  verifyTwoFactor: (input: { challenge: string; code: string; method: "totp" | "email" | "recovery" }) =>
    apiClient.post<LoginResponse>("/auth/two-factor/verify", input).then((r) => r.data),
};

export const accountApi = {
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("avatar", file);
    return apiClient
      .post<{ avatar: string; message: string }>("/me/avatar", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  updateAccount: (input: { name?: string; username?: string; bio?: string | null; is_public_profile?: boolean }) =>
    apiClient.patch<{ data: Record<string, unknown>; message: string }>("/me/account", input).then((r) => r.data),

  /**
   * Pide el código para CREAR la primera contraseña (cuentas que hoy entran solo
   * con Google). No recibe correo ni id: el servidor actúa sobre el usuario
   * autenticado, así que no hay superficie de enumeración.
   */
  requestPasswordChallenge: () =>
    apiClient
      .post<{
        message: string;
        /** Cuándo caduca el código vigente. */
        expires_in_minutes: number;
        /** Cuándo se puede pedir OTRO código (política real del limitador). */
        retry_after_seconds?: number;
      }>("/me/password/challenge")
      .then((r) => r.data),

  /**
   * `current_password` para cuentas que ya tienen contraseña; `email_code` para
   * crear la primera en una cuenta sin credencial local. Nunca ambos.
   */
  changePassword: (input: {
    current_password?: string;
    email_code?: string;
    password: string;
    password_confirmation: string;
  }) =>
    apiClient
      .patch<{ message: string; revoked_sessions?: number }>("/me/password", input)
      .then((r) => r.data),

  updatePreferences: (input: Record<string, unknown>) =>
    apiClient.patch<{ data: Record<string, unknown>; message: string }>("/me/preferences", input).then((r) => r.data),

  getSubscription: () =>
    apiClient.get<{ data: Record<string, unknown> }>("/me/subscription").then((r) => r.data.data),

  getSessions: () =>
    apiClient.get<{ data: Record<string, unknown>[] }>("/me/sessions").then((r) => r.data.data),
  revokeSession: (id: number) =>
    apiClient.delete<{ message: string }>(`/me/sessions/${id}`).then((r) => r.data),
  deleteAccount: (input: { password?: string; confirm: string }) =>
    apiClient.delete<{ message: string }>("/me/account", { data: input }).then((r) => r.data),
};

export const twoFactorApi = {
  setupTotp: () =>
    apiClient.post<{ secret: string; otpauth_url: string }>("/me/two-factor/totp/setup").then((r) => r.data),
  confirmTotp: (code: string) =>
    apiClient.post<{ message: string; recovery_codes: string[] }>(
      "/me/two-factor/totp/confirm", { code }
    ).then((r) => r.data),
  enableEmail: () =>
    apiClient.post<{ message: string; requires_confirmation: boolean; expires_in_minutes?: number }>(
      "/me/two-factor/email/enable"
    ).then((r) => r.data),
  confirmEmail: (code: string) =>
    apiClient.post<{ message: string; recovery_codes: string[] | null }>(
      "/me/two-factor/email/confirm", { code }
    ).then((r) => r.data),
  sendAccountEmailCode: () =>
    apiClient.post<{ message: string; expires_in_minutes?: number }>(
      "/me/two-factor/email/challenge"
    ).then((r) => r.data),
  regenerateRecovery: () =>
    apiClient.post<{ recovery_codes: string[] }>("/me/two-factor/recovery-codes").then((r) => r.data),
  disable: (input: {
    method?: string;
    password?: string;
    verification_method?: "totp" | "email" | "recovery";
    code?: string;
  }) =>
    apiClient.post<{ message: string }>("/me/two-factor/disable", input).then((r) => r.data),
};

export const passkeyApi = {
  list: () => apiClient.get<{ data: PasskeyDevice[] }>("/me/passkeys").then((r) => r.data.data),
  options: () => apiClient.post<PasskeyRegistrationOptions>("/me/passkeys/options").then((r) => r.data),
  store: (input: { credential_id: string; public_key: string; label?: string; device_type?: string; transports?: string }) =>
    apiClient.post<{ data: PasskeyDevice }>("/me/passkeys", input).then((r) => r.data.data),
  remove: (id: number) =>
    apiClient.delete<{ message: string }>(`/me/passkeys/${id}`).then((r) => r.data),
};
