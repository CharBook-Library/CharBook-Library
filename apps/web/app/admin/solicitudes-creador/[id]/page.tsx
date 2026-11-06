"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft, ExternalLink, Loader2, Check, X, MessageSquareWarning,
  User, Calendar, Star, Users, Library, Mail,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { staffApi } from "@/lib/api-creator";
import { cn } from "@/lib/utils";

export default function AdminCreatorAppDetailPage() {
  const t = useTranslations("admin.creator_apps");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = parseInt(params.id);

  const { data: app, isLoading } = useQuery({
    queryKey: ["admin-creator-app", id],
    queryFn: () => staffApi.creatorApps.get(id),
  });

  // Rúbrica local — se rellena al cargar
  const [quality, setQuality] = useState(0);
  const [commitment, setCommitment] = useState(0);
  const [professionalism, setProfessionalism] = useState(0);
  const [fit, setFit] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (app) {
      setQuality(app.score.quality ?? 0);
      setCommitment(app.score.commitment ?? 0);
      setProfessionalism(app.score.professionalism ?? 0);
      setFit(app.score.fit ?? 0);
      setNotes(app.reviewer_notes ?? "");
    }
  }, [app]);

  const total = quality + commitment + professionalism + fit;
  const canApprove = total >= 8;

  // Mutations
  const scoreMutation = useMutation({
    mutationFn: () =>
      staffApi.creatorApps.score(id, { quality, commitment, professionalism, fit }),
    onSuccess: () => toast.success("Borrador guardado"),
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      // Primero guarda el score, luego aprueba
      await staffApi.creatorApps.score(id, { quality, commitment, professionalism, fit });
      return staffApi.creatorApps.approve(id, notes || null);
    },
    onSuccess: () => {
      toast.success("Solicitud aprobada ✨");
      queryClient.invalidateQueries({ queryKey: ["admin-creator-apps"] });
      router.push("/admin/solicitudes-creador");
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? "Error al aprobar"),
  });

  const rejectMutation = useMutation({
    mutationFn: () => staffApi.creatorApps.reject(id, notes),
    onSuccess: () => {
      toast.success("Solicitud rechazada");
      queryClient.invalidateQueries({ queryKey: ["admin-creator-apps"] });
      router.push("/admin/solicitudes-creador");
    },
  });

  const changesMutation = useMutation({
    mutationFn: () => staffApi.creatorApps.requestChanges(id, notes),
    onSuccess: () => {
      toast.success("Cambios solicitados al usuario");
      queryClient.invalidateQueries({ queryKey: ["admin-creator-apps"] });
      router.push("/admin/solicitudes-creador");
    },
  });

  if (isLoading || !app) {
    return (
      <div className="p-6 md:p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const isResolved = app.status === "approved" || app.status === "rejected";
  const accountAgeDays = app.user
    ? Math.floor((Date.now() - new Date(app.user.created_at).getTime()) / 86_400_000)
    : 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <Link
        href="/admin/solicitudes-creador"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al listado
      </Link>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* ===== Columna principal: solicitud + rúbrica ===== */}
        <div className="space-y-6 min-w-0">
          {/* Cabecera */}
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              {app.display_name}
              {app.pen_name && (
                <span className="ml-3 text-xl italic text-muted-foreground font-normal">
                  "{app.pen_name}"
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enviada hace {Math.floor((Date.now() - new Date(app.submitted_at).getTime()) / 86_400_000)} día(s)
            </p>
          </div>

          {/* Contenido de la solicitud */}
          <Card className="border-border/60 bg-card p-6 space-y-5">
            <Section title="Biografía">
              <p className="whitespace-pre-line text-sm leading-relaxed">{app.bio_long}</p>
            </Section>

            <Section title="Muestra de obra">
              <a
                href={app.sample_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline break-all"
              >
                {app.sample_url} <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </Section>

            <div className="grid sm:grid-cols-2 gap-4">
              <Section title="Géneros">
                <div className="flex flex-wrap gap-1.5">
                  {app.genres.map((g) => (
                    <Badge key={g} variant="outline" className="capitalize border-border/60">
                      {g.replace("_", " ")}
                    </Badge>
                  ))}
                </div>
              </Section>
              <Section title="Idiomas">
                <div className="flex flex-wrap gap-1.5">
                  {app.languages.map((l) => (
                    <Badge key={l} variant="outline" className="border-border/60 uppercase">
                      {l}
                    </Badge>
                  ))}
                </div>
              </Section>
            </div>

            {(app.publish_frequency || app.publish_plan) && (
              <Section title="Plan de publicación">
                {app.publish_frequency && (
                  <p className="text-sm">Frecuencia: <strong className="capitalize">{app.publish_frequency}</strong></p>
                )}
                {app.publish_plan && (
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{app.publish_plan}</p>
                )}
              </Section>
            )}

            <Section title="Por qué quiere unirse">
              <p className="whitespace-pre-line text-sm leading-relaxed">{app.why_join}</p>
            </Section>

            {app.social_links && Object.keys(app.social_links).length > 0 && (
              <Section title="Redes sociales">
                <div className="space-y-1">
                  {Object.entries(app.social_links).map(([key, url]) => (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-primary hover:underline"
                    >
                      <span className="capitalize">{key}:</span> {url}
                    </a>
                  ))}
                </div>
              </Section>
            )}
          </Card>

          {/* Rúbrica */}
          {!isResolved && (
            <Card className="border-primary/30 bg-primary/5 p-6 space-y-5">
              <h2 className="font-serif text-xl font-bold">{t("rubric_title")}</h2>

              <RubricSlider
                label={t("rubric_quality")}
                value={quality}
                onChange={setQuality}
                hints={["Descartable", "Débil", "Sólido", "Excelente"]}
              />
              <RubricSlider
                label={t("rubric_commitment")}
                value={commitment}
                onChange={setCommitment}
                hints={["Sin plan", "Plan vago", "Plan claro", "Calendario consistente"]}
              />
              <RubricSlider
                label={t("rubric_professionalism")}
                value={professionalism}
                onChange={setProfessionalism}
                hints={["Bio vacía", "Cumple", "Cuidado", "Identidad fuerte"]}
              />
              <RubricSlider
                label={t("rubric_fit")}
                value={fit}
                onChange={setFit}
                hints={["No encaja", "Apenas", "Aporta", "Llena un hueco"]}
              />

              <div className="flex items-center justify-between pt-3 border-t border-primary/20">
                <div>
                  <p className="text-sm text-muted-foreground">{t("score_total", { score: total })}</p>
                  <p className="text-[10px] text-muted-foreground/70">{t("min_to_approve", { min: 8 })}</p>
                </div>
                <div className={cn(
                  "text-3xl font-bold",
                  canApprove ? "text-emerald-400" : "text-amber-400"
                )}>
                  {total}/12
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Notas para el solicitante
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder={canApprove ? "Opcional al aprobar" : "Obligatorio al rechazar o pedir cambios (min 20 chars)"}
                  className="mt-1.5 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </div>

              {/* Acciones */}
              <div className="grid sm:grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={() => changesMutation.mutate()}
                  disabled={notes.length < 20 || changesMutation.isPending}
                  className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                >
                  {changesMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareWarning className="mr-2 h-4 w-4" />}
                  {t("action_request_changes")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => rejectMutation.mutate()}
                  disabled={notes.length < 20 || rejectMutation.isPending}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {rejectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                  {t("action_reject")}
                </Button>
                <Button
                  onClick={() => approveMutation.mutate()}
                  disabled={!canApprove || approveMutation.isPending}
                  className="bg-emerald-500 text-white hover:bg-emerald-600"
                >
                  {approveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  {t("action_approve")}
                </Button>
              </div>
            </Card>
          )}

          {/* Si ya está resuelta, mostrar resultado */}
          {isResolved && (
            <Card className="border-border/60 bg-card p-6">
              <p className="text-sm text-muted-foreground">
                Esta solicitud ya fue {app.status === "approved" ? "aprobada" : "rechazada"} el{" "}
                {new Date(app.reviewed_at!).toLocaleDateString("es")} por{" "}
                {app.reviewer?.name ?? "el equipo"}.
              </p>
              {app.reviewer_notes && (
                <p className="mt-3 text-sm whitespace-pre-line">{app.reviewer_notes}</p>
              )}
            </Card>
          )}
        </div>

        {/* ===== Sidebar: contexto del solicitante ===== */}
        <aside className="space-y-4">
          <Card className="border-border/60 bg-card p-5">
            <h3 className="font-serif text-base font-bold mb-4">{t("applicant_context")}</h3>

            <div className="flex items-center gap-3 mb-4">
              <Avatar className="h-12 w-12 border border-border/60">
                <AvatarImage src={app.user?.avatar ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-primary">
                  {app.user?.name?.[0]?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="font-semibold truncate">{app.user?.name}</div>
                <div className="text-xs text-muted-foreground truncate">@{app.user?.username}</div>
              </div>
            </div>

            <dl className="space-y-2.5 text-xs">
              <SidebarItem icon={<Mail />} label="Email" value={app.user?.email} />
              <SidebarItem icon={<Calendar />} label="Cuenta creada" value={`Hace ${accountAgeDays} días`} />
              <SidebarItem icon={<Star />} label="Reseñas escritas" value={`${app.user?.reviews_count ?? 0}`} />
              <SidebarItem icon={<Library />} label="Antologías" value={`${app.user?.anthologies_count ?? 0}`} />
              <SidebarItem icon={<Users />} label="Seguidores" value={`${app.user?.followers_count ?? 0}`} />
            </dl>

            {app.user?.username && (
              <Button asChild variant="outline" size="sm" className="w-full mt-4 border-border/60">
                <Link href={`/${app.user.username}`} target="_blank">
                  <User className="mr-1.5 h-3.5 w-3.5" />
                  Ver perfil público
                </Link>
              </Button>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{title}</h3>
      {children}
    </div>
  );
}

function RubricSlider({
  label, value, onChange, hints,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hints: string[];
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold">{label}</label>
        <span className="text-xs text-muted-foreground">{value}/3</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "rounded-md border px-2 py-2 text-[10px] font-medium transition-colors text-center",
              value === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 hover:border-primary/60"
            )}
          >
            <div className="text-base mb-0.5">{n}</div>
            <div className="opacity-80 leading-tight">{hints[n]}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-medium truncate">{value}</div>
      </div>
    </div>
  );
}
