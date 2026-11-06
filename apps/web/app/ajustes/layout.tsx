"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UserCircle, Shield, Bell, CreditCard, Languages, Smartphone, UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const groups = [
  {
    label: "Cuenta",
    items: [
      { href: "/ajustes/perfil", label: "Perfil", icon: UserCircle },
      { href: "/ajustes/seguridad", label: "Seguridad y 2FA", icon: Shield },
      { href: "/ajustes/dispositivos", label: "Dispositivos", icon: Smartphone },
    ],
  },
  {
    label: "Preferencias",
    items: [
      { href: "/ajustes/preferencias", label: "Preferencias", icon: Languages },
      { href: "/ajustes/notificaciones-ajustes", label: "Notificaciones", icon: Bell },
    ],
  },
  {
    label: "Plan",
    items: [
      { href: "/ajustes/suscripciones", label: "Suscripción", icon: CreditCard },
    ],
  },
  {
    label: "Social",
    items: [
      { href: "/ajustes/solicitudes", label: "Solicitudes", icon: UserPlus },
    ],
  },
];

export default function AjustesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Administra tu cuenta, seguridad y preferencias.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <aside className="md:sticky md:top-20 md:self-start">
          <nav className="space-y-4">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  {g.label}
                </div>
                <ul className="space-y-0.5">
                  {g.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + "/");
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link href={item.href}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                            active
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground"
                          )}>
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
