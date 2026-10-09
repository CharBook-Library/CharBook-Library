import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  ShieldCheck,
  Eye,
  Search,
  Gem,
  Trophy,
  Star,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Users,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Verifica tu perfil · CharBook Library",
  description:
    "Obtén la insignia de Autor Verificado y destaca en CharBook Library. Mayor confianza, más recomendaciones y acceso a programas exclusivos.",
};

export default function VerificationPage() {
  return (
    <div className="min-h-screen">
      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/15 via-amber-400/5 to-transparent pointer-events-none" />
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-400/15 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-4xl px-4 py-16 md:px-6 md:py-24 text-center">
          <div className="inline-flex items-center justify-center rounded-full border-2 border-emerald-400/60 bg-emerald-400/10 p-4">
            <BadgeCheck className="h-12 w-12 text-emerald-400" />
          </div>
          <Badge
            variant="outline"
            className="mt-5 border-emerald-400/60 bg-emerald-400/10 text-emerald-400 gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Programa de Verificación
          </Badge>
          <h1 className="mt-5 font-serif text-4xl font-bold tracking-tight md:text-5xl">
            Conviértete en{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-amber-400 bg-clip-text text-transparent">
              Autor Verificado
            </span>
          </h1>
          <p className="mt-5 mx-auto max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            La insignia ✓ que distingue a los autores con identidad y obra
            revisadas por el equipo de CharBook. Opcional, gratuita, y siempre
            tuya.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              asChild
              size="lg"
              className="bg-emerald-400 text-emerald-950 hover:bg-emerald-500 text-base px-6 shadow-lg shadow-emerald-400/20"
            >
              <Link href="/solicitud-creador/nueva">
                Solicitar verificación
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base">
              <Link href="/convertirme-en-creador">Volver al inicio</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════════ COMPARATIVA NIVELES ═══════════════════ */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <div className="text-center">
          <Badge variant="outline" className="border-amber-400/60 bg-amber-400/10 text-amber-500 gap-1.5">
            <Trophy className="h-3.5 w-3.5" />
            Niveles
          </Badge>
          <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight md:text-4xl">
            ¿Dónde encajas hoy?
          </h2>
          <p className="mt-3 mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
            Tres niveles que reconocen tu trayectoria. Cualquiera puede empezar
            como Creador y crecer.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <LevelTier
            emoji="📝"
            level="Creador"
            tagline="Punto de partida"
            description="Cualquier usuario registrado. Publica libremente desde el día 1."
            badges={["Acceso total al Studio", "Atelier personalizable", "Sin postulación"]}
            color="primary"
          />
          <LevelTier
            emoji="✨"
            level="Autor Verificado"
            tagline="Tu próxima meta"
            description="Insignia ✓ tras revisión del equipo. Tus lectores te identifican como autor confiable."
            badges={["Insignia ✓ verde", "Prioridad en búsqueda", "Eventos exclusivos"]}
            color="emerald"
            featured
          />
          <LevelTier
            emoji="🏆"
            level="Autor Destacado"
            tagline="Reconocimiento curatorial"
            description="Selección del equipo para autores con impacto excepcional dentro de la plataforma."
            badges={["Insignia 🏆 dorada", "Recomendado en home", "Programas premium"]}
            color="amber"
          />
        </div>
      </section>

      {/* ═══════════════════ BENEFICIOS ═══════════════════ */}
      <section className="border-y border-border/40 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div className="lg:sticky lg:top-24">
              <Badge variant="outline" className="border-emerald-400/60 bg-emerald-400/10 text-emerald-400 gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5" />
                Beneficios
              </Badge>
              <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight md:text-4xl">
                ¿Por qué verificar tu perfil?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                La verificación es opcional, pero te da ventajas reales en
                visibilidad, credibilidad y acceso. Si tu obra está lista para
                destacar, la insignia ayuda a tus lectores a confiar antes de
                leer.
              </p>
              <Card className="mt-6 border-emerald-400/30 bg-emerald-400/5 p-4">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <strong className="text-foreground">100% gratuita.</strong>{" "}
                    Nunca te cobraremos por la verificación. Si te aprobamos,
                    obtienes la insignia y todos sus beneficios sin costo.
                  </p>
                </div>
              </Card>
            </div>

            <ul className="space-y-3">
              <BigBenefit
                icon={<ShieldCheck className="h-6 w-6" />}
                title="Mayor confianza para los lectores"
                body="La insignia ✓ indica que tu identidad y tu obra han sido revisadas por el equipo de CharBook. Los lectores leen con más tranquilidad."
              />
              <BigBenefit
                icon={<Eye className="h-6 w-6" />}
                title="Insignia visible en tu perfil"
                body="Aparece al lado de tu nombre en cada reseña, comentario, anuncio o publicación. Una señal pequeña con gran impacto."
              />
              <BigBenefit
                icon={<Search className="h-6 w-6" />}
                title="Más posibilidades en recomendaciones"
                body="Los autores verificados tienen prioridad en búsquedas, descubrimientos y secciones curatoriales de la home."
              />
              <BigBenefit
                icon={<Gem className="h-6 w-6" />}
                title="Participación en eventos y programas especiales"
                body="Acceso a talleres exclusivos, programas de mentoría, presentaciones organizadas por el equipo y oportunidades de colaboración."
              />
            </ul>
          </div>
        </div>
      </section>

      {/* ═══════════════════ CRITERIOS ═══════════════════ */}
      <section className="mx-auto max-w-5xl px-4 py-16 md:px-6 md:py-24">
        <div className="text-center">
          <h2 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
            ¿Qué evaluamos?
          </h2>
          <p className="mt-3 mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
            Cuatro pilares con los que el equipo revisa cada solicitud. Una
            rúbrica clara, sin sorpresas.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <CriteriaCard
            icon={<Star className="h-5 w-5" />}
            title="Calidad de la obra"
            body="Originalidad, cuidado editorial, claridad narrativa. No buscamos perfección, sino voz propia y trabajo cuidado."
          />
          <CriteriaCard
            icon={<Clock className="h-5 w-5" />}
            title="Compromiso"
            body="Consistencia en publicaciones, presencia activa, respuesta a tu comunidad. Si publicas con regularidad, suma."
          />
          <CriteriaCard
            icon={<BookOpen className="h-5 w-5" />}
            title="Profesionalismo"
            body="Perfil completo, biografía cuidada, portadas adecuadas, descripciones útiles. Pequeños detalles que se notan."
          />
          <CriteriaCard
            icon={<Users className="h-5 w-5" />}
            title="Encaje con CharBook"
            body="Coherencia con nuestra misión literaria y el respeto a la comunidad. Esperamos autores, no spammers."
          />
        </div>
      </section>

      {/* ═══════════════════ FAQ ═══════════════════ */}
      <section className="border-y border-border/40 bg-card/30">
        <div className="mx-auto max-w-3xl px-4 py-16 md:px-6 md:py-24">
          <div className="text-center">
            <h2 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
              Preguntas frecuentes
            </h2>
          </div>

          <div className="mt-10 space-y-3">
            <Faq
              q="¿Necesito estar verificado para publicar?"
              a="No. Cualquier usuario registrado puede publicar desde el primer día. La verificación es una capa opcional para destacar."
            />
            <Faq
              q="¿Cuánto tarda el proceso?"
              a="Normalmente entre 3 y 7 días hábiles. Te avisamos por email tan pronto el equipo termine la revisión."
            />
            <Faq
              q="¿Tiene costo?"
              a="No. La verificación es 100% gratuita. Nunca te cobraremos por obtenerla ni mantenerla."
            />
            <Faq
              q="¿Si me rechazan, puedo volver a aplicar?"
              a="Sí. Te enviaremos retroalimentación con los puntos a mejorar y podrás reaplicar pasados 30 días."
            />
            <Faq
              q="¿La insignia caduca?"
              a="No, pero la mantenemos sujeta a las normas de la comunidad. Solo se revoca en casos graves de violación de términos."
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════ CTA FINAL ═══════════════════ */}
      <section className="mx-auto max-w-4xl px-4 py-16 md:px-6 md:py-24">
        <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-400/40 bg-card p-8 text-center md:p-12">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/15 via-transparent to-amber-400/10 pointer-events-none" />
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none" />

          <div className="relative">
            <BadgeCheck className="mx-auto h-12 w-12 text-emerald-400" />
            <h2 className="mt-5 font-serif text-3xl font-bold tracking-tight md:text-4xl">
              ¿Listo para destacar?
            </h2>
            <p className="mt-3 mx-auto max-w-xl text-sm text-muted-foreground md:text-base">
              Solicitar la verificación toma menos de 10 minutos. Te respondemos
              en pocos días con retroalimentación clara.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                asChild
                size="lg"
                className="bg-emerald-400 text-emerald-950 hover:bg-emerald-500 text-base px-6 shadow-lg shadow-emerald-400/20"
              >
                <Link href="/solicitud-creador/nueva">
                  Solicitar verificación
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-base">
                <Link href="/studio">Ir al Studio</Link>
              </Button>
            </div>
            <p className="mt-6 text-[11px] text-muted-foreground/70">
              100% gratuita · Conservas todos tus derechos · Reaplicable
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

function LevelTier({
  emoji,
  level,
  tagline,
  description,
  badges,
  color,
  featured,
}: {
  emoji: string;
  level: string;
  tagline: string;
  description: string;
  badges: string[];
  color: "primary" | "emerald" | "amber";
  featured?: boolean;
}) {
  const cls = {
    primary: {
      border: "border-primary/40",
      bg: "bg-primary/5",
      text: "text-primary",
      ring: "ring-primary/20",
    },
    emerald: {
      border: "border-emerald-400/60",
      bg: "bg-emerald-400/10",
      text: "text-emerald-400",
      ring: "ring-emerald-400/30",
    },
    amber: {
      border: "border-amber-400/40",
      bg: "bg-amber-400/5",
      text: "text-amber-500",
      ring: "ring-amber-400/20",
    },
  }[color];
  return (
    <Card
      className={`relative border-2 ${cls.border} p-6 transition-transform hover:-translate-y-1 ${
        featured ? `ring-4 ${cls.ring} shadow-xl` : ""
      }`}
    >
      {featured && (
        <Badge className="absolute -top-3 left-6 bg-emerald-400 text-emerald-950 hover:bg-emerald-400 border-0">
          ⭐ Tu siguiente meta
        </Badge>
      )}
      <div className="text-4xl">{emoji}</div>
      <h3 className="mt-3 font-serif text-xl font-bold">{level}</h3>
      <p className={`text-xs font-medium uppercase tracking-wider ${cls.text}`}>
        {tagline}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <ul className="mt-4 space-y-1.5 border-t border-border/40 pt-4">
        {badges.map((b) => (
          <li key={b} className="flex items-center gap-2 text-xs">
            <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${cls.text}`} />
            <span className="text-foreground/80">{b}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function BigBenefit({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li>
      <Card className="border-border/60 bg-card p-5 transition-colors hover:border-emerald-400/40">
        <div className="flex items-start gap-4">
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-emerald-400 shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="font-serif text-base font-bold leading-tight">
              {title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {body}
            </p>
          </div>
        </div>
      </Card>
    </li>
  );
}

function CriteriaCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card className="border-border/60 bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-400/15 p-2 text-amber-400 shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="font-medium">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {body}
          </p>
        </div>
      </div>
    </Card>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/40">
      <summary className="flex cursor-pointer items-center justify-between gap-3 font-medium list-none">
        <span>{q}</span>
        <span className="ml-2 text-xs text-muted-foreground transition-transform group-open:rotate-180">
          ▼
        </span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
    </details>
  );
}
