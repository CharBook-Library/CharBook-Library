"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Headphones, X, Sparkles, Play, FileText, Check, Clock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { FeatureLock } from "@/components/premium/feature-gate";
import { AI_VOICES, plusApi, type AiVoice } from "@/lib/api-plus";

/* Botón "Audiolibro IA" del lector (libro / serie / cómic). Placeholder: aún no
   genera audio — solo guarda la voz preferida. Quien no es Plus ve el paywall. */
export function AiAudiobookButton({ muted }: { muted?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ToolbarIcon onClick={() => setOpen(true)} label="Audiolibro IA (Premium Plus)" muted={muted}>
        <Headphones className="h-4 w-4" />
      </ToolbarIcon>
      {open && <AudiobookModal onClose={() => setOpen(false)} />}
    </>
  );
}

/* Botón "Resumen IA" — opción aparte, también próximamente (Premium Plus). */
export function AiSummaryButton({ muted }: { muted?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ToolbarIcon onClick={() => setOpen(true)} label="Resumen IA (Premium Plus)" muted={muted}>
        <FileText className="h-4 w-4" />
      </ToolbarIcon>
      {open && <SummaryModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ToolbarIcon({ onClick, label, muted, children }: { onClick: () => void; label: string; muted?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn("inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-accent/40", muted)}
    >
      {children}
    </button>
  );
}

/**
 * Modal en PORTAL a `document.body`. Necesario porque el toolbar del lector usa
 * `transform` (translate-y para auto-ocultarse) y eso rompe el `position: fixed`
 * del modal (quedaba pegado arriba). El portal lo saca de ese contexto y centra.
 */
function PlusModal({
  title, subtitle, icon: Icon, onClose, children,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  onClose: () => void;
  children: ReactNode;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal>
      <button onClick={onClose} aria-label="Cerrar" className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border/60 bg-card p-6 text-foreground shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/40" aria-label="Cerrar">
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </span>
          <div>
            <h2 className="font-serif text-lg font-bold">{title}</h2>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function AudiobookModal({ onClose }: { onClose: () => void }) {
  const { isPremiumPlus } = useEntitlements();
  const { user } = useAuth();
  const [voice, setVoice] = useState<AiVoice>(
    (user?.preferences?.reader_voice as AiVoice | undefined) ?? "calida",
  );
  const [saving, setSaving] = useState(false);

  const pickVoice = async (v: AiVoice) => {
    setVoice(v);
    setSaving(true);
    try {
      await plusApi.setVoice(v);
    } catch {
      /* placeholder: conservamos la selección local si falla */
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlusModal title="Audiolibro IA" subtitle="Escucha tus lecturas con voces IA." icon={Headphones} onClose={onClose}>
      {!isPremiumPlus ? (
        <FeatureLock
          requires="premium_plus"
          title="Exclusivo de Premium Plus"
          description="Los audiolibros con voces IA son una función de Premium Plus."
        />
      ) : (
        <div className="space-y-5">
          <div className="flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/[0.06] px-4 py-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm text-foreground/90">
              Los <strong>audiolibros IA</strong> estarán disponibles <strong>próximamente</strong> para
              miembros Premium Plus. Mientras tanto, deja elegida tu voz preferida.
            </p>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> Elige tu voz
              {saving && <span className="font-normal normal-case">· guardando…</span>}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {AI_VOICES.map((v) => {
                const active = voice === v.key;
                return (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => pickVoice(v.key)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                      active ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/40",
                    )}
                  >
                    <span>{v.name}</span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            disabled
            title="Próximamente"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary/30 px-4 py-2.5 text-sm font-semibold text-primary-foreground/80"
          >
            <Play className="h-4 w-4" /> Reproducir audiolibro · Próximamente
          </button>
        </div>
      )}
    </PlusModal>
  );
}

function SummaryModal({ onClose }: { onClose: () => void }) {
  const { isPremiumPlus } = useEntitlements();
  return (
    <PlusModal title="Resumen IA" subtitle="Resúmenes inteligentes de tus lecturas." icon={FileText} onClose={onClose}>
      {!isPremiumPlus ? (
        <FeatureLock
          requires="premium_plus"
          title="Exclusivo de Premium Plus"
          description="Los resúmenes inteligentes son una función de Premium Plus."
        />
      ) : (
        <div className="space-y-3">
          {[
            { t: "Resumen del libro", d: "Un vistazo rápido de la obra completa." },
            { t: "Resumen del capítulo", d: "Repasa lo esencial de este capítulo." },
          ].map((row) => (
            <div key={row.t} className="rounded-xl border border-border/60 bg-background p-4">
              <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                {row.t}
                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" /> Próximamente
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{row.d}</p>
            </div>
          ))}
          <p className="text-center text-xs text-muted-foreground">
            Resúmenes inteligentes próximamente para miembros Premium Plus.
          </p>
        </div>
      )}
    </PlusModal>
  );
}
