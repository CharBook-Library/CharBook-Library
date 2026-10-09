"use client";

import { useState } from "react";
import { HelpCircle, LayoutGrid, BookOpenText } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

/**
 * Icono discreto de ayuda: al pulsarlo abre un diálogo que explica
 * para qué sirve cada portada (cuadrada vs vertical) y dónde se muestran.
 */
export function CoverHelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="¿Para qué sirve cada portada?"
        title="¿Para qué sirve cada portada?"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Para qué sirve cada portada?</DialogTitle>
            <DialogDescription>
              Tu obra se muestra en distintos lugares de CharBook y cada uno
              usa un formato diferente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Vertical */}
            <div className="flex gap-4 rounded-lg border border-border/60 bg-card/50 p-3">
              <div className="flex w-20 shrink-0 items-center justify-center">
                <div className="flex aspect-[2/3] w-14 items-center justify-center rounded-md border-2 border-primary/50 bg-primary/10">
                  <BookOpenText className="h-5 w-5 text-primary/70" />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Portada vertical (2:3)</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Mínimo 1080 × 1920 px.
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Es la portada “de libro”. Se muestra en la{" "}
                  <strong className="text-foreground/90">página de detalle de tu obra</strong>,
                  en el <strong className="text-foreground/90">catálogo</strong> y en los{" "}
                  <strong className="text-foreground/90">carruseles de la portada</strong>{" "}
                  (Destacados, Recién añadidos…).
                </p>
              </div>
            </div>

            {/* Cuadrada */}
            <div className="flex gap-4 rounded-lg border border-border/60 bg-card/50 p-3">
              <div className="flex w-20 shrink-0 items-center justify-center">
                <div className="flex aspect-square w-16 items-center justify-center rounded-md border-2 border-amber-500/50 bg-amber-500/10">
                  <LayoutGrid className="h-5 w-5 text-amber-500/70" />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Portada cuadrada (1:1)</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Mínimo 1080 × 1080 px.
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Es la miniatura compacta. Se usa en{" "}
                  <strong className="text-foreground/90">tarjetas y listados</strong>,
                  en <strong className="text-foreground/90">resultados de búsqueda</strong>,
                  recomendaciones y en el <strong className="text-foreground/90">perfil de creador</strong>.
                </p>
              </div>
            </div>

            <p className="rounded-md bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              💡 Consejo: usa la misma ilustración en ambas versiones para que
              los lectores reconozcan tu obra en cualquier parte. Formatos
              admitidos: JPG, PNG o WebP, máx. 5 MB.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
