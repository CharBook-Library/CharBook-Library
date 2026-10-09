"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Lock, Sparkles, Crown, Clock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEntitlements, type FeatureState } from "@/hooks/use-entitlements";

/** Chip de estado: Disponible / Requiere Premium / Requiere Premium Plus / Próximamente. */
export function FeatureStateChip({ state, className }: { state: FeatureState; className?: string }) {
  const meta: Record<FeatureState, { label: string; icon: typeof Check; cls: string }> = {
    available: { label: "Disponible", icon: Check, cls: "border-emerald-500/40 text-emerald-500 bg-emerald-500/10" },
    requires_premium: { label: "Requiere Premium", icon: Crown, cls: "border-primary/40 text-primary bg-primary/10" },
    requires_premium_plus: { label: "Requiere Premium Plus", icon: Sparkles, cls: "border-primary/50 text-primary bg-primary/10" },
    coming_soon: { label: "Próximamente", icon: Clock, cls: "border-border/60 text-muted-foreground bg-muted/40" },
  };
  const m = meta[state];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", m.cls, className)}>
      <m.icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}

/**
 * Tarjeta de bloqueo profesional para una función Premium/Plus que el usuario
 * no puede usar todavía. Incluye CTA a /premium.
 */
export function FeatureLock({
  requires,
  title,
  description,
  className,
}: {
  requires: "premium" | "premium_plus";
  title: string;
  description?: string;
  className?: string;
}) {
  const isPlus = requires === "premium_plus";
  const Icon = isPlus ? Sparkles : Crown;
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/[0.07] to-transparent p-6 text-center",
        className,
      )}
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
        <Lock className="h-5 w-5 text-primary" />
      </span>
      <h3 className="mt-4 font-serif text-lg font-bold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      <Link
        href="/premium"
        className={cn(
          "mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-transform hover:scale-[1.03]",
          isPlus ? "plus-cta" : "bg-primary text-primary-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
        {isPlus ? "Obtener Premium Plus" : "Obtener Premium"}
      </Link>
    </div>
  );
}

/**
 * Envuelve contenido que requiere un entitlement. Si el usuario puede usarlo,
 * renderiza children; si no, muestra `<FeatureLock/>` (o un `fallback` propio).
 *
 * NOTA: es solo UX. La seguridad real está en el backend (middleware
 * `entitlement:<feature>` + validaciones en los servicios).
 */
export function FeatureGate({
  feature,
  title,
  description,
  fallback,
  children,
}: {
  feature: string;
  title: string;
  description?: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can, requires } = useEntitlements();
  if (can(feature)) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  const req = requires(feature) === "premium_plus" ? "premium_plus" : "premium";
  return <FeatureLock requires={req} title={title} description={description} />;
}
