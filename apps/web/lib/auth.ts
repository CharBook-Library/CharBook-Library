/**
 * Auth utilities — manejo de token Sanctum.
 *
 * Estrategia:
 * - El token se guarda en una cookie (legible desde JS).
 * - Server Components leen vía `cookies()` de next/headers.
 * - Client Components leen vía document.cookie.
 *
 * Nota: en producción ideal sería HTTP-only cookie firmada por un proxy
 * route en Next.js. Para dev local, esto es suficiente.
 */

export const TOKEN_COOKIE = "charbook_token";
export const TOKEN_MAX_AGE = 60 * 60 * 24 * 30; // 30 días
export const OAUTH_STATE_COOKIE = "charbook_oauth_state";
export const OAUTH_RETURN_COOKIE = "charbook_oauth_return";

// ===== Client-side helpers (browser) =====

export function setClientToken(token: string): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${TOKEN_MAX_AGE}; samesite=lax${secure}`;
}

export function clearClientToken(): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
}

export function getClientToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${TOKEN_COOKIE}=([^;]+)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}
