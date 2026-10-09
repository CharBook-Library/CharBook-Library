"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Megaphone, Send, Loader2, Users, Sparkles, Bell, MessageSquare,
  Trophy, Calendar, Lightbulb, ShieldCheck, BarChart3, AlertCircle,
  UserSearch, Search, X, Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { adminBroadcastApi, type AdminUserHit } from "@/lib/api-inbox";
import { cn } from "@/lib/utils";

type Mode = "notification" | "message";
type Target = "all" | "creators" | "verified" | "featured" | "user";

const TARGETS: { value: Target; label: string; icon: typeof Users; description: string }[] = [
  { value: "all", label: "Todos los usuarios", icon: Users, description: "Cualquier cuenta registrada" },
  { value: "creators", label: "Creadores activos", icon: Sparkles, description: "Con al menos 1 obra publicada" },
  { value: "verified", label: "Verificados", icon: ShieldCheck, description: "Con la insignia ✓ verde" },
  { value: "featured", label: "Destacados", icon: Trophy, description: "Tier 🏆 dorado" },
  { value: "user", label: "Usuario específico", icon: UserSearch, description: "Solo a una persona concreta" },
];

const NOTIF_CATEGORIES = [
  { value: "system", label: "Sistema", emoji: "🛠️" },
  { value: "reading", label: "Lectura", emoji: "📖" },
  { value: "works", label: "Obras", emoji: "📚" },
  { value: "comments", label: "Comentarios", emoji: "💬" },
  { value: "followers", label: "Seguidores", emoji: "👥" },
  { value: "monetization", label: "Monetización", emoji: "💰" },
];

const MSG_CATEGORIES = [
  { value: "platform", label: "Plataforma", icon: Megaphone },
  { value: "event", label: "Eventos", icon: Calendar },
  { value: "tip", label: "Consejos", icon: Lightbulb },
  { value: "achievement", label: "Logros", icon: Trophy },
  { value: "report", label: "Reportes", icon: BarChart3 },
  { value: "review", label: "Revisión", icon: ShieldCheck },
];

const PRIORITIES = [
  { value: "low", label: "Baja", cls: "border-border/60 text-muted-foreground" },
  { value: "normal", label: "Normal", cls: "border-primary/40 text-primary" },
  { value: "high", label: "Alta", cls: "border-amber-500/40 text-amber-500" },
  { value: "urgent", label: "Urgente", cls: "border-destructive/40 text-destructive" },
];

const COMMON_EMOJIS = ["📢", "🎉", "✨", "🛠️", "⚠️", "🔔", "📚", "📖", "💬", "🚀", "🎁", "🏆"];

export default function AdminBroadcastPage() {
  const [mode, setMode] = useState<Mode>("notification");

  // Notif state
  const [nEmoji, setNEmoji] = useState("📢");
  const [nCategory, setNCategory] = useState("system");
  const [nTitle, setNTitle] = useState("");
  const [nBody, setNBody] = useState("");
  const [nLink, setNLink] = useState("");

  // Message state
  const [mCategory, setMCategory] = useState("platform");
  const [mPriority, setMPriority] = useState("normal");
  const [mSubject, setMSubject] = useState("");
  const [mBody, setMBody] = useState("");
  const [mSender, setMSender] = useState("Equipo CharBook");

  const [target, setTarget] = useState<Target>("all");

  // ===== User picker (target = "user") =====
  const [userQuery, setUserQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUserHit | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(userQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [userQuery]);

  const userSearch = useQuery({
    queryKey: ["admin", "users", "search", debouncedQuery],
    queryFn: () => adminBroadcastApi.searchUsers(debouncedQuery),
    enabled: target === "user" && !selectedUser && debouncedQuery.length >= 2,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const notifMutation = useMutation({
    mutationFn: () =>
      adminBroadcastApi.notification({
        emoji: nEmoji,
        title: nTitle.trim(),
        body: nBody.trim() || undefined,
        link: nLink.trim() || undefined,
        category: nCategory,
        target,
        user_id: target === "user" ? selectedUser?.id : undefined,
      }),
    onSuccess: (res) => {
      toast.success(res.message);
      setNTitle("");
      setNBody("");
      setNLink("");
    },
    onError: (err: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      const first = err.response?.data?.errors
        ? Object.values(err.response.data.errors)[0]?.[0]
        : err.response?.data?.message;
      toast.error(first ?? "No se pudo enviar");
    },
  });

  const msgMutation = useMutation({
    mutationFn: () =>
      adminBroadcastApi.message({
        category: mCategory,
        priority: mPriority,
        subject: mSubject.trim(),
        body: mBody.trim(),
        sender_name: mSender.trim() || undefined,
        target,
        user_id: target === "user" ? selectedUser?.id : undefined,
      }),
    onSuccess: (res) => {
      toast.success(res.message);
      setMSubject("");
      setMBody("");
    },
    onError: (err: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      const first = err.response?.data?.errors
        ? Object.values(err.response.data.errors)[0]?.[0]
        : err.response?.data?.message;
      toast.error(first ?? "No se pudo enviar");
    },
  });

  const baseValid =
    mode === "notification"
      ? nTitle.trim().length >= 3
      : mSubject.trim().length >= 3 && mBody.trim().length >= 10;
  const targetValid = target === "user" ? !!selectedUser : true;
  const isValid = baseValid && targetValid;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Difusión</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envía notificaciones rápidas o mensajes detallados a un público específico.
        </p>
      </div>

      {/* ═══════ TIPO DE DIFUSIÓN ═══════ */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={() => setMode("notification")}
          className={cn(
            "rounded-lg border-2 p-4 text-left transition-colors",
            mode === "notification"
              ? "border-primary bg-primary/5"
              : "border-border/60 hover:border-primary/40"
          )}
        >
          <div className="flex items-center gap-2">
            <Bell className={cn("h-5 w-5", mode === "notification" ? "text-primary" : "text-muted-foreground")} />
            <span className="font-medium">Notificación rápida</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Aviso corto que aparece en el icono 🔔 del header. Ideal para anuncios breves y enlaces.
          </p>
        </button>

        <button
          onClick={() => setMode("message")}
          className={cn(
            "rounded-lg border-2 p-4 text-left transition-colors",
            mode === "message"
              ? "border-amber-500 bg-amber-500/5"
              : "border-border/60 hover:border-amber-500/40"
          )}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className={cn("h-5 w-5", mode === "message" ? "text-amber-500" : "text-muted-foreground")} />
            <span className="font-medium">Mensaje extenso</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Va a la bandeja de mensajes. Para comunicados largos, eventos, políticas y consejos.
          </p>
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* ═══════ FORM ═══════ */}
        <Card className="border-border/60 bg-card p-5 space-y-5">
          <h2 className="font-medium text-sm">
            {mode === "notification" ? "Datos de la notificación" : "Datos del mensaje"}
          </h2>

          {mode === "notification" ? (
            <>
              <Field label="Emoji">
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setNEmoji(e)}
                      className={cn(
                        "h-9 w-9 rounded-md border text-base transition-colors",
                        nEmoji === e
                          ? "border-primary bg-primary/10"
                          : "border-border/60 hover:bg-accent"
                      )}
                    >
                      {e}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={nEmoji}
                    onChange={(e) => setNEmoji(e.target.value.slice(0, 4))}
                    maxLength={4}
                    className="h-9 w-12 rounded-md border border-border/60 bg-background text-center text-base outline-none"
                  />
                </div>
              </Field>

              <Field label="Categoría">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {NOTIF_CATEGORIES.map((c) => {
                    const active = nCategory === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setNCategory(c.value)}
                        className={cn(
                          "rounded-md border px-2.5 py-1.5 text-xs text-left transition-colors",
                          active ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/30"
                        )}
                      >
                        <span className="mr-1">{c.emoji}</span>{c.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Título" required counter={`${nTitle.length}/200`}>
                <input
                  type="text"
                  value={nTitle}
                  onChange={(e) => setNTitle(e.target.value.slice(0, 200))}
                  placeholder='Ej. "Nueva función disponible en CharBook"'
                  className={inputCls}
                />
              </Field>

              <Field label="Subtítulo / Descripción (opcional)" counter={`${nBody.length}/500`}>
                <textarea
                  rows={3}
                  value={nBody}
                  onChange={(e) => setNBody(e.target.value.slice(0, 500))}
                  placeholder="Detalles adicionales que se mostrarán debajo del título."
                  className={textareaCls}
                />
              </Field>

              <Field label="Enlace (opcional)" help='Ej: "/biblioteca" o URL completa'>
                <input
                  type="text"
                  value={nLink}
                  onChange={(e) => setNLink(e.target.value.slice(0, 500))}
                  placeholder="/ruta o https://…"
                  className={inputCls}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Categoría">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {MSG_CATEGORIES.map((c) => {
                    const Icon = c.icon;
                    const active = mCategory === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setMCategory(c.value)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                          active ? "border-amber-500 bg-amber-500/5" : "border-border/60 hover:border-amber-500/30"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Prioridad">
                <div className="flex flex-wrap gap-1.5">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setMPriority(p.value)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        p.cls,
                        mPriority === p.value && "ring-2 ring-offset-1 ring-offset-background ring-current"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Remitente">
                <input
                  type="text"
                  value={mSender}
                  onChange={(e) => setMSender(e.target.value.slice(0, 100))}
                  placeholder="Equipo CharBook"
                  className={inputCls}
                />
              </Field>

              <Field label="Asunto" required counter={`${mSubject.length}/200`}>
                <input
                  type="text"
                  value={mSubject}
                  onChange={(e) => setMSubject(e.target.value.slice(0, 200))}
                  placeholder='Ej. "Concurso de microcuento de verano"'
                  className={inputCls}
                />
              </Field>

              <Field label="Cuerpo del mensaje" required help="Acepta saltos de línea. Sé claro y detallado.">
                <textarea
                  rows={10}
                  value={mBody}
                  onChange={(e) => setMBody(e.target.value)}
                  placeholder="Hola,&#10;&#10;Te escribimos para contarte que…"
                  className={cn(textareaCls, "font-serif leading-relaxed")}
                />
                <p className="mt-1 text-[10px] text-muted-foreground/70 text-right">
                  {mBody.length} caracteres
                </p>
              </Field>
            </>
          )}

          {/* Target */}
          <div className="border-t border-border/60 pt-4">
            <p className="mb-2 text-xs font-medium">Destinatarios</p>
            <div className="space-y-1.5">
              {TARGETS.map((t) => {
                const Icon = t.icon;
                const active = target === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setTarget(t.value);
                      if (t.value !== "user") {
                        setSelectedUser(null);
                        setUserQuery("");
                      }
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-primary/30"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-[11px] text-muted-foreground">{t.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ───── Picker de usuario ───── */}
            {target === "user" && (
              <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
                {selectedUser ? (
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={selectedUser.avatar ?? undefined} alt={selectedUser.name} />
                      <AvatarFallback className="bg-primary/20 text-xs text-primary">
                        {selectedUser.name?.[0]?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-green-500" />
                        {selectedUser.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {selectedUser.username ? `@${selectedUser.username}` : selectedUser.email}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => {
                        setSelectedUser(null);
                        setUserQuery("");
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        placeholder="Buscar por nombre, @usuario o email…"
                        className="h-9 w-full rounded-md border border-border/60 bg-background pl-8 pr-3 text-xs outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30"
                        autoFocus
                      />
                    </div>

                    {debouncedQuery.length < 2 && (
                      <p className="text-[10px] text-muted-foreground/70 px-1">
                        Escribe al menos 2 caracteres para buscar.
                      </p>
                    )}

                    {userSearch.isFetching && debouncedQuery.length >= 2 && (
                      <div className="flex items-center justify-center py-3 text-[11px] text-muted-foreground gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" /> Buscando…
                      </div>
                    )}

                    {!userSearch.isFetching && debouncedQuery.length >= 2 && userSearch.data && (
                      <div className="max-h-60 overflow-y-auto rounded-md border border-border/40 bg-background divide-y divide-border/40">
                        {userSearch.data.length === 0 ? (
                          <p className="p-3 text-[11px] text-muted-foreground text-center">
                            No se encontraron usuarios.
                          </p>
                        ) : (
                          userSearch.data.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => setSelectedUser(u)}
                              className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-accent transition-colors"
                            >
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={u.avatar ?? undefined} alt={u.name} />
                                <AvatarFallback className="bg-primary/15 text-[10px] text-primary">
                                  {u.name?.[0]?.toUpperCase() ?? "U"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate">{u.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {u.username ? `@${u.username}` : u.email}
                                </p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="border-t border-border/60 pt-4">
            <Button
              className="w-full"
              disabled={!isValid || notifMutation.isPending || msgMutation.isPending}
              onClick={() => {
                if (mode === "notification") notifMutation.mutate();
                else msgMutation.mutate();
              }}
            >
              {(notifMutation.isPending || msgMutation.isPending) ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-3.5 w-3.5" />
              )}
              {mode === "notification" ? "Enviar notificación" : "Enviar mensaje"}
            </Button>
            {!isValid && (
              <p className="mt-2 text-[11px] text-muted-foreground text-center">
                Completa los campos obligatorios para enviar.
              </p>
            )}
          </div>
        </Card>

        {/* ═══════ PREVIEW EN VIVO ═══════ */}
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Vista previa en vivo
          </p>

          {mode === "notification" ? (
            <Card className="border-border/60 bg-card p-4">
              <div className="flex items-start gap-2.5">
                <span className="text-xl mt-0.5">{nEmoji || "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {nTitle || "(Sin título)"}
                  </p>
                  {nBody && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
                      {nBody}
                    </p>
                  )}
                  <p className="mt-2 text-[10px] text-muted-foreground/60">
                    ahora · {nCategory}
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="border-border/60 bg-card p-5">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {(() => {
                  const c = MSG_CATEGORIES.find((c) => c.value === mCategory);
                  const Icon = c?.icon ?? Megaphone;
                  return (
                    <Badge variant="outline" className="gap-1">
                      <Icon className="h-3 w-3" />
                      {c?.label}
                    </Badge>
                  );
                })()}
                {mPriority !== "normal" && (
                  <Badge variant="outline" className={
                    PRIORITIES.find((p) => p.value === mPriority)?.cls
                  }>
                    {PRIORITIES.find((p) => p.value === mPriority)?.label}
                  </Badge>
                )}
              </div>
              <h3 className="font-serif text-lg font-bold leading-tight">
                {mSubject || "(Sin asunto)"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                De: <strong className="text-foreground/80">{mSender || "Equipo CharBook"}</strong> · ahora
              </p>
              <div className="mt-4 font-serif whitespace-pre-line text-sm leading-relaxed text-foreground/90 max-h-80 overflow-y-auto">
                {mBody || (
                  <span className="text-muted-foreground italic">
                    (Aquí aparecerá el cuerpo del mensaje)
                  </span>
                )}
              </div>
            </Card>
          )}

          {/* Resumen del envío */}
          <Card className="border-border/60 bg-card/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
              Resumen
            </p>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className="text-muted-foreground">Tipo:</dt>
              <dd>{mode === "notification" ? "Notificación" : "Mensaje"}</dd>
              <dt className="text-muted-foreground">Destinatarios:</dt>
              <dd>
                {target === "user"
                  ? selectedUser
                    ? selectedUser.name
                    : <span className="text-amber-500">Sin seleccionar</span>
                  : TARGETS.find((t) => t.value === target)?.label}
              </dd>
            </dl>
          </Card>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-500/90 flex gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <p>
              El envío es instantáneo y no se puede deshacer. Asegúrate de
              revisar el contenido antes de publicar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════ Primitives ═══════════════
const inputCls =
  "h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30";
const textareaCls =
  "w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30";

function Field({
  label, required, counter, help, children,
}: {
  label: string;
  required?: boolean;
  counter?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="text-xs font-medium">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
        {counter && (
          <span className="text-[10px] tabular-nums text-muted-foreground/70">
            {counter}
          </span>
        )}
      </div>
      {children}
      {help && (
        <p className="mt-1 text-[10px] text-muted-foreground/70">{help}</p>
      )}
    </div>
  );
}
