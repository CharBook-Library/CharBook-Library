"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft, Save, Loader2, Info, Tag, X, Globe2,
  ShieldCheck, BookOpenText, Layers, BookText, BookImage,
  AlertCircle, Send, EyeOff, ExternalLink, Trash2, Settings2,
  FileText, Sparkles, Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CategoryPicker } from "@/components/studio/category-picker";
import { ChaptersBuilder } from "@/components/studio/chapters-builder";
import { BookFileUploader } from "@/components/studio/book-file-uploader";
import { ComicPagesBuilder } from "@/components/studio/comic-pages-builder";
import { ChapterMonetizationEditor } from "@/components/studio/chapter-monetization-editor";
import { worksApi } from "@/lib/api-creator";
import { cn } from "@/lib/utils";
import type { AgeRating } from "@/lib/types";

type WorkFormat = "serie" | "libro_completo" | "comic";
type Tab = "info" | "content" | "monetization" | "settings" | "danger";

const LANGUAGES: { code: string; label: string }[] = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
];

const AGE_RATINGS: { value: AgeRating; label: string }[] = [
  { value: "all", label: "Todas las edades" },
  { value: "teen", label: "Adolescentes (13+)" },
  { value: "mature", label: "Adultos (18+)" },
  { value: "explicit", label: "Explícito (18+)" },
];

const LIMITS = {
  title: 200,
  description: 5000,
  copyright: 200,
  tag: 30,
  seoTitle: 200,
  seoDescription: 500,
  authorNote: 5000,
} as const;
const MAX_TAGS = 10;
const MAX_SEO_KEYWORDS = 20;

const TABS: { key: Tab; label: string; icon: typeof Info }[] = [
  { key: "info", label: "Información", icon: Info },
  { key: "content", label: "Contenido", icon: FileText },
  { key: "monetization", label: "Monetización", icon: Coins },
  { key: "settings", label: "Configuración", icon: Settings2 },
  { key: "danger", label: "Avanzado", icon: AlertCircle },
];

export default function EditWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = use(params);
  const workId = Number(idStr);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("info");

  // Estado del form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workFormat, setWorkFormat] = useState<WorkFormat>("libro_completo");
  const [parentCategoryId, setParentCategoryId] = useState<number | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<number | null>(null);
  const [language, setLanguage] = useState("es");
  const [ageRating, setAgeRating] = useState<AgeRating>("all");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [copyright, setCopyright] = useState("");

  const [commentsMode, setCommentsMode] = useState<"on" | "followers_only" | "off">("on");
  const [ratingsEnabled, setRatingsEnabled] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState<string[]>([]);
  const [seoKeywordDraft, setSeoKeywordDraft] = useState("");
  const [authorNoteStart, setAuthorNoteStart] = useState("");
  const [authorNoteEnd, setAuthorNoteEnd] = useState("");

  // Cargar la obra
  const { data: work, isLoading } = useQuery({
    queryKey: ["work", workId],
    queryFn: () => worksApi.get(workId),
  });

  // Cuando llegan datos, popular el form
  useEffect(() => {
    if (!work) return;
    const w = work as any;
    setTitle(w.title ?? "");
    setDescription(w.description ?? "");
    setWorkFormat((w.work_format as WorkFormat) ?? "libro_completo");
    setParentCategoryId(w.parent_category_id ?? null);
    setSubCategoryId(w.subcategory_id ?? null);
    setLanguage(w.language ?? "es");
    setAgeRating((w.age_rating as AgeRating) ?? "all");
    setTags(w.tags ?? []);
    setCopyright(w.copyright_holder ?? "");
    setCommentsMode(w.comments_mode ?? "on");
    setRatingsEnabled(w.ratings_enabled ?? true);
    setAllowDownload(!!w.allow_download);
    setSeoTitle(w.seo_title ?? "");
    setSeoDescription(w.seo_description ?? "");
    setSeoKeywords(w.seo_keywords ?? []);
    setAuthorNoteStart(w.author_note_start ?? "");
    setAuthorNoteEnd(w.author_note_end ?? "");
  }, [work]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["work", workId] });
    queryClient.invalidateQueries({ queryKey: ["my-works"] });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      worksApi.update(workId, {
        title: title.trim(),
        description: description.trim(),
        parent_category_id: parentCategoryId,
        subcategory_id: subCategoryId,
        language,
        age_rating: ageRating,
        tags,
        copyright_holder: copyright.trim(),
        comments_mode: commentsMode,
        ratings_enabled: ratingsEnabled,
        allow_download: allowDownload,
        seo_title: seoTitle.trim() || null,
        seo_description: seoDescription.trim() || null,
        seo_keywords: seoKeywords.length ? seoKeywords : null,
        author_note_start: authorNoteStart.trim() || null,
        author_note_end: authorNoteEnd.trim() || null,
      } as any),
    onSuccess: () => {
      toast.success("Cambios guardados");
      invalidate();
      // Volver a la lista de obras tras guardar (flujo esperado por el creador).
      router.push("/studio/obras");
    },
    onError: (err: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      const apiErrors = err.response?.data?.errors;
      const first = apiErrors ? Object.values(apiErrors)[0]?.[0] : err.response?.data?.message;
      toast.error(first ?? "No se pudo guardar");
    },
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: "draft" | "published") =>
      worksApi.update(workId, { submission_status: newStatus } as any),
    onSuccess: (_, newStatus) => {
      toast.success(
        newStatus === "published" ? "Obra publicada" : "Obra pasada a borrador"
      );
      invalidate();
    },
    onError: () => toast.error("No se pudo actualizar el estado"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => worksApi.remove(workId),
    onSuccess: () => {
      toast.success("Obra eliminada");
      router.push("/studio/obras");
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const addTag = () => {
    const t = tagDraft.trim().toLowerCase();
    if (!t || t.length > LIMITS.tag || tags.includes(t) || tags.length >= MAX_TAGS) return;
    setTags([...tags, t]);
    setTagDraft("");
  };

  const addSeoKeyword = () => {
    const t = seoKeywordDraft.trim().toLowerCase();
    if (!t || seoKeywords.includes(t) || seoKeywords.length >= MAX_SEO_KEYWORDS) return;
    setSeoKeywords([...seoKeywords, t]);
    setSeoKeywordDraft("");
  };

  if (isLoading || !work) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const w = work as any;
  const isPublished =
    w.submission_status === "published" && !!w.is_published;

  return (
    <div className="pb-16">
      {/* ═══════ HEADER STICKY ═══════ */}
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/studio/obras"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Volver"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Studio · Editar
              </p>
              <h1 className="line-clamp-1 font-serif text-base font-bold leading-tight md:text-lg">
                {title || "Sin título"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPublished && (
              <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
                <Link href={`/libro/${w.slug}`} target="_blank">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Ver
                </Link>
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Guardar
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-t border-border/60 px-3 py-2 sm:px-6 lg:px-10">
          {TABS.filter((t) => t.key !== "monetization" || workFormat === "serie" || workFormat === "comic").map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════ BODY ═══════ */}
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {/* Estado badge */}
        <div className="mb-6 flex items-center gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">Estado:</p>
          <Badge
            variant="outline"
            className={cn(
              isPublished
                ? "border-emerald-500/40 text-emerald-500"
                : "border-border/60 text-muted-foreground"
            )}
          >
            {isPublished ? "✓ Publicado" : "Borrador"}
          </Badge>
          {isPublished ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => statusMutation.mutate("draft")}
              disabled={statusMutation.isPending}
            >
              <EyeOff className="mr-1 h-3 w-3" />
              Pasar a borrador
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => statusMutation.mutate("published")}
              disabled={statusMutation.isPending}
            >
              <Send className="mr-1 h-3 w-3" />
              Publicar
            </Button>
          )}
        </div>

        {tab === "info" && (
          <InfoTab
            title={title} setTitle={setTitle}
            description={description} setDescription={setDescription}
            parentCategoryId={parentCategoryId}
            subCategoryId={subCategoryId}
            setCategories={(p: number | null, s: number | null) => { setParentCategoryId(p); setSubCategoryId(s); }}
            language={language} setLanguage={setLanguage}
            ageRating={ageRating} setAgeRating={setAgeRating}
            tags={tags} setTags={setTags}
            tagDraft={tagDraft} setTagDraft={setTagDraft} addTag={addTag}
            copyright={copyright} setCopyright={setCopyright}
            workFormat={workFormat}
          />
        )}

        {tab === "content" && <ContentTab workFormat={workFormat} workId={workId} workIsPublished={isPublished} />}

        {tab === "monetization" && (workFormat === "serie" || workFormat === "comic") && (
          <MonetizationTab
            workId={workId}
            monetization={w.monetization ?? null}
            inUnlimitedCatalog={Boolean(w.in_unlimited_catalog)}
            onSaved={invalidate}
          />
        )}

        {tab === "settings" && (
          <SettingsTab
            commentsMode={commentsMode} setCommentsMode={setCommentsMode}
            ratingsEnabled={ratingsEnabled} setRatingsEnabled={setRatingsEnabled}
            allowDownload={allowDownload} setAllowDownload={setAllowDownload}
            seoTitle={seoTitle} setSeoTitle={setSeoTitle}
            seoDescription={seoDescription} setSeoDescription={setSeoDescription}
            seoKeywords={seoKeywords} setSeoKeywords={setSeoKeywords}
            seoKeywordDraft={seoKeywordDraft} setSeoKeywordDraft={setSeoKeywordDraft}
            addSeoKeyword={addSeoKeyword}
            authorNoteStart={authorNoteStart} setAuthorNoteStart={setAuthorNoteStart}
            authorNoteEnd={authorNoteEnd} setAuthorNoteEnd={setAuthorNoteEnd}
          />
        )}

        {tab === "danger" && (
          <DangerTab
            onDelete={() => {
              if (confirm(`Eliminar "${title}" permanentemente? Esta acción no se puede deshacer.`)) {
                deleteMutation.mutate();
              }
            }}
            isPending={deleteMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: Información básica
// ═══════════════════════════════════════════════════════════
function InfoTab(props: any) {
  const {
    title, setTitle, description, setDescription,
    parentCategoryId, subCategoryId, setCategories,
    language, setLanguage, ageRating, setAgeRating,
    tags, setTags, tagDraft, setTagDraft, addTag,
    copyright, setCopyright, workFormat,
  } = props;

  const FORMAT_LABEL = {
    serie: { label: "Serie por capítulos", icon: Layers },
    libro_completo: { label: "Libro completo", icon: BookText },
    comic: { label: "Cómic", icon: BookImage },
  }[workFormat as WorkFormat];

  return (
    <div className="space-y-8">
      <section>
        <Field label="Título de la obra" counter={`${title.length} / ${LIMITS.title}`}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, LIMITS.title))}
            className={inputCls}
          />
        </Field>

        <Field label="Descripción" counter={`${description.length} / ${LIMITS.description}`}
          help="Sinopsis breve — esto verán los lectores.">
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, LIMITS.description))}
            className={textareaCls}
          />
        </Field>

        <Field label="Formato de obra"
          help="El formato no se puede cambiar una vez creada la obra.">
          <div className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
            {FORMAT_LABEL && <FORMAT_LABEL.icon className="h-3.5 w-3.5 text-muted-foreground" />}
            {FORMAT_LABEL?.label}
          </div>
        </Field>
      </section>

      <section className="border-t border-border/60 pt-6">
        <h2 className="mb-4 font-serif text-base font-bold">Categoría</h2>
        <CategoryPicker
          parentId={parentCategoryId}
          subId={subCategoryId}
          onChange={(p, s) => setCategories(p, s)}
          required
        />

        <div className="mt-4">
          <Field label="Etiquetas" icon={<Tag className="h-3.5 w-3.5" />}
            counter={`${tags.length} / ${MAX_TAGS}`}>
            <div className="rounded-md border border-border/60 bg-background p-2">
              {tags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {tags.map((t: string) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {t}
                      <button onClick={() => setTags(tags.filter((x: string) => x !== t))} className="hover:bg-primary/20 rounded-sm">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                type="text"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                placeholder={tags.length >= MAX_TAGS ? "Has alcanzado el máximo" : "Pulsa Enter para añadir"}
                disabled={tags.length >= MAX_TAGS}
                maxLength={LIMITS.tag}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
              />
            </div>
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Idioma" icon={<Globe2 className="h-3.5 w-3.5" />}>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={selectCls}>
              {LANGUAGES.map((l) => (<option key={l.code} value={l.code}>{l.label}</option>))}
            </select>
          </Field>
          <Field label="Clasificación por edad">
            <select value={ageRating} onChange={(e) => setAgeRating(e.target.value as AgeRating)} className={selectCls}>
              {AGE_RATINGS.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
            </select>
          </Field>
        </div>
      </section>

      <section className="border-t border-border/60 pt-6">
        <h2 className="mb-4 font-serif text-base font-bold">Derechos</h2>
        <Field label="Titular de los derechos" icon={<ShieldCheck className="h-3.5 w-3.5" />}
          counter={`${copyright.length} / ${LIMITS.copyright}`}>
          <input
            type="text"
            value={copyright}
            onChange={(e) => setCopyright(e.target.value.slice(0, LIMITS.copyright))}
            className={inputCls}
          />
        </Field>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: Contenido
// ═══════════════════════════════════════════════════════════
function ContentTab({
  workFormat,
  workId,
  workIsPublished = false,
}: {
  workFormat: WorkFormat;
  workId: number;
  workIsPublished?: boolean;
}) {
  const meta = {
    serie: { title: "Capítulos", icon: Layers },
    libro_completo: { title: "Archivo del libro", icon: BookText },
    comic: { title: "Páginas", icon: BookImage },
  }[workFormat];
  const Icon = meta.icon;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-xl font-bold leading-tight">{meta.title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {workFormat === "serie" && "Crea, edita y reordena capítulos."}
          {workFormat === "libro_completo" && "Sube o reemplaza el archivo del libro."}
          {workFormat === "comic" && "Sube y reordena las páginas del cómic."}
        </p>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-5">
        {workFormat === "serie" && <ChaptersBuilder workId={workId} workIsPublished={workIsPublished} />}
        {workFormat === "libro_completo" && <BookFileUploader workId={workId} />}
        {workFormat === "comic" && <ComicPagesBuilder workId={workId} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: Configuración
// ═══════════════════════════════════════════════════════════
function MonetizationTab({
  workId,
  monetization,
  inUnlimitedCatalog,
  onSaved,
}: {
  workId: number;
  monetization: any;
  inUnlimitedCatalog: boolean;
  onSaved: () => void;
}) {
  return (
    <ChapterMonetizationEditor
      workId={workId}
      initialMonetization={monetization}
      initialInUnlimitedCatalog={inUnlimitedCatalog}
      onSaved={onSaved}
    />
  );
}

function SettingsTab(props: any) {
  const {
    commentsMode, setCommentsMode,
    ratingsEnabled, setRatingsEnabled,
    allowDownload, setAllowDownload,
    seoTitle, setSeoTitle, seoDescription, setSeoDescription,
    seoKeywords, setSeoKeywords, seoKeywordDraft, setSeoKeywordDraft, addSeoKeyword,
    authorNoteStart, setAuthorNoteStart, authorNoteEnd, setAuthorNoteEnd,
  } = props;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 font-serif text-base font-bold">Configuración de lectores</h2>
        <Field label="Comentarios">
          <div className="space-y-1.5">
            {[
              { v: "on", label: "Activados — cualquiera puede comentar" },
              { v: "followers_only", label: "Solo seguidores" },
              { v: "off", label: "Desactivados" },
            ].map((opt) => (
              <label key={opt.v}
                className={cn("flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm",
                  commentsMode === opt.v ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/30")}>
                <input type="radio" name="comments" checked={commentsMode === opt.v}
                  onChange={() => setCommentsMode(opt.v as any)} className="h-3.5 w-3.5" />
                {opt.label}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Calificaciones (estrellas)">
          <label className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2.5 cursor-pointer">
            <input type="checkbox" checked={ratingsEnabled}
              onChange={(e) => setRatingsEnabled(e.target.checked)} className="h-3.5 w-3.5" />
            <span className="text-sm">{ratingsEnabled ? "Activadas" : "Desactivadas"}</span>
          </label>
        </Field>

        <Field label="Descargas">
          <label className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2.5 cursor-pointer">
            <input type="checkbox" checked={allowDownload}
              onChange={(e) => setAllowDownload(e.target.checked)} className="h-3.5 w-3.5" />
            <span className="text-sm">
              {allowDownload ? "Permitida — los lectores pueden descargar la obra (EPUB)" : "No permitida — solo lectura en la plataforma"}
            </span>
          </label>
        </Field>
      </section>

      <section className="border-t border-border/60 pt-6">
        <h2 className="mb-4 font-serif text-base font-bold">Notas del creador</h2>
        <Field label="Nota inicial" icon={<FileText className="h-3.5 w-3.5" />}>
          <textarea rows={3} value={authorNoteStart}
            onChange={(e) => setAuthorNoteStart(e.target.value.slice(0, LIMITS.authorNote))}
            placeholder="Antes de empezar, quiero contarte que…"
            className={textareaCls} />
        </Field>
        <Field label="Nota final" icon={<FileText className="h-3.5 w-3.5" />}>
          <textarea rows={3} value={authorNoteEnd}
            onChange={(e) => setAuthorNoteEnd(e.target.value.slice(0, LIMITS.authorNote))}
            placeholder="Gracias por leer. Si te gustó…"
            className={textareaCls} />
        </Field>
      </section>

      <section className="border-t border-border/60 pt-6">
        <h2 className="mb-4 font-serif text-base font-bold">SEO y descubrimiento</h2>
        <Field label="Título SEO" help="Si vacío usamos el título de la obra." counter={`${seoTitle.length} / ${LIMITS.seoTitle}`}>
          <input type="text" value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value.slice(0, LIMITS.seoTitle))}
            className={inputCls} />
        </Field>
        <Field label="Descripción SEO" counter={`${seoDescription.length} / ${LIMITS.seoDescription}`}>
          <textarea rows={3} value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value.slice(0, LIMITS.seoDescription))}
            className={textareaCls} />
        </Field>
        <Field label="Palabras clave" icon={<Tag className="h-3.5 w-3.5" />} counter={`${seoKeywords.length} / ${MAX_SEO_KEYWORDS}`}>
          <div className="rounded-md border border-border/60 bg-background p-2">
            {seoKeywords.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {seoKeywords.map((kw: string) => (
                  <span key={kw} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
                    {kw}
                    <button onClick={() => setSeoKeywords(seoKeywords.filter((x: string) => x !== kw))} className="hover:bg-muted-foreground/10 rounded-sm">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input type="text" value={seoKeywordDraft}
              onChange={(e) => setSeoKeywordDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSeoKeyword(); } }}
              placeholder={seoKeywords.length >= MAX_SEO_KEYWORDS ? "Máximo alcanzado" : "Pulsa Enter para añadir"}
              disabled={seoKeywords.length >= MAX_SEO_KEYWORDS}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" />
          </div>
        </Field>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: Avanzado / Eliminar
// ═══════════════════════════════════════════════════════════
function DangerTab({ onDelete, isPending }: { onDelete: () => void; isPending: boolean }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
      <div className="flex items-start gap-3">
        <Trash2 className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium">Eliminar obra permanentemente</h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            La obra desaparecerá del catálogo, reseñas, favoritos y feeds. Sus
            capítulos y archivos asociados también serán eliminados.
          </p>
        </div>
      </div>
      <Button
        variant="destructive"
        className="mt-4 w-full sm:w-auto"
        onClick={onDelete}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        )}
        Eliminar obra
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Form primitives
// ═══════════════════════════════════════════════════════════
const inputCls =
  "h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30";
const textareaCls =
  "w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30 leading-relaxed";
const selectCls =
  "h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30";

function Field({
  label, icon, help, counter, children,
}: {
  label: string;
  icon?: React.ReactNode;
  help?: string;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-sm font-medium">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          {label}
        </label>
        {counter && (
          <span className="text-[10px] tabular-nums text-muted-foreground/70">
            {counter}
          </span>
        )}
      </div>
      {children}
      {help && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Info className="h-3 w-3" /> {help}
        </p>
      )}
    </div>
  );
}
