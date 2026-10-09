"use client";

import { useAuth } from "./use-auth";

export type PlanTier = "free" | "premium" | "premium_plus";
export type FeatureState =
  | "available"
  | "requires_premium"
  | "requires_premium_plus"
  | "coming_soon";

/** Espejo de `App\Services\Entitlements::FEATURES` (fallback para invitados/SSR). */
const REQUIRED: Record<string, PlanTier> = {
  read_no_ads: "premium",
  read_no_locks: "premium",
  smart_recommendations: "premium",
  premium_themes: "premium",
  extra_fonts: "premium",
  ai_audiobooks: "premium_plus",
  ai_voices: "premium_plus",
  advanced_profile: "premium_plus",
  early_access: "premium_plus",
  plus_badge: "premium_plus",
  creator_support: "premium_plus",
  book_summaries: "premium_plus",
  chapter_summaries: "premium_plus",
  priority_access: "premium_plus",
};
const COMING_SOON = new Set(["ai_audiobooks", "book_summaries", "chapter_summaries"]);
const RANK: Record<PlanTier, number> = { free: 0, premium: 1, premium_plus: 2 };

/**
 * Capa de entitlements en el cliente. La verdad la pone el backend (incluida en
 * `/api/user` → `user.entitlements`); si no está (invitado), cae al mapa local.
 * NO es seguridad: los endpoints sensibles validan server-side.
 */
export function useEntitlements() {
  const { user } = useAuth();
  const plan = (user?.plan ?? "free") as PlanTier;
  const ent = user?.entitlements;

  const requires = (f: string): PlanTier =>
    (ent?.[f]?.requires as PlanTier) ?? REQUIRED[f] ?? "premium_plus";

  const can = (f: string): boolean =>
    ent?.[f] ? ent[f].can : RANK[plan] >= RANK[requires(f)];

  const state = (f: string): FeatureState => {
    if (ent?.[f]) return ent[f].state as FeatureState;
    if (!can(f)) return requires(f) === "premium_plus" ? "requires_premium_plus" : "requires_premium";
    return COMING_SOON.has(f) ? "coming_soon" : "available";
  };

  return {
    plan,
    isPremium: RANK[plan] >= 1,
    isPremiumPlus: RANK[plan] >= 2,
    can,
    state,
    requires,
  };
}
