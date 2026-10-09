"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Search,
} from "lucide-react";
import { adminApi } from "@/lib/api-admin";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryMultiPicker } from "@/components/admin/category-multi-picker";
import type { Author, BookDetail } from "@/lib/types";

interface BookFormProps {
  mode: "create" | "edit";
  /** Libro existente cuando estamos editando. */
  initial?: BookDetail;
}

export function BookForm({ mode, initial }: BookFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // ===== Catálogos =====
  const { data: authorsRes } = useQuery({
    queryKey: ["authors-all"],
    queryFn: () => apiClient.get<{ data: Author[] }>("/authors").then((r) => r.data),
  });

  // ===== Estado del form =====
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [authorId, setAuthorId] = useState<string>(
    initial?.author?.id ? String(initial.author.id) : ""
  );
  const [categoryIds, setCategoryIds] = useState<number[]>(
    initial?.categories?.map((c) => c.id) ?? []
  );
  const [accessType, setAccessType] = useState<"free" | "premium">(
    initial?.access_type ?? "free"
  );
  const [price, setPrice] = useState(initial?.price ?? "");
  const [fileType, setFileType] = useState<"pdf" | "epub" | "both">(
    initial?.file_type ?? "epub"
  );
  const [language, setLanguage] = useState(initial?.language ?? "es");
  const [publicationYear, setPublicationYear] = useState(
    initial?.publication_year?.toString() ?? ""
  );
  const [pages, setPages] = useState(initial?.pages?.toString() ?? "");
  const [publisher, setPublisher] = useState(initial?.publisher ?? "");
  const [isbn13, setIsbn13] = useState(initial?.isbn_13 ?? "");
  const [isFeatured, setIsFeatured] = useState(initial?.is_featured ?? false);
  const [isPublished, setIsPublished] = useState(initial?.is_published ?? true);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState(initial?.cover ?? "");
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState(initial?.file_link ?? "");

  // Preview de la portada cuando se selecciona archivo
  const [coverPreview, setCoverPreview] = useState<string | null>(initial?.cover ?? null);
  useEffect(() => {
    if (!coverFile) return;
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  // ===== Submit =====
  const mutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (mode === "create") return adminApi.books.create(formData);
      return adminApi.books.update(initial!.slug, formData);
    },
    onSuccess: (book) => {
      toast.success(mode === "create" ? "Libro creado" : "Libro actualizado");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      router.push("/admin/libros");
      router.refresh();
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ??
        "No se pudo guardar el libro. Revisa los campos.";
      toast.error(msg);
      console.error(err?.response?.data);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("title", title);
    if (subtitle) fd.append("subtitle", subtitle);
    if (description) fd.append("description", description);
    fd.append("author_id", authorId);
    fd.append("access_type", accessType);
    if (accessType === "premium" && price) fd.append("price", String(price));
    fd.append("file_type", fileType);
    if (language) fd.append("language", language);
    if (publicationYear) fd.append("publication_year", publicationYear);
    if (pages) fd.append("pages", pages);
    if (publisher) fd.append("publisher", publisher);
    if (isbn13) fd.append("isbn_13", isbn13);
    fd.append("is_featured", isFeatured ? "1" : "0");
    fd.append("is_published", isPublished ? "1" : "0");
    fd.append("category_ids", JSON.stringify(categoryIds));

    if (coverFile) fd.append("cover", coverFile);
    else if (coverUrl) fd.append("cover_url", coverUrl);

    if (bookFile) fd.append("file", bookFile);
    else if (fileUrl) fd.append("file_url", fileUrl);

    mutation.mutate(fd);
  };

  // ===== Lookup mágico (Google Books + Open Library) =====
  const [lookupValue, setLookupValue] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

  const doLookup = async () => {
    const v = lookupValue.trim();
    if (!v) return;
    setLookupLoading(true);

    // Si parece ISBN (10 o 13 dígitos), busca por ISBN; si no, por título
    const isIsbn = /^[\d-]{10,17}$/.test(v);
    const input = isIsbn ? { isbn: v.replace(/-/g, "") } : { title: v };

    try {
      const meta = await adminApi.lookup(input);

      // Auto-fill solo si los campos están vacíos (no sobrescribir lo que ya escribió el admin)
      if (meta.title && !title) setTitle(meta.title);
      if (meta.subtitle && !subtitle) setSubtitle(meta.subtitle);
      if (meta.description && !description) setDescription(meta.description);
      if (meta.author_id && !authorId) setAuthorId(String(meta.author_id));
      if (meta.publisher && !publisher) setPublisher(meta.publisher);
      if (meta.publication_year && !publicationYear)
        setPublicationYear(String(meta.publication_year));
      if (meta.pages && !pages) setPages(String(meta.pages));
      if (meta.language) setLanguage(meta.language);
      if (meta.isbn_13 && !isbn13) setIsbn13(meta.isbn_13);
      if (meta.cover_url && !coverUrl && !coverFile) {
        setCoverUrl(meta.cover_url);
        setCoverPreview(meta.cover_url);
      }

      const created = meta.author_was_created
        ? ` (autor "${meta.author_name}" creado automáticamente)`
        : "";
      toast.success(`Metadata cargada${created}`);

      // Refresca lista de autores si se creó uno nuevo
      if (meta.author_was_created) {
        queryClient.invalidateQueries({ queryKey: ["authors-all"] });
      }
    } catch (e: any) {
      const msg =
        e?.response?.status === 404
          ? "No se encontró metadata. Prueba con otro ISBN o título."
          : "Error al buscar metadata.";
      toast.error(msg);
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ========== Lookup mágico (solo en crear) ========== */}
      {mode === "create" && (
        <Card className="border-primary/30 bg-primary/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-serif text-base font-bold">
              Auto-rellenar con Google Books + Open Library
            </h2>
            <Badge className="border-0 bg-primary/20 text-[10px] text-primary">
              Mágico
            </Badge>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Pega un ISBN (10 o 13 dígitos) o un título y rellena título, autor,
            descripción, portada, año, páginas, ISBN automáticamente.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={lookupValue}
                onChange={(e) => setLookupValue(e.target.value)}
                placeholder="9780261103252 ó 'El Hobbit'"
                className="h-10 pl-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    doLookup();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              onClick={doLookup}
              disabled={lookupLoading || !lookupValue.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {lookupLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Buscar"
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* ========== Información básica ========== */}
      <Card className="space-y-4 border-border/60 bg-card p-6">
        <h2 className="font-serif text-lg font-bold">Información básica</h2>

        <Field label="Título *">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Ej: Cien años de soledad"
          />
        </Field>

        <Field label="Subtítulo">
          <Input
            value={subtitle ?? ""}
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </Field>

        <Field label="Descripción">
          <textarea
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-border/60 bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            placeholder="Sinopsis o descripción del libro"
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Autor *">
            <select
              value={authorId}
              onChange={(e) => setAuthorId(e.target.value)}
              required
              className="h-10 w-full rounded-md border border-border/60 bg-card px-3 text-sm"
            >
              <option value="">— Selecciona —</option>
              {authorsRes?.data.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Idioma">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-10 w-full rounded-md border border-border/60 bg-card px-3 text-sm"
            >
              <option value="es">Español</option>
              <option value="en">Inglés</option>
              <option value="fr">Francés</option>
              <option value="de">Alemán</option>
              <option value="pt">Portugués</option>
            </select>
          </Field>
        </div>

        <Field label="Categorías">
          <CategoryMultiPicker
            selectedIds={categoryIds}
            onChange={setCategoryIds}
            max={5}
          />
        </Field>
      </Card>

      {/* ========== Archivos ========== */}
      <Card className="space-y-5 border-border/60 bg-card p-6">
        <h2 className="font-serif text-lg font-bold">Archivos</h2>

        {/* Portada */}
        <div className="grid gap-4 md:grid-cols-[140px_1fr]">
          <div className="relative aspect-[2/3] w-full max-w-[140px] overflow-hidden rounded-lg border border-border/60 bg-muted">
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverPreview}
                alt="Cover preview"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Field label="Portada (sube imagen o URL)">
              <div className="flex items-center gap-2">
                <FilePickerButton
                  accept="image/*"
                  onChange={(f) => {
                    setCoverFile(f);
                    if (f) setCoverUrl("");
                  }}
                  icon={<Upload className="h-4 w-4" />}
                  label="Subir imagen"
                  selectedName={coverFile?.name}
                  onClear={() => {
                    setCoverFile(null);
                    setCoverPreview(initial?.cover ?? null);
                  }}
                />
              </div>
            </Field>
            <Field label="O usa URL externa">
              <Input
                type="url"
                value={coverFile ? "" : coverUrl}
                onChange={(e) => {
                  setCoverUrl(e.target.value);
                  setCoverPreview(e.target.value || null);
                }}
                disabled={!!coverFile}
                placeholder="https://..."
              />
            </Field>
          </div>
        </div>

        {/* Archivo del libro */}
        <div className="space-y-3">
          <Field label="Archivo del libro (PDF/EPUB)">
            <FilePickerButton
              accept=".pdf,.epub"
              onChange={(f) => {
                setBookFile(f);
                if (f) {
                  setFileUrl("");
                  setFileType(f.name.toLowerCase().endsWith(".pdf") ? "pdf" : "epub");
                }
              }}
              icon={<FileText className="h-4 w-4" />}
              label="Subir PDF/EPUB"
              selectedName={bookFile?.name}
              onClear={() => setBookFile(null)}
            />
          </Field>
          <Field label="O usa URL externa (ej: Project Gutenberg)">
            <Input
              type="url"
              value={bookFile ? "" : fileUrl ?? ""}
              onChange={(e) => setFileUrl(e.target.value)}
              disabled={!!bookFile}
              placeholder="https://gutenberg.org/.../book.epub"
            />
          </Field>

          <Field label="Formato">
            <div className="flex gap-2">
              {(["pdf", "epub", "both"] as const).map((opt) => (
                <Button
                  key={opt}
                  type="button"
                  size="sm"
                  variant={fileType === opt ? "default" : "outline"}
                  onClick={() => setFileType(opt)}
                  className={
                    fileType === opt
                      ? "bg-primary text-primary-foreground"
                      : "border-border/60"
                  }
                >
                  {opt.toUpperCase()}
                </Button>
              ))}
            </div>
          </Field>
        </div>
      </Card>

      {/* ========== Monetización + Metadata ========== */}
      <Card className="space-y-4 border-border/60 bg-card p-6">
        <h2 className="font-serif text-lg font-bold">Acceso & Metadata</h2>

        <Field label="Tipo de acceso">
          <div className="flex gap-2">
            {(["free", "premium"] as const).map((opt) => (
              <Button
                key={opt}
                type="button"
                size="sm"
                variant={accessType === opt ? "default" : "outline"}
                onClick={() => setAccessType(opt)}
                className={
                  accessType === opt
                    ? "bg-primary text-primary-foreground"
                    : "border-border/60"
                }
              >
                {opt === "free" ? "Gratis" : "Premium"}
              </Button>
            ))}
          </div>
        </Field>

        {accessType === "premium" && (
          <Field label="Precio (USD)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price ?? ""}
              onChange={(e) => setPrice(e.target.value)}
              required={accessType === "premium"}
              placeholder="9.99"
            />
          </Field>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Año de publicación">
            <Input
              type="number"
              value={publicationYear}
              onChange={(e) => setPublicationYear(e.target.value)}
              placeholder="1605"
            />
          </Field>
          <Field label="Páginas">
            <Input
              type="number"
              min="1"
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              placeholder="500"
            />
          </Field>
          <Field label="ISBN-13">
            <Input
              value={isbn13 ?? ""}
              onChange={(e) => setIsbn13(e.target.value)}
              placeholder="978-..."
            />
          </Field>
        </div>

        <Field label="Editorial">
          <Input
            value={publisher ?? ""}
            onChange={(e) => setPublisher(e.target.value)}
          />
        </Field>

        <div className="flex flex-wrap gap-4 pt-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Publicado (visible en el catálogo)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Destacado en la home
          </label>
        </div>
      </Card>

      {/* ========== Submit ========== */}
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/libros")}
          className="border-border/60"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={mutation.isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Crear libro" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

// ===== Helpers UI =====

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function FilePickerButton({
  accept,
  onChange,
  icon,
  label,
  selectedName,
  onClear,
}: {
  accept: string;
  onChange: (file: File | null) => void;
  icon: React.ReactNode;
  label: string;
  selectedName?: string;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-1 items-center gap-2">
      <label
        className={
          "inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-card px-4 text-sm font-medium transition-colors hover:border-primary/60 hover:text-primary"
        }
      >
        {icon}
        {selectedName ? "Cambiar archivo" : label}
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
      {selectedName && (
        <div className="flex flex-1 items-center justify-between gap-2 rounded-md bg-accent/40 px-3 py-2 text-xs">
          <span className="truncate">{selectedName}</span>
          <button
            type="button"
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
