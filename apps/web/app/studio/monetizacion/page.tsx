"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Banknote,
  CircleDollarSign,
  Clock,
  ExternalLink,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { monetizationApi } from "@/lib/api-monetization";

type ApiError = { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };

type CreatorWalletInfo = {
  pending_coins: number;
  available_coins: number;
  pending_usd: number;
  available_usd: number;
  revenue_share_pct: number;
  creator_level?: "none" | "basic" | "verified" | "featured";
  creator_level_label?: string;
  earnings_examples?: Array<{ reader_spends: number; you_earn: number }>;
  payout_rules: {
    min_usd: number;
    fee_pct: number;
    max_per_week: number;
    hold_days: number;
  };
};

type ConnectStatus = {
  connected: boolean;
  payouts_enabled: boolean;
};

type EarningsSummary = {
  totals?: {
    usd?: number;
    coins?: number;
  };
};

type PayoutRow = {
  id: number;
  amount_usd: string | number;
  status: string;
  created_at: string;
};

export default function CreatorMonetizationPage() {
  const [wallet, setWallet] = useState<CreatorWalletInfo | null>(null);
  const [connect, setConnect] = useState<ConnectStatus | null>(null);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    setLoaded(false);
    Promise.allSettled([
      monetizationApi.creator.wallet().then(setWallet),
      monetizationApi.creator.connectStatus().then(setConnect),
      monetizationApi.creator.earnings(30).then(setEarnings),
      monetizationApi.creator.payouts().then((response) => setPayouts(response.data ?? [])),
    ]).finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const startConnect = async () => {
    setBusy("connect");
    setMsg(null);
    try {
      const { url } = await monetizationApi.creator.connect();
      window.location.href = url;
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setMsg(apiError?.response?.data?.message ?? "No se pudo iniciar Stripe Connect.");
      setBusy(null);
    }
  };

  const requestPayout = async () => {
    setBusy("payout");
    setMsg(null);
    try {
      await monetizationApi.creator.requestPayout();
      setMsg("Retiro solicitado. Stripe lo enviara a tu banco automaticamente.");
      load();
    } catch (error: unknown) {
      const apiError = error as ApiError;
      const errors = apiError?.response?.data?.errors;
      setMsg(errors ? String(Object.values(errors).flat()[0]) : "No se pudo solicitar el retiro.");
    } finally {
      setBusy(null);
    }
  };

  const statusLabel: Record<string, string> = {
    requested: "Solicitado",
    processing: "Procesando",
    paid: "Pagado",
    failed: "Fallo",
    rejected: "Rechazado",
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl font-bold tracking-tight">
          <CircleDollarSign className="h-7 w-7 text-primary" /> Monetizacion
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Ganas Creator Coins cuando los lectores desbloquean tus capitulos con CharCoins Premium.
          Se convierten a USD y se retiran por Stripe Connect.
        </p>
        {wallet?.creator_level_label && (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> {wallet.creator_level_label}
          </span>
        )}
      </header>

      {/* Cuánto ganas de verdad — en coins, sin porcentajes técnicos */}
      {wallet?.earnings_examples && wallet.earnings_examples.length > 0 && (
        <section className="rounded-lg border border-border/60 bg-card p-5">
          <h2 className="font-semibold">Cuanto ganas por cada desbloqueo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Asi se traduce el gasto de un lector en tus Creator Coins, segun tu nivel actual:
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {wallet.earnings_examples.map((example) => (
              <div key={example.reader_spends} className="rounded-lg border border-border/50 bg-background px-4 py-3 text-center">
                <p className="text-xs text-muted-foreground">Capitulo de {example.reader_spends} CharCoins</p>
                <p className="mt-1 font-serif text-2xl font-bold text-primary">+{example.you_earn}</p>
                <p className="text-xs text-muted-foreground">Creator Coins para ti</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sube de nivel (Basico → Verificado → Destacado) y ganaras mas por el mismo capitulo.
          </p>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          label={`Pendiente (retencion ${wallet?.payout_rules?.hold_days ?? 7} dias)`}
          value={wallet ? `$${wallet.pending_usd}` : "..."}
          sub={`${wallet?.pending_coins ?? 0} Creator Coins`}
        />
        <MetricCard
          icon={<Wallet className="h-4 w-4 text-emerald-500" />}
          label="Disponible para retirar"
          value={wallet ? `$${wallet.available_usd}` : "..."}
          sub={`${wallet?.available_coins ?? 0} Creator Coins`}
        />
        <MetricCard
          icon={<Banknote className="h-4 w-4 text-primary" />}
          label="Ultimos 30 dias"
          value={earnings ? `$${earnings.totals?.usd ?? 0}` : "..."}
          sub={`${earnings?.totals?.coins ?? 0} coins ganadas`}
        />
      </div>

      <section className="rounded-lg border border-border/60 bg-card p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-5 w-5 text-primary" /> Stripe Connect
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {connect?.payouts_enabled
            ? "Cuenta verificada. Tus retiros van directo a tu banco."
            : connect?.connected
              ? "Verificacion pendiente. Completa los requisitos de Stripe para habilitar retiros."
              : "Conecta tu cuenta para recibir pagos. La verificacion de identidad y tus datos bancarios los gestiona Stripe; CharBook nunca los almacena."}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={startConnect} disabled={busy !== null} variant={connect?.payouts_enabled ? "outline" : "default"}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {connect?.payouts_enabled ? "Gestionar cuenta" : connect?.connected ? "Continuar verificacion" : "Conectar Stripe"}
          </Button>
          <Button
            onClick={requestPayout}
            disabled={busy !== null || !connect?.payouts_enabled || !wallet || wallet.available_usd < (wallet.payout_rules?.min_usd ?? 50)}
          >
            <Banknote className="mr-2 h-4 w-4" /> Solicitar retiro
          </Button>
          <p className="text-xs text-muted-foreground">
            Minimo ${wallet?.payout_rules?.min_usd ?? 50} - max. {wallet?.payout_rules?.max_per_week ?? 1}/semana
            {Number(wallet?.payout_rules?.fee_pct ?? 0) > 0 ? ` - comision ${wallet?.payout_rules?.fee_pct}%` : ""}
          </p>
        </div>
        {msg && <p className="mt-3 text-sm text-primary">{msg}</p>}
      </section>

      <section>
        <h2 className="font-serif text-xl font-bold">Historial de retiros</h2>
        {payouts.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-border/70 bg-card/60 p-6 text-sm text-muted-foreground">
            {loaded ? "Aun no has solicitado retiros." : "Cargando retiros..."}
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
            {payouts.map((payout) => (
              <div key={payout.id} className="flex items-center justify-between gap-3 border-b border-border/40 bg-card px-5 py-3 last:border-0">
                <div>
                  <p className="font-mono text-sm font-semibold">${payout.amount_usd}</p>
                  <p className="text-xs text-muted-foreground">{new Date(payout.created_at).toLocaleString("es")}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                  payout.status === "paid" ? "bg-emerald-500/10 text-emerald-500"
                  : payout.status === "failed" || payout.status === "rejected" ? "bg-destructive/10 text-destructive"
                  : "bg-amber-500/10 text-amber-500"
                }`}>
                  {statusLabel[payout.status] ?? payout.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Configura precios por capitulo, capitulos gratuitos, packs y acceso anticipado desde la edicion de cada obra.
      </p>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-5">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">{icon} {label}</p>
      <p className="mt-2 font-serif text-3xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
