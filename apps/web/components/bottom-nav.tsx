"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, Search, Heart, User } from "lucide-react";
import { useSearch } from "@/components/search/search-context";
import { cn } from "@/lib/utils";

type Tab =
  | { label: string; href: string; icon: typeof Home; action?: undefined }
  | { label: string; icon: typeof Home; action: "search"; href?: undefined };

const tabs: Tab[] = [
  { label: "Inicio", href: "/", icon: Home },
  { label: "Catálogo", href: "/catalogo", icon: Library },
  { label: "Buscar", icon: Search, action: "search" },
  { label: "Biblioteca", href: "/biblioteca", icon: Heart },
  { label: "Cuenta", href: "/login", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const { setOpen } = useSearch();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/40 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div
        className="mx-auto grid max-w-md grid-cols-5"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = !tab.action && pathname === tab.href;
          const cls = cn(
            "flex flex-col items-center justify-center gap-1 px-2 py-2.5 text-[10px] font-medium transition-colors",
            active
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          );

          if (tab.action === "search") {
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => setOpen(true)}
                className={cls}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            );
          }

          return (
            <Link key={tab.href} href={tab.href!} className={cls}>
              <Icon
                className={cn("h-5 w-5 transition-transform", active && "scale-110")}
                strokeWidth={active ? 2.5 : 2}
              />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
