"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sun, Moon, Monitor, Type, Globe, Bell, ShieldAlert, Music, Loader2, Save,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { accountApi } from "@/lib/api-auth";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const THEMES = [
  { key: "light", label: "Claro", icon: Sun },
  { key: "dark", label: "Oscuro", icon: Moon },
  { key: "system", label: "Sistema", icon: Monitor },
];

const FONTS = [
  { key: "serif", label: "Serif (clásico)" },
  { key: "sans", label: "Sans (moderno)" },
  { key: "mono", label: "Monoespaciada" },
];

const EMAIL_FREQ = [
  { key: "realtime", label: "Tiempo real" },
  { key: "daily", label: "Resumen diario" },
  { key: "weekly", label: "Resumen semanal" },
  { key: "never", label: "Nunca" },
];

const FILTERS = [
  { key: "safe", label: "Seguro", desc: "Solo contenido para todo público." },
  { key: "standard", label: "Estándar", desc: "Lo más común, sin contenido explícito." },
  { key: "explicit", label: "Sin filtros", desc: "Incluye contenido para adultos." },
];

export default function PreferenciasPage() {
  const { user } = useAuth();
  const initial = (user?.preferences ?? {}) as any;

  const [theme, setTheme] = useState(initial.theme ?? "system");
  const [font, setFont] = useState(initial.reading_font ?? "serif");
  const [size, setSize] = useState(initial.reading_size ?? 100);
  const [emailFreq, setEmailFreq] = useState(initial.email_frequency ?? "realtime");
  const [push, setPush] = useState<boolean>(initial.push_notifications ?? true);
  const [filter, setFilter] = useState(initial.content_filter ?? "standard");
  const [autoplay, setAutoplay] = useState<boolean>(initial.autoplay_audio ?? false);

  // Aplica el tema inmediatamente al body
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", sysDark);
    } else {
      root.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  const save = useMutation({
    mutationFn: () => accountApi.updatePreferences({
      theme, reading_font: font, reading_size: size,
      email_frequency: emailFreq, push_notifications: push,
      content_filter: filter, autoplay_audio: autoplay,
    }),
    onSuccess: () => toast.success("Preferencias guardadas."),
    onError: () => toast.error("No se pudieron guardar."),
  });

  return (
    <div className="space-y-6">
      <SectionCard icon={Monitor} title="Apariencia" desc="Define cómo se ve CharBook.">
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => {
            const Icon = t.icon;
            const active = theme === t.key;
            return (
              <button key={t.key} onClick={() => setTheme(t.key as any)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-md border-2 p-3 text-xs transition-colors",
                  active ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/30"
                )}>
                <Icon className="h-5 w-5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard icon={Type} title="Lectura" desc="Fuente y tamaño en lectores de capítulos.">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium">Fuente</p>
            <div className="flex flex-wrap gap-2">
              {FONTS.map((f) => (
                <button key={f.key} onClick={() => setFont(f.key as any)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs",
                    font === f.key ? "border-primary bg-primary/10 text-primary" : "border-border/60"
                  )}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">Tamaño del texto: {size}%</p>
              <button onClick={() => setSize(100)} className="text-[10px] text-muted-foreground hover:text-foreground">
                Restablecer
              </button>
            </div>
            <input type="range" min="80" max="160" step="10" value={size}
              onChange={(e) => setSize(parseInt(e.target.value))} className="w-full" />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Bell} title="Notificaciones" desc="Cómo te avisamos.">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium">Correos electrónicos</p>
            <div className="flex flex-wrap gap-2">
              {EMAIL_FREQ.map((f) => (
                <button key={f.key} onClick={() => setEmailFreq(f.key as any)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs",
                    emailFreq === f.key ? "border-primary bg-primary/10 text-primary" : "border-border/60"
                  )}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <SwitchRow label="Notificaciones push" desc="Avisos en navegador y móvil." checked={push} onChange={setPush} />
        </div>
      </SectionCard>

      <SectionCard icon={ShieldAlert} title="Contenido" desc="Qué tipo de obras te mostramos.">
        <div className="grid gap-2 sm:grid-cols-3">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key as any)}
              className={cn(
                "rounded-md border p-3 text-left transition-colors",
                filter === f.key ? "border-primary bg-primary/5" : "border-border/60"
              )}>
              <p className="text-sm font-medium">{f.label}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{f.desc}</p>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard icon={Music} title="Audio" desc="Comportamiento de audiolibros y previews.">
        <SwitchRow label="Reproducción automática" desc="Inicia el audio cuando se abre un libro." checked={autoplay} onChange={setAutoplay} />
      </SectionCard>

      <div className="sticky bottom-4 z-10">
        <Button size="lg" className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar preferencias
        </Button>
      </div>
    </div>
  );
}

function SectionCard({ icon: Icon, title, desc, children }: { icon: any; title: string; desc: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <Icon className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-medium">{title}</h2>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

function SwitchRow({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer rounded-md border border-border/60 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)} role="switch" aria-checked={checked}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted"
        )}>
        <span className={cn(
          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform",
          checked && "translate-x-4"
        )} />
      </button>
    </label>
  );
}
