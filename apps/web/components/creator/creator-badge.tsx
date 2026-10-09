import { BadgeCheck, Trophy, Feather } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreatorLevel } from "@/lib/types";

interface CreatorBadgeProps {
  level: CreatorLevel | undefined;
  /**
   * Tres tamaños — la mayoría de listados usan "xs".
   * El perfil hero usa "md" o "lg".
   */
  size?: "xs" | "sm" | "md" | "lg";
  /** Solo icono (sin texto) — útil al lado de un nombre. */
  iconOnly?: boolean;
  className?: string;
}

/**
 * Insignia del creador. NO renderiza nada para "none".
 *  - basic     → 🪶 Creador (gris suave)
 *  - verified  → ✓ Autor verificado (verde)
 *  - featured  → 🏆 Destacado (dorado)
 */
export function CreatorBadge({
  level,
  size = "xs",
  iconOnly = false,
  className,
}: CreatorBadgeProps) {
  if (!level || level === "none") return null;

  const cfg = LEVEL_CONFIG[level];
  const Icon = cfg.icon;

  const sizeCls = {
    xs: "h-3.5 px-1 text-[10px] gap-0.5",
    sm: "h-5 px-1.5 text-[11px] gap-1",
    md: "h-6 px-2 text-xs gap-1",
    lg: "h-7 px-2.5 text-sm gap-1.5",
  }[size];

  const iconCls = {
    xs: "h-2.5 w-2.5",
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  }[size];

  if (iconOnly) {
    return (
      <span
        title={cfg.label}
        aria-label={cfg.label}
        className={cn("inline-flex items-center justify-center", cfg.iconColor, className)}
      >
        <Icon className={iconCls} />
      </span>
    );
  }

  return (
    <span
      title={cfg.tooltip}
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        sizeCls,
        cfg.boxCls,
        className
      )}
    >
      <Icon className={iconCls} />
      <span>{cfg.label}</span>
    </span>
  );
}

const LEVEL_CONFIG: Record<
  Exclude<CreatorLevel, "none">,
  {
    label: string;
    tooltip: string;
    icon: typeof BadgeCheck;
    iconColor: string;
    boxCls: string;
  }
> = {
  basic: {
    label: "Creador",
    tooltip: "Publica obras en CharBook",
    icon: Feather,
    iconColor: "text-muted-foreground",
    boxCls: "border-border/60 bg-muted/50 text-muted-foreground",
  },
  verified: {
    label: "Verificado",
    tooltip: "Autor Verificado por CharBook",
    icon: BadgeCheck,
    iconColor: "text-emerald-400",
    boxCls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-400",
  },
  featured: {
    label: "Destacado",
    tooltip: "Autor Destacado por CharBook",
    icon: Trophy,
    iconColor: "text-amber-500",
    boxCls: "border-amber-400/40 bg-amber-400/10 text-amber-500",
  },
};
