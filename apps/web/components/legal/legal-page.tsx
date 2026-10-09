import Link from "next/link";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

/**
 * Plantilla compartida de páginas legales (Términos / Privacidad): hero sobrio,
 * índice de contenidos con anclas y secciones numeradas legibles.
 */
export function LegalPage({
  kind,
  title,
  updatedAt,
  intro,
  sections,
}: {
  kind: "terms" | "privacy";
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
}) {
  const Icon = kind === "terms" ? FileText : ShieldCheck;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Volver al inicio
      </Link>

      {/* ───── Hero ───── */}
      <header className="border-b border-border/60 pb-8">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.07]">
          <Icon className="h-6 w-6 text-primary" strokeWidth={1.75} />
        </span>
        <h1 className="mt-5 font-serif text-3xl font-bold tracking-tight md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
          Última actualización: {updatedAt}
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {intro}
        </p>
      </header>

      {/* ───── Índice ───── */}
      <nav aria-label="Índice" className="mt-8 rounded-xl border border-border/60 bg-card p-5">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Contenido
        </p>
        <ol className="grid gap-1.5 sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex items-baseline gap-2 text-sm text-foreground/80 hover:text-primary"
              >
                <span className="text-xs tabular-nums text-muted-foreground/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* ───── Secciones ───── */}
      <div className="mt-10 space-y-10">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <h2 className="flex items-baseline gap-3 font-serif text-xl font-bold tracking-tight">
              <span className="text-sm tabular-nums text-primary/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              {s.title}
            </h2>
            <div className="prose-legal mt-3 space-y-3 text-sm leading-relaxed text-foreground/85">
              {s.body}
            </div>
          </section>
        ))}
      </div>

      {/* ───── Pie ───── */}
      <footer className="mt-14 rounded-xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">
        ¿Dudas sobre este documento? Escríbenos a{" "}
        <a href="mailto:soporte@charbook.app" className="font-medium text-primary hover:underline">
          soporte@charbook.app
        </a>
        . También puedes leer {kind === "terms" ? (
          <Link href="/privacidad" className="font-medium text-primary hover:underline">
            nuestra Política de Privacidad
          </Link>
        ) : (
          <Link href="/terminos" className="font-medium text-primary hover:underline">
            nuestros Términos de Servicio
          </Link>
        )}
        .
      </footer>
    </div>
  );
}
