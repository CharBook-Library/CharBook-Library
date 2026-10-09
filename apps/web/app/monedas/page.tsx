"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Coins, Gift, PlayCircle, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RouteLoading } from "@/components/route-loading";
import {
  monetizationApi,
  type CoinPackage,
  type WalletInfo,
} from "@/lib/api-monetization";
import { useAuth } from "@/hooks/use-auth";

type ApiError = {
  response?: {
    status?: number;
    data?: { message?: string };
  };
};

type WalletTransaction = {
  id: number;
  type: string;
  currency: "premium" | "reward";
  amount: number;
  created_at: string;
};

const typeLabel: Record<string, string> = {
  purchase: "Compra",
  unlock: "Desbloqueo",
  ad_reward: "Anuncio",
  daily_login: "Login diario",
  book_complete: "Libro completado",
  admin_adjust: "Ajuste",
  refund: "Reembolso",
};

const RECENT_MOVEMENTS_DAYS = 7;
const RECENT_MOVEMENTS_WINDOW_MS = RECENT_MOVEMENTS_DAYS * 24 * 60 * 60 * 1000;

function isRecentMovement(tx: WalletTransaction): boolean {
  const timestamp = new Date(tx.created_at).getTime();
  if (!Number.isFinite(timestamp)) return false;

  return timestamp >= Date.now() - RECENT_MOVEMENTS_WINDOW_MS;
}

export default function CoinsPage() {
  // useSearchParams() forces a CSR bailout during prerender, so it must live
  // under a Suspense boundary or `next build` aborts the static export.
  return (
    <Suspense fallback={<RouteLoading rows={8} />}>
      <CoinsPageContent />
    </Suspense>
  );
}

function CoinsPageContent() {
  const searchParams = useSearchParams();
  const { refetch } = useAuth();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [txs, setTxs] = useState<WalletTransaction[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoaded(false);
    const [walletResult, packagesResult, txResult] = await Promise.allSettled([
      monetizationApi.wallet(),
      monetizationApi.packages(),
      monetizationApi.walletTransactions(),
    ]);

    if (walletResult.status === "fulfilled") {
      setWallet(walletResult.value);
      setNeedsAuth(false);
    } else {
      const error = walletResult.reason as ApiError;
      setNeedsAuth(error?.response?.status === 401);
      setWallet(null);
    }

    if (packagesResult.status === "fulfilled") {
      setPackages(packagesResult.value);
    }

    if (txResult.status === "fulfilled") {
      setTxs(txResult.value.data ?? []);
    }

    setLoaded(true);
  }, []);

  const refreshWalletOnly = useCallback(() => {
    monetizationApi.wallet()
      .then((next) => {
        setWallet(next);
        setNeedsAuth(false);
      })
      .catch((error: ApiError) => {
        setNeedsAuth(error?.response?.status === 401);
        setWallet(null);
      });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (searchParams.get("status") !== "success") return;
    const notice = window.setTimeout(() => {
      setMsg("Pago recibido. Estamos actualizando tus saldos y membresia.");
    }, 0);
    const first = window.setTimeout(() => {
      void load();
      void refetch();
    }, 1500);
    const second = window.setTimeout(() => {
      void load();
      void refetch();
    }, 4500);
    return () => {
      window.clearTimeout(notice);
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [load, refetch, searchParams]);

  const buy = async (pkg: CoinPackage) => {
    setBusy(`pkg-${pkg.id}`);
    setMsg(null);
    try {
      const { url } = await monetizationApi.checkout({ package_id: pkg.id });
      window.location.assign(url);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setMsg(apiError?.response?.status === 401 ? "Inicia sesion para comprar monedas." : "No se pudo iniciar el pago.");
      setBusy(null);
    }
  };

  const claimDaily = async () => {
    setBusy("daily");
    setMsg(null);
    try {
      const result = await monetizationApi.dailyLogin();
      setMsg(result.granted > 0 ? `+${result.granted} CharCoins Reward por entrar hoy.` : "Ya reclamaste la recompensa de hoy o alcanzaste el limite.");
      void refreshWalletOnly();
    } catch {
      setMsg("Inicia sesion para reclamar recompensas.");
    } finally {
      setBusy(null);
    }
  };

  const watchAd = async () => {
    setBusy("ad");
    setMsg(null);
    try {
      const result = await monetizationApi.adSession("reward_screen");
      setMsg((result.granted ?? 0) > 0 ? `+${result.granted} CharCoins Reward por ver el anuncio.` : "Limite de anuncios de hoy alcanzado.");
      void refreshWalletOnly();
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setMsg(apiError?.response?.data?.message ?? "No hay anuncios disponibles.");
    } finally {
      setBusy(null);
    }
  };

  const recentTxs = txs.filter(isRecentMovement);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <section>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">CharCoins</p>
          <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight sm:text-5xl">Billetera y monedas</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Las monedas se compran aparte de Premium. Usa CharCoins Premium para desbloqueos y Reward para cubrir parte de lecturas normales.
          </p>
        </div>
      </section>

      {needsAuth && (
        <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-medium">Inicia sesion para ver tus saldos y comprar monedas.</p>
          <Button asChild className="mt-3" size="sm">
            <Link href="/login">Iniciar sesion</Link>
          </Button>
        </div>
      )}

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <BalanceCard icon={Coins} label="CharCoins Premium" value={needsAuth ? "-" : wallet?.premium_balance ?? "..."} tone="primary" />
        <BalanceCard icon={Gift} label="CharCoins Reward" value={needsAuth ? "-" : wallet?.reward_balance ?? "..."} tone="emerald" />
        <div className="rounded-lg border border-border/60 bg-card p-6">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4 text-primary" /> Limites Reward
          </p>
          {wallet ? (
            <>
              <p className="mt-2 font-serif text-3xl font-bold">{wallet.reward_limits.earned_today}/{wallet.reward_limits.daily_cap}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Anuncios hoy: {wallet.reward_limits.ads_today}/{wallet.reward_limits.ad_daily_cap}. Max. {wallet.reward_limits.max_pct_per_unlock}% por desbloqueo.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{needsAuth ? "Inicia sesion." : "Cargando..."}</p>
          )}
        </div>
      </section>

      <section className="mt-5 flex flex-wrap gap-3">
        <Button variant="outline" disabled={busy !== null || needsAuth} onClick={claimDaily}>
          <Gift className="mr-2 h-4 w-4" /> Recompensa diaria
        </Button>
        <Button variant="outline" disabled={busy !== null || needsAuth} onClick={watchAd}>
          <PlayCircle className="mr-2 h-4 w-4" /> Ganar con anuncio
        </Button>
      </section>
      {msg && <p className="mt-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">{msg}</p>}

      <section className="mt-12">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-serif text-2xl font-bold">Paquetes de CharCoins Premium</h2>
            <p className="mt-2 text-sm text-muted-foreground">Compra monedas para desbloquear capitulos, packs y acceso anticipado cuando aplique.</p>
          </div>
          <Link href="/premium" className="text-sm text-primary underline-offset-2 hover:underline">
            Ver beneficios Premium
          </Link>
        </div>

        {packages.length === 0 && loaded ? (
          <div className="mt-5 rounded-lg border border-dashed border-border/70 bg-card/60 p-6 text-sm text-muted-foreground">
            No hay paquetes activos en este momento.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {packages.map((pkg) => (
              <article key={pkg.id} className="flex min-h-[230px] flex-col rounded-lg border border-border/60 bg-card p-5">
                <p className="text-sm font-semibold">{pkg.name}</p>
                <p className="mt-3 font-serif text-4xl font-bold">{pkg.coins.toLocaleString()}</p>
                <p className="mt-1 text-xs text-muted-foreground">CharCoins Premium</p>
                {pkg.bonus_coins > 0 && (
                  <p className="mt-3 flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-500">
                    <Sparkles className="h-3 w-3" /> +{pkg.bonus_coins} bonus
                  </p>
                )}
                <Button className="mt-auto" disabled={busy !== null || needsAuth} onClick={() => buy(pkg)}>
                  Comprar por ${pkg.price_usd}
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-2xl font-bold">Movimientos recientes</h2>
        {recentTxs.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
            {recentTxs.slice(0, 12).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 border-b border-border/40 bg-card px-5 py-3 last:border-0">
                <div>
                  <p className="text-sm">{typeLabel[tx.type] ?? tx.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleString("es")} - {tx.currency === "premium" ? "Premium" : "Reward"}
                  </p>
                </div>
                <p className={`font-mono text-sm font-semibold ${tx.amount > 0 ? "text-emerald-500" : "text-destructive"}`}>
                  {tx.amount > 0 ? "+" : ""}{tx.amount}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-border/70 bg-card/60 p-6 text-sm text-muted-foreground">
            {needsAuth ? "Inicia sesion para ver tus movimientos." : loaded ? "No hay movimientos de los ultimos 7 dias." : "Cargando movimientos..."}
          </div>
        )}
      </section>

      {/* ===== ¿Qué son las CharCoins? (explicación para nuevos) ===== */}
      <section className="mt-12">
        <h2 className="font-serif text-2xl font-bold">¿Qué son las CharCoins?</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <article className="rounded-lg border border-border/60 bg-card p-5">
            <Coins className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-semibold">Qué son</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              La moneda de CharBook. Las <strong>Premium</strong> se compran; las{" "}
              <strong>Reward</strong> se ganan gratis leyendo y participando.
            </p>
          </article>
          <article className="rounded-lg border border-border/60 bg-card p-5">
            <Gift className="h-5 w-5 text-emerald-500" />
            <h3 className="mt-3 font-semibold">Para qué sirven</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Desbloquean capítulos y packs de tus series favoritas, para siempre.
              Cada desbloqueo apoya directamente al creador de la obra.
            </p>
          </article>
          <article className="rounded-lg border border-border/60 bg-card p-5">
            <PlayCircle className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-semibold">Cómo se consiguen</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Comprando paquetes, con la recompensa diaria, viendo anuncios
              opcionales, completando libros y en eventos especiales.
            </p>
          </article>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Las CharCoins son independientes de la membresía Premium: una mejora tu
          experiencia de lectura, las otras desbloquean contenido puntual.
        </p>
      </section>
    </div>
  );
}

function BalanceCard({ icon: Icon, label, value, tone }: { icon: typeof Coins; label: string; value: number | string; tone: "primary" | "emerald" }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-6">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={`h-4 w-4 ${tone === "primary" ? "text-primary" : "text-emerald-500"}`} /> {label}
      </p>
      <p className="mt-2 font-serif text-4xl font-bold">{value}</p>
    </div>
  );
}
