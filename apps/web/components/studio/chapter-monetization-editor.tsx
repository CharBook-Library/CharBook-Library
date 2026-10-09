"use client";

import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Coins, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chaptersApi } from "@/lib/api-creator";
import { monetizationApi } from "@/lib/api-monetization";
import { cn } from "@/lib/utils";
import type { Chapter, WorkMonetization } from "@/lib/types";

const DEFAULT_PACKS = [3, 5, 10] as const;
// Packs fijos de plataforma: tamaños estables = decisión de compra más simple.
const PACK_LABELS: Record<number, string> = { 3: "Pack pequeño", 5: "Pack mediano", 10: "Pack grande" };
// Tope duro de la economía (espejo de pricing.chapter_max_price del backend).
const MAX_CHAPTER_PRICE = 50;
const RECOMMENDED_PRICE = { min: 5, max: 15 };

interface ChapterMonetizationEditorProps {
  workId: number;
  initialMonetization?: WorkMonetization | null;
  initialInUnlimitedCatalog?: boolean;
  onSaved?: () => void;
}

interface ChapterPriceRow {
  id: number;
  number: number;
  title: string;
  coin_price: number;
  early_access_until: string;
}

type ApiError = { response?: { data?: { message?: string } } };

export function ChapterMonetizationEditor({
  workId,
  initialMonetization,
  initialInUnlimitedCatalog = false,
  onSaved,
}: ChapterMonetizationEditorProps) {
  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ["chapters", workId],
    queryFn: () => chaptersApi.list(workId),
  });

  const formKey = useMemo(
    () =>
      JSON.stringify({
        chapters: chapters.map((chapter) => [
          chapter.id,
          chapter.coin_price,
          chapter.early_access_until,
        ]),
        monetization: initialMonetization ?? null,
        inUnlimitedCatalog: initialInUnlimitedCatalog,
      }),
    [chapters, initialInUnlimitedCatalog, initialMonetization],
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/60 bg-card p-5">
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-14 animate-pulse rounded-md bg-muted/70" />
          ))}
        </div>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-card/60 p-6 text-center">
        <Coins className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <h3 className="mt-3 text-sm font-medium">Aun no hay capitulos para monetizar</h3>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
          Crea capitulos en la pestana Contenido. Despues podras definir precios,
          packs y acceso anticipado desde aqui.
        </p>
      </div>
    );
  }

  return (
    <ChapterMonetizationForm
      key={formKey}
      workId={workId}
      chapters={chapters}
      initialMonetization={initialMonetization}
      initialInUnlimitedCatalog={initialInUnlimitedCatalog}
      onSaved={onSaved}
    />
  );
}

function ChapterMonetizationForm({
  workId,
  chapters,
  initialMonetization,
  initialInUnlimitedCatalog,
  onSaved,
}: {
  workId: number;
  chapters: Chapter[];
  initialMonetization?: WorkMonetization | null;
  initialInUnlimitedCatalog: boolean;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const initialPacks = normalizePackOptions(initialMonetization?.packs);
  const initialDiscounts = initialMonetization?.pack_discount_pct ?? {};

  const [freeChapters, setFreeChapters] = useState(
    Number(initialMonetization?.free_chapters ?? 0),
  );
  // Solo lectura: la participación en Premium Plus la decide la plataforma.
  const inUnlimitedCatalog = Boolean(initialInUnlimitedCatalog);
  const [enabledPacks, setEnabledPacks] = useState<Record<number, boolean>>(() => {
    // Activos = los que la obra ya tenía guardados (solo del set fijo 3/5/10).
    const saved = (initialMonetization?.packs ?? [...DEFAULT_PACKS]).map(Number);
    return Object.fromEntries(
      initialPacks.map((pack) => [pack, saved.includes(pack)]),
    ) as Record<number, boolean>;
  });
  const [packDiscounts, setPackDiscounts] = useState<Record<number, number>>(
    () =>
      Object.fromEntries(
        initialPacks.map((pack) => [pack, Number(initialDiscounts[String(pack)] ?? 0)]),
      ) as Record<number, number>,
  );
  const [rows, setRows] = useState<ChapterPriceRow[]>(() => chapters.map(chapterToRow));

  const packOptions = useMemo(
    () => normalizePackOptions([...DEFAULT_PACKS, ...Object.keys(enabledPacks).map(Number)]),
    [enabledPacks],
  );

  const stats = useMemo(() => {
    const freeByRule = rows.filter((row) => row.number <= freeChapters).length;
    const paidRows = rows.filter((row) => row.number > freeChapters && row.coin_price > 0);
    const earlyRows = rows.filter((row) => row.early_access_until).length;

    return {
      freeByRule,
      paidCount: paidRows.length,
      paidCoinTotal: paidRows.reduce((sum, row) => sum + row.coin_price, 0),
      earlyCount: earlyRows,
    };
  }, [freeChapters, rows]);

  const save = useMutation({
    mutationFn: () => {
      const packs = packOptions.filter((pack) => enabledPacks[pack]);
      const pack_discount_pct = Object.fromEntries(
        packs.map((pack) => [String(pack), clampInt(packDiscounts[pack] ?? 0, 0, 90)]),
      );

      return monetizationApi.creator.updateWorkMonetization(workId, {
        free_chapters: clampInt(freeChapters, 0, 1000),
        packs,
        pack_discount_pct,
        chapters: rows.map((row) => ({
          id: row.id,
          coin_price: clampInt(row.coin_price, 0, MAX_CHAPTER_PRICE),
          early_access_until: toIsoOrNull(row.early_access_until),
        })),
      });
    },
    onSuccess: () => {
      toast.success("Monetizacion guardada");
      queryClient.invalidateQueries({ queryKey: ["work", workId] });
      queryClient.invalidateQueries({ queryKey: ["chapters", workId] });
      onSaved?.();
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.message ?? "No se pudo guardar la monetizacion");
    },
  });

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border/60 bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              <h2 className="font-serif text-xl font-bold leading-tight">
                Monetizacion por capitulo
              </h2>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Define que se lee gratis, cuanto cuesta cada capitulo y que packs
              puede comprar el lector desde el paywall.
            </p>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Guardar monetizacion
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Gratis por regla" value={stats.freeByRule} />
          <Metric label="Capitulos de pago" value={stats.paidCount} />
          <Metric label="Coins publicados" value={stats.paidCoinTotal} />
          <Metric label="Acceso anticipado" value={stats.earlyCount} />
        </div>
      </div>

      <section className="rounded-lg border border-border/60 bg-card p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div>
            <h3 className="text-sm font-medium">Reglas del libro</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Estas reglas se aplican antes del precio individual de cada capitulo.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium">Primeros capitulos gratis</span>
              <Input
                type="number"
                min={0}
                max={chapters.length}
                value={freeChapters}
                onChange={(event) =>
                  setFreeChapters(clampInt(event.target.value, 0, chapters.length))
                }
                className="mt-1"
              />
            </label>

            {/* La participación en Premium Plus la cura CharBook, no el creador. */}
            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-background p-3">
              <span
                className={cn(
                  "mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                  inUnlimitedCatalog ? "bg-primary" : "bg-muted-foreground/40",
                )}
                aria-hidden
              />
              <span>
                <span className="block text-sm font-medium">
                  {inUnlimitedCatalog
                    ? "Esta obra participa en Premium Plus"
                    : "Esta obra no participa en Premium Plus"}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  La seleccion del catalogo Unlimited la hace el equipo de CharBook.
                  Las obras participantes ganan ademas por lectura real via Creator Fund.
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border/60 bg-card p-5">
        <h3 className="text-sm font-medium">Packs de desbloqueo</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          El paywall ofrece paquetes de proximos capitulos bloqueados con descuento.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {packOptions.map((pack) => (
            <label
              key={pack}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                enabledPacks[pack]
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/60 bg-background",
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium">{PACK_LABELS[pack] ?? `Pack de ${pack}`}</span>
                  <span className="block text-xs text-muted-foreground">{pack} capitulos</span>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(enabledPacks[pack])}
                  onChange={(event) =>
                    setEnabledPacks((current) => ({
                      ...current,
                      [pack]: event.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />
              </span>
              <span className="mt-3 block text-xs font-medium">Descuento</span>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={90}
                  value={packDiscounts[pack] ?? 0}
                  onChange={(event) =>
                    setPackDiscounts((current) => ({
                      ...current,
                      [pack]: clampInt(event.target.value, 0, 90),
                    }))
                  }
                  disabled={!enabledPacks[pack]}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border/60 bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-medium">Precios por capitulo</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Precio 0 significa gratis. El acceso anticipado no acepta reward coins.
              Maximo {MAX_CHAPTER_PRICE} coins por capitulo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setAllPrices(0, setRows)}>
              Todo gratis
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAllPrices(10, setRows)}>
              Todo a 10 coins
            </Button>
          </div>
        </div>

        {/* Guía rápida para creadores nuevos (sin complicar la interfaz) */}
        <div className="mt-3 grid gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2">
          <p>
            <Sparkles className="mr-1 inline h-3.5 w-3.5 text-primary" />
            <strong className="text-foreground">Precio recomendado:</strong>{" "}
            {RECOMMENDED_PRICE.min}–{RECOMMENDED_PRICE.max} coins por capitulo.
          </p>
          <p>
            <strong className="text-foreground">Capitulos gratis:</strong>{" "}
            3–5 para novelas largas; 1–2 para historias cortas.
          </p>
          <p>
            <strong className="text-foreground">Novela larga (30+ caps):</strong>{" "}
            precios bajos + packs activados convierten mejor.
          </p>
          <p>
            <strong className="text-foreground">Acceso anticipado:</strong>{" "}
            7 dias funciona bien para series con publicacion semanal.
          </p>
        </div>

        <div className="mt-4 space-y-2">
          {rows.map((row, index) => {
            const freeByRule = row.number <= freeChapters;

            return (
              <div
                key={row.id}
                className="grid gap-3 rounded-lg border border-border/60 bg-background p-3 lg:grid-cols-[minmax(0,1fr)_120px_220px]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                      #{row.number}
                    </span>
                    <span className="line-clamp-1 text-sm font-medium">{row.title}</span>
                    {freeByRule && (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">
                        Gratis por regla
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {index === 0
                      ? "Buen lugar para enganchar sin friccion."
                      : "Define precio y ventana si aplica."}
                  </p>
                </div>

                <label>
                  <span className="text-xs font-medium">Precio</span>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={MAX_CHAPTER_PRICE}
                      value={row.coin_price}
                      onChange={(event) => updateRow(row.id, "coin_price", event.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">coins</span>
                  </div>
                </label>

                <label>
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                    Anticipado hasta
                  </span>
                  <Input
                    type="datetime-local"
                    value={row.early_access_until}
                    onChange={(event) =>
                      updateRow(row.id, "early_access_until", event.target.value)
                    }
                    className="mt-1"
                  />
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Guardar monetizacion
        </Button>
      </div>
    </div>
  );

  function updateRow(id: number, field: "coin_price" | "early_access_until", value: string) {
    // (clamp real más abajo; tope de economía = MAX_CHAPTER_PRICE)
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: field === "coin_price" ? clampInt(value, 0, MAX_CHAPTER_PRICE) : value,
            }
          : row,
      ),
    );
  }
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold tabular-nums">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function chapterToRow(chapter: Chapter): ChapterPriceRow {
  return {
    id: chapter.id,
    number: chapter.number,
    title: chapter.title,
    coin_price: Number(chapter.coin_price ?? 0),
    early_access_until: toDateTimeLocal(chapter.early_access_until),
  };
}

function normalizePackOptions(packs?: readonly number[] | number[] | null) {
  // Tamaños FIJOS de plataforma (3/5/10): los packs guardados solo determinan
  // cuáles están activos; cualquier tamaño legado fuera del set se descarta.
  void packs;
  return [...DEFAULT_PACKS];
}

function setAllPrices(
  price: number,
  setRows: Dispatch<SetStateAction<ChapterPriceRow[]>>,
) {
  setRows((current) => current.map((row) => ({ ...row, coin_price: price })));
}

function clampInt(value: string | number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
