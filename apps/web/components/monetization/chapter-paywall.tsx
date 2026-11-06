"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, Check, Clock, Coins, Crown, Lock, PlayCircle, Sparkles, Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { monetizationApi, type ChapterAccess, type WalletInfo } from "@/lib/api-monetization";

type ApiError = { response?: { data?: { message?: string } } };

export function ChapterPaywall({ slug, number }: { slug: string; number: number }) {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [access, setAccess] = useState<ChapterAccess[] | null>(null);
  const [packs, setPacks] = useState<number[]>([3, 5, 10]);
  const [packDiscounts, setPackDiscounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adMsg, setAdMsg] = useState<string | null>(null);
  const [waitUntil, setWaitUntil] = useState<string | null>(null);

  const reload = () =>
    monetizationApi.bookAccess(slug).then((response) => {
      setAccess(response.data);
      setPacks(response.monetization?.packs ?? [3, 5, 10]);
      setPackDiscounts(response.monetization?.pack_discount_pct ?? {});
    });

  useEffect(() => {
    reload().catch(() => setError("No se pudo cargar el estado del capítulo."));
    monetizationApi.wallet().then(setWallet).catch(() => setWallet(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const clicked = useMemo(
    () => access?.find((item) => item.number === number) ?? null,
    [access, number],
  );

  // Lectura secuencial: si este capítulo está bloqueado por uno de pago anterior
  // (la "puerta"), el paywall opera sobre esa puerta — es lo que hay que pagar
  // para avanzar. Al desbloquearla, los capítulos gratis siguientes se abren solos.
  const chapter = useMemo(() => {
    if (clicked?.reason === "locked_sequential" && clicked.gate_chapter_id) {
      return access?.find((c) => c.chapter_id === clicked.gate_chapter_id) ?? clicked;
    }
    return clicked;
  }, [access, clicked]);

  const targetNumber = chapter?.number ?? number;
  const blockedByGate =
    clicked?.reason === "locked_sequential" && chapter?.chapter_id !== clicked?.chapter_id;

  const lockedAhead = useMemo(
    () => (access ?? []).filter((item) => !item.access && item.number >= targetNumber),
    [access, targetNumber],
  );

  // El reloj de la cuenta atrás: del estado local (recién reservado) o del server.
  const deadline = waitUntil ?? chapter?.wait_until ?? null;

  const maxRewardUsable = (price: number) =>
    wallet
      ? Math.min(
          wallet.reward_balance,
          Math.floor((price * wallet.reward_limits.max_pct_per_unlock) / 100),
        )
      : 0;

  const doUnlockChapter = async () => {
    if (!chapter) return;
    setBusy("chapter");
    setError(null);
    try {
      const reward = chapter.early_access ? 0 : maxRewardUsable(chapter.coin_price);
      await monetizationApi.unlockChapter(chapter.chapter_id, reward, crypto.randomUUID());
      router.refresh();
    } catch (e: unknown) {
      setError((e as ApiError)?.response?.data?.message ?? "No se pudo desbloquear. Revisa tu saldo.");
    } finally {
      setBusy(null);
    }
  };

  const doStartWait = async () => {
    if (!chapter) return;
    setBusy("wait");
    setError(null);
    try {
      const { unlocks_at } = await monetizationApi.startWaitUnlock(chapter.chapter_id);
      setWaitUntil(unlocks_at);
      reload().catch(() => {});
    } catch (e: unknown) {
      setError((e as ApiError)?.response?.data?.message ?? "No se pudo reservar la espera.");
    } finally {
      setBusy(null);
    }
  };

  const doUnlockPack = async (size: number) => {
    setBusy(`pack-${size}`);
    setError(null);
    try {
      await monetizationApi.unlockPack(slug, size, number, 0, crypto.randomUUID());
      router.refresh();
    } catch (e: unknown) {
      setError((e as ApiError)?.response?.data?.message ?? "No se pudo desbloquear el pack.");
    } finally {
      setBusy(null);
    }
  };

  const goCheckout = async (plan: "premium" | "premium_plus") => {
    setBusy(plan);
    setError(null);
    try {
      const { url } = await monetizationApi.checkout({ plan });
      window.location.href = url;
    } catch (e: unknown) {
      setError((e as ApiError)?.response?.data?.message ?? "Inicia sesión para suscribirte.");
      setBusy(null);
    }
  };

  const watchAd = async () => {
    setBusy("ad");
    setError(null);
    setAdMsg(null);
    try {
      const response = await monetizationApi.adSession("between_chapters");
      const granted = response.granted ?? 0;
      setAdMsg(granted > 0 ? `+${granted} CharCoin${granted === 1 ? "" : "s"} Reward.` : "Límite diario de anuncios alcanzado.");
      setWallet(await monetizationApi.wallet());
    } catch (e: unknown) {
      setAdMsg((e as ApiError)?.response?.data?.message ?? "No hay anuncios disponibles ahora.");
    } finally {
      setBusy(null);
    }
  };

  const price = chapter?.coin_price ?? 0;
  const balanceTotal = (wallet?.premium_balance ?? 0) + (chapter?.early_access ? 0 : (wallet?.reward_balance ?? 0));
  const missingCoins = wallet && !chapter?.early_access ? Math.max(0, price - balanceTotal) : 0;
  const canAfford = balanceTotal >= price;
  const packOptions = packs.filter((pack) => pack <= lockedAhead.length);
  const canWait = !!chapter?.wait_available && !chapter?.early_access;
  const waitHours = chapter?.wait_hours ?? 48;

  return (
    <div className="relative mx-auto flex min-h-[82dvh] max-w-2xl flex-col justify-center px-4 py-12 sm:px-6">
      {/* Glow superior muy sutil — nada de degradados recargados */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(60%_100%_at_50%_0%,oklch(0.78_0.13_80_/_0.10),transparent_70%)]"
      />

      {/* ───── Encabezado ───── */}
      <header className="relative text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/[0.07] shadow-sm">
          <Lock className="h-6 w-6 text-primary" strokeWidth={1.75} />
        </span>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">
          Capítulo {targetNumber}
        </p>
        <h1 className="mx-auto mt-2 max-w-md text-balance font-serif text-[1.9rem] font-bold leading-[1.1] tracking-tight sm:text-4xl">
          {chapter?.early_access ? "Acceso anticipado" : "Continúa la historia"}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          {chapter?.early_access
            ? "Este capítulo se publica antes para la comunidad Premium Plus. También puedes abrirlo con CharCoins."
            : "Elige cómo seguir leyendo. Lo que desbloquees queda guardado en tu cuenta para siempre."}
        </p>
        {blockedByGate && (
          <p className="mx-auto mt-4 max-w-sm rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-2.5 text-sm text-foreground/90">
            El capítulo {number} llega más adelante en la historia. Para continuar, desbloquea
            primero el capítulo {targetNumber}.
          </p>
        )}
      </header>

      {/* ───── Opciones ───── */}
      <div className="relative mt-9 space-y-3">
        {/* 1 · Esperar gratis (solo capítulos de pago normales) */}
        {canWait && (
          <WaitOption
            deadline={deadline}
            waitHours={waitHours}
            busy={busy === "wait"}
            disabled={busy !== null}
            onStart={doStartWait}
            onElapsed={() => router.refresh()}
          />
        )}

        {/* 2 · Desbloquear ya con monedas */}
        {!chapter?.early_access ? (
          <CoinOption
            price={price}
            wallet={wallet}
            canAfford={canAfford}
            missingCoins={missingCoins}
            busy={busy === "chapter"}
            disabled={!chapter || busy !== null}
            onUnlock={doUnlockChapter}
            onWatchAd={watchAd}
            watchingAd={busy === "ad"}
          />
        ) : (
          <PlanBand
            plus
            title="Desbloquea el acceso anticipado"
            features={["Capítulos nuevos antes que nadie", "Lectura sin anuncios", "CharCoins cada mes"]}
            cta="Activar Premium Plus"
            busy={busy === "premium_plus"}
            disabled={busy !== null}
            onClick={() => goCheckout("premium_plus")}
          />
        )}

        {/* 3 · Planes — lectura sin límites (upsell sobrio) */}
        <div className="grid gap-3 sm:grid-cols-2">
          <PlanBand
            title="Premium"
            features={["Sin anuncios", "Temas exclusivos", "Bonus de CharCoins"]}
            cta="Ver Premium"
            variant="outline"
            busy={busy === "premium"}
            disabled={busy !== null}
            onClick={() => goCheckout("premium")}
          />
          {!chapter?.early_access && (
            <PlanBand
              plus
              title="Premium Plus"
              features={["Acceso anticipado", "CharCoins mensuales", "Más apoyo a autores"]}
              cta="Ver Plus"
              busy={busy === "premium_plus"}
              disabled={busy !== null}
              onClick={() => goCheckout("premium_plus")}
            />
          )}
        </div>

        {/* 4 · Pack de capítulos (si hay varios bloqueados por delante) */}
        {packOptions.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
            <p className="text-sm font-semibold">Avanza varios capítulos</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Desbloquea un tramo completo con descuento.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {packOptions.map((pack) => {
                const packPrice = lockedAhead.slice(0, pack).reduce((sum, item) => sum + item.coin_price, 0);
                const discount = packDiscounts[String(pack)] ?? 0;
                const final = Math.ceil((packPrice * (100 - discount)) / 100);
                return (
                  <button
                    key={pack}
                    disabled={busy !== null}
                    onClick={() => doUnlockPack(pack)}
                    className="flex flex-col items-center gap-0.5 rounded-xl border border-border/60 bg-background px-3 py-2.5 transition-colors hover:border-primary/50 hover:bg-primary/[0.04] disabled:opacity-50"
                  >
                    <span className="text-sm font-semibold tabular-nums">+{pack} caps.</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {final} <Coins className="inline h-3 w-3" />
                      {discount > 0 ? ` · −${discount}%` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 5 · Acciones secundarias */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1 text-sm">
          <Link href="/charcoins" className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground">
            <Coins className="h-4 w-4" /> Comprar CharCoins
          </Link>
          {!chapter?.early_access && (
            <>
              <span aria-hidden className="hidden h-3.5 w-px bg-border sm:block" />
              <button
                onClick={watchAd}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                <PlayCircle className="h-4 w-4" /> Ganar monedas con un anuncio
              </button>
            </>
          )}
        </div>
      </div>

      {(adMsg || error) && (
        <div className="relative mt-5">
          {adMsg && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-center text-sm text-emerald-600 dark:text-emerald-400">{adMsg}</p>}
          {error && <p className="mt-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-center text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Esperar para desbloquear (gratis) — oferta o cuenta atrás en vivo
 * ────────────────────────────────────────────────────────────── */
function WaitOption({
  deadline, waitHours, busy, disabled, onStart, onElapsed,
}: {
  deadline: string | null;
  waitHours: number;
  busy: boolean;
  disabled: boolean;
  onStart: () => void;
  onElapsed: () => void;
}) {
  const target = deadline ? new Date(deadline).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  const remaining = target ? target - now : null;

  // Cuando la cuenta atrás llega a 0, recargamos para entrar al capítulo.
  useEffect(() => {
    if (remaining !== null && remaining <= 0) onElapsed();
  }, [remaining, onElapsed]);

  const active = remaining !== null && remaining > 0;
  const totalMs = waitHours * 3_600_000;
  const progress = active ? Math.min(100, Math.max(0, ((totalMs - remaining!) / totalMs) * 100)) : 0;

  return (
    <article className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/[0.08] to-transparent">
      <div className="p-5">
        <div className="flex items-start gap-3.5">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            {active ? <Timer className="h-5 w-5 text-primary" /> : <Clock className="h-5 w-5 text-primary" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{active ? "Reservado para ti" : "Espéralo y léelo gratis"}</h2>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                Gratis
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {active
                ? "Se desbloquea solo cuando termine la cuenta atrás — aunque cierres la página."
                : `Resérvalo ahora y podrás leerlo gratis en ${humanDuration(waitHours)}. Sin gastar monedas.`}
            </p>

            {active ? (
              <div className="mt-4">
                <Countdown ms={remaining!} />
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400 transition-[width] duration-1000 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <Button className="mt-4" disabled={disabled} onClick={onStart}>
                {busy ? "Reservando…" : "Reservar y esperar"}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function Countdown({ ms }: { ms: number }) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [
    ...(d > 0 ? [{ v: d, label: "días" }] : []),
    { v: h, label: "horas" },
    { v: m, label: "min" },
    { v: s, label: "seg" },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {parts.map((p, i) => (
        <div key={p.label} className="flex items-center gap-1.5">
          <div className="flex min-w-[3.25rem] flex-col items-center rounded-lg border border-border/60 bg-background/80 px-2 py-1.5">
            <span className="font-serif text-2xl font-bold leading-none tabular-nums">
              {String(p.v).padStart(2, "0")}
            </span>
            <span className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">{p.label}</span>
          </div>
          {i < parts.length - 1 && <span className="text-lg font-bold text-muted-foreground/40">:</span>}
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Desbloquear con monedas
 * ────────────────────────────────────────────────────────────── */
function CoinOption({
  price, wallet, canAfford, missingCoins, busy, disabled, onUnlock, onWatchAd, watchingAd,
}: {
  price: number;
  wallet: WalletInfo | null;
  canAfford: boolean;
  missingCoins: number;
  busy: boolean;
  disabled: boolean;
  onUnlock: () => void;
  onWatchAd: () => void;
  watchingAd: boolean;
}) {
  return (
    <article className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background">
            <Coins className="h-5 w-5 text-primary" />
          </span>
          <div>
            <h2 className="font-semibold">Desbloquéalo ahora</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ábrelo al instante por <span className="font-semibold text-foreground tabular-nums">{price}</span> CharCoins.
              {wallet && (
                <span className="block text-xs text-muted-foreground/80">
                  Tu saldo: <span className="tabular-nums">{(wallet.premium_balance + wallet.reward_balance).toLocaleString("es")}</span>
                </span>
              )}
            </p>
          </div>
        </div>
        <Button className="shrink-0" disabled={disabled || !canAfford} onClick={onUnlock}>
          {busy ? "Desbloqueando…" : canAfford ? "Desbloquear" : "Saldo insuficiente"}
          {canAfford && !busy && <ArrowRight className="ml-1.5 h-4 w-4" />}
        </Button>
      </div>

      {wallet && missingCoins > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] px-4 py-3">
          <p className="text-sm font-medium text-primary">
            Te faltan {missingCoins} CharCoin{missingCoins === 1 ? "" : "s"} para este capítulo.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="h-8">
              <Link href="/charcoins">Comprar</Link>
            </Button>
            <Button size="sm" variant="outline" className="h-8" disabled={disabled} onClick={onWatchAd}>
              {watchingAd ? "…" : "Ver anuncio"}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Banda de plan (Premium / Plus) — upsell con lista de beneficios
 * ────────────────────────────────────────────────────────────── */
function PlanBand({
  title, features, cta, plus, variant, busy, disabled, onClick,
}: {
  title: string;
  features: string[];
  cta: string;
  plus?: boolean;
  variant?: "outline";
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <article className={`relative flex h-full flex-col rounded-2xl border p-5 ${plus ? "border-primary/40 bg-primary/[0.05]" : "border-border/60 bg-card"}`}>
      {plus && (
        <span className="absolute -top-2.5 left-5 rounded-full border border-primary/40 bg-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
          Recomendado
        </span>
      )}
      <div className="flex items-center gap-2">
        {plus ? <Sparkles className="h-4 w-4 text-primary" /> : <Crown className="h-4 w-4 text-primary" />}
        <h2 className="font-semibold">{title}</h2>
      </div>
      <ul className="mt-3 flex-1 space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> {f}
          </li>
        ))}
      </ul>
      <Button
        variant={variant}
        className={`mt-4 w-full ${plus ? "plus-cta font-semibold" : ""}`}
        disabled={disabled}
        onClick={onClick}
      >
        {busy ? "Redirigiendo…" : cta}
      </Button>
    </article>
  );
}

/** "48 h" → "2 días"; "1" → "1 hora"; "5" → "5 horas". */
function humanDuration(hours: number): string {
  if (hours % 24 === 0) {
    const d = hours / 24;
    return `${d} día${d === 1 ? "" : "s"}`;
  }
  return `${hours} hora${hours === 1 ? "" : "s"}`;
}
