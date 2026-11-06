import { Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Insignia de membresía. `plan="premium_plus"` (por defecto) muestra la insignia
 * Premium Plus; `plan="premium"` la de Premium. Úsala SOLO cuando el plan está
 * activo (la decisión la toma quien la renderiza, p. ej. con useEntitlements).
 */
export function PlusBadge({
  plan = "premium_plus",
  size = "sm",
  className,
  title,
}: {
  plan?: "premium" | "premium_plus";
  size?: "xs" | "sm" | "md";
  className?: string;
  title?: string;
}) {
  const isPlus = plan === "premium_plus";
  const Icon = isPlus ? Sparkles : Crown;
  const sizes = {
    xs: "h-4 gap-0.5 px-1.5 text-[9px]",
    sm: "h-5 gap-1 px-2 text-[10px]",
    md: "h-6 gap-1.5 px-2.5 text-xs",
  } as const;
  const icon = { xs: "h-2.5 w-2.5", sm: "h-3 w-3", md: "h-3.5 w-3.5" } as const;

  return (
    <span
      title={title ?? (isPlus ? "Miembro Premium Plus" : "Miembro Premium")}
      className={cn(
        isPlus ? "member-chip-plus" : "member-chip-premium",
        "inline-flex items-center rounded-full font-semibold uppercase tracking-wide",
        sizes[size],
        className,
      )}
    >
      <Icon className={cn(icon[size], isPlus && "animate-premium-float")} />
      {isPlus ? "Plus" : "Premium"}
    </span>
  );
}
