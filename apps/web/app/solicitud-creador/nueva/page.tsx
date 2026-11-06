"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { creatorApi, type CreatorAppInput } from "@/lib/api-creator";
import { cn } from "@/lib/utils";

const GENRES = [
  "fantasia", "ciencia_ficcion", "romance", "terror", "misterio",
  "historia", "biografia", "poesia", "ensayo", "infantil",
  "drama", "aventura", "humor", "thriller", "literatura",
];

const LANG_OPTIONS = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
];

const TOTAL_STEPS = 4;

export default function NuevaSolicitudCreadorPage() {
  const router = useRouter();
  const t = useTranslations("creator.wizard");
  const tCommon = useTranslations("common");

  const [step, setStep] = useState(1);

  // Estado del form
  const [displayName, setDisplayName] = useState("");
  const [penName, setPenName] = useState("");
  const [bioLong, setBioLong] = useState("");
  const [sampleUrl, setSampleUrl] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [publishFrequency, setPublishFrequency] = useState<string>("");
  const [publishPlan, setPublishPlan] = useState("");
  const [whyJoin, setWhyJoin] = useState("");
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (input: CreatorAppInput) => creatorApi.submit(input),
    onSuccess: () => {
      toast.success(t("submitted_success"));
      router.push("/mi-solicitud");
      router.refresh();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message ?? "Error al enviar la solicitud");
    },
  });

  const handleSubmit = () => {
    mutation.mutate({
      display_name: displayName,
      pen_name: penName.trim() || null,
      bio_long: bioLong,
      sample_url: sampleUrl,
      genres,
      languages,
      why_join: whyJoin,
      social_links: Object.keys(socialLinks).length ? socialLinks : null,
      publish_frequency: (publishFrequency || null) as CreatorAppInput["publish_frequency"],
      publish_plan: publishPlan.trim() || null,
    });
  };

  // Validación por paso
  const canAdvance = () => {
    if (step === 1) return displayName.trim().length > 0;
    if (step === 2) return bioLong.length >= 500 && sampleUrl.trim().length > 0;
    if (step === 3) return genres.length > 0 && languages.length > 0;
    if (step === 4) return whyJoin.length >= 250;
    return false;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
      <Link
        href="/convertirme-en-creador"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {tCommon("back")}
      </Link>

      {/* Stepper */}
      <div className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
          {t("step_of", { current: step, total: TOTAL_STEPS })}
        </p>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
            const n = i + 1;
            const active = n === step;
            const done = n < step;
            return (
              <div key={n} className="flex-1">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-colors",
                    done ? "bg-primary" : active ? "bg-primary/70" : "bg-muted"
                  )}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Card del paso */}
      <Card className="border-border/60 bg-card p-6 md:p-10 space-y-6">
        {step === 1 && (
          <>
            <h1 className="font-serif text-2xl font-bold tracking-tight md:text-3xl">
              {t("step1_title")}
            </h1>
            <Field label={t("display_name") + " *"} help={t("display_name_help")}>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
                required
              />
            </Field>
            <Field label={t("pen_name")} help={t("pen_name_help")}>
              <Input
                value={penName}
                onChange={(e) => setPenName(e.target.value)}
                maxLength={100}
              />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="font-serif text-2xl font-bold tracking-tight md:text-3xl">
              {t("step2_title")}
            </h1>
            <Field
              label={t("bio_long") + " *"}
              help={`${t("bio_long_help")} (${bioLong.length}/2000)`}
            >
              <textarea
                value={bioLong}
                onChange={(e) => setBioLong(e.target.value)}
                rows={8}
                maxLength={2000}
                required
                className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
            </Field>
            <Field label={t("sample_url") + " *"} help={t("sample_url_help")}>
              <Input
                type="url"
                value={sampleUrl}
                onChange={(e) => setSampleUrl(e.target.value)}
                placeholder="https://"
                maxLength={500}
                required
              />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="font-serif text-2xl font-bold tracking-tight md:text-3xl">
              {t("step3_title")}
            </h1>
            <Field label={t("genres") + " *"} help={t("genres_help")}>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => {
                  const selected = genres.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        if (selected) setGenres(genres.filter((x) => x !== g));
                        else if (genres.length < 5) setGenres([...genres, g]);
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 hover:border-primary/60"
                      )}
                    >
                      {g.replace("_", " ")}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label={t("languages") + " *"}>
              <div className="flex flex-wrap gap-2">
                {LANG_OPTIONS.map((l) => {
                  const selected = languages.includes(l.code);
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => {
                        if (selected) setLanguages(languages.filter((x) => x !== l.code));
                        else if (languages.length < 5) setLanguages([...languages, l.code]);
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 hover:border-primary/60"
                      )}
                    >
                      {l.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label={t("publish_frequency")}>
              <div className="flex flex-wrap gap-2">
                {["weekly", "biweekly", "monthly", "irregular"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setPublishFrequency(f)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      publishFrequency === f
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 hover:border-primary/60"
                    )}
                  >
                    {t(`publish_frequency_${f}`)}
                  </button>
                ))}
              </div>
            </Field>

            <Field label={t("publish_plan")} help={t("publish_plan_help")}>
              <textarea
                value={publishPlan}
                onChange={(e) => setPublishPlan(e.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
            </Field>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="font-serif text-2xl font-bold tracking-tight md:text-3xl">
              {t("step4_title")}
            </h1>
            <Field
              label={t("why_join") + " *"}
              help={`${t("why_join_help")} (${whyJoin.length}/1000)`}
            >
              <textarea
                value={whyJoin}
                onChange={(e) => setWhyJoin(e.target.value)}
                rows={8}
                maxLength={1000}
                required
                className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
            </Field>
            <Field label={t("social_links")}>
              <div className="space-y-2">
                {["twitter", "instagram", "web", "youtube"].map((key) => (
                  <Input
                    key={key}
                    type="url"
                    placeholder={`https://${key === "web" ? "tu-sitio.com" : `${key}.com/tu-usuario`}`}
                    value={socialLinks[key] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (v) setSocialLinks({ ...socialLinks, [key]: v });
                      else {
                        const next = { ...socialLinks };
                        delete next[key];
                        setSocialLinks(next);
                      }
                    }}
                  />
                ))}
              </div>
            </Field>
          </>
        )}
      </Card>

      {/* Botones */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 1 || mutation.isPending}
          className="border-border/60"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> {tCommon("previous")}
        </Button>

        {step < TOTAL_STEPS ? (
          <Button
            type="button"
            onClick={() => setStep(step + 1)}
            disabled={!canAdvance()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {tCommon("next")} <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canAdvance() || mutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mutation.isPending ? t("submitting") : t("submit")}
            <Check className="ml-1.5 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({
  label, help, children,
}: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
      {help && <p className="text-xs text-muted-foreground/80">{help}</p>}
    </div>
  );
}
