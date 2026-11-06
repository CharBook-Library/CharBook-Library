"use client";

import { apiClient } from "./api-client";
import type { ProfileBanner } from "./profile-banners";

export type { ProfileBanner };

/** Voces IA (placeholder — aún sin generación de audio real). */
export const AI_VOICES = [
  { key: "calida", name: "Voz narrativa cálida" },
  { key: "juvenil", name: "Voz juvenil" },
  { key: "profunda", name: "Voz profunda" },
  { key: "neutral", name: "Voz neutral" },
] as const;

export type AiVoice = (typeof AI_VOICES)[number]["key"];

/** Endpoints exclusivos de Premium Plus (validados también server-side). */
export const plusApi = {
  setVoice: (voice: AiVoice) =>
    apiClient.patch<{ voice: AiVoice }>("/me/plus/voice", { voice }).then((r) => r.data),
  setProfileBanner: (banner: ProfileBanner | null) =>
    apiClient.patch<{ banner: ProfileBanner | null }>("/me/plus/profile", { banner }).then((r) => r.data),
};
