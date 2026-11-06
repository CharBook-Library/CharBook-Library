import type { Metadata } from "next";
import Link from "next/link";
import {
  Feather,
  BookOpen,
  Sparkles,
  Users,
  TrendingUp,
  Heart,
  ArrowRight,
  Megaphone,
  CalendarDays,
  Lightbulb,
  Folder,
  Globe2,
  PenLine,
  Upload,
  UsersRound,
  BadgeCheck,
  Trophy,
  ShieldCheck,
  Eye,
  Search,
  Gem,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Publica tus historias en CharBook",
  description:
    "Crea, publica y construye tu comunidad de lectores. Cualquier persona puede comenzar a compartir sus obras desde el primer día.",
};

export default function CreatorsLandingPage() {
  return (
    <div className="min-h-screen">
      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/15 via-primary/5 to-transparent pointer-events-none" />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge
                variant="outline"
                className="border-amber-400/60 bg-amber-400/10 text-amber-500 gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Publica desde el primer día
              </Badge>
              <h1 className="mt-5 font-serif text-4xl font-bold tracking-tight leading-tight md:text-5xl lg:text-6xl">
                Publica tus historias
                <br />
                <span className="bg-gradient-to-r from-amber-400 via-primary to-rose-400 bg-clip-text text-transparent">
                  en CharBook.
                </span>
              </h1>
              <p className="mt-5 max-w-prose text-base leading-relaxed text-muted-foreground md:text-lg">
                Crea, publica y construye tu comunidad de lectores. En CharBook
                cualquier persona puede comenzar a compartir sus obras desde el
                primer día.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-6 shadow-lg shadow-primary/20"
                >
                  <Link href="/studio">
                    <PenLine className="mr-2 h-4 w-4" />
                    Publicar mi primera obra
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-base">
                  <Link href="#niveles">Conocer la verificación</Link>
                </Button>
              </div>
              <p className="mt-4 text-[11px] text-muted-foreground/70">
                Sin postulaciones · Sin esperas · Conservas todos los derechos
              </p>
            </div>

            {/* Visual flotante */}
            <div className="hidden lg:block">
              <div className="relative aspect-square max-w-md mx-auto">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-400/30 via-primary/20 to-rose-400/15 blur-3xl" />
                <div className="relative grid grid-cols-2 gap-4 p-8">
                  <FloatingCard
                    icon={<PenLine className="h-5 w-5" />}
                    label="Escribe"
                    color="amber"
                  />
                  <FloatingCard
                    icon={<Upload className="h-5 w-5" />}
                    label="Publica"
                    color="primary"
                    delay
                  />
                  <FloatingCard
                    icon={<UsersRound className="h-5 w-5" />}
                    label="Comunidad"
                    color="rose"
                    delay
                  />
                  <FloatingCard
                    icon={<BadgeCheck className="h-5 w-5" />}
                    label="Verificación"
                    color="emerald"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ CÓMO FUNCIONA — 4 PASOS ═══════════════════ */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <div className="text-center">
          <Badge variant="outline" className="border-primary/40 text-primary gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Empieza en minutos
          </Badge>
          <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight md:text-4xl">
            ¿Cómo funciona?
          </h2>
          <p className="mt-3 mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
            Cuatro pasos simples, sin trámites ni esperas.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StepCard
            step="1"
            icon={<UsersRound className="h-5 w-5" />}
            title="Crea tu cuenta"
            body="Regístrate gratuitamente y crea tu perfil de creador. Bastan tu nombre y un email."
          />
          <StepCard
            step="2"
            icon={<Upload className="h-5 w-5" />}
            title="Publica tu primera obra"
            body="Sube novelas, cuentos, ensayos, poesía o cualquier obra original en PDF o EPUB."
          />
          <StepCard
            step="3"
            icon={<Heart className="h-5 w-5" />}
            title="Construye tu comunidad"
            body="Recibe seguidores, reseñas, favoritos y comentarios de lectores apasionados."
          />
          <StepCard
            step="4"
            icon={<BadgeCheck className="h-5 w-5" />}
            title="Obtén la verificación"
            body="Los creadores que demuestren originalidad, constancia y calidad pueden solicitar la insignia de Autor Verificado."
            accent
          />
        </div>
      </section>

      {/* ═══════════════════ NIVELES DE LA COMUNIDAD ═══════════════════ */}
      <section id="niveles" className="border-y border-border/40 bg-gradient-to-br from-amber-400/5 via-card/30 to-primary/5">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="text-center">
            <Badge variant="outline" className="border-amber-400/60 bg-amber-400/10 text-amber-500 gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              Niveles
            </Badge>
            <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight md:text-4xl">
              Niveles de la comunidad
            </h2>
            <p className="mt-3 mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
              Tres niveles que reconocen tu trayectoria como autor.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <LevelCard
              emoji="📝"
              icon={<PenLine className="h-5 w-5" />}
              title="Creador"
              tagline="Publica desde el día uno"
              body="Publica contenido libremente y empieza a construir tu audiencia. Tu Atelier es tuyo desde el primer minuto."
              color="primary"
              perks={["Sin postulación", "Publicación inmediata", "Atelier personalizable"]}
            />
            <LevelCard
              emoji="✨"
              icon={<BadgeCheck className="h-5 w-5" />}
              title="Autor Verificado"
              tagline="Insignia oficial de CharBook"
              body="Insignia oficial de CharBook para creadores aprobados por nuestro equipo. Te diferencia y aumenta la confianza de tus lectores."
              color="amber"
              perks={["Insignia ✓ verificada", "Mayor confianza lectora", "Prioridad en soporte"]}
              featured
            />
            <LevelCard
              emoji="🏆"
              icon={<Trophy className="h-5 w-5" />}
              title="Autor Destacado"
              tagline="Reconocimiento especial"
              body="Reconocimiento especial para autores con gran impacto dentro de la plataforma — selección curatorial del equipo."
              color="rose"
              perks={["Insignia 🏆 destacada", "Recomendado en home", "Eventos exclusivos"]}
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════ BENEFICIOS ═══════════════════ */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <div className="text-center">
          <h2 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
            Una plataforma a tu lado
          </h2>
          <p className="mt-3 mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
            Las herramientas que importan, sin las que estorban.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <BenefitCard
            icon={<Globe2 />}
            color="primary"
            title="Alcance global"
            body="Tu obra está disponible 24/7 para lectores de toda la región hispanohablante."
          />
          <BenefitCard
            icon={<Heart />}
            color="rose"
            title="Comunidad real"
            body="Lectores que reseñan, te siguen y te ayudan a crecer."
          />
          <BenefitCard
            icon={<TrendingUp />}
            color="emerald"
            title="Estadísticas claras"
            body="Visualizaciones, favoritos, reseñas: todo en tu dashboard."
          />
          <BenefitCard
            icon={<Sparkles />}
            color="amber"
            title="Tu Atelier"
            body="Personaliza tu perfil con anuncios, eventos, tips y secciones a tu medida."
          />
        </div>
      </section>

      {/* ═══════════════════ ATELIER PREVIEW ═══════════════════ */}
      <section className="border-y border-border/40 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="text-center">
            <Badge variant="outline" className="border-amber-400/60 bg-amber-400/10 text-amber-500 gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Tu Atelier
            </Badge>
            <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight md:text-4xl">
              Más que un perfil: tu espacio.
            </h2>
            <p className="mt-3 mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
              Tu Atelier es el espacio personal donde tus lectores te encuentran.
              Personalízalo a tu medida.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AtelierFeature
              icon={<Megaphone className="h-5 w-5" />}
              color="amber"
              title="📣 Anuncios"
              body="Comparte novedades, promociones o lanzamientos."
            />
            <AtelierFeature
              icon={<Lightbulb className="h-5 w-5" />}
              color="emerald"
              title="💡 Tips de lectura"
              body="Consejos, recomendaciones, recursos para tus lectores."
            />
            <AtelierFeature
              icon={<CalendarDays className="h-5 w-5" />}
              color="violet"
              title="📅 Eventos"
              body="Presentaciones, charlas, talleres con fecha y hora."
            />
            <AtelierFeature
              icon={<BookOpen className="h-5 w-5" />}
              color="primary"
              title="📚 Nuevas adquisiciones"
              body="Destaca tus últimas obras o recomendaciones."
            />
            <AtelierFeature
              icon={<Folder className="h-5 w-5" />}
              color="sky"
              title="🗂️ Categorías destacadas"
              body="Guía a tus lectores a los géneros que dominas."
            />
            <AtelierFeature
              icon={<Feather className="h-5 w-5" />}
              color="rose"
              title="🔗 Acceso directo"
              body="Enlaces a tu blog, redes, Patreon o tu newsletter."
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════ ¿POR QUÉ VERIFICAR? ═══════════════════ */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <Badge variant="outline" className="border-emerald-400/60 bg-emerald-400/10 text-emerald-400 gap-1.5">
              <BadgeCheck className="h-3.5 w-3.5" />
              Verificación
            </Badge>
            <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight md:text-4xl">
              ¿Por qué verificar tu perfil?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              La verificación es opcional, pero te da ventajas reales: más
              visibilidad, más confianza lectora y acceso a programas exclusivos.
              Solicita la insignia cuando tu obra esté lista para destacar.
            </p>
            <Button asChild size="lg" className="mt-6" variant="outline">
              <Link href="/verificacion">
                Conocer más sobre la verificación
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <ul className="space-y-3">
            <VerifyBenefit
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Mayor confianza para los lectores"
              body="La insignia ✓ indica que tu identidad y tu obra han sido revisadas por el equipo de CharBook."
            />
            <VerifyBenefit
              icon={<BadgeCheck className="h-5 w-5" />}
              title="Insignia visible en tu perfil"
              body="Destaca al lado de tu nombre en cada reseña, anuncio o publicación."
            />
            <VerifyBenefit
              icon={<Search className="h-5 w-5" />}
              title="Más posibilidades en recomendaciones"
              body="Los autores verificados aparecen con prioridad en búsquedas y descubrimientos."
            />
            <VerifyBenefit
              icon={<Gem className="h-5 w-5" />}
              title="Programas y eventos especiales"
              body="Acceso a programas, talleres y eventos exclusivos para autores verificados."
            />
          </ul>
        </div>
      </section>

      {/* ═══════════════════ CTA FINAL ═══════════════════ */}
      <section className="mx-auto max-w-4xl px-4 py-16 md:px-6 md:py-24">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-8 text-center md:p-12">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-amber-400/15 pointer-events-none" />
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

          <div className="relative">
            <Sparkles className="mx-auto h-10 w-10 text-amber-400" />
            <h2 className="mt-5 font-serif text-3xl font-bold tracking-tight md:text-4xl">
              Empieza a publicar hoy
            </h2>
            <p className="mt-3 mx-auto max-w-xl text-sm text-muted-foreground md:text-base">
              No necesitas aprobación para comenzar. Comparte tus historias,
              encuentra lectores y haz crecer tu comunidad dentro de CharBook
              Library.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                asChild
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-6 shadow-lg shadow-primary/20"
              >
                <Link href="/studio">
                  <PenLine className="mr-2 h-4 w-4" />
                  Publicar mi primera obra
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-base">
                <Link href="/verificacion">
                  <BadgeCheck className="mr-2 h-4 w-4" />
                  Conocer la verificación
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-[11px] text-muted-foreground/70">
              Sin postulaciones · Sin costos · Cancela cuando quieras
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// ───────────────────────────────────────────────────────
// Sub-componentes
// ───────────────────────────────────────────────────────

function FloatingCard({
  icon,
  label,
  color,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  color: "amber" | "primary" | "rose" | "emerald";
  delay?: boolean;
}) {
  const colorClass = {
    amber: "border-amber-400/40 bg-amber-400/10 text-amber-500",
    primary: "border-primary/40 bg-primary/10 text-primary",
    rose: "border-rose-400/40 bg-rose-400/10 text-rose-400",
    emerald: "border-emerald-400/40 bg-emerald-400/10 text-emerald-400",
  }[color];
  return (
    <div
      className={`rounded-2xl border ${colorClass} aspect-square flex flex-col items-center justify-center gap-2 backdrop-blur-sm shadow-xl ${
        delay ? "mt-8" : ""
      }`}
    >
      {icon}
      <span className="text-xs font-medium tracking-wide">{label}</span>
    </div>
  );
}

function StepCard({
  step,
  icon,
  title,
  body,
  accent,
}: {
  step: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl border bg-card p-6 transition-colors ${
        accent
          ? "border-amber-400/50 bg-gradient-to-br from-amber-400/10 to-transparent hover:border-amber-400/70"
          : "border-border/60 hover:border-primary/40"
      }`}
    >
      <div className="absolute -top-4 left-6 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary font-serif text-base font-bold text-primary-foreground shadow-lg">
        {step}
      </div>
      <div
        className={`mt-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border ${
          accent
            ? "border-amber-400/40 bg-amber-400/10 text-amber-500"
            : "border-primary/30 bg-primary/10 text-primary"
        }`}
      >
        {icon}
      </div>
      <h3 className="mt-4 font-serif text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function LevelCard({
  emoji,
  icon,
  title,
  tagline,
  body,
  perks,
  color,
  featured,
}: {
  emoji: string;
  icon: React.ReactNode;
  title: string;
  tagline: string;
  body: string;
  perks: string[];
  color: "primary" | "amber" | "rose";
  featured?: boolean;
}) {
  const cls = {
    primary: {
      border: "border-primary/40",
      bg: "bg-primary/5",
      text: "text-primary",
      ring: "ring-primary/20",
    },
    amber: {
      border: "border-amber-400/60",
      bg: "bg-amber-400/10",
      text: "text-amber-500",
      ring: "ring-amber-400/30",
    },
    rose: {
      border: "border-rose-400/40",
      bg: "bg-rose-400/5",
      text: "text-rose-400",
      ring: "ring-rose-400/20",
    },
  }[color];
  return (
    <div
      className={`relative rounded-3xl border-2 bg-card p-6 transition-transform hover:-translate-y-1 ${cls.border} ${
        featured ? `ring-4 ${cls.ring} shadow-xl` : ""
      }`}
    >
      {featured && (
        <Badge className="absolute -top-3 left-6 bg-amber-400 text-amber-950 hover:bg-amber-400 border-0">
          ⭐ Más popular
        </Badge>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="text-4xl">{emoji}</div>
        <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${cls.border} ${cls.bg} ${cls.text}`}>
          {icon}
        </div>
      </div>
      <h3 className="mt-4 font-serif text-xl font-bold">{title}</h3>
      <p className={`text-xs font-medium uppercase tracking-wider ${cls.text}`}>
        {tagline}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <ul className="mt-4 space-y-1.5 border-t border-border/40 pt-4">
        {perks.map((perk) => (
          <li key={perk} className="flex items-center gap-2 text-xs">
            <BadgeCheck className={`h-3.5 w-3.5 shrink-0 ${cls.text}`} />
            <span className="text-foreground/80">{perk}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BenefitCard({
  icon,
  title,
  body,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  color: "primary" | "rose" | "emerald" | "amber";
}) {
  const cls = {
    primary: "border-primary/30 bg-primary/5 text-primary",
    rose: "border-rose-400/30 bg-rose-400/5 text-rose-400",
    emerald: "border-emerald-400/30 bg-emerald-400/5 text-emerald-400",
    amber: "border-amber-400/30 bg-amber-400/5 text-amber-500",
  }[color];
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/40">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${cls}`}>
        {icon}
      </div>
      <h3 className="mt-4 font-serif text-lg font-bold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function AtelierFeature({
  icon,
  title,
  body,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  color: "amber" | "emerald" | "violet" | "primary" | "sky" | "rose";
}) {
  const cls = {
    amber: "border-amber-400/30 bg-amber-400/10 text-amber-500",
    emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
    violet: "border-violet-400/30 bg-violet-400/10 text-violet-400",
    primary: "border-primary/30 bg-primary/10 text-primary",
    sky: "border-sky-400/30 bg-sky-400/10 text-sky-400",
    rose: "border-rose-400/30 bg-rose-400/10 text-rose-400",
  }[color];
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 p-4">
      <div className="flex items-start gap-3">
        <div className={`rounded-md border p-2 shrink-0 ${cls}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-sm font-medium leading-tight">{title}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>
    </div>
  );
}

function VerifyBenefit({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="rounded-md border border-emerald-400/40 bg-emerald-400/10 p-2 text-emerald-400 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-medium">{title}</div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}
