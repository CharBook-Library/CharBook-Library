"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";

/**
 * Descarga la obra del creador en un solo archivo (EPUB), respetando el acceso
 * del lector (el backend solo incluye los capítulos a los que tiene derecho).
 * Se renderiza únicamente cuando el creador habilitó la descarga.
 */
export function DownloadWorkButton({ slug, title }: { slug: string; title: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.get(`/books/${slug}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || "obra").replace(/[^\w\s.-]+/g, "").trim() || "obra"}.epub`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(
        status === 403
          ? "El autor no permite descargar esta obra."
          : status === 404
            ? "No hay contenido disponible para descargar."
            : "No se pudo descargar. Inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col">
      <Button variant="outline" size="lg" onClick={handleDownload} disabled={busy} className="border-border/60">
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
        Descargar
      </Button>
      {error && <span className="mt-1 max-w-[12rem] text-[11px] text-destructive">{error}</span>}
    </div>
  );
}
