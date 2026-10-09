"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VerifiedGate } from "@/components/auth/verified-gate";

interface Props {
  url: string;
  label?: string;
}

/**
 * Botón de descarga. Si el correo NO está verificado, abre VerifiedGate.
 * Si SÍ, abre el archivo en nueva pestaña (el navegador respeta el
 * Content-Disposition del backend para mostrar inline o descargar).
 */
export function DownloadButton({ url, label = "Descargar" }: Props) {
  const trigger = () => {
    // Abrimos en nueva pestaña. El backend manda Content-Disposition: inline,
    // así que el navegador lo mostrará si es PDF/EPUB soportado, o descargará.
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <VerifiedGate onAllow={trigger} reason="para descargar libros">
      {({ onClick }) => (
        <Button size="lg" variant="outline" onClick={onClick}>
          <Download className="mr-1.5 h-4 w-4" />
          {label}
        </Button>
      )}
    </VerifiedGate>
  );
}
