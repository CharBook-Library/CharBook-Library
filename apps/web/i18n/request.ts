import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import {
  defaultLocale,
  normalizeLocale,
  pickLocaleFromAcceptLanguage,
  uiSupportedLocales,
  type Locale,
} from "./config";

const LOCALE_COOKIE = "charbook_locale";

function normalizeUiLocale(value?: string | null): Locale {
  const locale = normalizeLocale(value);
  return (uiSupportedLocales as readonly Locale[]).includes(locale) ? locale : defaultLocale;
}

/**
 * Resuelve el locale activo en cada request.
 * Prioridad: cookie > Accept-Language > defaultLocale ('es').
 */
export default getRequestConfig(async () => {
  let locale: Locale = defaultLocale;

  // 1) Cookie del usuario
  try {
    const cookieStore = await cookies();
    const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
    if (fromCookie) {
      locale = normalizeUiLocale(fromCookie);
    } else {
      // 2) Accept-Language del navegador
      const h = await headers();
      const acceptLang = h.get("accept-language");
      locale = pickLocaleFromAcceptLanguage(acceptLang);
    }
  } catch {
    // Fallback silencioso si no hay request context
  }

  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});

export { LOCALE_COOKIE };
