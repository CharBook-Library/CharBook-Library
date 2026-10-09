import Link from "next/link";
import { Settings, User, BadgeCheck, ShieldCheck, ArrowUpRight } from "lucide-react";

export default function StudioSettingsPage() {
  const sections = [
    {
      href: "/ajustes/perfil",
      icon: <User className="h-4 w-4" />,
      title: "Perfil público",
      description: "Nombre, username, biografía y visibilidad",
    },
    {
      href: "/verificacion",
      icon: <BadgeCheck className="h-4 w-4" />,
      title: "Verificación",
      description: "Solicita la insignia de Autor Verificado",
    },
    {
      href: "/ajustes/solicitudes",
      icon: <ShieldCheck className="h-4 w-4" />,
      title: "Solicitudes de seguimiento",
      description: "Acepta o rechaza solicitudes pendientes",
    },
  ];

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Studio
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold leading-tight tracking-tight md:text-3xl">
          Configuración
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu cuenta y tu Atelier, en un solo lugar.
        </p>
      </header>

      <ul className="mt-8 divide-y divide-border/60 rounded-lg border border-border/60 bg-card">
        {sections.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-accent/40"
            >
              <div className="rounded-md border border-border/60 bg-background p-2 text-muted-foreground shrink-0">
                {s.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.description}
                </p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
