import Link from "next/link";

interface ComingSoonProps {
  section: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  /** Lista corta de qué tendrá esta sección cuando esté lista. */
  preview?: string[];
  /** Link de "mientras tanto", a otra sección útil. */
  fallback?: { href: string; label: string };
}

export function ComingSoon({
  section,
  title,
  description,
  icon,
  preview,
  fallback,
}: ComingSoonProps) {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Studio
        </p>
        <h1 className="mt-1 font-serif text-2xl font-bold leading-tight tracking-tight md:text-3xl">
          {section}
        </h1>
      </header>

      <div className="mt-8 rounded-lg border border-dashed border-border/60 bg-card/40 p-8 md:p-10">
        <div className="flex items-start gap-4">
          <div className="rounded-md border border-border/60 bg-background p-3 text-muted-foreground shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-base font-bold leading-tight">
                {title}
              </h2>
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500 border border-amber-500/30">
                Próximamente
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>

            {preview && preview.length > 0 && (
              <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-4">
                {preview.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-xs text-muted-foreground"
                  >
                    <span className="mt-1.5 inline-block h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            )}

            {fallback && (
              <div className="mt-5">
                <Link
                  href={fallback.href}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Mientras tanto: {fallback.label} →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
