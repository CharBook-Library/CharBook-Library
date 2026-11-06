"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Save, Send, Loader2, AlertCircle,
  Info, Tag, X, BookOpenText, Globe2, ShieldCheck, FileText,
  Layers, BookText, BookImage, Smartphone, Tablet, Monitor,
  Sparkles, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CoverDropzone } from "@/components/studio/cover-dropzone";
import { CoverHelpButton } from "@/components/studio/cover-help-dialog";
import { CategoryPicker } from "@/components/studio/category-picker";
import { WizardProgress, type WizardStep } from "@/components/studio/wizard-progress";
import { ChaptersBuilder } from "@/components/studio/chapters-builder";
import { BookFileUploader } from "@/components/studio/book-file-uploader";
import { ComicPagesBuilder } from "@/components/studio/comic-pages-builder";
import { worksApi } from "@/lib/api-creator";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { AgeRating } from "@/lib/types";

type WorkFormat = "serie" | "libro_completo" | "comic";

const STEPS: WizardStep[] = [
  { key: "basic", label: "Información básica", short: "Información" },
  { key: "content", label: "Contenido", short: "Contenido" },
  { key: "settings", label: "Configuración", short: "Config" },
  { key: "preview", label: "Vista previa", short: "Publicar" },
];

const FORMATS: { value: WorkFormat; label: string; icon: typeof BookText; hint: string }[] = [
  { value: "serie", label: "Serie por capítulos", icon: Layers, hint: "Publica capítulo a capítulo" },
  { value: "libro_completo", label: "Libro completo", icon: BookText, hint: "Un único archivo descargable" },
  { value: "comic", label: "Cómic o novela gráfica", icon: BookImage, hint: "Página por página visual" },
];

const LANGUAGES: { code: string; label: string }[] = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
];

const AGE_RATINGS: { value: AgeRating; label: string; description: string }[] = [
  { value: "all", label: "Todas las edades", description: "Apto para cualquier lector" },
  { value: "teen", label: "Adolescentes (13+)", description: "Temas adolescentes y juveniles" },
  { value: "mature", label: "Adultos (18+)", description: "Contenido adulto, lenguaje fuerte" },
  { value: "explicit", label: "Explícito (18+)", description: "Sexual o gráfico explícito" },
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

export default function NewWorkWizardPage() {
  const router = useRouter();
  const { user, isLoading: loadingUser } = useAuth();

  // ───── Estado global del wizard ─────
  const [step, setStep] = useState(0);
  const [workId, setWorkId] = useState<number | null>(null);

  // Paso 1: información básica
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workFormat, setWorkFormat] = useState<WorkFormat | "">("");
  const [parentCategoryId, setParentCategoryId] = useState<number | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<number | null>(null);
  const [language, setLanguage] = useState("es");
  const [ageRating, setAgeRating] = useState<AgeRating>("all");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [squareCover, setSquareCover] = useState<string | null>(null);
  const [verticalCover, setVerticalCover] = useState<string | null>(null);
  const [copyright, setCopyright] = useState(
    user?.name ? `© ${new Date().getFullYear()} ${user.name}` : ""
  );
  const [confirmOriginal, setConfirmOriginal] = useState(false);
  // Obligatorio: el creador decide si su obra es descargable (sí/no). null = sin elegir.
  const [allowDownload, setAllowDownload] = useState<boolean | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Paso 3: configuración
  const [commentsMode, setCommentsMode] = useState<"on" | "followers_only" | "off">("on");
  const [ratingsEnabled, setRatingsEnabled] = useState(true);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState<string[]>([]);
  const [seoKeywordDraft, setSeoKeywordDraft] = useState("");
  const [authorNoteStart, setAuthorNoteStart] = useState("");
  const [authorNoteEnd, setAuthorNoteEnd] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "schedule">("now");
  const [scheduleAt, setScheduleAt] = useState("");

  // Paso 4: viewport vista previa
  const [previewViewport, setPreviewViewport] = useState<"mobile" | "tablet" | "desktop">("mobile");

  // ───── Validaciones paso 1 ─────
  const step1Errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (touched.title && title.trim().length < 3) e.title = "Mínimo 3 caracteres.";
    if (touched.title && title.length > LIMITS.title) e.title = `Máximo ${LIMITS.title} caracteres.`;
    if (touched.description && description.trim().length < 30)
      e.description = "Describe con al menos 30 caracteres.";
    if (touched.description && description.length > LIMITS.description)
      e.description = `Máximo ${LIMITS.description} caracteres.`;
    if (touched.workFormat && !workFormat) e.workFormat = "Elige un formato.";
    if (touched.parentCategoryId && !parentCategoryId) e.parentCategoryId = "Elige una categoría principal.";
    // La validación de subcategoría se delega al CategoryPicker
    // (solo es obligatoria si el padre tiene hijos)
    if (touched.copyright && copyright.trim().length < 4) e.copyright = "Indica el titular.";
    if (touched.confirmOriginal && !confirmOriginal)
      e.confirmOriginal = "Confirma que la obra es original.";
    if (touched.squareCover && !squareCover) e.squareCover = "Sube la portada cuadrada.";
    if (touched.verticalCover && !verticalCover) e.verticalCover = "Sube la portada vertical.";
    if (touched.allowDownload && allowDownload === null)
      e.allowDownload = "Indica si tu obra se puede descargar.";
    return e;
  }, [
    touched, title, description, workFormat, parentCategoryId, subCategoryId,
    copyright, confirmOriginal, squareCover, verticalCover, allowDownload,
  ]);

  const step1Valid =
    title.trim().length >= 3 &&
    title.length <= LIMITS.title &&
    description.trim().length >= 30 &&
    description.length <= LIMITS.description &&
    !!workFormat &&
    !!parentCategoryId &&
    !!language &&
    !!squareCover &&
    !!verticalCover &&
    copyright.trim().length >= 4 &&
    confirmOriginal &&
    allowDownload !== null;

  // Error de correo sin verificar (403 del middleware verified.email): toast
  // con botón que lleva directo a la sección de verificación en Ajustes.
  const handleWorkError = (
    err: { response?: { status?: number; data?: { message?: string; email_verified?: boolean; errors?: Record<string, string[]> } } },
    fallback: string,
  ) => {
    if (err.response?.status === 403 && err.response.data?.email_verified === false) {
      toast.error("Verifica tu correo electrónico para publicar obras.", {
        duration: 8000,
        action: {
          label: "Verificar",
          onClick: () => router.push("/ajustes/seguridad#verificar-correo"),
        },
      });
      return;
    }
    const apiErrors = err.response?.data?.errors;
    const first = apiErrors ? Object.values(apiErrors)[0]?.[0] : err.response?.data?.message;
    toast.error(first ?? fallback);
  };

  // ───── Mutación: crear borrador antes del paso 2 ─────
  const draftMutation = useMutation({
    mutationFn: () => {
      return worksApi.create({
        title: title.trim(),
        description: description.trim(),
        content_type: undefined as any,
        work_format: workFormat,
        parent_category_id: parentCategoryId,
        subcategory_id: subCategoryId,
        language,
        age_rating: ageRating,
        tags,
        copyright_holder: copyright.trim(),
        is_original: confirmOriginal,
        allow_download: allowDownload ?? false,
        cover_url: verticalCover ?? squareCover ?? null,
        publish_now: false,
      } as any);
    },
    onSuccess: (work: any) => {
      setWorkId(work.id);
      toast.success("Borrador creado");
      setStep(1);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err: { response?: { status?: number; data?: { message?: string; email_verified?: boolean; errors?: Record<string, string[]> } } }) =>
      handleWorkError(err, "No se pudo crear el borrador"),
  });

  // ───── Mutación: guardar (borrador o publicar) ─────
  const saveMutation = useMutation({
    mutationFn: (publishNow: boolean) => {
      // Si ya existe el borrador (workId), solo actualizamos config y estado
      if (workId) {
        return worksApi.update(workId, {
          allow_download: allowDownload ?? false,
          comments_mode: commentsMode,
          ratings_enabled: ratingsEnabled,
          seo_title: seoTitle.trim() || null,
          seo_description: seoDescription.trim() || null,
          seo_keywords: seoKeywords.length ? seoKeywords : null,
          author_note_start: authorNoteStart.trim() || null,
          author_note_end: authorNoteEnd.trim() || null,
          schedule_at: scheduleMode === "schedule" && scheduleAt
            ? new Date(scheduleAt).toISOString()
            : null,
          submission_status: publishNow ? "published" : "draft",
        } as any);
      }
      return worksApi.create({
        title: title.trim(),
        description: description.trim(),
        // content_type queda null — el formato lo dicta work_format
        content_type: undefined as any,
        work_format: workFormat,
        parent_category_id: parentCategoryId,
        subcategory_id: subCategoryId,
        language,
        age_rating: ageRating,
        tags,
        copyright_holder: copyright.trim(),
        is_original: confirmOriginal,
        allow_download: allowDownload ?? false,
        cover_url: verticalCover ?? squareCover ?? null,
        comments_mode: commentsMode,
        ratings_enabled: ratingsEnabled,
        seo_title: seoTitle.trim() || null,
        seo_description: seoDescription.trim() || null,
        seo_keywords: seoKeywords.length ? seoKeywords : null,
        author_note_start: authorNoteStart.trim() || null,
        author_note_end: authorNoteEnd.trim() || null,
        schedule_at: scheduleMode === "schedule" && scheduleAt
          ? new Date(scheduleAt).toISOString()
          : null,
        publish_now: publishNow,
      } as any);
    },
    onSuccess: (_data, publishNow) => {
      toast.success(
        publishNow
          ? scheduleMode === "schedule"
            ? "Obra programada"
            : "¡Obra publicada!"
          : "Borrador guardado"
      );
      router.push("/studio/obras");
    },
    onError: (err: { response?: { status?: number; data?: { message?: string; email_verified?: boolean; errors?: Record<string, string[]> } } }) =>
      handleWorkError(err, "No se pudo guardar"),
  });

  // ───── Helpers ─────
  const touchStep1 = () =>
    setTouched({
      title: true,
      description: true,
      workFormat: true,
      parentCategoryId: true,
      subCategoryId: true,
      copyright: true,
      confirmOriginal: true,
      squareCover: true,
      verticalCover: true,
      allowDownload: true,
    });

  const goToStep = (i: number) => {
    if (i > 0 && !step1Valid) {
      touchStep1();
      toast.error("Completa el paso 1 antes de continuar.");
      return;
    }
    setStep(Math.max(0, Math.min(STEPS.length - 1, i)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNext = () => {
    if (step === 0) {
      touchStep1();
      if (!step1Valid) {
        toast.error("Revisa los campos marcados.");
        return;
      }
      // Si aún no creamos el borrador → crearlo ahora; si ya existe, avanzar
      if (!workId) {
        draftMutation.mutate();
        return;
      }
    }
    goToStep(step + 1);
  };

  const handleSaveDraft = () => saveMutation.mutate(false);
  const handlePublish = () => saveMutation.mutate(true);

  const addTag = () => {
    const t = tagDraft.trim().toLowerCase();
    if (!t || t.length > LIMITS.tag) return;
    if (tags.includes(t) || tags.length >= MAX_TAGS) return;
    setTags([...tags, t]);
    setTagDraft("");
  };

  const addSeoKeyword = () => {
    const t = seoKeywordDraft.trim().toLowerCase();
    if (!t || seoKeywords.includes(t) || seoKeywords.length >= MAX_SEO_KEYWORDS) return;
    setSeoKeywords([...seoKeywords, t]);
    setSeoKeywordDraft("");
  };

  if (loadingUser) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-96" />
      </div>
    );
  }

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
                Studio · Nueva obra
              </p>
              <h1 className="line-clamp-1 font-serif text-base font-bold leading-tight md:text-lg">
                {title || "Sin título"}
              </h1>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={!step1Valid || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Guardar borrador
          </Button>
        </div>
        {/* Barra de progreso */}
        <div className="px-4 pb-4 pt-1 sm:px-6 lg:px-10">
          <WizardProgress steps={STEPS} current={step} onStepClick={goToStep} />
        </div>
      </div>

      {/* ═══════ BODY ═══════ */}
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {step === 0 && (
          <Step1Basic
            title={title} setTitle={setTitle}
            description={description} setDescription={setDescription}
            workFormat={workFormat} setWorkFormat={setWorkFormat}
            parentCategoryId={parentCategoryId} subCategoryId={subCategoryId}
            setCategories={(p: number | null, s: number | null) => { setParentCategoryId(p); setSubCategoryId(s); }}
            language={language} setLanguage={setLanguage}
            ageRating={ageRating} setAgeRating={setAgeRating}
            tags={tags} setTags={setTags}
            tagDraft={tagDraft} setTagDraft={setTagDraft} addTag={addTag}
            squareCover={squareCover} setSquareCover={setSquareCover}
            verticalCover={verticalCover} setVerticalCover={setVerticalCover}
            copyright={copyright} setCopyright={setCopyright}
            confirmOriginal={confirmOriginal} setConfirmOriginal={setConfirmOriginal}
            allowDownload={allowDownload} setAllowDownload={setAllowDownload}
            touched={touched} setTouched={setTouched}
            errors={step1Errors}
          />
        )}

        {step === 1 && (
          <Step2Content
            workFormat={workFormat || "libro_completo"}
            workId={workId}
          />
        )}

        {step === 2 && (
          <Step3Settings
            commentsMode={commentsMode} setCommentsMode={setCommentsMode}
            ratingsEnabled={ratingsEnabled} setRatingsEnabled={setRatingsEnabled}
            seoTitle={seoTitle} setSeoTitle={setSeoTitle}
            seoDescription={seoDescription} setSeoDescription={setSeoDescription}
            seoKeywords={seoKeywords} setSeoKeywords={setSeoKeywords}
            seoKeywordDraft={seoKeywordDraft} setSeoKeywordDraft={setSeoKeywordDraft}
            addSeoKeyword={addSeoKeyword}
            authorNoteStart={authorNoteStart} setAuthorNoteStart={setAuthorNoteStart}
            authorNoteEnd={authorNoteEnd} setAuthorNoteEnd={setAuthorNoteEnd}
            scheduleMode={scheduleMode} setScheduleMode={setScheduleMode}
            scheduleAt={scheduleAt} setScheduleAt={setScheduleAt}
          />
        )}

        {step === 3 && (
          <Step4Preview
            previewViewport={previewViewport}
            setPreviewViewport={setPreviewViewport}
            data={{ title, description, squareCover, verticalCover, tags, ageRating }}
          />
        )}

        {/* ═══════ NAVEGACIÓN ENTRE PASOS ═══════ */}
        <div className="mt-8 flex items-center justify-between gap-2 border-t border-border/60 pt-4">
          {step > 0 ? (
            <Button variant="outline" onClick={() => goToStep(step - 1)} disabled={saveMutation.isPending}>
              <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
              Atrás
            </Button>
          ) : (
            <span />
          )}

          {step < STEPS.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={draftMutation.isPending || saveMutation.isPending}
            >
              {draftMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Siguiente
              {!draftMutation.isPending && (
                <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
              )}
            </Button>
          ) : (
            <Button onClick={handlePublish} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-3.5 w-3.5" />
              )}
              {scheduleMode === "schedule" ? "Programar obra" : "Publicar obra"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PASO 1: Información básica
// ═══════════════════════════════════════════════════════════
function Step1Basic({
  title, setTitle, description, setDescription,
  workFormat, setWorkFormat,
  parentCategoryId, subCategoryId, setCategories,
  language, setLanguage,
  ageRating, setAgeRating,
  tags, setTags, tagDraft, setTagDraft, addTag,
  squareCover, setSquareCover, verticalCover, setVerticalCover,
  copyright, setCopyright,
  confirmOriginal, setConfirmOriginal,
  allowDownload, setAllowDownload,
  touched, setTouched,
  errors,
}: any) {
  return (
    <>
      <FormSection
        title="¿Qué tipo de obra publicas?"
        description="El formato define cómo se entrega tu obra y qué pasos verás después."
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {FORMATS.map((f) => {
            const Icon = f.icon;
            const active = workFormat === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setWorkFormat(f.value);
                  setTouched((t: any) => ({ ...t, workFormat: true }));
                }}
                className={cn(
                  "rounded-lg border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border/60 hover:border-primary/30"
                )}
              >
                <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                <div className="mt-2 text-sm font-medium">{f.label}</div>
                <div className="text-[11px] text-muted-foreground">{f.hint}</div>
              </button>
            );
          })}
        </div>
        {errors.workFormat && (
          <p className="mt-2 flex items-center gap-1 text-[11px] text-destructive">
            <AlertCircle className="h-3 w-3" /> {errors.workFormat}
          </p>
        )}
      </FormSection>

      <FormSection title="Información básica" description="Cómo encuentran tu obra los lectores.">
        <Field label="Título de la obra" required error={errors.title} counter={`${title.length} / ${LIMITS.title}`}>
          <input
            type="text"
            value={title}
            onBlur={() => setTouched((t: any) => ({ ...t, title: true }))}
            onChange={(e) => setTitle(e.target.value.slice(0, LIMITS.title + 1))}
            placeholder="Ej. Las horas perdidas"
            className={cn(inputCls, errors.title && errorBorder)}
          />
        </Field>

        <Field label="Descripción" required
          help="Sinopsis clara — esto verán los lectores antes de empezar."
          error={errors.description} counter={`${description.length} / ${LIMITS.description}`}>
          <textarea
            rows={5}
            value={description}
            onBlur={() => setTouched((t: any) => ({ ...t, description: true }))}
            onChange={(e) => setDescription(e.target.value.slice(0, LIMITS.description + 1))}
            placeholder="¿De qué trata tu obra? ¿Por qué deberían leerla?"
            className={cn(textareaCls, errors.description && errorBorder)}
          />
        </Field>
      </FormSection>

      <FormSection title="Categoría" description="Ayuda a la plataforma a recomendar tu obra a los lectores correctos.">
        <CategoryPicker
          parentId={parentCategoryId}
          subId={subCategoryId}
          onChange={(p, s) => {
            setCategories(p, s);
            setTouched((t: any) => ({ ...t, parentCategoryId: true, subCategoryId: true }));
          }}
          required
          showSubError={touched.subCategoryId}
        />
        {errors.parentCategoryId && (
          <p className="mt-2 flex items-center gap-1 text-[11px] text-destructive">
            <AlertCircle className="h-3 w-3" /> {errors.parentCategoryId}
          </p>
        )}

        <Field label="Etiquetas" icon={<Tag className="h-3.5 w-3.5" />} help={`Hasta ${MAX_TAGS} palabras clave.`} counter={`${tags.length} / ${MAX_TAGS}`}>
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Idioma" icon={<Globe2 className="h-3.5 w-3.5" />}>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={selectCls}>
              {LANGUAGES.map((l) => (<option key={l.code} value={l.code}>{l.label}</option>))}
            </select>
          </Field>
          <Field label="Clasificación por edad" required>
            <select value={ageRating} onChange={(e) => setAgeRating(e.target.value as AgeRating)} className={selectCls}>
              {AGE_RATINGS.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
            </select>
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Portadas"
        description="Sube las dos versiones de tu portada."
        action={<CoverHelpButton />}
      >
        <div className="flex flex-wrap items-start gap-5">
          <CoverDropzone
            label="Vertical"
            aspectRatio="portrait"
            minWidth={1080}
            minHeight={1920}
            value={verticalCover}
            onChange={(v) => {
              setVerticalCover(v);
              setTouched((t: any) => ({ ...t, verticalCover: true }));
            }}
            compact
          />
          <CoverDropzone
            label="Cuadrada"
            aspectRatio="square"
            minWidth={1080}
            minHeight={1080}
            value={squareCover}
            onChange={(v) => {
              setSquareCover(v);
              setTouched((t: any) => ({ ...t, squareCover: true }));
            }}
            compact
          />
        </div>
        {(errors.squareCover || errors.verticalCover) && (
          <p className="mt-2 flex items-center gap-1 text-[11px] text-destructive">
            <AlertCircle className="h-3 w-3" />
            Ambas portadas son obligatorias con las dimensiones mínimas.
          </p>
        )}
      </FormSection>

      <FormSection title="Derechos y autoría" description="Información requerida por las normas de la comunidad.">
        <Field label="Titular de los derechos" icon={<ShieldCheck className="h-3.5 w-3.5" />} required error={errors.copyright} counter={`${copyright.length} / ${LIMITS.copyright}`}>
          <input
            type="text"
            value={copyright}
            onBlur={() => setTouched((t: any) => ({ ...t, copyright: true }))}
            onChange={(e) => setCopyright(e.target.value.slice(0, LIMITS.copyright + 1))}
            placeholder="© 2026 Tu nombre"
            className={cn(inputCls, errors.copyright && errorBorder)}
          />
        </Field>

        <div className="rounded-md border border-border/60 bg-card p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmOriginal}
              onChange={(e) => {
                setConfirmOriginal(e.target.checked);
                setTouched((t: any) => ({ ...t, confirmOriginal: true }));
              }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">Confirmo que esta obra es original</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Declaro que la obra es de mi autoría o tengo los derechos necesarios para publicarla.
              </p>
            </div>
          </label>
          {errors.confirmOriginal && (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-destructive">
              <AlertCircle className="h-3 w-3" /> {errors.confirmOriginal}
            </p>
          )}
        </div>
      </FormSection>

      <FormSection
        title="Descargas"
        description="Decide si los lectores pueden descargar tu obra en un solo archivo (EPUB). Esta elección es obligatoria."
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            { val: true, label: "Permitir descarga", desc: "Los lectores podrán bajar los capítulos a los que tengan acceso." },
            { val: false, label: "No permitir", desc: "Tu obra solo se podrá leer dentro de la plataforma." },
          ].map((opt) => {
            const active = allowDownload === opt.val;
            return (
              <button
                key={String(opt.val)}
                type="button"
                onClick={() => {
                  setAllowDownload(opt.val);
                  setTouched((t: any) => ({ ...t, allowDownload: true }));
                }}
                className={cn(
                  "rounded-lg border px-4 py-3 text-left transition-colors",
                  active ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/30",
                )}
              >
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{opt.desc}</p>
              </button>
            );
          })}
        </div>
        {errors.allowDownload && (
          <p className="mt-2 flex items-center gap-1 text-[11px] text-destructive">
            <AlertCircle className="h-3 w-3" /> {errors.allowDownload}
          </p>
        )}
      </FormSection>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// PASO 2: Contenido — builder real según work_format
// ═══════════════════════════════════════════════════════════
function Step2Content({
  workFormat,
  workId,
}: {
  workFormat: WorkFormat;
  workId: number | null;
}) {
  const meta = {
    serie: { title: "Serie por capítulos", icon: Layers },
    libro_completo: { title: "Libro completo", icon: BookText },
    comic: { title: "Cómic o novela gráfica", icon: BookImage },
  }[workFormat];

  const Icon = meta.icon;

  if (!workId) {
    return (
      <div className="rounded-lg border border-amber-400/40 bg-amber-400/5 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <h3 className="font-medium">Aún no hay borrador</h3>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Vuelve al paso anterior y completa la información básica para crear
          un borrador. Después podrás subir el contenido.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-xl font-bold leading-tight">{meta.title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {workFormat === "serie" && "Crea capítulos, escribe su contenido y reordénalos como quieras."}
          {workFormat === "libro_completo" && "Sube el archivo único de tu libro en EPUB, PDF o DOCX."}
          {workFormat === "comic" && "Sube las páginas de tu cómic o novela gráfica."}
        </p>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-5">
        {workFormat === "serie" && <ChaptersBuilder workId={workId} />}
        {workFormat === "libro_completo" && <BookFileUploader workId={workId} />}
        {workFormat === "comic" && <ComicPagesBuilder workId={workId} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PASO 3: Configuración (comentarios, ratings, SEO, notas, schedule)
// ═══════════════════════════════════════════════════════════
function Step3Settings(props: any) {
  const {
    commentsMode, setCommentsMode,
    ratingsEnabled, setRatingsEnabled,
    seoTitle, setSeoTitle,
    seoDescription, setSeoDescription,
    seoKeywords, setSeoKeywords,
    seoKeywordDraft, setSeoKeywordDraft, addSeoKeyword,
    authorNoteStart, setAuthorNoteStart,
    authorNoteEnd, setAuthorNoteEnd,
    scheduleMode, setScheduleMode,
    scheduleAt, setScheduleAt,
  } = props;

  return (
    <>
      <FormSection title="Programación de publicación" description="¿Cuándo deben verla tus lectores?">
        <div className="space-y-2">
          <label className={cn("flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors",
            scheduleMode === "now" ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/30")}>
            <input type="radio" name="schedule" checked={scheduleMode === "now"}
              onChange={() => setScheduleMode("now")} className="mt-1 h-3.5 w-3.5" />
            <div className="min-w-0">
              <div className="text-sm font-medium">Publicar inmediatamente</div>
              <div className="text-[11px] text-muted-foreground">Tus lectores verán la obra en cuanto pulses Publicar.</div>
            </div>
          </label>
          <label className={cn("flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors",
            scheduleMode === "schedule" ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/30")}>
            <input type="radio" name="schedule" checked={scheduleMode === "schedule"}
              onChange={() => setScheduleMode("schedule")} className="mt-1 h-3.5 w-3.5" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Programar publicación</div>
              <div className="text-[11px] text-muted-foreground">Elige fecha y hora exactas.</div>
              {scheduleMode === "schedule" && (
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className={cn(inputCls, "mt-2")}
                />
              )}
            </div>
          </label>
        </div>
      </FormSection>

      <FormSection title="Configuración de lectores" description="Cómo pueden interactuar contigo y con tu obra.">
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
      </FormSection>

      <FormSection title="Notas del creador" description="Mensajes para tus lectores. Aparecen antes o después de la obra.">
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
      </FormSection>

      <FormSection title="SEO y descubrimiento" description="Ayuda a que más lectores encuentren tu obra en búsquedas.">
        <Field label="Título SEO" help="Si vacío usamos el título de la obra." counter={`${seoTitle.length} / ${LIMITS.seoTitle}`}>
          <input type="text" value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value.slice(0, LIMITS.seoTitle))}
            placeholder="Cómo lo verán en Google"
            className={inputCls} />
        </Field>
        <Field label="Descripción SEO" counter={`${seoDescription.length} / ${LIMITS.seoDescription}`}>
          <textarea rows={3} value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value.slice(0, LIMITS.seoDescription))}
            placeholder="Frase corta y atractiva."
            className={textareaCls} />
        </Field>
        <Field label="Palabras clave" icon={<Tag className="h-3.5 w-3.5" />} counter={`${seoKeywords.length} / ${MAX_SEO_KEYWORDS}`}>
          <div className="rounded-md border border-border/60 bg-background p-2">
            {seoKeywords.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {seoKeywords.map((kw: string) => (
                  <span key={kw} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-foreground">
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
      </FormSection>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// PASO 4: Vista previa
// ═══════════════════════════════════════════════════════════
function Step4Preview({
  previewViewport, setPreviewViewport, data,
}: {
  previewViewport: "mobile" | "tablet" | "desktop";
  setPreviewViewport: (v: "mobile" | "tablet" | "desktop") => void;
  data: any;
}) {
  const viewports = [
    { key: "mobile", label: "Móvil", icon: Smartphone, w: 360 },
    { key: "tablet", label: "Tablet", icon: Tablet, w: 768 },
    { key: "desktop", label: "Escritorio", icon: Monitor, w: 1024 },
  ] as const;

  const current = viewports.find((v) => v.key === previewViewport)!;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Eye className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-xl font-bold leading-tight">Vista previa</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Así verán los lectores tu obra. Cambia entre dispositivos para revisar.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border/60 pb-3">
        {viewports.map((vp) => {
          const Icon = vp.icon;
          const active = previewViewport === vp.key;
          return (
            <button key={vp.key} onClick={() => setPreviewViewport(vp.key)}
              className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="h-3.5 w-3.5" />
              {vp.label}
            </button>
          );
        })}
      </div>

      <div className="flex justify-center">
        <div
          className="overflow-hidden rounded-lg border border-border/60 bg-card shadow-lg transition-all"
          style={{ width: `${Math.min(current.w, 1024)}px`, maxWidth: "100%" }}
        >
          <PreviewContent data={data} narrow={current.w <= 360} />
        </div>
      </div>
    </div>
  );
}

function PreviewContent({ data, narrow }: { data: any; narrow: boolean }) {
  return (
    <div className="bg-background">
      <div className={cn("relative", narrow ? "aspect-[3/4]" : "aspect-[2/1]")}>
        {data.verticalCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.verticalCover} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground/40">
            <BookOpenText className="h-12 w-12" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="font-serif text-xl font-bold leading-tight">
            {data.title || "Sin título"}
          </h3>
          {data.tags?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {data.tags.slice(0, 3).map((t: string) => (
                <span key={t} className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="p-4">
        <p className="text-sm leading-relaxed text-muted-foreground line-clamp-6">
          {data.description || "Aquí aparecerá la descripción de tu obra."}
        </p>
      </div>
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
const errorBorder = "border-destructive/60 focus-visible:border-destructive focus-visible:ring-destructive/20";

function FormSection({
  title, description, action, children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 border-b border-border/60 pb-8 last:border-b-0">
      <div className="mb-5">
        <div className="flex items-center gap-1.5">
          <h2 className="font-serif text-lg font-bold leading-tight">{title}</h2>
          {action}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({
  label, icon, help, required, error, counter, children,
}: {
  label: string;
  icon?: React.ReactNode;
  help?: string;
  required?: boolean;
  error?: string;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-sm font-medium">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          {label}
          {required && <span className="text-destructive">*</span>}
        </label>
        {counter && (
          <span className="text-[10px] tabular-nums text-muted-foreground/70">{counter}</span>
        )}
      </div>
      {children}
      <div className="mt-1.5 min-h-[14px]">
        {error ? (
          <p className="flex items-center gap-1 text-[11px] text-destructive">
            <AlertCircle className="h-3 w-3" /> {error}
          </p>
        ) : help ? (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Info className="h-3 w-3" /> {help}
          </p>
        ) : null}
      </div>
    </div>
  );
}
