"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, CircleDollarSign, Coins, RefreshCw, Save, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monetizationApi, type CoinPackage } from "@/lib/api-monetization";

type SettingMap = Record<string, unknown>;

interface FinanceOverview {
  totals?: {
    gross_usd?: number | string;
    platform_usd?: number | string;
    creators_usd?: number | string;
  };
  creators?: {
    payouts_paid_usd?: number | string;
    payouts_pending?: number | string;
  };
  by_category?: Array<{
    category: string;
    gross?: number | string;
    events?: number | string;
  }>;
}

interface PayoutRow {
  id: number;
  creator_id?: number;
  creator?: { name?: string | null } | null;
  amount_usd?: number | string;
  status?: string;
  created_at?: string;
}

const SETTING_GROUPS: Array<{ title: string; keys: Array<{ key: string; label: string }> }> = [
  {
    title: "Reparto de ingresos",
    keys: [
      { key: "revenue_split", label: "Split (JSON: default + por nivel)" },
      { key: "coins.premium_usd_per_coin", label: "USD por CharCoin Premium" },
      { key: "creator.coin_to_usd", label: "USD por Creator Coin" },
    ],
  },
  {
    title: "Suscripciones",
    keys: [
      { key: "subs.premium_price_usd", label: "Precio Premium (USD/mes)" },
      { key: "subs.premium_plus_price_usd", label: "Precio Premium Plus (USD/mes)" },
      { key: "subs.premium_price_id", label: "Stripe Price ID Premium" },
      { key: "subs.premium_plus_price_id", label: "Stripe Price ID Premium Plus" },
      { key: "subs.premium_unlock_discount_pct", label: "Descuento Premium en desbloqueos (%)" },
    ],
  },
  {
    title: "Limites de CharCoins Reward",
    keys: [
      { key: "rewards.daily_cap", label: "Maximo diario" },
      { key: "rewards.weekly_cap", label: "Maximo semanal" },
      { key: "rewards.ad_daily_cap", label: "Max. anuncios/dia" },
      { key: "rewards.per_ad", label: "Monedas por anuncio" },
      { key: "rewards.max_pct_per_unlock", label: "% max. por desbloqueo" },
      { key: "rewards.login_daily", label: "Login diario" },
      { key: "rewards.book_complete", label: "Completar libro" },
    ],
  },
  {
    title: "Lectura valida",
    keys: [
      { key: "reading.min_seconds_per_chapter", label: "Segundos minimos/capitulo" },
      { key: "reading.daily_valid_chapters", label: "Capitulos validos max./dia" },
    ],
  },
  {
    title: "Retiros",
    keys: [
      { key: "payouts.min_usd", label: "Retiro minimo (USD)" },
      { key: "payouts.fee_pct", label: "Comision de retiro (%)" },
      { key: "payouts.max_per_week", label: "Retiros max./semana" },
      { key: "payouts.hold_days", label: "Retencion (dias)" },
    ],
  },
  {
    title: "Creator Fund y anuncios",
    keys: [
      { key: "fund.premium_plus_pct", label: "% de Premium Plus al fondo" },
      { key: "ads.enabled", label: "Anuncios activos (true/false)" },
      { key: "ads.dev_autoconfirm", label: "Autoconfirmar anuncios (SOLO dev)" },
    ],
  },
];

function toDraftValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function parseValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (!Number.isNaN(Number(trimmed))) return Number(trimmed);
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function formatUsd(value: number | string | undefined): string {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

export default function AdminMonetizationPage() {
  const [settings, setSettings] = useState<SettingMap>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "neutral"; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [settingsResult, overviewResult, payoutsResult, packagesResult] = await Promise.allSettled([
      monetizationApi.admin.settings(),
      monetizationApi.admin.financeOverview(),
      monetizationApi.admin.payouts(),
      monetizationApi.admin.packages(),
    ]);

    if (settingsResult.status === "fulfilled") {
      const nextSettings = settingsResult.value as SettingMap;
      setSettings(nextSettings);
      setDrafts(
        Object.fromEntries(Object.entries(nextSettings).map(([key, value]) => [key, toDraftValue(value)])),
      );
    }

    if (overviewResult.status === "fulfilled") {
      setOverview(overviewResult.value as FinanceOverview);
    }

    if (payoutsResult.status === "fulfilled") {
      const response = payoutsResult.value as { data?: PayoutRow[] };
      setPayouts(response.data ?? []);
    }

    if (packagesResult.status === "fulfilled") {
      setPackages(packagesResult.value ?? []);
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const saveSettings = async () => {
    setBusy("settings");
    setMessage(null);
    try {
      const changed: SettingMap = {};
      for (const [key, raw] of Object.entries(drafts)) {
        const parsed = parseValue(raw);
        if (JSON.stringify(parsed) !== JSON.stringify(settings[key])) changed[key] = parsed;
      }

      if (Object.keys(changed).length === 0) {
        setMessage({ tone: "neutral", text: "No hay cambios por guardar." });
      } else {
        await monetizationApi.admin.updateSettings(changed);
        setMessage({ tone: "success", text: `Guardados ${Object.keys(changed).length} parametro(s). Aplican al instante.` });
        await load();
      }
    } catch {
      setMessage({ tone: "error", text: "No se pudieron guardar los parametros." });
    } finally {
      setBusy(null);
    }
  };

  const payoutAction = async (id: number, action: "retry" | "reject") => {
    setBusy(`payout-${id}`);
    try {
      await monetizationApi.admin.payoutAction(id, action);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const runFund = async () => {
    setBusy("fund");
    setMessage(null);
    try {
      const response = (await monetizationApi.admin.runCreatorFund()) as { output?: string };
      setMessage({ tone: "success", text: response.output || "Creator Fund ejecutado." });
    } catch {
      setMessage({ tone: "error", text: "No se pudo ejecutar el Creator Fund." });
    } finally {
      setBusy(null);
    }
  };

  const togglePackage = async (pkg: CoinPackage) => {
    setBusy(`package-${pkg.id}`);
    try {
      await monetizationApi.admin.updatePackage(pkg.id, { is_active: !pkg.is_active });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8 px-4 py-8 sm:px-6 lg:px-0">
      <header className="max-w-3xl">
        <h1 className="flex items-center gap-2 font-serif text-3xl font-bold tracking-tight">
          <CircleDollarSign className="h-7 w-7 text-primary" /> Monetizacion
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Economia de la plataforma: ingresos, reparto, limites, retiros y Creator Fund.
        </p>
      </header>

      {overview ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Ingresos brutos (mes)" value={formatUsd(overview.totals?.gross_usd)} />
          <Metric label="Para plataforma" value={formatUsd(overview.totals?.platform_usd)} />
          <Metric label="Para creadores" value={formatUsd(overview.totals?.creators_usd)} />
          <Metric
            label="Retiros pagados"
            value={formatUsd(overview.creators?.payouts_paid_usd)}
            sub={`${overview.creators?.payouts_pending ?? 0} pendientes`}
          />
          {overview.by_category?.map((category) => (
            <Metric
              key={category.category}
              label={category.category}
              value={formatUsd(category.gross)}
              sub={`${category.events ?? 0} eventos`}
            />
          ))}
        </section>
      ) : (
        loaded && (
          <section className="rounded-lg border border-border/60 bg-card p-5 text-sm text-muted-foreground">
            No se pudieron cargar las metricas financieras.
          </section>
        )
      )}

      <section className="rounded-lg border border-border/60 bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <Settings2 className="h-5 w-5 text-primary" /> Parametros economicos
          </h2>
          <Button onClick={saveSettings} disabled={busy !== null}>
            <Save className="mr-2 h-4 w-4" /> Guardar cambios
          </Button>
        </div>

        {message && (
          <p
            className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
              message.tone === "error"
                ? "border-destructive/40 text-destructive"
                : message.tone === "success"
                  ? "border-primary/40 text-primary"
                  : "border-border/60 text-muted-foreground"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          {SETTING_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</h3>
              <div className="mt-2 space-y-2">
                {group.keys.map(({ key, label }) => (
                  <label key={key} className="block">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 font-mono text-xs text-foreground"
                      value={drafts[key] ?? ""}
                      onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border/60 bg-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Coins className="h-5 w-5 text-primary" /> Paquetes de monedas
        </h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-border/40">
          {packages.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              No hay paquetes configurados para mostrar.
            </p>
          ) : (
            packages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex flex-col gap-3 border-b border-border/30 px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{pkg.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono text-foreground">{pkg.coins}+{pkg.bonus_coins}</span> monedas por{" "}
                    <span className="font-mono text-foreground">${pkg.price_usd}</span>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={pkg.is_active ? "outline" : "secondary"}
                  onClick={() => togglePackage(pkg)}
                  disabled={busy !== null}
                  className="w-full sm:w-auto"
                >
                  {pkg.is_active ? "Desactivar" : "Activar"}
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border/60 bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <Banknote className="h-5 w-5 text-primary" /> Retiros de creadores
          </h2>
          <Button variant="outline" onClick={runFund} disabled={busy !== null}>
            <RefreshCw className="mr-2 h-4 w-4" /> Ejecutar Creator Fund
          </Button>
        </div>

        {payouts.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border/60 px-4 py-5 text-sm text-muted-foreground">
            Sin retiros registrados.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-border/40">
            {payouts.map((payout) => (
              <div
                key={payout.id}
                className="flex flex-col gap-3 border-b border-border/30 px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">
                    {payout.creator?.name ?? `Creador #${payout.creator_id ?? payout.id}`}{" "}
                    <span className="font-mono">{formatUsd(payout.amount_usd)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {payout.status ?? "sin estado"} -{" "}
                    {payout.created_at ? new Date(payout.created_at).toLocaleString("es") : "sin fecha"}
                  </p>
                </div>
                {(payout.status === "failed" || payout.status === "requested") && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button size="sm" onClick={() => payoutAction(payout.id, "retry")} disabled={busy !== null}>
                      Reintentar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => payoutAction(payout.id, "reject")}
                      disabled={busy !== null}
                    >
                      Rechazar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
