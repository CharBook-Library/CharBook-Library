"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { getClientToken } from "@/lib/auth";
import { locales, localeMeta, uiSupportedLocales, type Locale } from "@/i18n/config";

const LOCALE_COOKIE = "charbook_locale";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

export function LanguageSwitcher() {
  const currentLocale = useLocale() as Locale;
  const t = useTranslations("language");
  const [isPending, startTransition] = useTransition();

  const setLocale = (newLocale: Locale) => {
    if (newLocale === currentLocale) return;

    // 1) Cookie (1 año)
    setLocaleCookie(newLocale);

    // 2) Si está logueado, persiste también en el perfil del usuario
    if (getClientToken()) {
      apiClient
        .patch("/me/profile", { locale: newLocale })
        .catch(() => { /* silencioso: la cookie ya cambió */ });
    }

    // 3) Hard reload — Next.js cachea páginas y router.refresh() solo
    //    refresca server components pero NO recarga los messages de
    //    next-intl que se resuelven en `getRequestConfig` al inicio del
    //    request. Un location.reload garantiza re-leer todo.
    startTransition(() => {
      window.location.reload();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          className="h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
          aria-label={t("selector_label")}
        >
          <Globe className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            {currentLocale}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
          {t("selector_label")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {locales.map((loc) => {
          const meta = localeMeta[loc];
          const supported = (uiSupportedLocales as readonly Locale[]).includes(loc);
          const active = loc === currentLocale;
          return (
            <DropdownMenuItem
              key={loc}
              onClick={() => setLocale(loc)}
              disabled={!supported}
              className="cursor-pointer"
            >
              <span className="mr-2 text-lg leading-none">{meta.flag}</span>
              <div className="flex-1">
                <div className="font-medium">{meta.native}</div>
                {!supported && (
                  <div className="text-[10px] text-muted-foreground">próximamente</div>
                )}
              </div>
              {active && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
