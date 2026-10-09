import { ShoppingCart, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { AffiliateLink, AffiliateVendor } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BuyButtonsProps {
  links: AffiliateLink[];
}

/**
 * Sección "Cómpralo en..." con enlaces afiliados.
 * Server-friendly: solo es un anchor `<a>` que abre nueva pestaña.
 * El backend trackea el click + redirige al vendor.
 */
export function BuyButtons({ links }: BuyButtonsProps) {
  if (!links || links.length === 0) return null;

  return (
    <Card className="border-border/60 bg-card/80 p-5">
      <div className="mb-4 flex items-center gap-2">
        <ShoppingCart className="h-4 w-4 text-primary" />
        <h3 className="font-serif text-lg font-bold">Cómpralo en</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
          (enlaces afiliados)
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {links.map((link) => (
          <BuyLink key={link.id} link={link} />
        ))}
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground/70">
        Al comprar a través de estos enlaces, CharBook Library puede recibir
        una pequeña comisión sin coste adicional para ti. ¡Gracias por
        apoyarnos!
      </p>
    </Card>
  );
}

function BuyLink({ link }: { link: AffiliateLink }) {
  const config = VENDOR_STYLES[link.vendor] ?? VENDOR_STYLES.other;

  return (
    <a
      href={link.go_url}
      target="_blank"
      rel="nofollow noopener noreferrer sponsored"
      className={cn(
        "group flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-all hover:scale-[1.02] hover:shadow-lg",
        config.className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-bold text-xs",
            config.iconBg
          )}
        >
          {config.icon}
        </span>
        <div className="min-w-0">
          <div className="font-semibold leading-tight">{link.vendor_label}</div>
          {link.label && (
            <div className="truncate text-xs opacity-70">{link.label}</div>
          )}
        </div>
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
    </a>
  );
}

const VENDOR_STYLES: Record<
  AffiliateVendor,
  { className: string; iconBg: string; icon: string }
> = {
  amazon: {
    className: "border-[#FF9900]/40 bg-[#FF9900]/5 hover:border-[#FF9900]",
    iconBg: "bg-[#FF9900] text-black",
    icon: "a",
  },
  kobo: {
    className: "border-[#68C5F2]/40 bg-[#68C5F2]/5 hover:border-[#68C5F2]",
    iconBg: "bg-[#68C5F2] text-black",
    icon: "K",
  },
  audible: {
    className: "border-[#F7A716]/40 bg-[#F7A716]/5 hover:border-[#F7A716]",
    iconBg: "bg-[#F7A716] text-black",
    icon: "♪",
  },
  apple_books: {
    className: "border-zinc-400/40 bg-zinc-400/5 hover:border-zinc-400",
    iconBg: "bg-white text-black",
    icon: "",
  },
  google_play: {
    className: "border-[#34A853]/40 bg-[#34A853]/5 hover:border-[#34A853]",
    iconBg: "bg-[#34A853] text-white",
    icon: "▶",
  },
  barnes_noble: {
    className: "border-[#0a8a3a]/40 bg-[#0a8a3a]/5 hover:border-[#0a8a3a]",
    iconBg: "bg-[#0a8a3a] text-white",
    icon: "B",
  },
  other: {
    className: "border-border/60 bg-card hover:border-primary/40",
    iconBg: "bg-primary text-primary-foreground",
    icon: "?",
  },
};
