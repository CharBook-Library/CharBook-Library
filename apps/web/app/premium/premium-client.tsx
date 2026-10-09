"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Check,
  CheckCircle2,
  Crown,
  Download,
  HeartHandshake,
  HelpCircle,
  Library,
  Palette,
  ShieldCheck,
  Sparkles,
  Star,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { monetizationApi } from "@/lib/api-monetization";
import { useAuth } from "@/hooks/use-auth";

type PlanTier = "free" | "premium" | "premium_plus";
type ApiError = { response?: { data?: { message?: string }; status?: number } };
type SubscriptionInfo = {
  tier?: PlanTier | string;
  subscriptions?: Array<{ status?: string }>;
  prices?: {
    premium_usd?: number | string;
    premium_plus_usd?: number | string;
  };
};

const planLabels: Record<PlanTier, string> = {
  free: "Gratis",
  premium: "Premium",
  premium_plus: "Premium Plus",
};

const benefits: Array<{ icon: LucideIcon; title: string; description: string; plus?: boolean }> = [
  { icon: ShieldCheck, title: "Sin anuncios", description: "Lectura continua sin interrupciones entre capitulos." },
  { icon: Download, title: "Lectura offline", description: "Descargas compatibles para seguir leyendo sin conexion." },
  { icon: Palette, title: "Temas exclusivos", description: "Ambientes de lectura mas comodos para sesiones largas." },
  { icon: Library, title: "Premium Picks", description: "Selecciones editoriales y recomendaciones destacadas." },
  { icon: Palette, title: "Personalizacion avanzada", description: "Temas, tipografias y ajustes de lectura exclusivos." },
  { icon: BadgeCheck, title: "Distintivo Premium", description: "Una marca visible de apoyo dentro de tu perfil." },
  { icon: Zap, title: "Acceso anticipado", description: "Premium Plus abre capitulos exclusivos antes.", plus: true },
  { icon: HeartHandshake, title: "Mayor apoyo a creadores", description: "Premium Plus fortalece el ecosistema de autores.", plus: true },
];

const comparisonRows = [
  // ── Premium ──
  { label: "Anuncios", free: "Con anuncios", premium: "Sin anuncios", plus: "Sin anuncios" },
  { label: "Leer todo sin bloqueos (libros, series, cómics)", free: false, premium: true, plus: true },
  { label: "Recomendaciones inteligentes", free: false, premium: true, plus: true },
  { label: "Temas de lectura premium", free: "Básicos", premium: true, plus: true },
  { label: "Tipografías premium", free: "Básicas", premium: true, plus: true },
  { label: "Soporte prioritario", free: false, premium: true, plus: true },
  // ── Premium Plus ──
  { label: "Audiolibros IA", free: false, premium: false, plus: "Próximamente" },
  { label: "Elegir voz IA", free: false, premium: false, plus: true },
  { label: "Perfil avanzado (banners)", free: false, premium: false, plus: true },
  { label: "Acceso anticipado", free: false, premium: false, plus: true },
  { label: "Insignia Premium Plus", free: false, premium: false, plus: true },
  { label: "Apoyo a creadores", free: false, premium: false, plus: true },
  { label: "Resumen de libros y por capítulo", free: false, premium: false, plus: "Próximamente" },
  { label: "Acceso prioritario a novedades", free: false, premium: false, plus: true },
];

const faqs = [
  ["Puedo cancelar cuando quiera?", "Si. La gestion del plan se hace desde el portal de facturacion cuando tu cuenta tenga una suscripcion activa."],
  ["Que pasa si cambio de plan?", "CharBook muestra el plan vigente que confirma el proveedor de pago o que otorgo un super admin."],
  ["Las monedas son parte de Premium?", "No. Premium es tu experiencia de lectura; las CharCoins viven en su propio espacio y se gestionan desde la pagina de CharCoins."],
  ["Como funciona Premium Plus?", "Incluye todo Premium y suma acceso anticipado, catalogo Unlimited participante, recompensas exclusivas y mas apoyo a creadores."],
  ["Puedo usar Premium en web y movil?", "La cuenta es la misma. Cada beneficio aparece donde CharBook ya tenga soporte disponible."],
  ["Como apoyo a los creadores?", "Al suscribirte ayudas a financiar lecturas seleccionadas, herramientas de publicacion y programas para autores participantes."],
];

function BooleanState({ value }: { value: boolean | string }) {
  if (typeof value === "string") return <span className="text-sm text-muted-foreground">{value}</span>;
  return value ? (
    <CheckCircle2 className="mx-auto h-5 w-5 text-primary" aria-label="Incluido" />
  ) : (
    <X className="mx-auto h-5 w-5 text-muted-foreground/70" aria-label="No incluido" />
  );
}

function formatPrice(value: number | string | undefined, fallback: string) {
  if (value === undefined || value === null || value === "") return fallback;
  return `$${Number(value).toFixed(2)}/mes`;
}

export function PremiumClient() {
  const searchParams = useSearchParams();
  const { user, refetch, isAuthenticated } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [busy, setBusy] = useState<PlanTier | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const currentTier = useMemo<PlanTier>(() => {
    const tier = subscription?.tier ?? user?.subscription_tier ?? "free";
    return tier === "premium" || tier === "premium_plus" ? tier : "free";
  }, [subscription?.tier, user?.subscription_tier]);
  const hasBillingSubscription = Boolean(subscription?.subscriptions?.some((item) => item.status === "active"));

  const loadSubscription = useCallback(async () => {
    try {
      const response = await monetizationApi.subscription();
      setSubscription(response as SubscriptionInfo);
    } catch {
      setSubscription(null);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = window.setTimeout(() => {
      void loadSubscription();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, loadSubscription]);

  useEffect(() => {
    if (searchParams.get("status") !== "success") return;
    const notice = window.setTimeout(() => {
      setMessage("Estamos confirmando tu membresia. La pagina se actualizara sola en unos segundos.");
    }, 0);
    const first = window.setTimeout(() => {
      void refetch();
      void loadSubscription();
    }, 1500);
    const second = window.setTimeout(() => {
      void refetch();
      void loadSubscription();
    }, 4500);
    return () => {
      window.clearTimeout(notice);
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [loadSubscription, refetch, searchParams]);

  const openBillingPortal = async () => {
    setBusy(currentTier);
    setMessage(null);
    try {
      const { url } = await monetizationApi.billingPortal();
      window.location.assign(url);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setMessage(apiError?.response?.data?.message ?? "No se pudo abrir la gestion de tu membresia.");
      setBusy(null);
    }
  };

  const startCheckout = async (plan: "premium" | "premium_plus") => {
    setBusy(plan);
    setMessage(null);
    try {
      const { url } = await monetizationApi.checkout({ plan });
      window.location.assign(url);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setMessage(apiError?.response?.status === 401 ? "Inicia sesion para suscribirte." : apiError?.response?.data?.message ?? "No se pudo abrir checkout.");
      setBusy(null);
    }
  };

  const premiumPrice = formatPrice(subscription?.prices?.premium_usd, "$4.99/mes");
  const plusPrice = formatPrice(subscription?.prices?.premium_plus_usd, "$9.99/mes");

  return (
    <main className="overflow-hidden bg-background">
      <section className="relative border-b border-border/50">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_5%,oklch(0.78_0.13_80_/_0.26),transparent_34%),radial-gradient(circle_at_90%_25%,oklch(0.65_0.18_250_/_0.18),transparent_30%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
          <div className="animate-fade-in-up max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Crown className="h-4 w-4" />
              CharBook Premium
            </span>
            <h1 className="mt-6 font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Lee mejor, desbloquea mas y apoya historias nuevas.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Tres formas claras de leer en CharBook: gratis para explorar, Premium para una experiencia mas comoda y Premium Plus para lectores que siguen series y creadores de cerca.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <a href="#planes">
                  Ver planes <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#comparar">Comparar beneficios</a>
              </Button>
            </div>
            {message && (
              <p className="mt-5 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
                {message}
              </p>
            )}
          </div>

          <div className="animate-fade-in-up relative [animation-delay:120ms] [animation-fill-mode:both]">
            <div className="absolute -inset-6 -z-10 rounded-full bg-primary/15 blur-3xl" />
            <PremiumShowcase />
            <div className="grid gap-4 md:grid-cols-3">
              <MiniPlan title="Gratis" price="$0" items={["Catalogo publico", "Comunidad", "Monedas aparte"]} />
              <MiniPlan title="Premium" price={premiumPrice} items={["Sin anuncios", "Offline", "Premium Picks"]} active={currentTier === "premium"} />
              <MiniPlan title="Premium Plus" price={plusPrice} items={["Acceso anticipado", "Catalogo Unlimited", "Mas apoyo"]} active={currentTier === "premium_plus"} highlighted />
            </div>
          </div>
        </div>
      </section>

      <section id="planes" className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="font-serif text-3xl font-bold">Elige como quieres leer</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">Las monedas se compran aparte. Los planes cambian beneficios de lectura y suscripcion.</p>
          </div>
          <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-sm text-muted-foreground">
            Plan actual: {planLabels[currentTier]}
          </span>
        </div>
        <div className="mt-8 grid items-stretch gap-5 lg:grid-cols-3">
          <PlanCard
            tier="free"
            title="Gratis"
            price="$0"
            description="Para descubrir libros, seguir perfiles y participar en la comunidad."
            features={["Catalogo gratuito", "Biblioteca personal", "Resenas y antologias", "Comunidad de lectores"]}
            currentTier={currentTier}
          />
          <PlanCard
            tier="premium"
            title="Premium"
            price={premiumPrice}
            description="Para leer con menos friccion y beneficios constantes."
            features={["Lee todo sin pagar, sin anuncios y sin bloqueos", "Recomendaciones inteligentes", "Temas de lectura premium", "Más tipografías de lectura", "Soporte prioritario"]}
            currentTier={currentTier}
            disabled={currentTier === "premium_plus"}
            onSelect={() => startCheckout("premium")}
            busy={busy === "premium"}
          />
          <PlanCard
            tier="premium_plus"
            title="Premium Plus"
            price={plusPrice}
            description="Para lectores intensivos que quieren acceso anticipado y mayor apoyo a creadores."
            features={["Todo lo de Premium", "Audiolibros IA (próximamente)", "Elegir voces IA", "Perfil avanzado con banners", "Acceso anticipado", "Insignia Premium Plus", "Resúmenes de libros y capítulos (próximamente)", "Acceso prioritario a nuevas funciones", "Mayor apoyo a creadores"]}
            currentTier={currentTier}
            highlighted
            onSelect={() => startCheckout("premium_plus")}
            busy={busy === "premium_plus"}
          />
        </div>
      </section>

      <section className="border-y border-border/50 bg-card/60">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <h2 className="text-center font-serif text-3xl font-bold">Lo que ganas con Premium</h2>
          <div className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(({ icon: Icon, title, description, plus }) => (
              <article key={title} className="rounded-lg border border-border/60 bg-background p-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                {plus && <p className="mt-3 text-xs font-medium text-primary">Premium Plus</p>}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="comparar" className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <h2 className="font-serif text-3xl font-bold">Comparacion clara</h2>
        <div className="mt-8 overflow-x-auto rounded-lg border border-border/60 bg-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border/60 bg-muted/40">
              <tr>
                <th className="px-4 py-4 font-semibold">Beneficio</th>
                <th className="px-4 py-4 text-center font-semibold">Gratis</th>
                <th className="px-4 py-4 text-center font-semibold text-primary">Premium</th>
                <th className="bg-primary/10 px-4 py-4 text-center font-semibold text-primary">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Premium Plus
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.label} className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-4 font-medium">{row.label}</td>
                  <td className="px-4 py-4 text-center"><BooleanState value={row.free} /></td>
                  <td className="px-4 py-4 text-center"><BooleanState value={row.premium} /></td>
                  <td className="bg-primary/5 px-4 py-4 text-center"><BooleanState value={row.plus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-y border-border/50 bg-muted/25">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-3">
          <FeaturePanel icon={Download} title="Lectura offline" copy="Descarga obras compatibles y sigue leyendo sin conexion, con tu progreso sincronizado entre dispositivos." />
          <FeaturePanel icon={Library} title="Catalogo Unlimited" copy="Premium Plus permite acceso a obras participantes del catalogo unlimited sin convertir cada lectura en una compra individual." />
          <FeaturePanel icon={HeartHandshake} title="Apoyo a creadores" copy="Las membresias ayudan a sostener mejores herramientas, curaduria y programas que conectan lectores con autores." />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="font-serif text-3xl font-bold">Premium Picks</h2>
            <p className="mt-3 text-muted-foreground">Una seleccion editorial para descubrir historias sin navegar a ciegas.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {["Biblioteca de medianoche", "Cartas bajo la lluvia", "La ciudad de tinta"].map((title, index) => (
              <article key={title} className="rounded-lg border border-border/60 bg-card p-4">
                <div className="aspect-[3/4] rounded-lg border border-primary/20 bg-gradient-to-br from-primary/20 via-background to-blue-500/10 p-4">
                  <Star className="h-5 w-5 text-primary" />
                  <h3 className="mt-16 font-serif text-xl font-bold">{title}</h3>
                  <p className="mt-2 text-xs text-muted-foreground">{index === 0 ? "Seleccion editorial" : "Historia recomendada"}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-6 w-6 text-primary" />
          <h2 className="font-serif text-3xl font-bold">Preguntas frecuentes</h2>
        </div>
        <div className="mt-8 space-y-3">
          {faqs.map(([question, answer]) => (
            <details key={question} className="group rounded-lg border border-border/60 bg-card p-4">
              <summary className="cursor-pointer list-none font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary">
                {question}
              </summary>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="plus-border-gradient relative overflow-hidden rounded-lg p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
          <h2 className="font-serif text-3xl font-bold">Empieza tu experiencia Premium hoy</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">Mas lectura, mas beneficios y mas apoyo para los creadores que amas.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {currentTier !== "free" ? (
              hasBillingSubscription ? (
                <Button size="lg" onClick={openBillingPortal} disabled={busy !== null}>
                  Gestionar mi membresia
                </Button>
              ) : (
                <Button asChild size="lg">
                  <Link href="/monedas">Ver mi estado Premium</Link>
                </Button>
              )
            ) : (
              <>
                <Button size="lg" variant="outline" onClick={() => startCheckout("premium")} disabled={busy !== null}>Elegir Premium</Button>
                <Button size="lg" className="plus-cta font-semibold shadow-lg shadow-primary/25" onClick={() => startCheckout("premium_plus")} disabled={busy !== null}>
                  <Sparkles className="mr-2 h-4 w-4" /> Elegir Premium Plus
                </Button>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function PremiumShowcase() {
  return (
    <div className="mb-4 rounded-lg border border-primary/25 bg-card p-5 shadow-2xl shadow-black/10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Biblioteca Premium</p>
          <p className="text-xs text-muted-foreground">Picks, acceso anticipado y lectura sin anuncios.</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BookOpen className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="relative min-h-[220px] rounded-lg border border-border/60 bg-background p-4">
          <div className="absolute bottom-4 left-4 h-36 w-24 rotate-[-6deg] rounded-md border border-primary/30 bg-gradient-to-br from-primary/35 via-background to-sky-500/20 p-3 shadow-xl">
            <Star className="h-4 w-4 text-primary" />
            <p className="mt-14 font-serif text-lg font-bold leading-tight">Premium Picks</p>
          </div>
          <div className="absolute bottom-4 left-24 h-40 w-28 rotate-[5deg] rounded-md border border-primary/30 bg-gradient-to-br from-amber-500/25 via-card to-purple-500/20 p-3 shadow-xl">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="mt-16 font-serif text-lg font-bold leading-tight">Capitulo Plus</p>
          </div>
          <div className="absolute right-4 top-4 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
            Sin anuncios
          </div>
        </div>
        <div className="grid content-between gap-3">
          {["Offline", "Acceso anticipado", "Apoya autores"].map((item) => (
            <div key={item} className="rounded-lg border border-border/60 bg-background px-4 py-3 text-sm font-medium">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniPlan({ title, price, items, active, highlighted }: { title: string; price: string; items: string[]; active?: boolean; highlighted?: boolean }) {
  return (
    <article
      className={`rounded-lg p-5 transition-transform duration-300 hover:-translate-y-0.5 ${
        highlighted ? "plus-border-gradient plus-card-glow" : "border border-border/60 bg-card/90"
      } ${active ? "ring-2 ring-primary/50" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-serif text-xl font-bold">{title}</p>
        {highlighted && <Sparkles className="animate-premium-float h-4 w-4 text-primary" />}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{price}</p>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <p key={item} className="flex items-center gap-2 text-sm"><Check className="h-3.5 w-3.5 text-primary" /> {item}</p>
        ))}
      </div>
      {active && <p className="mt-4 rounded-full bg-primary px-3 py-1 text-center text-xs font-semibold text-primary-foreground">Plan actual</p>}
    </article>
  );
}

function PlanCard({
  tier,
  title,
  price,
  description,
  features,
  currentTier,
  highlighted,
  disabled,
  busy,
  onSelect,
}: {
  tier: PlanTier;
  title: string;
  price: string;
  description: string;
  features: string[];
  currentTier: PlanTier;
  highlighted?: boolean;
  disabled?: boolean;
  busy?: boolean;
  onSelect?: () => void;
}) {
  const isCurrent = currentTier === tier;
  const isIncluded = tier === "premium" && currentTier === "premium_plus";
  const isPlus = tier === "premium_plus";
  return (
    <article
      className={`relative flex min-h-[540px] flex-col rounded-lg p-6 transition-all duration-300 hover:-translate-y-1 ${
        highlighted
          ? "plus-border-gradient plus-card-glow lg:scale-[1.03]"
          : "border border-border/60 bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-black/10"
      }`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-primary/50 bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary shadow-md shadow-primary/20">
          Mejor experiencia
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-3xl font-bold">
            {isPlus ? (
              <span className="bg-gradient-to-r from-primary via-amber-200 to-primary bg-clip-text text-transparent">
                {title}
              </span>
            ) : (
              title
            )}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        {highlighted && <Sparkles className="animate-premium-float h-5 w-5 shrink-0 text-primary" />}
      </div>
      <p className="mt-6 font-serif text-3xl font-bold">{price}</p>
      <p className="mt-1 text-xs text-muted-foreground">Facturacion y precios reales desde configuracion.</p>
      <div className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <p key={feature} className="flex gap-3 text-sm leading-6">
            <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
            <span>{feature}</span>
          </p>
        ))}
      </div>
      {tier === "free" ? (
        <Button asChild className="mt-6" variant="outline"><Link href="/catalogo">Seguir gratis</Link></Button>
      ) : (
        <Button
          className={`mt-6 ${highlighted ? "plus-cta font-semibold shadow-lg shadow-primary/25" : ""}`}
          size={highlighted ? "lg" : "default"}
          disabled={disabled || isCurrent || isIncluded || busy}
          onClick={onSelect}
          variant={highlighted ? "default" : "outline"}
        >
          {isCurrent ? "Plan actual" : isIncluded ? "Incluido en Plus" : busy ? "Abriendo checkout..." : isPlus ? "Mejorar a Plus" : `Elegir ${title}`}
          {highlighted && !isCurrent && !busy && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      )}
    </article>
  );
}

function FeaturePanel({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
  return (
    <article className="rounded-lg border border-border/60 bg-card p-6">
      <Icon className="h-6 w-6 text-primary" />
      <h3 className="mt-4 font-serif text-2xl font-bold">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p>
    </article>
  );
}
