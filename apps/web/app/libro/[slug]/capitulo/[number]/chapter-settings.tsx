"use client";

import { useEffect, useState } from "react";
import { Settings2, AArrowDown, AArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "charbook_reader_size";

export function ChapterSettings() {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<number>(17);

  // Leer preferencia guardada y aplicar
  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) {
        const n = Number(stored);
        if (!isNaN(n) && n >= 14 && n <= 22) setSize(n);
      }
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--reader-font-size", `${size}px`);
    try { localStorage.setItem(KEY, String(size)); } catch {}

    // Aplicar al contenido del lector si existe
    const el = document.querySelector<HTMLElement>(".reader-content");
    if (el) el.style.fontSize = `${size}px`;
  }, [size]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Ajustes del lector"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Settings2 className="h-4 w-4" />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-10 z-40 w-64 rounded-md border border-border/60 bg-popover p-3 shadow-lg"
        >
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
            Tamaño de letra
          </p>
          <div className="flex items-center justify-between gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setSize((s) => Math.max(14, s - 1))}
              disabled={size <= 14}
              className="h-8 w-8"
              aria-label="Reducir"
            >
              <AArrowDown className="h-3.5 w-3.5" />
            </Button>
            <span className="font-serif text-base tabular-nums">{size}px</span>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setSize((s) => Math.min(22, s + 1))}
              disabled={size >= 22}
              className="h-8 w-8"
              aria-label="Aumentar"
            >
              <AArrowUp className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground/70 text-center">
            Recomendado: 17px
          </p>
        </div>
      )}
    </div>
  );
}
