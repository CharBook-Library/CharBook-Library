export const locales = ["es", "en", "pt", "fr", "de", "it", "ja"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "es";

/** Locales con UI 100% traducida (resto serán placeholder). */
export const uiSupportedLocales: Locale[] = ["es", "en"];

export const localeMeta: Record<Locale, { native: string; en: string; flag: string }> = {
  es: { native: "Español", en: "Spanish", flag: "🇪🇸" },
  en: { native: "English", en: "English", flag: "🇺🇸" },
  pt: { native: "Português", en: "Portuguese", flag: "🇧🇷" },
  fr: { native: "Français", en: "French", flag: "🇫🇷" },
  de: { native: "Deutsch", en: "German", flag: "🇩🇪" },
  it: { native: "Italiano", en: "Italian", flag: "🇮🇹" },
  ja: { native: "日本語", en: "Japanese", flag: "🇯🇵" },
};

/**
 * Normaliza un Accept-Language o cualquier string locale (ej. "es-MX", "en-GB")
 * al locale base soportado.
 */
export function normalizeLocale(input?: string | null): Locale {
  if (!input) return defaultLocale;
  const base = input.toLowerCase().split(/[-_]/)[0];
  return (locales as readonly string[]).includes(base) ? (base as Locale) : defaultLocale;
}

/**
 * Extrae el mejor locale del header Accept-Language.
 * Ej: "es-MX,es;q=0.9,en;q=0.8" → "es"
 */
export function pickLocaleFromAcceptLanguage(acceptLang?: string | null): Locale {
  if (!acceptLang) return defaultLocale;
  const candidates = acceptLang
    .split(",")
    .map((part) => {
      const [tag, qStr] = part.trim().split(";q=");
      return { tag, q: qStr ? parseFloat(qStr) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of candidates) {
    const normalized = normalizeLocale(tag);
    if ((uiSupportedLocales as readonly string[]).includes(normalized)) {
      return normalized;
    }
  }
  return defaultLocale;
}
