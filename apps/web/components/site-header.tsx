"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Search,
  User,
  LogOut,
  Shield,
  Library,
  ListMusic,
  UserCircle,
  Settings,
  Feather,
  CheckCircle2,
  UserPlus,
  Crown,
  Sparkles,
  Coins,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { socialApi } from "@/lib/api-social";
import { monetizationApi } from "@/lib/api-monetization";
import { NotificationsDropdown } from "@/components/inbox/notifications-dropdown";
import { MessagesDropdown } from "@/components/inbox/messages-dropdown";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useSearch } from "@/components/search/search-context";
import { preloadCommandPalette } from "@/components/search/command-palette-loader";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();

  const isImmersiveReader =
    pathname?.startsWith("/leer/") ||
    /^\/libro\/[^/]+\/(capitulo|leer)/.test(pathname ?? "");
  if (isImmersiveReader) return null;

  return <SiteHeaderContent pathname={pathname} />;
}

function SiteHeaderContent({ pathname }: { pathname: string | null }) {
  const { user, isLoading, isAuthenticated, isAdmin, isModerator, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const showAdminLink = isAdmin || isModerator;
  const { setOpen: setSearchOpen } = useSearch();
  const tNav = useTranslations("nav");
  const tHeader = useTranslations("header");
  const subscriptionTier = user?.subscription_tier ?? "free";
  const isPremiumMember = subscriptionTier === "premium" || subscriptionTier === "premium_plus";

  // Saldo de CharCoins para el acceso rápido del menú (silencioso si falla)
  const { data: walletInfo } = useQuery({
    queryKey: ["header-wallet"],
    queryFn: () => monetizationApi.wallet(),
    enabled: isAuthenticated && userMenuOpen,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const coinBalance = walletInfo
    ? walletInfo.premium_balance + walletInfo.reward_balance
    : null;

  const navLinks = [
    { label: tNav("home"), href: "/" },
    { label: tNav("catalog"), href: "/catalogo" },
    { label: tNav("creators"), href: "/creadores" },
    { label: tNav("community"), href: "/comunidad" },
    ...(!isPremiumMember ? [{ label: "Premium", href: "/premium" }] : []),
    { label: tNav("free"), href: "/catalogo?access_type=free" },
  ];

  // Solo tiene sentido pollar el contador si el perfil es privado
  // (los públicos no reciben solicitudes — se siguen directamente)
  const { data: pendingRequests } = useQuery({
    queryKey: ["follow-requests-count"],
    queryFn: () => socialApi.followRequests.count(),
    enabled: isAuthenticated && user?.is_public_profile === false,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-amber-400 shadow-sm transition-transform group-hover:scale-105">
            <BookOpen className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="hidden sm:block">
            <div className="font-serif text-lg font-bold leading-none tracking-tight">
              CharBook
            </div>
            <div className="text-[10px] uppercase tracking-widest text-primary/80">
              Library
            </div>
          </div>
        </Link>

        {/* Nav desktop */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const active = pathname === link.href.split("?")[0];
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Search desktop (con shortcut visible) */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            onFocus={preloadCommandPalette}
            onPointerEnter={preloadCommandPalette}
            className="hidden h-9 items-center gap-2 rounded-md border border-border/60 bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground md:flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span>{tHeader("search_placeholder")}</span>
            <kbd className="ml-2 inline-flex items-center rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-medium">
              ⌘K
            </kbd>
          </button>

          {/* Search móvil (solo icono) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            onFocus={preloadCommandPalette}
            onPointerEnter={preloadCommandPalette}
            className="text-muted-foreground hover:text-foreground md:hidden"
            aria-label={tHeader("search_aria")}
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Inbox: notificaciones + mensajes */}
          {isAuthenticated && (
            <>
              <NotificationsDropdown />
              <MessagesDropdown />
            </>
          )}

          {/* Selector de idioma */}
          <LanguageSwitcher />

          {isPremiumMember ? (
            subscriptionTier === "premium_plus" ? (
              <Link
                href="/ajustes/suscripciones"
                title="Premium Plus activo · ver mi membresía"
                aria-label="Premium Plus activo"
                className="member-chip-plus hidden h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold tracking-wide transition-transform hover:scale-[1.03] lg:inline-flex"
              >
                <Sparkles className="h-3.5 w-3.5 animate-premium-float" />
                Plus
              </Link>
            ) : (
              <Link
                href="/ajustes/suscripciones"
                title="Premium activo · ver mi membresía"
                aria-label="Premium activo"
                className="member-chip-premium hidden h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold tracking-wide transition-transform hover:scale-[1.03] lg:inline-flex"
              >
                <Crown className="h-3.5 w-3.5" />
                Premium
              </Link>
            )
          ) : (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden border-primary/40 text-primary hover:bg-primary/10 hover:text-primary lg:inline-flex"
            >
              <Link href="/premium">
                <Crown className="mr-1.5 h-3.5 w-3.5" />
                Premium
              </Link>
            </Button>
          )}

          {isLoading ? (
            <Skeleton className="h-9 w-9 rounded-full" />
          ) : isAuthenticated && user ? (
            <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full p-0.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={tHeader("user_menu_aria")}
                >
                  <Avatar className="h-9 w-9 border border-primary/30">
                    <AvatarImage src={user.avatar ?? undefined} alt={user.name} />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {user.name?.[0]?.toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-medium">{user.name}</div>
                  <div className="truncate text-xs font-normal text-muted-foreground">
                    {user.email}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* Acceso rápido a CharCoins: saldo + ir a comprar/ganar */}
                <DropdownMenuItem asChild>
                  <Link
                    href="/charcoins"
                    className="cursor-pointer justify-between"
                    aria-label="Tus CharCoins — comprar o ganar más"
                  >
                    <span className="flex items-center">
                      <Coins className="mr-2 h-4 w-4 text-primary" />
                      {coinBalance !== null ? `${coinBalance} CharCoins` : "CharCoins"}
                    </span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-sm font-bold leading-none text-primary">
                      +
                    </span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {user.username && (
                  <DropdownMenuItem asChild>
                    <Link href={`/u/${user.username}`} className="cursor-pointer">
                      <UserCircle className="mr-2 h-4 w-4" />
                      {tHeader("my_atelier")}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/biblioteca" className="cursor-pointer">
                    <Library className="mr-2 h-4 w-4" />
                    {tHeader("my_library")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/antologias" className="cursor-pointer">
                    <ListMusic className="mr-2 h-4 w-4" />
                    {tHeader("my_anthologies")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/ajustes/perfil" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    {tHeader("edit_profile")}
                  </Link>
                </DropdownMenuItem>

                {user?.is_public_profile === false && (
                  <DropdownMenuItem asChild>
                    <Link
                      href="/ajustes/solicitudes"
                      className="cursor-pointer flex items-center justify-between"
                    >
                      <span className="flex items-center">
                        <UserPlus className="mr-2 h-4 w-4" />
                        {tHeader("requests")}
                      </span>
                      {pendingRequests && pendingRequests > 0 ? (
                        <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold h-5 min-w-5 px-1.5">
                          {pendingRequests}
                        </span>
                      ) : null}
                    </Link>
                  </DropdownMenuItem>
                )}

                {/* === Creator flow === */}
                <DropdownMenuSeparator />
                {user?.is_creator || user?.roles?.includes("creator") ? (
                  <DropdownMenuItem asChild>
                    <Link href="/studio" className="cursor-pointer">
                      <Feather className="mr-2 h-4 w-4 text-primary" />
                      <span className="text-primary">{tHeader("my_studio")}</span>
                    </Link>
                  </DropdownMenuItem>
                ) : user?.creator_status === "pending" || user?.creator_status === "changes_requested" ? (
                  <DropdownMenuItem asChild>
                    <Link href="/mi-solicitud" className="cursor-pointer">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-amber-400" />
                      <span>{tHeader("my_application")}</span>
                    </Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link href="/convertirme-en-creador" className="cursor-pointer">
                      <Feather className="mr-2 h-4 w-4 text-primary" />
                      <span>{tHeader("become_creator")}</span>
                    </Link>
                  </DropdownMenuItem>
                )}

                {showAdminLink && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4 text-primary" />
                      <span className="text-primary">
                        {isAdmin ? tHeader("admin_panel") : tHeader("mod_panel")}
                      </span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {tHeader("sign_out")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              size="sm"
              asChild
              className="hidden bg-primary text-primary-foreground hover:bg-primary/90 md:inline-flex"
            >
              <Link href="/login">
                <User className="mr-1.5 h-4 w-4" />
                {tHeader("sign_in")}
              </Link>
            </Button>
          )}

          {!isAuthenticated && (
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="text-muted-foreground md:hidden"
            >
              <Link href="/login" aria-label={tHeader("account_aria")}>
                <User className="h-5 w-5" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
