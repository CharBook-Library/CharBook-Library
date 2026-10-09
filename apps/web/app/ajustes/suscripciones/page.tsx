"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  Check,
  CreditCard,
  Crown,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { monetizationApi } from "@/lib/api-monetization";
import { useAuth } from "@/hooks/use-auth";

/**
 * Mi membresía — experiencia propia de CharBook.
 * Aquí solo se MUESTRA el estado y se decide; toda acción sensible
 * (cancelar, tarjeta, facturas, datos de pago) abre Stripe Customer Portal.
 */

type PlanTier = "free" | "premium" | "premium_plus";
type SubRow = { plan?: string; status?: string; current_period_end?: string | null; cancel_at_period_end?: boolean };
type SubInfo = { tier?: string; subscriptions?: SubRow[]; prices?: { premium_usd?: number | string; premium_plus_usd?: number | string } };
type ApiError = { response?: { data?: { message?: string } } };

const PLAN_META: Record<PlanTier, { label: string; icon: typeof Crown; benefits: string[] }> = {
  free: {
    label: "Gratis",
    icon: CreditCard,
    benefits: ["Catálogo gratuito completo", "Biblioteca, reseñas y comunidad", "CharCoins se compran aparte"],
  },
  premium: {
    label: "Premium",
    icon: Crown,
    benefits: ["Sin anuncios", "Temas y tipografías exclusivos", "Lectura offline compatible", "Premium Picks", "Descuento en desbloqueos", "Soporte prioritario"],
  },
  premium_plus: {
    label: "Premium Plus",
    icon: Sparkles,
    benefits: ["Todo Premium", "Acceso anticipado a capítulos", "Catálogo Unlimited participante", "Recompensas mensuales exclusivas", "Mayor apoyo a creadores (Creator Fund)"],
  },
};

function statusInfo(sub?: SubRow): { label: string; tone: string } {
  if (!sub) return { label: "Sin suscripción de pago", tone: "text-muted-foreground" };
  if (sub.cancel_at_period_end) return { label: "Cancelada (activa hasta fin del periodo)", tone: "text-amber-500" };
  switch (sub.status) {
    case "active": return { label: "Activa", tone: "text-emerald-500" };
    case "trialing": return { label: "Periodo de prueba", tone: "text-emerald-500" };
    case "past_due": return { label: "Pago vencido", tone: "text-destructive" };
    case "canceled": return { label: "Cancelada", tone: "text-destructive" };
    default: return { label: sub.status ?? "—", tone: "text-muted-foreground" };
  }
}

export default function SuscripcionesPage() {
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<SubInfo>({
    queryKey: ["membership"],
    queryFn: () => monetizationApi.subscription(),
    retry: false,
  });

  const tier: PlanTier =
    data?.tier === "premium" || data?.tier === "premium_plus"
      ? data.tier
      : user?.subscription_tier === "premium" || user?.subscription_tier === "premium_plus"
        ? user.subscription_tier
        : "free";

  const activeSub = data?.subscriptions?.find((s) => s.status === "active" || s.status === "trialing");
  const hasBilling = Boolean(activeSub);
  const status = statusInfo(activeSub);
  const meta = PLAN_META[tier];
  const PlanIcon = meta.icon;
  const renewal = activeSub?.current_period_end
    ? new Date(activeSub.current_period_end).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const openPortal = async () => {
    setBusy("portal");
    setMsg(null);
    try {
      const { url } = await monetizationApi.billingPortal();
      window.location.assign(url);
    } catch (error: unknown) {
      setMsg((error as ApiError)?.response?.data?.message ?? "No se pudo abrir el portal de facturación.");
      setBusy(null);
    }
  };

  const upgrade = async (plan: "premium" | "premium_plus") => {
    setBusy(plan);
    setMsg(null);
    try {
      const { url } = await monetizationApi.checkout({ plan });
      window.location.assign(url);
    } catch (error: unknown) {
      setMsg((error as ApiError)?.response?.data?.message ?? "No se pudo abrir el checkout.");
      setBusy(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-serif text-2xl font-bold">Mi membresía</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu plan de lectura en CharBook. Los pagos y datos sensibles se gestionan de forma segura en Stripe.
        </p>
      </header>

      {/* PLAN ACTUAL */}
      <section className={tier === "premium_plus" ? "plus-border-gradient rounded-lg p-6" : "rounded-lg border border-border/60 bg-card p-6"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
              <PlanIcon className="h-5 w-5 text-primary" />
            </span>
            <div>
              <p className="font-serif text-xl font-bold">{meta.label}</p>
              <p className={`text-sm ${status.tone}`}>{status.label}</p>
            </div>
          </div>
          {tier !== "free" && !hasBilling && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <BadgeCheck className="h-3.5 w-3.5" /> Otorgada por CharBook
            </span>
          )}
        </div>

        {renewal && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 text-primary" />
            {activeSub?.cancel_at_period_end ? "Acceso hasta el" : "Próximo cobro:"}{" "}
            <strong className="text-foreground">{renewal}</strong>
          </p>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {meta.benefits.map((benefit) => (
            <p key={benefit} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {benefit}
            </p>
          ))}
        </div>

        {/* CTAs — sensibles van al Portal de Stripe */}
        <div className="mt-6 flex flex-wrap gap-3">
          {tier === "free" && (
            <>
              <Button onClick={() => upgrade("premium")} disabled={busy !== null}>
                <Crown className="mr-2 h-4 w-4" /> Mejorar a Premium
              </Button>
              <Button className="plus-cta font-semibold" onClick={() => upgrade("premium_plus")} disabled={busy !== null}>
                <Sparkles className="mr-2 h-4 w-4" /> Mejorar a Premium Plus
              </Button>
            </>
          )}
          {tier === "premium" && (
            <Button className="plus-cta font-semibold" onClick={() => upgrade("premium_plus")} disabled={busy !== null}>
              <Sparkles className="mr-2 h-4 w-4" /> Mejorar a Premium Plus <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          {hasBilling && (
            <>
              <Button variant="outline" onClick={openPortal} disabled={busy !== null}>
                <CreditCard className="mr-2 h-4 w-4" /> Gestionar pago y facturación
              </Button>
              <Button variant="outline" onClick={openPortal} disabled={busy !== null}>
                <FileText className="mr-2 h-4 w-4" /> Ver facturas
              </Button>
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={openPortal} disabled={busy !== null}>
                <XCircle className="mr-2 h-4 w-4" /> Cancelar suscripción
              </Button>
            </>
          )}
        </div>
        {hasBilling && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ExternalLink className="h-3 w-3" /> Estas acciones abren el portal seguro de Stripe. CharBook nunca guarda tu tarjeta.
          </p>
        )}
        {msg && <p className="mt-3 text-sm text-destructive">{msg}</p>}
      </section>

      {/* COMPARACIÓN RÁPIDA */}
      <section className="rounded-lg border border-border/60 bg-card p-5">
        <h3 className="font-semibold">Comparación rápida</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(Object.keys(PLAN_META) as PlanTier[]).map((p) => (
            <div key={p} className={`rounded-lg border p-4 ${p === tier ? "border-primary/50 bg-primary/5" : "border-border/50"}`}>
              <p className="flex items-center justify-between text-sm font-semibold">
                {PLAN_META[p].label}
                {p === tier && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">ACTUAL</span>}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {PLAN_META[p].benefits.slice(0, 3).map((b) => <li key={b}>· {b}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          ¿Quieres el detalle completo?{" "}
          <Link href="/premium" className="text-primary underline-offset-2 hover:underline">Compara los planes</Link>.
        </p>
      </section>

      <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={busy !== null}>
        Actualizar estado
      </Button>
    </div>
  );
}
