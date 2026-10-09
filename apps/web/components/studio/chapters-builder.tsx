"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, GripVertical, Pencil, Copy, Trash2, Loader2, Save, X,
  ChevronUp, ChevronDown, FileText, Eye, Upload, Send, Images,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { chaptersApi, comicPagesApi } from "@/lib/api-creator";
import type { Chapter } from "@/lib/types";
import { ImportDialog } from "./import-dialog";
import { ComicPagesBuilder } from "./comic-pages-builder";

interface ChaptersBuilderProps {
  workId: number;
  workIsPublished?: boolean;
}

export function ChaptersBuilder({ workId, workIsPublished = false }: ChaptersBuilderProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Chapter | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const comicRef = useRef<HTMLInputElement>(null);

  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ["chapters", workId],
    queryFn: () => chaptersApi.list(workId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["chapters", workId] });

  // Capítulos en borrador que YA tienen contenido (texto o archivo): si la obra
  // está publicada, estos no se ven hasta publicarlos uno a uno. Botón en lote.
  const pendingChapters = chapters.filter(
    (c) => !c.is_published && (!!c.body?.trim() || !!c.file_url),
  );

  const publishPending = useMutation({
    mutationFn: async () => {
      for (const c of pendingChapters) {
        await chaptersApi.update(c.id, { is_published: true });
      }
    },
    onSuccess: () => {
      toast.success(
        `${pendingChapters.length} capítulo${pendingChapters.length === 1 ? "" : "s"} publicado${pendingChapters.length === 1 ? "" : "s"}`,
      );
      invalidate();
    },
    onError: () => toast.error("No se pudieron publicar los capítulos"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      chaptersApi.create(workId, {
        title: `Capítulo ${chapters.length + 1}`,
      }),
    onSuccess: (chapter) => {
      toast.success("Capítulo creado");
      invalidate();
      setEditing(chapter);
    },
    onError: () => toast.error("No se pudo crear"),
  });

  const reorderMutation = useMutation({
    mutationFn: (order: number[]) => chaptersApi.reorder(workId, order),
    onSuccess: () => invalidate(),
    onError: () => toast.error("No se pudo reordenar"),
  });

  // Auto-detección: un ZIP/CBZ con carpetas → un capítulo por carpeta (webtoon).
  const importComic = useMutation({
    mutationFn: (file: File) => comicPagesApi.importComicSeries(workId, file),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidate();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? "No se pudo importar el cómic"),
  });

  const move = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= chapters.length) return;
    const order = chapters.map((c) => c.id);
    [order[idx], order[next]] = [order[next], order[idx]];
    reorderMutation.mutate(order);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-medium">Capítulos</h3>
          <p className="text-xs text-muted-foreground">
            {chapters.length} {chapters.length === 1 ? "capítulo" : "capítulos"} ·
            Reordena con las flechas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Importar libro
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => comicRef.current?.click()}
            disabled={importComic.isPending}
            title="Sube un ZIP/CBZ con una carpeta por capítulo y se crean solos (webtoon)"
          >
            {importComic.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Images className="mr-1.5 h-3.5 w-3.5" />
            )}
            Importar cómic
          </Button>
          <input
            ref={comicRef}
            type="file"
            accept=".cbz,.zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importComic.mutate(f);
              if (comicRef.current) comicRef.current.value = "";
            }}
          />
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Nuevo capítulo
          </Button>
        </div>
      </div>

      {/* Aviso: obra publicada con capítulos listos pero en borrador */}
      {workIsPublished && pendingChapters.length > 0 && (
        <div className="flex flex-col gap-3 rounded-md border border-primary/40 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm">
              Tienes <strong>{pendingChapters.length}</strong>{" "}
              capítulo{pendingChapters.length === 1 ? "" : "s"} con contenido en borrador.
              Publícalo{pendingChapters.length === 1 ? "" : "s"} para que tus lectores
              puedan leerlo{pendingChapters.length === 1 ? "" : "s"}.
            </p>
          </div>
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => publishPending.mutate()}
            disabled={publishPending.isPending}
          >
            {publishPending.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5" />
            )}
            Publicar {pendingChapters.length === 1 ? "capítulo" : "capítulos"}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-md" />
          ))}
        </div>
      ) : chapters.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 bg-card/40 py-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            Tu serie aún no tiene capítulos.
          </p>
          <Button
            className="mt-4"
            size="sm"
            onClick={() => createMutation.mutate()}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Crear primer capítulo
          </Button>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {chapters.map((c, idx) => (
            <ChapterRow
              key={c.id}
              chapter={c}
              isFirst={idx === 0}
              isLast={idx === chapters.length - 1}
              onMoveUp={() => move(idx, -1)}
              onMoveDown={() => move(idx, 1)}
              onEdit={() => setEditing(c)}
              onChange={invalidate}
            />
          ))}
        </ul>
      )}

      {editing && (
        <ChapterEditor
          chapter={editing}
          workIsPublished={workIsPublished}
          onClose={() => setEditing(null)}
          onSaved={() => {
            invalidate();
            setEditing(null);
          }}
        />
      )}

      <ImportDialog
        workId={workId}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={invalidate}
      />
    </div>
  );
}

// ───────── fila de capítulo ─────────
function ChapterRow({
  chapter,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onEdit,
  onChange,
}: {
  chapter: Chapter;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onChange: () => void;
}) {
  const dup = useMutation({
    mutationFn: () => chaptersApi.duplicate(chapter.id),
    onSuccess: () => {
      toast.success("Capítulo duplicado");
      onChange();
    },
    onError: () => toast.error("No se pudo duplicar"),
  });

  const del = useMutation({
    mutationFn: () => chaptersApi.remove(chapter.id),
    onSuccess: () => {
      toast.success("Capítulo eliminado");
      onChange();
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  return (
    <li className="flex items-center gap-2 rounded-md border border-border/60 bg-card p-2.5 transition-colors hover:border-primary/40">
      <div className="flex flex-col">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="text-muted-foreground/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Mover arriba"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <GripVertical className="h-3 w-3 text-muted-foreground/30 my-0.5" />
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="text-muted-foreground/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Mover abajo"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      <div className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
        #{chapter.number}
      </div>

      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5">
          <span className="line-clamp-1 text-sm font-medium hover:text-primary">
            {chapter.title}
          </span>
          {chapter.is_published ? (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 text-[9px]">
              Publicado
            </Badge>
          ) : (
            <Badge variant="outline" className="border-border/60 text-muted-foreground text-[9px]">
              Borrador
            </Badge>
          )}
          {chapter.file_url && (
            <Badge variant="outline" className="border-primary/40 text-primary text-[9px]">
              📎 {chapter.file_type ?? "archivo"}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
          {chapter.body
            ? `${chapter.body.replace(/\s+/g, " ").slice(0, 80)}…`
            : chapter.file_url
              ? `Archivo ${chapter.file_type?.toUpperCase() ?? ""} adjunto`
              : "Sin contenido"}
        </p>
      </button>

      <div className="flex items-center gap-0.5 shrink-0">
        <Button size="icon" variant="ghost" onClick={onEdit} className="h-7 w-7">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => dup.mutate()}
          disabled={dup.isPending}
          className="h-7 w-7"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            if (confirm(`Eliminar "${chapter.title}"?`)) del.mutate();
          }}
          disabled={del.isPending}
          className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}

// ───────── editor en sheet ─────────
function ChapterEditor({
  chapter,
  workIsPublished = false,
  onClose,
  onSaved,
}: {
  chapter: Chapter;
  workIsPublished?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(chapter.title);
  const [body, setBody] = useState(chapter.body ?? "");
  const [authorNote, setAuthorNote] = useState(chapter.author_note ?? "");
  // Si la obra ya está publicada, sugerimos publicar el capítulo por defecto
  // (el usuario lo ve marcado y puede desmarcarlo si quiere dejarlo en borrador).
  const [isPublished, setIsPublished] = useState(chapter.is_published || workIsPublished);

  const save = useMutation({
    mutationFn: () =>
      chaptersApi.update(chapter.id, {
        title: title.trim() || `Capítulo ${chapter.number}`,
        body: body.trim() || null,
        author_note: authorNote.trim() || null,
        is_published: isPublished,
      }),
    onSuccess: () => {
      toast.success("Capítulo guardado");
      onSaved();
    },
    onError: () => toast.error("No se pudo guardar"),
  });

  const fileUpload = useMutation({
    mutationFn: (file: File) => chaptersApi.uploadFile(chapter.id, file),
    onSuccess: () => {
      toast.success("Archivo subido");
      onSaved();
    },
    onError: () => toast.error("No se pudo subir el archivo"),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-background sm:rounded-xl border-t sm:border border-border/60 max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/60 bg-background/95 backdrop-blur px-5 py-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Capítulo #{chapter.number}
            </p>
            <h3 className="font-serif font-bold text-base line-clamp-1">{title}</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium">Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 200))}
              className="mt-1 h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium">Contenido</label>
            <textarea
              rows={12}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escribe el contenido del capítulo. Acepta texto plano y se mostrará con saltos de línea."
              className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30 leading-relaxed font-serif"
            />
            <p className="mt-1 text-[10px] text-muted-foreground/70 text-right">
              {body.length.toLocaleString()} caracteres
            </p>
          </div>

          <div className="rounded-md border border-border/60 bg-card p-3">
            <label className="text-xs font-medium flex items-center gap-1.5">
              <Upload className="h-3 w-3" />
              Archivo del capítulo (opcional)
            </label>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              EPUB, PDF, DOCX, TXT, MD o PNG · Máx 50 MB
            </p>
            <input
              type="file"
              accept=".epub,.pdf,.docx,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) fileUpload.mutate(f);
              }}
              disabled={fileUpload.isPending}
              className="mt-2 w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground hover:file:bg-primary/90"
            />
            {fileUpload.isPending && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />
                Subiendo archivo… no cierres esta ventana.
              </p>
            )}
            {chapter.file_url && !fileUpload.isPending && (
              <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-emerald-500">
                ✓ {chapter.file_type?.toUpperCase()} · {Math.round((chapter.file_size ?? 0) / 1024)} KB
              </p>
            )}
          </div>

          <div className="rounded-md border border-border/60 bg-card p-3">
            <p className="text-xs font-medium flex items-center gap-1.5">
              <Images className="h-3 w-3" />
              Páginas de cómic (webtoon) · opcional
            </p>
            <p className="mt-0.5 mb-3 text-[11px] text-muted-foreground">
              Sube imágenes o un CBZ/ZIP y este capítulo se leerá como webtoon continuo.
            </p>
            <ComicPagesBuilder workId={chapter.book_id} chapterId={chapter.id} />
          </div>

          <div>
            <label className="text-xs font-medium">Nota del autor (opcional)</label>
            <textarea
              rows={2}
              value={authorNote}
              onChange={(e) => setAuthorNote(e.target.value.slice(0, 5000))}
              placeholder="Mensaje específico para este capítulo"
              className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>

          <label className="flex items-center gap-2 rounded-md border border-border/60 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            <span className="text-sm">
              {isPublished
                ? "✓ Capítulo publicado — visible para lectores"
                : "Borrador — no visible"}
            </span>
          </label>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border/60 bg-background px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending || fileUpload.isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending || fileUpload.isPending}>
            {save.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Guardar capítulo
          </Button>
        </div>
      </div>
    </div>
  );
}
