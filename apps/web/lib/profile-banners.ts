/**
 * Fondos de perfil oficiales de CharBook Library (Premium Plus).
 * Las claves DEBEN coincidir con `PlusController::PROFILE_BANNERS` (backend).
 *
 * Cada fondo es un `background-image` CSS (gradientes multicapa + brillos suaves +
 * partículas/estrellas + líneas abstractas) — sin imágenes externas ni fotos.
 * Pensados para el tema oscuro de la app: sobrios, premium, con profundidad.
 */
export type ProfileBanner =
  | "aurora"
  | "biblioteca"
  | "oceano"
  | "bosque"
  | "pergamino"
  | "noche"
  | "obsidiana"
  | "dorado"
  | "nebulosa"
  | "atelier";

export interface ProfileBannerDef {
  key: ProfileBanner;
  name: string;
  /** Valor para `style={{ backgroundImage }}`. */
  image: string;
  /** Fondo claro (pergamino) → el texto encima debe ir oscuro. */
  light?: boolean;
}

export const PROFILE_BANNERS: ProfileBannerDef[] = [
  {
    key: "aurora",
    name: "Aurora",
    image:
      "radial-gradient(1.5px 1.5px at 14% 30%,rgba(255,255,255,.55),transparent 60%),radial-gradient(1px 1px at 32% 66%,rgba(255,255,255,.4),transparent 60%),radial-gradient(1.5px 1.5px at 72% 24%,rgba(255,255,255,.5),transparent 60%),radial-gradient(1px 1px at 88% 58%,rgba(255,255,255,.38),transparent 60%),radial-gradient(95% 150% at 16% 135%,rgba(56,189,248,.22),transparent 55%),radial-gradient(90% 145% at 86% -32%,rgba(139,92,246,.30),transparent 55%),linear-gradient(180deg,#0a0f1c,#080b13)",
  },
  {
    key: "biblioteca",
    name: "Biblioteca",
    image:
      "repeating-linear-gradient(90deg,rgba(255,222,165,.05) 0 1.5px,transparent 1.5px 26px),radial-gradient(85% 135% at 10% -18%,rgba(216,160,84,.26),transparent 55%),radial-gradient(75% 130% at 96% 125%,rgba(150,90,45,.22),transparent 55%),linear-gradient(180deg,#19120a,#0f0a06)",
  },
  {
    key: "oceano",
    name: "Océano",
    image:
      "radial-gradient(95% 135% at 82% -22%,rgba(14,165,233,.24),transparent 55%),radial-gradient(85% 125% at 6% 125%,rgba(20,175,160,.20),transparent 55%),radial-gradient(130% 80% at 50% 140%,rgba(8,92,142,.20),transparent 60%),linear-gradient(180deg,#06121e,#040a11)",
  },
  {
    key: "bosque",
    name: "Bosque",
    image:
      "radial-gradient(95% 135% at 22% -16%,rgba(16,185,129,.22),transparent 55%),radial-gradient(75% 125% at 97% 125%,rgba(18,112,82,.22),transparent 55%),radial-gradient(60% 90% at 55% 60%,rgba(40,140,90,.10),transparent 60%),linear-gradient(180deg,#08160f,#05100b)",
  },
  {
    key: "pergamino",
    name: "Pergamino",
    light: true,
    image:
      "repeating-linear-gradient(110deg,rgba(120,90,50,.05) 0 1px,transparent 1px 15px),radial-gradient(120% 145% at 50% -32%,rgba(251,244,225,.95),transparent 70%),radial-gradient(100% 120% at 82% 125%,rgba(214,188,140,.4),transparent 60%),linear-gradient(180deg,#ece2c9,#dccdaa)",
  },
  {
    key: "noche",
    name: "Noche",
    image:
      "radial-gradient(1.5px 1.5px at 20% 34%,rgba(220,228,255,.6),transparent 60%),radial-gradient(1px 1px at 44% 60%,rgba(220,228,255,.4),transparent 60%),radial-gradient(1.5px 1.5px at 76% 30%,rgba(220,228,255,.5),transparent 60%),radial-gradient(48% 135% at 86% -16%,rgba(180,200,255,.20),transparent 60%),radial-gradient(75% 95% at 28% 125%,rgba(70,62,140,.18),transparent 60%),linear-gradient(180deg,#0a0a15,#060609)",
  },
  {
    key: "obsidiana",
    name: "Obsidiana",
    image:
      "linear-gradient(115deg,transparent 42%,rgba(255,255,255,.07) 50%,transparent 58%),conic-gradient(from 210deg at 28% 24%,rgba(255,255,255,.05),transparent 22%,rgba(120,140,170,.08) 48%,transparent 72%,rgba(255,255,255,.04)),linear-gradient(135deg,#0d0e12,#070708)",
  },
  {
    key: "dorado",
    name: "Dorado Premium",
    image:
      "linear-gradient(118deg,transparent 40%,rgba(255,225,160,.10) 50%,transparent 60%),radial-gradient(85% 155% at 16% -28%,rgba(246,208,124,.32),transparent 55%),radial-gradient(72% 135% at 96% 128%,rgba(172,122,56,.26),transparent 55%),linear-gradient(125deg,#181308,#0c0a05)",
  },
  {
    key: "nebulosa",
    name: "Nebulosa",
    image:
      "radial-gradient(1.5px 1.5px at 18% 30%,rgba(255,255,255,.55),transparent 60%),radial-gradient(1px 1px at 62% 58%,rgba(255,255,255,.4),transparent 60%),radial-gradient(1.5px 1.5px at 84% 36%,rgba(255,255,255,.5),transparent 60%),radial-gradient(60% 95% at 24% 30%,rgba(139,92,246,.32),transparent 55%),radial-gradient(58% 85% at 82% 66%,rgba(192,82,172,.26),transparent 55%),radial-gradient(52% 72% at 60% 4%,rgba(56,120,220,.22),transparent 55%),linear-gradient(180deg,#0b0814,#06050c)",
  },
  {
    key: "atelier",
    name: "Atelier",
    image:
      "repeating-linear-gradient(122deg,rgba(217,170,90,.07) 0 1px,transparent 1px 21px),radial-gradient(80% 150% at 13% -26%,rgba(219,172,92,.26),transparent 55%),radial-gradient(62% 115% at 93% 122%,rgba(140,100,50,.18),transparent 55%),linear-gradient(180deg,#110e09,#0a0807)",
  },
];

export const PROFILE_BANNER_IMAGE: Record<ProfileBanner, string> = Object.fromEntries(
  PROFILE_BANNERS.map((b) => [b.key, b.image]),
) as Record<ProfileBanner, string>;

export const PROFILE_BANNER_LIGHT: Record<ProfileBanner, boolean> = Object.fromEntries(
  PROFILE_BANNERS.map((b) => [b.key, !!b.light]),
) as Record<ProfileBanner, boolean>;
