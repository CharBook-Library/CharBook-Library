"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  X, Loader2, EyeOff, Eye, AlertTriangle, ShieldAlert,
  Clock, Trash2, FileText, Save, Pin, PinOff, Star, StarOff,
  Flame, Pencil, Tag, FolderInput, Globe2, LinkIcon,
  Image as ImageIcon, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { staffApi } from "@/lib/api-creator";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { AdminWorkAction, AdminWorkEditInput } from "@/lib/types";

const TABS = [
  { key: "moderation", label: "Moderación", icon: ShieldAlert },
  { key: "edit", label: "Edición", icon: Pencil },
  { key: "highlights", label: "Destacados", icon: Star },
  { key: "chapters", label: "Capítulos", icon: BookOpen },
  { key: "danger", label: "Eliminar", icon: Trash2 },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function WorkAdminDrawer({
  workId,
  onClose,
}: {
  workId: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<TabKey>("moderation");

  // Los moderadores pueden moderar/editar, pero solo admin elimina obras.
  const visibleTabs = TABS.filter((t) => t.key !== "danger" || isAdmin);

  const { data: work, isLoading } = useQuery({
    queryKey: ["admin-uploaded-work", workId],
    queryFn: () => staffApi.uploadedWorks.get(workId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-uploaded-work", workId] });
    queryClient.invalidateQueries({ queryKey: ["admin-uploaded-works"] });
  };

  const moderateMutation = useMutation({
    mutationFn: (action: AdminWorkAction) =>
      staffApi.uploadedWorks.moderate(workId, action),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidate();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? "No se pudo aplicar"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => staffApi.uploadedWorks.remove(workId),
    onSuccess: () => {
      toast.success("Obra eliminada");
      invalidate();
      onClose();
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto p-0"
      >
        {isLoading || !work ? (
          <>
            <SheetHeader className="border-b border-border/60 p-5 text-left">
              <SheetTitle className="font-serif text-lg">Cargando obra…</SheetTitle>
              <SheetDescription className="text-xs">
                Obteniendo detalles de la obra seleccionada.
              </SheetDescription>
            </SheetHeader>
            <div className="p-6 space-y-3">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-32 w-full" />
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="border-b border-border/60 p-5 text-left">
              <div className="flex items-start gap-4">
                <div className="h-20 w-14 shrink-0 overflow-hidden rounded border border-border/60 bg-muted">
                  {work.cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={work.cover} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="font-serif text-lg leading-tight line-clamp-2">
                    {work.title}
                  </SheetTitle>
                  <SheetDescription className="mt-1 text-xs">
                    @{work.creator?.username ?? "—"} ·{" "}
                    {new Date(work.created_at).toLocaleDateString("es")}
                  </SheetDescription>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <StatusFlag active={work.is_published} label="Publicada" />
                    <StatusFlag active={work.is_hidden} label="Oculta" danger />
                    <StatusFlag active={work.is_sensitive} label="Sensible" warning />
                    <StatusFlag active={work.is_pinned} label="Fijada" />
                    <StatusFlag active={work.is_recommended} label="Recomendada" />
                    <StatusFlag active={work.is_trending} label="Tendencia" />
                  </div>
                </div>
              </div>
            </SheetHeader>

            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto border-b border-border/60 px-3 py-2">
              {visibleTabs.map((t) => {
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

            {/* Contenido por tab */}
            <div className="p-5">
              {tab === "moderation" && (
                <ModerationTab
                  work={work}
                  onAction={moderateMutation.mutate}
                  pending={moderateMutation.isPending}
                />
              )}
              {tab === "edit" && (
                <EditTab work={work} onSaved={invalidate} />
              )}
              {tab === "highlights" && (
                <HighlightsTab
                  work={work}
                  onAction={moderateMutation.mutate}
                  pending={moderateMutation.isPending}
                />
              )}
              {tab === "chapters" && <ChaptersTab />}
              {tab === "danger" && (
                <DangerTab
                  pending={deleteMutation.isPending}
                  onDelete={() => deleteMutation.mutate()}
                />
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ───────────────── Moderación ─────────────────
function ModerationTab({
  work,
  onAction,
  pending,
}: {
  work: any;
  onAction: (a: AdminWorkAction) => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-4">
      <ActionGroup title="Estado de publicación">
        {work.submission_status !== "published" && (
          <ActionBtn icon={Eye} label="✅ Aprobar y publicar"
            onClick={() => onAction("publish")} disabled={pending} />
        )}
        {work.submission_status !== "review" && (
          <ActionBtn icon={Clock} label="🕐 Poner en revisión"
            warning onClick={() => onAction("review")} disabled={pending} />
        )}
        {work.is_hidden ? (
          <ActionBtn icon={Eye} label="🔓 Volver a mostrar"
            onClick={() => onAction("unhide")} disabled={pending} />
        ) : (
          <ActionBtn icon={EyeOff} label="🚫 Ocultar obra"
            danger onClick={() => onAction("hide")} disabled={pending} />
        )}
      </ActionGroup>

      <ActionGroup title="Clasificación">
        {work.is_sensitive ? (
          <ActionBtn icon={AlertTriangle} label="✓ Quitar marca de sensible"
            onClick={() => onAction("unsensitive")} disabled={pending} />
        ) : (
          <ActionBtn icon={AlertTriangle} label="⚠️ Marcar contenido sensible"
            warning onClick={() => onAction("sensitive")} disabled={pending} />
        )}
      </ActionGroup>

      <ActionGroup title="Notas internas">
        <p className="text-xs text-muted-foreground mb-2">
          Las notas que escribes en la pestaña <strong>Edición</strong>{" "}
          quedan visibles solo para el equipo de moderación.
        </p>
        {work.mod_notes && (
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs whitespace-pre-line">
            <FileText className="h-3 w-3 inline mr-1" />
            {work.mod_notes}
          </div>
        )}
      </ActionGroup>
    </div>
  );
}

// ───────────────── Edición ─────────────────
function EditTab({ work, onSaved }: { work: any; onSaved: () => void }) {
  const [title, setTitle] = useState(work.title);
  const [description, setDescription] = useState(work.description ?? "");
  const [slug, setSlug] = useState(work.slug);
  const [coverUrl, setCoverUrl] = useState(work.cover ?? "");
  const [language, setLanguage] = useState(work.language);
  const [ageRating, setAgeRating] = useState(work.age_rating);
  const [tags, setTags] = useState<string[]>(work.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [modNotes, setModNotes] = useState(work.mod_notes ?? "");

  // Reset si cambia la obra
  useEffect(() => {
    setTitle(work.title);
    setDescription(work.description ?? "");
    setSlug(work.slug);
    setCoverUrl(work.cover ?? "");
    setLanguage(work.language);
    setAgeRating(work.age_rating);
    setTags(work.tags ?? []);
    setModNotes(work.mod_notes ?? "");
  }, [work.id]);

  const mutation = useMutation({
    mutationFn: (input: AdminWorkEditInput) =>
      staffApi.uploadedWorks.update(work.id, input),
    onSuccess: (res) => {
      toast.success(res.message);
      onSaved();
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      const first = e.response?.data?.errors
        ? Object.values(e.response.data.errors)[0]?.[0]
        : e.response?.data?.message;
      toast.error(first ?? "No se pudo guardar");
    },
  });

  return (
    <div className="space-y-4">
      <Field label="✏️ Título">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputCls}
        />
      </Field>

      <Field label="✏️ Descripción">
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={textareaCls}
        />
      </Field>

      <Field label="🔗 Slug (URL)" icon={LinkIcon}>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="mi-obra-genial"
          className={inputCls}
        />
      </Field>

      <Field label="🖼️ URL de la portada" icon={ImageIcon}>
        <input
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="https://..."
          className={inputCls}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="🌎 Idioma" icon={Globe2}>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className={inputCls}
          >
            {[
              ["es", "Español"], ["en", "English"], ["pt", "Português"],
              ["fr", "Français"], ["de", "Deutsch"], ["it", "Italiano"],
            ].map(([c, l]) => (
              <option key={c} value={c}>{l}</option>
            ))}
          </select>
        </Field>

        <Field label="🔞 Clasificación por edad">
          <select
            value={ageRating}
            onChange={(e) => setAgeRating(e.target.value as any)}
            className={inputCls}
          >
            <option value="all">Todas las edades</option>
            <option value="teen">Adolescentes (13+)</option>
            <option value="mature">Adultos (18+)</option>
            <option value="explicit">Explícito (18+)</option>
          </select>
        </Field>
      </div>

      <Field label="🏷️ Etiquetas" icon={Tag}>
        <div className="rounded-md border border-border/60 bg-background p-2">
          {tags.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t}
                  className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))}
                    className="hover:bg-primary/20 rounded-sm">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                const t = tagDraft.trim().toLowerCase();
                if (t && !tags.includes(t) && tags.length < 10) {
                  setTags([...tags, t]);
                  setTagDraft("");
                }
              }
            }}
            placeholder="Pulsa Enter para añadir"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </div>
      </Field>

      <Field label="📂 Categorías" icon={FolderInput}>
        <p className="text-xs text-muted-foreground">
          Las categorías actuales:{" "}
          {work.categories?.length
            ? work.categories.map((c: any) => c.name).join(", ")
            : "(ninguna)"}
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          La edición avanzada de categorías se hace desde la pantalla de Libros.
        </p>
      </Field>

      <Field label="📝 Notas internas para moderadores">
        <textarea
          rows={3}
          value={modNotes}
          onChange={(e) => setModNotes(e.target.value)}
          placeholder="Solo visibles para el equipo..."
          className={textareaCls}
        />
      </Field>

      <Button
        className="w-full"
        disabled={mutation.isPending}
        onClick={() =>
          mutation.mutate({
            title, description, slug,
            cover_url: coverUrl || null,
            language,
            age_rating: ageRating,
            tags,
            mod_notes: modNotes || null,
          })
        }
      >
        {mutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          : <Save className="mr-1.5 h-3.5 w-3.5" />}
        Guardar cambios
      </Button>
    </div>
  );
}

// ───────────────── Destacados ─────────────────
function HighlightsTab({
  work,
  onAction,
  pending,
}: {
  work: any;
  onAction: (a: AdminWorkAction) => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-2">
      {work.is_pinned ? (
        <ActionBtn icon={PinOff} label="Quitar de destacados"
          onClick={() => onAction("unpin")} disabled={pending} />
      ) : (
        <ActionBtn icon={Pin} label="📌 Fijar obra en destacados"
          onClick={() => onAction("pin")} disabled={pending} />
      )}

      {work.is_recommended ? (
        <ActionBtn icon={StarOff} label="Quitar como recomendada"
          onClick={() => onAction("unrecommend")} disabled={pending} />
      ) : (
        <ActionBtn icon={Star} label="⭐ Marcar como recomendada"
          onClick={() => onAction("recommend")} disabled={pending} />
      )}

      {work.is_trending ? (
        <ActionBtn icon={Flame} label="Quitar de tendencias"
          onClick={() => onAction("untrend")} disabled={pending} />
      ) : (
        <ActionBtn icon={Flame} label="🔥 Marcar como tendencia"
          onClick={() => onAction("trend")} disabled={pending} />
      )}
    </div>
  );
}

// ───────────────── Capítulos (próximamente) ─────────────────
function ChaptersTab() {
  const items = [
    "📖 Ver capítulos", "➕ Crear capítulo", "✏️ Editar capítulo",
    "🗑️ Eliminar capítulo", "🔒 Bloquear capítulo", "👁️ Ocultar capítulo",
    "📅 Programar publicación", "🔄 Restaurar capítulo eliminado",
    "📥 Descargar contenido",
  ];
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-card/40 p-5">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-medium">Sistema de capítulos</h3>
        <Badge variant="outline" className="border-amber-400/40 text-amber-500 text-[10px]">
          Próximamente
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Los capítulos requieren un sistema dedicado (programación, versiones,
        bloqueos por suscripción). Estará disponible en una próxima fase.
      </p>
      <ul className="space-y-1.5 border-t border-border/60 pt-3">
        {items.map((i) => (
          <li key={i}
            className="flex items-center gap-2 text-xs text-muted-foreground/80">
            <span className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────── Eliminar ─────────────────
function DangerTab({
  pending,
  onDelete,
}: {
  pending: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
      <div className="flex items-start gap-3">
        <Trash2 className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium">Eliminar obra permanentemente</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            La obra desaparecerá del catálogo, reseñas, favoritos y feeds.
            Esta acción usa soft-delete y puede restaurarse vía consola.
          </p>
        </div>
      </div>
      <Button
        variant="destructive"
        className="mt-4 w-full"
        disabled={pending}
        onClick={() => {
          if (confirm("¿Eliminar esta obra? La acción puede revertirse desde la base de datos.")) {
            onDelete();
          }
        }}
      >
        {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
        🗑️ Eliminar obra
      </Button>
    </div>
  );
}

// ───────────────────────────────────────────────────────
// UI primitives
// ───────────────────────────────────────────────────────
const inputCls =
  "h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30";
const textareaCls =
  "w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30 leading-relaxed";

function ActionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
  warning,
}: {
  icon: typeof EyeOff;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  warning?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
        danger
          ? "border-destructive/30 text-destructive hover:bg-destructive/10"
          : warning
            ? "border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
            : "border-border/60 hover:border-primary/40 hover:bg-accent/40",
        "disabled:opacity-50 disabled:cursor-not-allowed"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: typeof EyeOff;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-xs font-medium">
        {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusFlag({
  active, label, danger, warning,
}: {
  active: boolean; label: string; danger?: boolean; warning?: boolean;
}) {
  if (!active) return null;
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium border",
        danger
          ? "bg-destructive/15 text-destructive border-destructive/30"
          : warning
            ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
            : "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
      )}
    >
      {label}
    </span>
  );
}
