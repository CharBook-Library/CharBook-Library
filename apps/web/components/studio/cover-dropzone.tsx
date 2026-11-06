"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, ImageIcon, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoverDropzoneProps {
  label: string;
  aspectRatio: "square" | "portrait";
  /** Dimensiones MÍNIMAS requeridas (px). La imagen puede ser igual o mayor. */
  minWidth: number;
  minHeight: number;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  hint?: string;
  /** Versión reducida: cuadro pequeño y textos mínimos. */
  compact?: boolean;
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

/**
 * Dropzone con validación de dimensiones MÍNIMAS.
 * Acepta imágenes cuyo width ≥ minWidth y height ≥ minHeight.
 */
export function CoverDropzone({
  label,
  aspectRatio,
  minWidth,
  minHeight,
  value,
  onChange,
  hint,
  compact,
}: CoverDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [actualSize, setActualSize] = useState<{ w: number; h: number } | null>(null);

  const aspectCls = aspectRatio === "square" ? "aspect-square" : "aspect-[2/3]";
  const sizeLabel = `${minWidth} × ${minHeight}`;

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      setActualSize(null);

      if (!ACCEPT.includes(file.type)) {
        setError("Formato no admitido. Usa JPG, PNG o WebP.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("La imagen supera los 5 MB.");
        return;
      }

      setValidating(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result;
        if (typeof url !== "string") {
          setValidating(false);
          setError("No se pudo leer la imagen.");
          return;
        }

        // Validar dimensiones antes de aceptar
        const img = new Image();
        img.onload = () => {
          setValidating(false);
          setActualSize({ w: img.naturalWidth, h: img.naturalHeight });

          if (
            img.naturalWidth < minWidth ||
            img.naturalHeight < minHeight
          ) {
            setError(
              `La imagen debe ser al menos de ${sizeLabel} px. ` +
                `La imagen subida es ${img.naturalWidth} × ${img.naturalHeight} px.`
            );
            return;
          }
          onChange(url);
        };
        img.onerror = () => {
          setValidating(false);
          setError("La imagen está dañada o no se puede leer.");
        };
        img.src = url;
      };
      reader.onerror = () => {
        setValidating(false);
        setError("No se pudo leer el archivo.");
      };
      reader.readAsDataURL(file);
    },
    [onChange, minWidth, minHeight, sizeLabel]
  );

  const isValid = !!value && !error;

  return (
    <div className={cn(compact && (aspectRatio === "square" ? "w-32 sm:w-36" : "w-28 sm:w-32"))}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className={cn("font-medium", compact ? "text-xs" : "text-sm")}>{label}</label>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-semibold tracking-wider",
            compact ? "text-[9px]" : "text-[10px]",
            isValid
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-muted text-muted-foreground"
          )}
        >
          {sizeLabel}
        </span>
      </div>

      <div
        className={cn(
          "group relative overflow-hidden rounded-md border-2 border-dashed transition-colors",
          aspectCls,
          validating
            ? "border-primary bg-primary/5"
            : dragOver
              ? "border-primary bg-primary/10"
              : error
                ? "border-destructive/60 bg-destructive/5"
                : isValid
                  ? "border-emerald-500/60 bg-emerald-500/5"
                  : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        {value && !error ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Vista previa"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent p-2">
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-50">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Válida
              </span>
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setActualSize(null);
                  setError(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                aria-label="Quitar imagen"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-foreground shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </>
        ) : validating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">Validando dimensiones…</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground"
          >
            <Upload className={compact ? "h-4 w-4" : "h-6 w-6"} />
            <span className={cn("font-medium", compact ? "text-[10px]" : "text-xs")}>
              {compact ? "Subir" : "Arrastra o haz clic"}
            </span>
            {!compact && (
              <span className="text-[10px] text-muted-foreground/70 max-w-[80%] text-center leading-tight">
                Mínimo {sizeLabel} px · JPG, PNG, WebP · Máx 5 MB
              </span>
            )}
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="hidden"
        />
      </div>

      {error ? (
        <div className="mt-1.5">
          <p className="flex items-start gap-1 text-[11px] text-destructive">
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
            {error}
          </p>
          {actualSize && (
            <p className="mt-0.5 text-[10px] text-muted-foreground pl-4">
              Usa una imagen con al menos {sizeLabel} px en cualquier editor.
            </p>
          )}
        </div>
      ) : hint ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <ImageIcon className="h-3 w-3" />
          {hint}
        </p>
      ) : null}
    </div>
  );
}
