"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  UploadCloud, FileText, Loader2, CheckCircle2, AlertTriangle,
  X, AlertCircle, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { importsApi } from "@/lib/api-creator";
import { cn } from "@/lib/utils";

interface ImportDialogProps {
  workId: number;
  open: boolean;
  onClose: () => void;
  /** Se llama al terminar la importación (para refrescar la lista). */
  onImported: () => void;
}

type ApiErr = { response?: { data?: { message?: string } } };

export function ImportDialog({ workId, open, onClose, onImported }: ImportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importId, setImportId] = useState<number | null>(null);
  const [publish, setPublish] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const notifiedDone = useRef(false);

  const start = useMutation({
    mutationFn: (file: File) => importsApi.start(workId, file),
    onSuccess: (data) => setImportId(data.id),
    onError: (e: ApiErr) =>
      toast.error(e?.response?.data?.message ?? "No se pudo subir el archivo."),
  });

  const statusQuery = useQuery({
    queryKey: ["import", workId, importId],
    queryFn: () => importsApi.status(workId, importId as number),
    enabled: importId !== null,
    retry: 1,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "uploaded" || s === "parsing" || s === "importing" ? 1200 : false;
    },
  });
  const imp = statusQuery.data;

  const confirm = useMutation({
    mutationFn: () => importsApi.confirm(importId as number, publish),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["import", workId, importId] }),
    onError: (e: ApiErr) =>
      toast.error(e?.response?.data?.message ?? "No se pudo iniciar la importación."),
  });

  // Al terminar: refresca la lista de capítulos (una sola vez).
  useEffect(() => {
    if (imp?.status === "done" && !notifiedDone.current) {
      notifiedDone.current = true;
      onImported();
    }
  }, [imp?.status, onImported]);

  const reset = () => {
    setImportId(null);
    setPublish(false);
    notifiedDone.current = false;
    start.reset();
    confirm.reset();
  };

  const handleClose = () => {
    // Limpia la sesión si quedó a medias (no si ya creó capítulos).
    if (importId && imp && ["preview_ready", "failed"].includes(imp.status)) {
      importsApi.remove(importId).catch(() => {});
    }
    reset();
    onClose();
  };

  const pickFile = (file?: File | null) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const maxMb: Record<string, number> = { txt: 5, docx: 25, epub: 100 };
    if (!(ext in maxMb)) {
      toast.error("Formato no soportado. Usa TXT, DOCX o EPUB.");
      return;
    }
    if (file.size > maxMb[ext] * 1024 * 1024) {
      toast.error(`El archivo supera el máximo de ${maxMb[ext]} MB para ${ext.toUpperCase()}.`);
      return;
    }
    start.mutate(file);
  };

  if (!open) return null;

  // Estado de la UI. Cualquier fallo (subida, parseo o polling) cae en "failed"
  // para que el modal NUNCA se quede colgado en "Analizando".
  const requestError = start.isError || statusQuery.isError;
  const errorDetail =
    imp?.error ??
    (start.error as ApiErr | undefined)?.response?.data?.message ??
    (statusQuery.error as ApiErr | undefined)?.response?.data?.message ??
    null;
  const status =
    requestError || imp?.status === "failed" || imp?.status === "canceled"
      ? "failed"
      : (imp?.status ?? (start.isPending ? "parsing" : "idle"));

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        aria-label="Cerrar"
        onClick={handleClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div className="relative z-10 flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-primary" />
            <h2 className="font-serif text-base font-bold">Importar libro</h2>
          </div>
          <button
            onClick={handleClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {/* ── Selección de archivo ── */}
          {status === "idle" && (
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  pickFile(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
                  dragOver ? "border-primary bg-primary/5" : "border-border/70 hover:border-primary/50",
                )}
              >
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Arrastra un archivo o haz clic para elegir</p>
                <p className="text-xs text-muted-foreground">
                  Detectamos los capítulos automáticamente.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.docx,.epub"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <FileText className="h-3 w-3" />
                <strong className="font-semibold">TXT</strong> (máx. 5 MB),{" "}
                <strong className="font-semibold">DOCX</strong> (máx. 25 MB) y{" "}
                <strong className="font-semibold">EPUB</strong> (máx. 100 MB).
              </p>
            </div>
          )}

          {/* ── Analizando ── */}
          {(status === "parsing" || status === "uploaded") && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm font-medium">Analizando el archivo…</p>
              <p className="text-xs text-muted-foreground">
                Detectando capítulos. Con archivos grandes puede tardar un momento.
              </p>
            </div>
          )}

          {/* ── Vista previa ── */}
          {status === "preview_ready" && imp && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-background p-3">
                <p className="text-sm">
                  Se detectaron <strong>{imp.total}</strong>{" "}
                  {imp.total === 1 ? "capítulo" : "capítulos"} ·{" "}
                  <strong>{imp.word_count.toLocaleString("es")}</strong> palabras
                  {imp.warning_count > 0 && (
                    <> · <span className="text-amber-500">{imp.warning_count} con avisos</span></>
                  )}
                </p>
              </div>

              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-1.5">
                {(imp.detected ?? []).map((c) => (
                  <li
                    key={c.order}
                    className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/30"
                  >
                    <span className="mt-0.5 inline-flex h-5 min-w-[22px] items-center justify-center rounded bg-accent px-1 text-[10px] font-bold tabular-nums">
                      {c.order}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c.title}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {c.word_count.toLocaleString("es")} palabras
                      </span>
                    </span>
                    {c.warning && (
                      <span title={c.warning} className="mt-0.5 shrink-0 text-amber-500">
                        <AlertCircle className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={publish}
                  onChange={(e) => setPublish(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Publicar los capítulos al importar
                <span className="text-xs text-muted-foreground">(si no, quedan en borrador)</span>
              </label>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
                <Button size="sm" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
                  {confirm.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Importar {imp.total} {imp.total === 1 ? "capítulo" : "capítulos"}
                </Button>
              </div>
            </div>
          )}

          {/* ── Importando ── */}
          {status === "importing" && imp && (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm font-medium">
                Creando capítulos… {imp.progress}/{imp.total}
              </p>
              <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-accent">
                <div
                  className="h-full bg-primary transition-[width] duration-300"
                  style={{ width: `${imp.total ? Math.round((imp.progress / imp.total) * 100) : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Resumen final ── */}
          {status === "done" && imp && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                <p className="font-serif text-lg font-bold">¡Importación completada!</p>
              </div>
              <dl className="grid grid-cols-2 gap-2">
                <Stat label="Capítulos creados" value={imp.created_count} highlight />
                <Stat label="Total detectados" value={imp.total} />
                <Stat label="Palabras" value={imp.word_count.toLocaleString("es")} />
                <Stat label="Con advertencias" value={imp.warning_count} warn={imp.warning_count > 0} />
                <Stat label="Con errores" value={imp.error_count} warn={imp.error_count > 0} />
                <Stat label="Tiempo" value={formatDuration(imp.started_at, imp.finished_at)} />
              </dl>
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                Ya puedes monetizarlos, programar Early Access o escucharlos como audiolibro.
              </p>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleClose}>Listo</Button>
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {status === "failed" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm font-medium">No pudimos analizar este archivo</p>
              <p className="text-xs text-muted-foreground">
                {errorDetail ?? "Ocurrió un error al procesarlo. Revisa que el archivo sea válido e inténtalo de nuevo."}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
                <Button size="sm" onClick={reset}>Reintentar</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, warn }: {
  label: string; value: number | string; highlight?: boolean; warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        highlight ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/60 bg-background",
      )}
    >
      <dd className={cn("text-lg font-bold tabular-nums", warn && "text-amber-500", highlight && "text-emerald-600")}>
        {value}
      </dd>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
    </div>
  );
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  if (ms < 1000) return "<1 s";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${s % 60} s`;
}
