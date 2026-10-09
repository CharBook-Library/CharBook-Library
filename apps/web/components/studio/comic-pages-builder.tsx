"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload, Loader2, ChevronLeft, ChevronRight,
  Image as ImageIcon, Trash2, BookImage, FileUp, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { chaptersApi, comicPagesApi } from "@/lib/api-creator";
import { cn } from "@/lib/utils";

interface ComicPagesBuilderProps {
  workId: number;
  /** Si se pasa, las páginas pertenecen a este capítulo (serie webtoon). */
  chapterId?: number;
}

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

export function ComicPagesBuilder({ workId, chapterId }: ComicPagesBuilderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [coverFor, setCoverFor] = useState<number | null>(null);

  const queryKey = chapterId
    ? ["chapter-pages", chapterId]
    : ["comic-pages", workId];

  const { data: pages = [], isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      chapterId ? comicPagesApi.chapterList(chapterId) : comicPagesApi.list(workId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const upload = useMutation({
    mutationFn: (files: File[]) =>
      chapterId
        ? comicPagesApi.chapterUpload(chapterId, files)
        : comicPagesApi.upload(workId, files),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidate();
    },
    onError: () => toast.error("No se pudieron subir las imágenes"),
  });

  const importArchive = useMutation({
    mutationFn: (file: File) =>
      chapterId
        ? comicPagesApi.chapterImport(chapterId, file)
        : comicPagesApi.importFile(workId, file),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidate();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? "No se pudo importar el archivo"),
  });

  // Episodios PDF (solo a nivel de obra): cada PDF es un episodio/capítulo que se
  // lee como webtoon. Reusa el sistema de capítulos → lista reordenable como series.
  const { data: episodes = [] } = useQuery({
    queryKey: ["chapters", workId],
    queryFn: () => chaptersApi.list(workId),
    enabled: !chapterId,
  });

  const addPdfEpisode = useMutation({
    mutationFn: async (file: File) => {
      const ch = await chaptersApi.create(workId, {
        title: file.name.replace(/\.pdf$/i, "") || "Episodio",
      });
      return chaptersApi.uploadFile(ch.id, file);
    },
    onSuccess: () => {
      toast.success("Episodio PDF añadido");
      queryClient.invalidateQueries({ queryKey: ["chapters", workId] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? "No se pudo añadir el episodio"),
  });

  const reorderEpisodes = useMutation({
    mutationFn: (order: number[]) => chaptersApi.reorder(workId, order),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chapters", workId] }),
    onError: () => toast.error("No se pudo reordenar"),
  });

  const removeEpisode = useMutation({
    mutationFn: (id: number) => chaptersApi.remove(id),
    onSuccess: () => {
      toast.success("Episodio eliminado");
      queryClient.invalidateQueries({ queryKey: ["chapters", workId] });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const moveEpisode = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= episodes.length) return;
    const order = episodes.map((c) => c.id);
    [order[idx], order[nextIdx]] = [order[nextIdx], order[idx]];
    reorderEpisodes.mutate(order);
  };

  const uploadCover = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) =>
      chaptersApi.uploadCover(id, file),
    onSuccess: () => {
      toast.success("Portada del episodio actualizada");
      queryClient.invalidateQueries({ queryKey: ["chapters", workId] });
    },
    onError: () => toast.error("No se pudo subir la portada"),
  });

  const remove = useMutation({
    mutationFn: (pageId: number) => comicPagesApi.remove(pageId),
    onSuccess: () => {
      toast.success("Página eliminada");
      invalidate();
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const reorder = useMutation({
    mutationFn: (order: number[]) =>
      chapterId
        ? comicPagesApi.chapterReorder(chapterId, order)
        : comicPagesApi.reorder(workId, order),
    onSuccess: () => invalidate(),
    onError: () => toast.error("No se pudo reordenar"),
  });

  const move = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= pages.length) return;
    const order = pages.map((p) => p.id);
    [order[idx], order[next]] = [order[next], order[idx]];
    reorder.mutate(order);
  };

  const handleFiles = (files: FileList | File[]) => {
    const valid = Array.from(files).filter((f) => ACCEPT.includes(f.type));
    if (valid.length === 0) {
      toast.error("Solo se admiten JPG, PNG o WebP.");
      return;
    }
    upload.mutate(valid);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h3 className="font-medium">Páginas</h3>
          <p className="text-xs text-muted-foreground">
            {pages.length} {pages.length === 1 ? "página" : "páginas"} · JPG, PNG, WebP · Máx 20 MB c/u
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!chapterId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => pdfRef.current?.click()}
              disabled={addPdfEpisode.isPending}
              title="Añade un PDF como episodio. Puedes añadir varios y reordenarlos."
            >
              {addPdfEpisode.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="mr-1.5 h-3.5 w-3.5" />
              )}
              Añadir episodio PDF
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => importRef.current?.click()}
            disabled={importArchive.isPending}
            title="Extrae las imágenes de un CBZ, ZIP o EPUB de cómic en orden de lectura"
          >
            {importArchive.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileUp className="mr-1.5 h-3.5 w-3.5" />
            )}
            Importar CBZ/ZIP/EPUB
          </Button>
          <Button
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            Subir páginas
          </Button>
        </div>
      </div>

      {!chapterId && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground">
          💡 Sube <strong>imágenes</strong> (una sola lectura continua) o añade{" "}
          <strong>episodios PDF</strong> con «Añadir episodio PDF» — puedes agregar varios,
          reordenarlos y cada uno se lee como webtoon con navegación entre episodios.
        </div>
      )}

      {!chapterId && episodes.length > 0 && (
        <div className="rounded-md border border-border/60 bg-card p-3">
          <p className="mb-2 text-xs font-medium">
            Episodios ({episodes.length}) · reordena con las flechas · sube una portada con el icono 🖼️
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {episodes.map((ep, idx) => (
              <div key={ep.id} className="w-32 shrink-0">
                <div className="group relative aspect-[3/4] overflow-hidden rounded-md border border-border/60 bg-muted">
                  {ep.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ep.cover_url} alt={ep.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-2 text-center text-[11px] font-medium text-muted-foreground">
                      {ep.title}
                    </div>
                  )}
                  <span className="absolute left-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                    #{ep.number}
                  </span>
                  {ep.file_type && (
                    <span className="absolute right-1 top-1 rounded bg-background/90 px-1 text-[9px] font-bold uppercase text-primary">
                      {ep.file_type}
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => {
                        setCoverFor(ep.id);
                        coverInputRef.current?.click();
                      }}
                      disabled={uploadCover.isPending}
                      className="inline-flex h-6 w-6 items-center justify-center rounded bg-background/90 hover:bg-background"
                      title="Subir portada del episodio"
                    >
                      <ImageIcon className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("¿Eliminar episodio?")) removeEpisode.mutate(ep.id);
                      }}
                      className="inline-flex h-6 w-6 items-center justify-center rounded bg-destructive/90 text-destructive-foreground"
                      title="Eliminar episodio"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] font-medium">{ep.title}</p>
                <div className="mt-0.5 flex items-center justify-between">
                  <button
                    onClick={() => moveEpisode(idx, -1)}
                    disabled={idx === 0}
                    className="text-muted-foreground/60 hover:text-foreground disabled:opacity-30"
                    aria-label="Mover a la izquierda"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveEpisode(idx, 1)}
                    disabled={idx === episodes.length - 1}
                    className="text-muted-foreground/60 hover:text-foreground disabled:opacity-30"
                    aria-label="Mover a la derecha"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className={cn(
          "rounded-md border-2 border-dashed p-4 transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20",
          pages.length === 0 && "py-12 text-center"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
      >
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="aspect-[2/3] rounded" />
            ))}
          </div>
        ) : pages.length === 0 ? (
          <div className="text-muted-foreground">
            <BookImage className="mx-auto h-10 w-10 opacity-40" />
            <p className="mt-3 text-sm font-medium">Arrastra imágenes aquí</p>
            <p className="mt-1 text-[11px]">
              O importa un CBZ/ZIP/EPUB de imágenes, o usa «Subir páginas» desde tu computadora.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {pages.map((page, idx) => (
              <PageTile
                key={page.id}
                page={page}
                idx={idx}
                total={pages.length}
                onMoveLeft={() => move(idx, -1)}
                onMoveRight={() => move(idx, 1)}
                onRemove={() => {
                  if (confirm("Eliminar esta página?")) remove.mutate(page.id);
                }}
                isBusy={remove.isPending && remove.variables === page.id}
              />
            ))}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        multiple
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
        className="hidden"
      />
      <input
        ref={importRef}
        type="file"
        accept=".cbz,.zip,.epub"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importArchive.mutate(file);
          if (importRef.current) importRef.current.value = "";
        }}
        className="hidden"
      />
      <input
        ref={pdfRef}
        type="file"
        accept=".pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) addPdfEpisode.mutate(file);
          if (pdfRef.current) pdfRef.current.value = "";
        }}
        className="hidden"
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && coverFor != null) uploadCover.mutate({ id: coverFor, file });
          if (coverInputRef.current) coverInputRef.current.value = "";
        }}
        className="hidden"
      />
    </div>
  );
}

function PageTile({
  page,
  idx,
  total,
  onMoveLeft,
  onMoveRight,
  onRemove,
  isBusy,
}: {
  page: { id: number; image_url: string | null; position: number };
  idx: number;
  total: number;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRemove: () => void;
  isBusy: boolean;
}) {
  return (
    <div className="group relative aspect-[2/3] overflow-hidden rounded border border-border/60 bg-muted">
      {page.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={page.image_url}
          alt={`Página ${page.position}`}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
          <ImageIcon className="h-6 w-6" />
        </div>
      )}

      {/* Overlay */}
      <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-bold text-foreground">
          #{page.position}
        </span>
        <div className="flex gap-1">
          <button
            onClick={onMoveLeft}
            disabled={idx === 0}
            className="inline-flex h-6 w-6 items-center justify-center rounded bg-background/90 disabled:opacity-30"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onMoveRight}
            disabled={idx === total - 1}
            className="inline-flex h-6 w-6 items-center justify-center rounded bg-background/90 disabled:opacity-30"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onRemove}
            disabled={isBusy}
            className="inline-flex h-6 w-6 items-center justify-center rounded bg-destructive/90 text-destructive-foreground"
            aria-label="Eliminar"
          >
            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Badge fijo de #N */}
      <span className="absolute left-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-bold text-foreground sm:hidden">
        #{page.position}
      </span>
    </div>
  );
}
