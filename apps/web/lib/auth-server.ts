import { cookies } from "next/headers";
import { TOKEN_COOKIE } from "./auth";
import type { CreatorStatus, Locale } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  is_public_profile: boolean;
  // v3
  locale: Locale;
  trust_score: number;
  creator_status: CreatorStatus;
  roles: string[];
  is_admin: boolean;
  is_super_admin: boolean;
  is_moderator: boolean;
  is_creator: boolean;
  // auth / 2FA / preferencias
  google_id?: string | null;
  /**
   * ¿La cuenta tiene contraseña local? Decide entre "cambiar contraseña" (exige
   * la actual) y "crear contraseña" (exige código al correo). Booleano derivado:
   * el API nunca envía el hash. `google_id` NO sirve como sustituto — una cuenta
   * de Google puede tener contraseña.
   */
  has_password?: boolean;
  is_email_verified?: boolean;
  two_factor_enabled?: boolean;
  two_factor_methods?: string[] | null;
  preferences?: Record<string, any> | null;
  subscription_tier?: string;
  // Plan efectivo + entitlements (qué puede usar este plan). Fuente: /api/user.
  plan?: "free" | "premium" | "premium_plus";
  is_premium?: boolean;
  is_premium_plus?: boolean;
  entitlements?: Record<string, { can: boolean; state: string; requires: string }>;
}

/** Lee el token desde las cookies del request actual (solo en server components). */
export async function getServerToken(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(TOKEN_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Devuelve el usuario autenticado o null. Se llama desde server components.
 * No cachea (siempre devuelve el estado actual).
 */
export async function getServerUser(): Promise<AuthUser | null> {
  const token = await getServerToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_URL}/api/user`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
