"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coins,
  Crown,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  staffApi,
  type AdminAccountStatus,
  type AdminUserListItem,
} from "@/lib/api-creator";
import { useAuth } from "@/hooks/use-auth";

const ALL_ROLES = ["super_admin", "admin", "moderator", "creator", "reader"] as const;

const ROLE_META: Record<string, { label: string; color: string }> = {
  super_admin: { label: "Super Admin", color: "bg-red-500/20 text-red-400 border-red-500/40" },
  admin: { label: "Admin", color: "bg-orange-500/20 text-orange-400 border-orange-500/40" },
  moderator: { label: "Moderador", color: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
  creator: { label: "Creador Verificado", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
  reader: { label: "Lector", color: "bg-muted text-muted-foreground border-border/60" },
};

const MEMBERSHIP_META: Record<string, { label: string; color: string }> = {
  free: { label: "Gratis", color: "bg-muted text-muted-foreground border-border/60" },
  premium: { label: "Premium", color: "bg-primary/15 text-primary border-primary/40" },
  premium_plus: { label: "Premium Plus", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
};

const ACCOUNT_STATUS_META: Record<
  AdminAccountStatus,
  { label: string; color: string; description: string }
> = {
  active: {
    label: "Activa",
    color: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    description: "Restablece el acceso a la cuenta.",
  },
  suspended: {
    label: "Suspendida",
    color: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    description: "Bloquea el acceso y revoca las sesiones actuales.",
  },
  banned: {
    label: "Inhabilitada",
    color: "border-red-500/40 bg-red-500/15 text-red-300",
    description: "Bloquea la cuenta sin fecha de expiracion.",
  },
};

function formatAccountDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

function futureDateInput(hours = 24) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

type ApiFailure = {
  response?: {
    data?: {
      message?: string;
      errors?: Record<string, string[]>;
    };
  };
};

function apiFailureMessage(error: ApiFailure, fallback: string) {
  const firstValidation = Object.values(error.response?.data?.errors ?? {})[0]?.[0];
  return firstValidation ?? error.response?.data?.message ?? fallback;
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { isSuperAdmin, user: authUser } = useAuth();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [accountFilter, setAccountFilter] = useState<AdminAccountStatus | "">("");
  const [page, setPage] = useState(1);
  const [accountDialog, setAccountDialog] = useState<AdminUserListItem | null>(null);
  const [nextAccountStatus, setNextAccountStatus] = useState<AdminAccountStatus>("suspended");
  const [suspensionMode, setSuspensionMode] = useState<"temporary" | "permanent">("temporary");
  const [suspendedUntil, setSuspendedUntil] = useState("");
  const [accountReason, setAccountReason] = useState("");
  const [accountConfirmed, setAccountConfirmed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", { search, role, accountFilter, page }],
    queryFn: () => staffApi.users.list({ search, role, account_status: accountFilter, page }),
    placeholderData: (previous) => previous,
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role, action }: { userId: number; role: string; action: "assign" | "remove" }) =>
      staffApi.users.updateRoles(userId, role, action),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? "Error al actualizar rol"),
  });

  // Nivel económico del creador (fuente del reparto de ingresos).
  const levelMutation = useMutation({
    mutationFn: ({ userId, level }: { userId: number; level: "none" | "basic" | "verified" | "featured" }) =>
      staffApi.users.setCreatorLevel(userId, level),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? "No se pudo actualizar el nivel"),
  });

  const membershipMutation = useMutation({
    mutationFn: ({ userId, tier }: { userId: number; tier: "free" | "premium" | "premium_plus" }) =>
      staffApi.users.setMembership(userId, tier),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? "No se pudo actualizar la membresia"),
  });

  const coinsMutation = useMutation({
    mutationFn: ({
      userId,
      amount,
      currency,
      reason,
    }: {
      userId: number;
      amount: number;
      currency: "premium";
      reason?: string;
    }) => staffApi.users.grantCoins(userId, { amount, currency, reason }),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? "No se pudieron enviar los CharCoins"),
  });

  const accountMutation = useMutation({
    mutationFn: ({
      userId,
      status,
      reason,
      suspendedUntil,
    }: {
      userId: number;
      status: AdminAccountStatus;
      reason: string;
      suspendedUntil: string | null;
    }) =>
      staffApi.users.setAccountStatus(userId, {
        status,
        reason,
        suspended_until: suspendedUntil,
      }),
    onSuccess: (res) => {
      toast.success(res.message);
      setAccountDialog(null);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: ApiFailure) =>
      toast.error(apiFailureMessage(error, "No se pudo cambiar el estado de la cuenta")),
  });

  const openAccountDialog = (target: AdminUserListItem) => {
    setAccountDialog(target);
    setNextAccountStatus(target.account_status === "active" ? "suspended" : "active");
    setSuspensionMode("temporary");
    setSuspendedUntil(futureDateInput());
    setAccountReason("");
    setAccountConfirmed(false);
  };

  const submitAccountStatus = () => {
    if (!accountDialog) return;
    const reason = accountReason.trim();
    if (reason.length < 3) {
      toast.error("Escribe un motivo de al menos 3 caracteres.");
      return;
    }

    let expiration: string | null = null;
    if (nextAccountStatus === "suspended" && suspensionMode === "temporary") {
      const parsed = new Date(suspendedUntil);
      if (!suspendedUntil || Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        toast.error("Selecciona una fecha futura para la suspension temporal.");
        return;
      }
      expiration = parsed.toISOString();
    }

    accountMutation.mutate({
      userId: accountDialog.id,
      status: nextAccountStatus,
      reason,
      suspendedUntil: expiration,
    });
  };

  const sendCoins = (
    userId: number,
    amount: number,
    currency: "premium",
    reason = "admin_quick_grant"
  ) => {
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
      toast.error("Ingresa una cantidad valida entre 1 y 100000.");
      return;
    }

    coinsMutation.mutate({ userId, amount, currency, reason });
  };

  const promptCustomCoins = (userId: number) => {
    const raw = window.prompt("Cantidad de CharCoins Premium a enviar");
    if (raw === null) return;

    const amount = Number(raw.trim());
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
      toast.error("Ingresa una cantidad valida entre 1 y 100000.");
      return;
    }

    const reason = window.prompt("Motivo interno opcional")?.trim();
    sendCoins(userId, amount, "premium", reason || "admin_custom_grant");
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Usuarios</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona la comunidad: roles, suspensiones y actividad.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email, username..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10"
          />
        </div>
        <select
          value={role}
          onChange={(e) => { setRole(e.target.value); setPage(1); }}
          aria-label="Filtrar por rol"
          className="h-10 rounded-md border border-border/60 bg-card px-3 text-sm"
        >
          <option value="">Todos los roles</option>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_META[r].label}</option>
          ))}
        </select>
        <select
          value={accountFilter}
          onChange={(e) => {
            setAccountFilter(e.target.value as AdminAccountStatus | "");
            setPage(1);
          }}
          aria-label="Filtrar por estado de cuenta"
          className="h-10 rounded-md border border-border/60 bg-card px-3 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="suspended">Suspendidas</option>
          <option value="banned">Inhabilitadas</option>
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : !data?.data.length ? (
        <Card className="border-dashed border-border/60 py-16 text-center text-sm text-muted-foreground">
          No hay usuarios con esos criterios.
        </Card>
      ) : (
        <div className="space-y-2">
          {data.data.map((u) => (
            <Card key={u.id} className="border-border/60 bg-card p-4">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar className="h-12 w-12 shrink-0 border border-border/60">
                  <AvatarImage src={u.avatar ?? undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {u.name?.[0]?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{u.name}</span>
                    {u.username && (
                      <span className="text-xs text-muted-foreground">@{u.username}</span>
                    )}
                    <Badge className={`text-[10px] border ${MEMBERSHIP_META[u.subscription_tier ?? "free"]?.color ?? MEMBERSHIP_META.free.color}`}>
                      {MEMBERSHIP_META[u.subscription_tier ?? "free"]?.label ?? "Gratis"}
                    </Badge>
                    <Badge className={`text-[10px] border ${ACCOUNT_STATUS_META[u.account_status].color}`}>
                      {ACCOUNT_STATUS_META[u.account_status].label}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  {u.account_status !== "active" && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {formatAccountDate(u.account_status_changed_at) && (
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3 w-3" aria-hidden="true" />
                          Desde {formatAccountDate(u.account_status_changed_at)}
                        </span>
                      )}
                      <span>
                        {u.account_status === "suspended" && u.account_status_expires_at
                          ? `Hasta ${formatAccountDate(u.account_status_expires_at)}`
                          : "Sin expiracion automatica"}
                      </span>
                    </div>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {u.roles.length === 0 && (
                      <Badge className="bg-muted text-muted-foreground text-[10px] border border-border/60">
                        Sin roles
                      </Badge>
                    )}
                    {u.roles.map((r) => (
                      <Badge key={r} className={`text-[10px] border ${ROLE_META[r]?.color ?? ""}`}>
                        {ROLE_META[r]?.label ?? r}
                      </Badge>
                    ))}
                    {u.creator_tier === "featured" && (
                      <Badge className="text-[10px] border bg-amber-500/20 text-amber-500 border-amber-500/40">
                        🏆 Destacado
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="hidden md:flex shrink-0 text-right text-xs text-muted-foreground gap-4">
                  <div>
                    <div className="font-bold text-foreground text-sm">{u.reviews_count}</div>
                    <div>reseñas</div>
                  </div>
                  <div>
                    <div className="font-bold text-foreground text-sm">{u.favorites_count}</div>
                    <div>favoritos</div>
                  </div>
                </div>

                {/* Dropdown asignar rol */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                      disabled={roleMutation.isPending}
                    >
                      <Shield className="mr-1.5 h-3.5 w-3.5" />
                      Roles
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="text-xs uppercase">
                      Asignar / quitar
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {ALL_ROLES.map((r) => {
                      // super_admin solo aparece si tú eres super_admin
                      if (r === "super_admin" && !isSuperAdmin) return null;
                      const has = u.roles.includes(r);
                      return (
                        <DropdownMenuItem
                          key={r}
                          onClick={() =>
                            roleMutation.mutate({
                              userId: u.id,
                              role: r,
                              action: has ? "remove" : "assign",
                            })
                          }
                          className="cursor-pointer"
                        >
                          {has ? (
                            <X className="mr-2 h-3.5 w-3.5 text-destructive" />
                          ) : (
                            <Check className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                          )}
                          {has ? "Quitar " : "Asignar "} {ROLE_META[r].label}
                        </DropdownMenuItem>
                      );
                    })}

                    {/* Nivel económico del creador (fija el % de reparto). */}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs uppercase">
                      Nivel económico {u.creator_level ? `· actual: ${u.creator_level}` : ""}
                    </DropdownMenuLabel>
                    {([
                      { level: "basic", label: "Básico (60%)" },
                      { level: "verified", label: "Verificado (70%)" },
                      { level: "featured", label: "Destacado (75%)" },
                      { level: "none", label: "Sin nivel (derivar)" },
                    ] as const).map(({ level, label }) => (
                      <DropdownMenuItem
                        key={level}
                        onClick={() => levelMutation.mutate({ userId: u.id, level })}
                        className="cursor-pointer"
                        disabled={levelMutation.isPending || u.creator_level === level}
                      >
                        {level === "featured" ? (
                          <Trophy className="mr-2 h-3.5 w-3.5 text-amber-500" />
                        ) : level === "none" ? (
                          <X className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Check className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                        )}
                        {label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {isSuperAdmin && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border/70 text-foreground hover:border-primary/50 hover:bg-primary/10"
                      onClick={() => openAccountDialog(u)}
                      disabled={accountMutation.isPending || authUser?.id === u.id}
                      title={authUser?.id === u.id ? "No puedes cambiar el estado de tu propia cuenta" : undefined}
                    >
                      {u.account_status === "active" ? (
                        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                      ) : (
                        <Ban className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Estado
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                          disabled={membershipMutation.isPending}
                        >
                          <Crown className="mr-1.5 h-3.5 w-3.5" />
                          Membresia
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="text-xs uppercase">
                          Plan otorgado
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {([
                          { tier: "free", label: "Gratis", icon: X },
                          { tier: "premium", label: "Premium", icon: Crown },
                          { tier: "premium_plus", label: "Premium Plus", icon: Sparkles },
                        ] as const).map(({ tier, label, icon: Icon }) => (
                          <DropdownMenuItem
                            key={tier}
                            onClick={() => membershipMutation.mutate({ userId: u.id, tier })}
                            className="cursor-pointer"
                            disabled={membershipMutation.isPending || u.subscription_tier === tier}
                          >
                            <Icon className="mr-2 h-3.5 w-3.5 text-primary" />
                            {label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
                          disabled={coinsMutation.isPending}
                        >
                          <Coins className="mr-1.5 h-3.5 w-3.5" />
                          Coins
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="text-xs uppercase">
                          Enviar CharCoins
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {([50, 100, 250] as const).map((amount) => (
                          <DropdownMenuItem
                            key={amount}
                            onClick={() => sendCoins(u.id, amount, "premium")}
                            className="cursor-pointer"
                            disabled={coinsMutation.isPending}
                          >
                            <Coins className="mr-2 h-3.5 w-3.5 text-amber-400" />
                            +{amount} Premium
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => promptCustomCoins(u.id)}
                          className="cursor-pointer"
                          disabled={coinsMutation.isPending}
                        >
                          Premium personalizado...
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            </Card>
          ))}

          {data.meta.last_page > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </Button>
              <span className="text-sm text-muted-foreground px-3">
                {data.meta.current_page} / {data.meta.last_page}
                <span className="ml-2 text-xs">({data.meta.total} total)</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.meta.last_page}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
      <Dialog
        open={accountDialog !== null}
        onOpenChange={(open) => {
          if (!open && !accountMutation.isPending) setAccountDialog(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Estado de la cuenta</DialogTitle>
            <DialogDescription>
              {accountDialog
                ? `Gestiona el acceso de ${accountDialog.name} (${accountDialog.email}).`
                : "Gestiona el acceso de esta cuenta."}
            </DialogDescription>
          </DialogHeader>

          {accountDialog && (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                submitAccountStatus();
              }}
            >
              <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-sm">
                <span className="text-muted-foreground">Estado actual:</span>{" "}
                <span className="font-medium">
                  {ACCOUNT_STATUS_META[accountDialog.account_status].label}
                </span>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Nuevo estado</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    { status: "active", icon: ShieldCheck },
                    { status: "suspended", icon: Clock3 },
                    { status: "banned", icon: Ban },
                  ] as const).map(({ status, icon: Icon }) => {
                    const meta = ACCOUNT_STATUS_META[status];
                    const selected = nextAccountStatus === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setNextAccountStatus(status)}
                        className={`min-h-20 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          selected
                            ? meta.color
                            : "border-border/70 bg-background hover:border-primary/40 hover:bg-muted/30"
                        }`}
                      >
                        <Icon className="mb-2 h-4 w-4" aria-hidden="true" />
                        <span className="block text-sm font-medium">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {ACCOUNT_STATUS_META[nextAccountStatus].description}
                </p>
              </fieldset>

              {nextAccountStatus === "suspended" && (
                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium">Duracion de la suspension</legend>
                  <div className="flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="suspension-mode"
                        value="temporary"
                        checked={suspensionMode === "temporary"}
                        onChange={() => setSuspensionMode("temporary")}
                        className="h-4 w-4 accent-primary"
                      />
                      Temporal
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="suspension-mode"
                        value="permanent"
                        checked={suspensionMode === "permanent"}
                        onChange={() => setSuspensionMode("permanent")}
                        className="h-4 w-4 accent-primary"
                      />
                      Permanente
                    </label>
                  </div>
                  {suspensionMode === "temporary" && (
                    <div className="space-y-1.5">
                      <label htmlFor="suspended-until" className="text-sm font-medium">
                        Finaliza el
                      </label>
                      <Input
                        id="suspended-until"
                        type="datetime-local"
                        value={suspendedUntil}
                        onChange={(event) => setSuspendedUntil(event.target.value)}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        La fecha se interpreta en la zona horaria de este dispositivo.
                      </p>
                    </div>
                  )}
                </fieldset>
              )}

              <div className="space-y-1.5">
                <label htmlFor="account-status-reason" className="text-sm font-medium">
                  Motivo interno
                </label>
                <Textarea
                  id="account-status-reason"
                  value={accountReason}
                  onChange={(event) => setAccountReason(event.target.value)}
                  maxLength={1000}
                  rows={4}
                  required
                  placeholder="Describe de forma objetiva por que se realiza este cambio."
                />
                <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                  <span>No se muestra en el perfil publico.</span>
                  <span>{accountReason.length}/1000</span>
                </div>
              </div>

              {nextAccountStatus !== "active" && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                  Las sesiones y tokens actuales se revocaran inmediatamente.
                </div>
              )}

              <label className="flex items-start gap-2 rounded-md border border-border/70 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={accountConfirmed}
                  onChange={(event) => setAccountConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span>Confirmo que revise la cuenta y el efecto de este cambio.</span>
              </label>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAccountDialog(null)}
                  disabled={accountMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    accountMutation.isPending ||
                    !accountConfirmed ||
                    accountReason.trim().length < 3 ||
                    nextAccountStatus === accountDialog.account_status ||
                    (nextAccountStatus === "suspended" &&
                      suspensionMode === "temporary" &&
                      !suspendedUntil)
                  }
                >
                  {accountMutation.isPending ? "Aplicando..." : "Aplicar cambio"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
