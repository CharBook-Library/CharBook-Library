"use client";

import type { ReactNode } from "react";
import { PdfReader } from "./pdf-reader";
import { useReaderMode } from "./premium-reader";

/**
 * Puente entre el `PremiumReader` (que guarda el modo de lectura y el tema) y el
 * `PdfReader`. Se renderiza como hijo del lector, así el server component solo
 * pasa la URL del archivo y el modo/tema se toman del contexto del lector.
 */
export function ChapterPdf(props: {
  fileUrl?: string;
  images?: string[];
  previewPages?: number;
  locked?: boolean;
  paywall?: ReactNode;
}) {
  const { pageMode, theme } = useReaderMode();
  return <PdfReader {...props} mode={pageMode} theme={theme} />;
}

export default ChapterPdf;
