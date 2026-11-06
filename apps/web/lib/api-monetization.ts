"use client";

import { apiClient } from "./api-client";
import type { WorkMonetization } from "./types";

/** Cliente de la capa de monetización (espejo de routes/api.php). */

export interface WalletInfo {
  premium_balance: number;
  reward_balance: number;
  plan: "premium" | "premium_plus" | null;
  reward_limits: {
    daily_cap: number;
    earned_today: number;
    ad_daily_cap: number;
    ads_today: number;
    max_pct_per_unlock: number;
  };
}

export interface CoinPackage {
  id: number;
  name: string;
  coins: number;
  bonus_coins: number;
  price_usd: string;
  stripe_price_id?: string | null;
  is_active: boolean;
  sort?: number;
}

export interface ChapterAccess {
  chapter_id: number;
  number: number;
  coin_price: number;
  access: boolean;
  reason: string;
  early_access: boolean;
  /** "Esperar para desbloquear" gratis: disponible en capítulos de pago normales. */
  wait_available?: boolean;
  /** Horas de espera configuradas para desbloqueo gratis. */
  wait_hours?: number;
  /** ISO8601 — si el lector ya reservó, cuándo queda disponible gratis. */
  wait_until?: string | null;
  /** Lectura secuencial: cuando reason === "locked_sequential", la "puerta" a pagar. */
  gate_number?: number;
  gate_chapter_id?: number;
  gate_price?: number;
}

export interface WorkMonetizationInput extends WorkMonetization {
  in_unlimited_catalog?: boolean;
  chapters?: Array<{
    id: number;
    coin_price: number;
    early_access_until: string | null;
  }>;
}

export type MonetizationSettings = Record<string, unknown>;

export type CoinPackageInput = Partial<
  Pick<
    CoinPackage,
    "name" | "coins" | "bonus_coins" | "price_usd" | "stripe_price_id" | "is_active" | "sort"
  >
>;

export const monetizationApi = {
  // ===== Lector =====
  wallet: () => apiClient.get<WalletInfo>("/wallet").then((r) => r.data),
  walletTransactions: (page = 1) =>
    apiClient.get("/wallet/transactions", { params: { page } }).then((r) => r.data),
  packages: () =>
    apiClient.get<{ data: CoinPackage[] }>("/coin-packages").then((r) => r.data.data),

  bookAccess: (slug: string) =>
    apiClient
      .get<{
        data: ChapterAccess[];
        monetization: WorkMonetization & { in_unlimited_catalog?: boolean };
        plan: string | null;
      }>(`/books/${slug}/access`)
      .then((r) => r.data),

  unlockChapter: (chapterId: number, useReward: number, idempotencyKey: string) =>
    apiClient
      .post(`/chapters/${chapterId}/unlock`, {
        use_reward: useReward,
        idempotency_key: idempotencyKey,
      })
      .then((r) => r.data),

  /** Reserva el capítulo para que se desbloquee gratis tras la espera. */
  startWaitUnlock: (chapterId: number) =>
    apiClient
      .post<{ unlocks_at: string; wait_hours: number }>(`/chapters/${chapterId}/wait-unlock`, {})
      .then((r) => r.data),

  unlockPack: (slug: string, size: number, fromChapter: number, useReward: number, idempotencyKey: string) =>
    apiClient
      .post(`/books/${slug}/unlock-pack`, {
        size,
        from_chapter: fromChapter,
        use_reward: useReward,
        idempotency_key: idempotencyKey,
      })
      .then((r) => r.data),

  myUnlocks: (page = 1) => apiClient.get("/me/unlocks", { params: { page } }).then((r) => r.data),

  checkout: (input: { package_id?: number; plan?: "premium" | "premium_plus" }) =>
    apiClient.post<{ url: string }>("/billing/checkout", input).then((r) => r.data),

  /** Stripe Customer Portal: gestionar suscripción, métodos de pago y facturas. */
  billingPortal: () =>
    apiClient.post<{ url: string }>("/billing/portal").then((r) => r.data),

  subscription: () => apiClient.get("/me/billing/subscription").then((r) => r.data.data),

  dailyLogin: () => apiClient.post<{ granted: number }>("/rewards/daily-login").then((r) => r.data),

  adSession: (placement: "catalog" | "profile" | "reward_screen" | "between_chapters") =>
    apiClient.post("/ads/session", { placement }).then((r) => r.data),

  readingEvent: (input: { book_id: number; chapter_id?: number; milestone: string; seconds: number; scroll_pct: number }) =>
    apiClient.post("/reading-events", input).then((r) => r.data),

  secureFile: (slug: string) =>
    apiClient.get<{ url: string; expires_in: number }>(`/books/${slug}/secure-file`).then((r) => r.data),

  // ===== Creador =====
  creator: {
    wallet: () => apiClient.get("/me/creator/wallet").then((r) => r.data),
    earnings: (days = 30) => apiClient.get("/me/creator/earnings", { params: { days } }).then((r) => r.data),
    transactions: (page = 1) => apiClient.get("/me/creator/transactions", { params: { page } }).then((r) => r.data),
    connect: () => apiClient.post<{ url: string }>("/me/creator/connect").then((r) => r.data),
    connectStatus: () => apiClient.get("/me/creator/connect/status").then((r) => r.data),
    requestPayout: () => apiClient.post("/me/creator/payouts").then((r) => r.data),
    payouts: (page = 1) => apiClient.get("/me/creator/payouts", { params: { page } }).then((r) => r.data),
    updateWorkMonetization: (workId: number, input: WorkMonetizationInput) =>
      apiClient.patch(`/me/works/${workId}/monetization`, input).then((r) => r.data),
  },

  // ===== Admin =====
  admin: {
    settings: () => apiClient.get("/admin/monetization/settings").then((r) => r.data),
    updateSettings: (settings: MonetizationSettings) =>
      apiClient.put("/admin/monetization/settings", { settings }).then((r) => r.data),
    packages: () => apiClient.get("/admin/coin-packages").then((r) => r.data.data),
    storePackage: (input: CoinPackageInput) => apiClient.post("/admin/coin-packages", input).then((r) => r.data.data),
    updatePackage: (id: number, input: CoinPackageInput) =>
      apiClient.patch(`/admin/coin-packages/${id}`, input).then((r) => r.data.data),
    financeOverview: () => apiClient.get("/admin/finance/overview").then((r) => r.data),
    payouts: (status?: string) =>
      apiClient.get("/admin/payouts", { params: { status } }).then((r) => r.data),
    payoutAction: (id: number, action: "retry" | "reject") =>
      apiClient.patch(`/admin/payouts/${id}`, { action }).then((r) => r.data),
    runCreatorFund: (month?: string) =>
      apiClient.post("/admin/creator-fund/run", { month }).then((r) => r.data),
  },
};
