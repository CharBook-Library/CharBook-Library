import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/playfair-display";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";
import { BottomNav } from "@/components/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { SearchProvider } from "@/components/search/search-context";
import { CommandPaletteLoader } from "@/components/search/command-palette-loader";
import { GlobalTextLocalizer } from "@/components/i18n/global-text-localizer";

export const metadata: Metadata = {
  title: {
    default: "CharBook Library — Tu biblioteca digital moderna",
    template: "%s | CharBook Library",
  },
  description:
    "Descubre, lee y guarda miles de libros clásicos. Una biblioteca digital moderna con experiencia premium en móvil y desktop.",
  keywords: [
    "biblioteca digital",
    "libros gratis",
    "leer online",
    "clásicos",
    "EPUB",
    "PDF",
  ],
  openGraph: {
    title: "CharBook Library",
    description: "Tu biblioteca digital moderna",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className="dark"
    >
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <SearchProvider>
              <div className="flex min-h-dvh flex-col">
                <SiteHeader />
                <main className="flex-1 pb-20 md:pb-0">{children}</main>
                <BottomNav />
              </div>
              <CommandPaletteLoader />
              <Toaster richColors />
            </SearchProvider>
            <GlobalTextLocalizer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
