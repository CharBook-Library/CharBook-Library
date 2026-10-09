"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Library,
  Plus,
  Users,
  Tags,
  ExternalLink,
  Shield,
  UserCheck,
  Flag,
  User as UserIcon,
  KeyRound,
  Upload,
  Megaphone,
  CircleDollarSign,
  Activity,
  ListOrdered,
  ScrollText,
  BellRing,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { AuthUser } from "@/lib/auth-server";

// Grupos visuales para mayor claridad
const navGroups: Array<{
  label: string | null;
  items: Array<{
    label: string;
    href: string;
    icon: typeof LayoutDashboard;
    exact?: boolean;
    superAdminOnly?: boolean;
  }>;
}> = [
  {
    label: null,
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { label: "Libros", href: "/admin/libros", icon: Library },
      { label: "Nuevo libro", href: "/admin/libros/nuevo", icon: Plus },
      { label: "Obras subidas", href: "/admin/obras-subidas", icon: Upload },
      { label: "Autores", href: "/admin/autores", icon: Users },
      { label: "Categorías", href: "/admin/categorias", icon: Tags },
    ],
  },
  {
    label: "Comunidad",
    items: [
      { label: "Usuarios", href: "/admin/usuarios", icon: UserIcon },
      { label: "Solicitudes Creador", href: "/admin/solicitudes-creador", icon: UserCheck },
      { label: "Reportes", href: "/admin/reportes", icon: Flag },
    ],
  },
  {
    label: "Comunicaciones",
    items: [
      { label: "Difusión", href: "/admin/notificaciones", icon: Megaphone },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { label: "Monetización", href: "/admin/monetizacion", icon: CircleDollarSign },
    ],
  },
  {
    label: "Sistema",
    items: [
      { label: "Roles y permisos", href: "/admin/roles", icon: KeyRound },
      { label: "Salud del sistema", href: "/admin/sistema", icon: Activity, superAdminOnly: true },
      { label: "Alertas", href: "/admin/alertas", icon: BellRing, superAdminOnly: true },
      { label: "Colas y jobs", href: "/admin/colas", icon: ListOrdered, superAdminOnly: true },
      { label: "Auditoría", href: "/admin/auditoria", icon: ScrollText, superAdminOnly: true },
    ],
  },
];

export function AdminSidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname();

  return (
    <aside className="border-b border-border/40 bg-sidebar md:sticky md:top-16 md:h-[calc(100dvh-4rem)] md:overflow-y-auto md:border-b-0 md:border-r">
      <div className="flex min-h-full flex-col gap-1 p-4">
        {/* Badge admin */}
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            Panel Admin
          </span>
        </div>

        {/* Nav links agrupados */}
        <nav className="flex flex-col gap-3">
          {navGroups.map((group, gi) => (
            <div key={gi} className="flex flex-col gap-0.5">
              {group.label && (
                <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </div>
              )}
              {group.items.map(({ label, href, icon: Icon, exact, superAdminOnly }) => {
                if (superAdminOnly && !user.is_super_admin) return null;
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={active ? 2.5 : 2} />
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Volver al sitio */}
        <Link
          href="/"
          className="mt-3 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
          Ver sitio público
        </Link>

        {/* User */}
        <div className="mt-auto hidden items-center gap-2.5 rounded-md border border-border/40 bg-card px-3 py-2 md:flex">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar ?? undefined} alt={user.name} />
            <AvatarFallback className="bg-primary/20 text-xs text-primary">
              {user.name?.[0]?.toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-[10px] text-muted-foreground">
              {user.email}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
