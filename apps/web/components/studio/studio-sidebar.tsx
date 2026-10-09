"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BookText,
  BarChart3,
  MessageSquare,
  Heart,
  CircleDollarSign,
  Megaphone,
  Bell,
  Settings,
  Plus,
  Menu,
  X,
  BadgeCheck,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/studio/obras", label: "Mis Obras", icon: BookText },
  { href: "/studio/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { href: "/studio/comentarios", label: "Comentarios", icon: MessageSquare },
  { href: "/studio/seguidores", label: "Seguidores", icon: Heart },
  { href: "/studio/monetizacion", label: "Monetización", icon: CircleDollarSign },
  { href: "/studio/anuncios", label: "Anuncios", icon: Megaphone },
  { href: "/studio/notificaciones", label: "Notificaciones", icon: Bell },
  { href: "/studio/configuracion", label: "Configuración", icon: Settings },
];

export function StudioSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isVerified = user?.is_creator || user?.roles?.includes("creator");

  return (
    <>
      {/* ───────── MOBILE TOPBAR ───────── */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-background/95 backdrop-blur-md px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-serif text-sm font-bold">Studio</span>
        <Link
          href="/studio/obras/nueva"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Nueva
        </Link>
      </div>

      {/* ───────── MOBILE OVERLAY ───────── */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ───────── SIDEBAR ───────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border/60 bg-card transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header del sidebar */}
        <div className="flex h-14 items-center justify-between border-b border-border/60 px-5">
          <Link href="/studio" className="font-serif text-lg font-bold tracking-tight">
            Studio
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Perfil */}
        <div className="border-b border-border/60 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-border/60">
              {user?.avatar ? (
                <Image
                  src={user.avatar}
                  alt={user.name}
                  fill
                  sizes="44px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/20 font-medium text-primary">
                  {user?.name?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="line-clamp-1 text-sm font-medium">{user?.name}</p>
                {isVerified && (
                  <BadgeCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                )}
              </div>
              {user?.username && (
                <Link
                  href={`/u/${user.username}`}
                  className="line-clamp-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  @{user.username}
                </Link>
              )}
            </div>
          </div>

          {/* CTA Nueva Obra */}
          <Link
            href="/studio/obras/nueva"
            onClick={() => setMobileOpen(false)}
            className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Nueva Obra
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href !== "/studio" && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {active && <ChevronRight className="h-3 w-3" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-border/60 px-5 py-3">
          {!isVerified ? (
            <Link
              href="/verificacion"
              className="block rounded-md bg-emerald-400/10 px-3 py-2 text-xs text-emerald-400 hover:bg-emerald-400/20"
            >
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-3.5 w-3.5" />
                <span className="font-medium">Verifica tu perfil</span>
              </div>
              <p className="mt-0.5 text-[10px] text-emerald-400/70">
                Obtén la insignia oficial
              </p>
            </Link>
          ) : (
            <p className="text-[10px] text-muted-foreground/70">
              Autor verificado ✓ Plan gratuito
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
