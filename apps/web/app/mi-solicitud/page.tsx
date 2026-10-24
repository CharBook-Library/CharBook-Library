"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft, Clock, MessageSquareWarning, CheckCircle2, XCircle, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { creatorApi } from "@/lib/api-creator";
import { useAuth } from "@/hooks/use-auth";

export default function MiSolicitudPage() {
  const t = useTranslations("creator.my_application");
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: app, isLoading } = useQuery({
    queryKey: ["my-creator-application"],
    queryFn: creatorApi.mine,
    enabled: isAuthenticated,
  });

  if (authLoading || isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-muted-foreground mb-4">Inicia sesión para ver tu solicitud.</p>
        <Button asChild>
          <Link href="/login">Iniciar sesión</Link>
        </Button>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-muted-foreground mb-4">No tienes ninguna solicitud activa.</p>
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/convertirme-en-creador">Postular como Creador</Link>
        </Button>
      </div>
    );
  }

  const statusMeta = {
    pending: {
      icon: <Clock className="h-6 w-6" />,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10 border-blue-400/30",
      title: t("status_pending"),
      desc: t("status_pending_desc"),
    },
    changes_requested: {
      icon: <MessageSquareWarning className="h-6 w-6" />,
      color: "text-amber-400",
      bgColor: "bg-amber-400/10 border-amber-400/30",
      title: t("status_changes_requested"),
      desc: t("status_changes_requested_desc"),
    },
    approved: {
      icon: <CheckCircle2 className="h-6 w-6" />,
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10 border-emerald-400/30",
      title: t("status_approved"),
      desc: t("status_approved_desc"),
    },
    rejected: {
      icon: <XCircle className="h-6 w-6" />,
      color: "text-destructive",
      bgColor: "bg-destructive/10 border-destructive/30",
      title: t("status_rejected"),
      desc: t("status_rejected_desc", { days: 30 }),
    },
  }[app.status];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
      <Link
        href="/convertirme-en-creador"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      <h1 className="font-serif text-3xl font-bold tracking-tight mb-2">{t("title")}</h1>
      <p className="text-sm text-muted-foreground mb-8">
        {t("folio")}: <span className="font-medium text-foreground">{app.folio}</span>
        {" · "}
        {t("submitted_on", {
          date: new Date(app.submitted_at).toLocaleDateString("es", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        })}
      </p>

      {/* Estado destacado */}
      <Card className={`${statusMeta.bgColor} border p-6 mb-6`}>
        <div className="flex items-start gap-4">
          <div className={statusMeta.color}>{statusMeta.icon}</div>
          <div className="flex-1">
            <h2 className="font-serif text-xl font-bold mb-1">{statusMeta.title}</h2>
            <p className="text-sm text-muted-foreground">{statusMeta.desc}</p>
          </div>
        </div>
      </Card>

      {/* Notas del revisor (si las hay) */}
      {app.reviewer_notes && (
        <Card className="border-border/60 bg-card p-5 mb-6">
          <h3 className="font-serif text-base font-bold mb-2">{t("reviewer_notes")}</h3>
          <p className="text-sm whitespace-pre-line text-muted-foreground">
            {app.reviewer_notes}
          </p>
        </Card>
      )}

      {/* Score (solo si ya fue revisada) */}
      {app.score.total !== null && (
        <Card className="border-border/60 bg-card p-5 mb-6">
          <h3 className="font-serif text-base font-bold mb-3">Evaluación</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <ScoreLine label="Calidad" value={app.score.quality} />
            <ScoreLine label="Compromiso" value={app.score.commitment} />
            <ScoreLine label="Profesionalismo" value={app.score.professionalism} />
            <ScoreLine label="Encaje editorial" value={app.score.fit} />
          </div>
          <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-xl font-bold">
              {app.score.total}/{app.score.max}
            </span>
          </div>
        </Card>
      )}

      {/* Resumen de la solicitud */}
      <Card className="border-border/60 bg-card p-5 mb-6">
        <h3 className="font-serif text-base font-bold mb-4">Tu solicitud</h3>
        <dl className="space-y-3 text-sm">
          <Item label="Nombre público" value={app.display_name} />
          {app.pen_name && <Item label="Seudónimo" value={app.pen_name} />}
          <Item label="Géneros">
            <div className="flex flex-wrap gap-1.5 mt-1">
              {app.genres.map((g) => (
                <Badge key={g} variant="outline" className="capitalize border-border/60">
                  {g.replace("_", " ")}
                </Badge>
              ))}
            </div>
          </Item>
          <Item label="Idiomas">
            <div className="flex flex-wrap gap-1.5 mt-1">
              {app.languages.map((l) => (
                <Badge key={l} variant="outline" className="border-border/60 uppercase">
                  {l}
                </Badge>
              ))}
            </div>
          </Item>
          <Item label="Muestra">
            <a
              href={app.sample_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Ver muestra <ExternalLink className="h-3 w-3" />
            </a>
          </Item>
        </dl>
      </Card>

      {/* CTAs según estado */}
      <div className="flex flex-wrap gap-3">
        {app.status === "changes_requested" && (
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/solicitud-creador/nueva">{t("edit_resubmit")}</Link>
          </Button>
        )}
        {app.status === "approved" && (
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/studio">{t("go_to_studio")}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function ScoreLine({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{value ?? "—"}/3</span>
    </div>
  );
}

function Item({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd>{value ?? children}</dd>
    </div>
  );
}
