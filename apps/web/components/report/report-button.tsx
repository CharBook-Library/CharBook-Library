"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Flag, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { reportsApi } from "@/lib/api-creator";
import { useAuth } from "@/hooks/use-auth";
import type { ReportReason, ReportTargetType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: number;
  variant?: "icon" | "full";
  className?: string;
}

const REASONS: { key: ReportReason; emoji: string; label: string }[] = [
  { key: "spam", emoji: "🚫", label: "Spam o publicidad" },
  { key: "abuse", emoji: "⚠️", label: "Abuso, acoso u odio" },
  { key: "inappropriate", emoji: "🔞", label: "Contenido inapropiado" },
  { key: "copyright", emoji: "©️", label: "Infracción de copyright" },
  { key: "misleading", emoji: "🎭", label: "Información engañosa" },
  { key: "illegal", emoji: "🚓", label: "Contenido ilegal" },
  { key: "other", emoji: "❓", label: "Otro motivo" },
];

export function ReportButton({
  targetType,
  targetId,
  variant = "icon",
  className,
}: ReportButtonProps) {
  const router = useRouter();
  const t = useTranslations("report");
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      reportsApi.create({
        target_type: targetType,
        target_id: targetId,
        reason: selected!,
        details: details.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t("success"));
      setOpen(false);
      setSelected(null);
      setDetails("");
    },
    onError: (e: { response?: { status?: number; data?: { message?: string } } }) => {
      if (e.response?.status === 429) {
        toast.info(t("duplicate"));
      } else {
        toast.error(e.response?.data?.message ?? "No se pudo enviar el reporte");
      }
    },
  });

  const handleOpen = () => {
    if (!isAuthenticated) {
      toast("Inicia sesión para reportar contenido", {
        action: {
          label: "Login",
          onClick: () => router.push("/login"),
        },
      });
      return;
    }
    setOpen(true);
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={handleOpen}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive",
            className
          )}
          title={t("button")}
          aria-label={t("button")}
        >
          <Flag className="h-3.5 w-3.5" />
        </button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpen}
          className={cn(
            "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
            className
          )}
        >
          <Flag className="mr-1.5 h-3.5 w-3.5" />
          {t("button")}
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-serif text-2xl">
              {t("dialog_title")}
            </SheetTitle>
            <SheetDescription>{t("select_reason")}</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Lista de razones */}
            <div className="space-y-1.5">
              {REASONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setSelected(r.key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                    selected === r.key
                      ? "border-primary bg-primary/10"
                      : "border-border/60 hover:border-primary/40"
                  )}
                >
                  <span className="text-xl">{r.emoji}</span>
                  <span className="flex-1 text-sm font-medium">{r.label}</span>
                  {selected === r.key && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>

            {/* Detalles */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("details_label")}
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={t("details_placeholder")}
                className="mt-1.5 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
            </div>

            {/* Submit */}
            <Button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={!selected || mutation.isPending}
              className="w-full bg-destructive text-white hover:bg-destructive/90"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("submit")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
