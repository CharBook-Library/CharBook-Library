"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileText, X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bookFileApi, worksApi } from "@/lib/api-creator";

interface BookFileUploaderProps {
  workId: number;
}

const ACCEPT = [".epub", ".pdf", ".docx"];
const MAX_BYTES = 50 * 1024 * 1024;

export function BookFileUploader({ workId }: BookFileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [dragOver, setDragOver] = useState(false);

  const { data: work, isLoading } = useQuery({
    queryKey: ["work", workId],
    queryFn: async () => {
      const list = await worksApi.mine("all", 1);
      return list.data.find((w: any) => w.id === workId) ?? null;
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) => bookFileApi.upload(workId, file),
    onSuccess: () => {
      toast.success("Archivo subido correctamente");
      queryClient.invalidateQueries({ queryKey: ["work", workId] });
      queryClient.invalidateQueries({ queryKey: ["my-works"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? "No se pudo subir el archivo"),
  });

  const remove = useMutation({
    mutationFn: () => bookFileApi.remove(workId),
    onSuccess: () => {
      toast.success("Archivo eliminado");
      queryClient.invalidateQueries({ queryKey: ["work", workId] });
      queryClient.invalidateQueries({ queryKey: ["my-works"] });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const handleFile = (file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPT.includes(ext)) {
      toast.error("Formato no permitido. Usa: " + ACCEPT.join(", "));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("El archivo supera los 50 MB.");
      return;
    }
    upload.mutate(file);
  };

  const hasFile = !!(work as any)?.file_url;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium">Archivo del libro</h3>
        <p className="text-xs text-muted-foreground">
          Sube el contenido completo de tu obra en EPUB, PDF o DOCX.
        </p>
      </div>

      {hasFile ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">Archivo subido</p>
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-500">
                  {(work as any).file_type ?? "archivo"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {(work as any).file_size
                  ? `${((work as any).file_size / 1024 / 1024).toFixed(2)} MB`
                  : "Tamaño desconocido"}
                {" · "}
                Subido {new Date((work as any).updated_at).toLocaleDateString("es")}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                  disabled={upload.isPending}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Reemplazar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm("Eliminar el archivo del libro?")) remove.mutate();
                  }}
                  disabled={remove.isPending}
                  className="hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Quitar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`group relative rounded-md border-2 border-dashed p-8 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/30 hover:border-primary/40"
          }`}
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
          {upload.isPending || isLoading ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-xs">Subiendo archivo…</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <Upload className="h-8 w-8" />
              <p className="text-sm font-medium">
                Arrastra el archivo o haz clic
              </p>
              <p className="text-[11px] text-muted-foreground/70">
                EPUB, PDF, DOCX · Máximo 50 MB
              </p>
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
        className="hidden"
      />
    </div>
  );
}
