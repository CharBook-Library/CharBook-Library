"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckSquare, ChevronDown, ChevronLeft, ChevronRight, Download, Loader2, ScrollText,
  Search, ShieldAlert, Square, Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi, type AuditFilters, type AuditLogEntry } from "@/lib/api-admin";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const PURGE_OPTIONS = [
  { value: "30", label: "más de 30 días" },
  { value: "90", label: "más de 90 días" },
  { value: "180", label: "más de 180 días" },
  { value: "365", label: "más de 1 año" },
];

export default function AuditLogPage() {
  const { user, isLoading: loadingUser } = useAuth();
  const isSuperAdmin = !!user?.is_super_admin;
  const queryClient = useQueryClient();

  const [action, setAction] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [ipInput, setIpInput] = useState("");
  const [ip, setIp] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [purgeDays, setPurgeDays] = useState("90");
  const [exporting, setExporting] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setIp(ipInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, ipInput]);

  // Filtros activos, reutilizados por la lista y por la exportación.
  const activeFilters: AuditFilters = {
    action: action || undefined,
    search: search || undefined,
    ip: ip || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  // La selección solo tiene sentido dentro de la vista actual: si cambia la
  // página o cualquier filtro, se descarta durante el render (patrón React de
  // "ajustar estado al cambiar props/estado", sin efecto).
  const viewKey = `${page}|${action}|${search}|${ip}|${from}|${to}`;
  const [lastViewKey, setLastViewKey] = useState(viewKey);
  if (viewKey !== lastViewKey) {
    setLastViewKey(viewKey);
    setSelected(new Set());
  }

  const { data: actions } = useQuery({
    queryKey: ["audit-actions"],
    queryFn: () => adminApi.audit.actions(),
    enabled: isSuperAdmin,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", { action, search, ip, from, to, page }],
    queryFn: () => adminApi.audit.list({ ...activeFilters, page }),
    enabled: isSuperAdmin,
  });

  const refreshLogs = () => {
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    queryClient.invalidateQueries({ queryKey: ["audit-actions"] });
  };

  const runExport = async (format: "csv" | "json") => {
    setExporting(true);
    try {
      await adminApi.audit.export(format, activeFilters);
      toast.success(`Auditoría exportada (${format.toUpperCase()}).`);
    } catch {
      toast.error("No se pudo exportar la auditoría");
    } finally {
      setExporting(false);
    }
  };

  const deleteSelectedMutation = useMutation({
    mutationFn: (ids: number[]) => adminApi.audit.deleteSelected(ids),
    onSuccess: (res) => { toast.success(res.message); refreshLogs(); },
    onError: () => toast.error("No se pudieron eliminar las entradas"),
  });

  const purgeMutation = useMutation({
    mutationFn: (days: number) => adminApi.audit.purgeOlderThan(days),
    onSuccess: (res) => { toast.success(res.message); refreshLogs(); },
    onError: () => toast.error("No se pudo purgar la auditoría"),
  });

  const deleteAllMutation = useMutation({
    mutationFn: ({ reason, password }: { reason: string; password: string }) =>
      adminApi.audit.deleteAll(reason, password),
    onSuccess: (res) => {
      toast.success(res.message);
      setShowDeleteAll(false);
      refreshLogs();
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })
          ?.response?.data;
      toast.error(
        msg?.errors?.password?.[0] ??
        msg?.message ??
        "No se pudo vaciar la auditoría"
      );
    },
  });

  if (!loadingUser && user && !isSuperAdmin) {
    return (
      <div className="p-6 md:p-8">
        <Card className="border-destructive/30 bg-destructive/5 p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive/60" />
          <h1 className="font-serif text-xl font-bold">Solo Super Admin</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            La auditoría administrativa está restringida al super administrador.
          </p>
        </Card>
      </div>
    );
  }

  const logs = data?.data ?? [];
  const allOnPageSelected = logs.length > 0 && logs.every((l) => selected.has(l.id));
  const busy =
    deleteSelectedMutation.isPending || purgeMutation.isPending || deleteAllMutation.isPending;

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) logs.forEach((l) => next.delete(l.id));
      else logs.forEach((l) => next.add(l.id));
      return next;
    });
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" />
          <h1 className="font-serif text-2xl font-bold tracking-tight">Auditoría</h1>
          {data && (
            <span className="text-xs text-muted-foreground tabular-nums">
              · {data.meta.total} registros
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Registro de acciones administrativas: quién hizo qué, cuándo, desde
          dónde y por qué. No almacena contraseñas ni secretos, y cada limpieza
          del registro queda a su vez auditada.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por entidad, motivo o acción…"
            className="h-9 w-full rounded-md border border-border/60 bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary/50"
          />
        </div>
        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className="h-9 rounded-md border border-border/60 bg-card px-2.5 text-xs"
          aria-label="Filtrar por acción"
        >
          <option value="">Todas las acciones</option>
          {actions?.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <input
          value={ipInput}
          onChange={(e) => setIpInput(e.target.value)}
          placeholder="IP…"
          className="h-9 w-28 rounded-md border border-border/60 bg-card px-2.5 text-xs outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary/50"
          aria-label="Filtrar por IP"
        />
        <input
          type="date" value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(1); }}
          className="h-9 rounded-md border border-border/60 bg-card px-2.5 text-xs"
          aria-label="Desde"
        />
        <input
          type="date" value={to}
          onChange={(e) => { setTo(e.target.value); setPage(1); }}
          className="h-9 rounded-md border border-border/60 bg-card px-2.5 text-xs"
          aria-label="Hasta"
        />

        {/* Exportar el resultado FILTRADO (para conservar antes de purgar) */}
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" disabled={exporting || logs.length === 0} onClick={() => runExport("csv")}>
            {exporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
            CSV
          </Button>
          <Button variant="outline" size="sm" disabled={exporting || logs.length === 0} onClick={() => runExport("json")}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            JSON
          </Button>
        </div>
      </div>

      {/* Mantenimiento: selección + purga + vaciado (todo re-auditado) */}
      {logs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2">
          <Button variant="outline" size="sm" onClick={toggleAllOnPage} disabled={busy}>
            {allOnPageSelected ? (
              <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Square className="mr-1.5 h-3.5 w-3.5" />
            )}
            {allOnPageSelected ? "Quitar selección" : "Seleccionar página"}
          </Button>

          {selected.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (confirm(`¿Eliminar ${selected.size} entrada(s) de auditoría seleccionadas? Esta acción quedará registrada.`)) {
                  deleteSelectedMutation.mutate([...selected]);
                }
              }}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Eliminar ({selected.size})
            </Button>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              value={purgeDays}
              onChange={(e) => setPurgeDays(e.target.value)}
              className="h-8 rounded-md border border-border/60 bg-card px-2 text-xs"
              aria-label="Antigüedad a purgar"
            >
              {PURGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                const label = PURGE_OPTIONS.find((o) => o.value === purgeDays)?.label ?? purgeDays;
                if (confirm(`¿Purgar las entradas con ${label}? Las recientes se conservan.`)) {
                  purgeMutation.mutate(Number(purgeDays));
                }
              }}
            >
              Purgar antiguas
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteAll(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Eliminar todo
            </Button>
          </div>
        </div>
      )}

      {showDeleteAll && (
        <DeleteAllDialog
          total={data?.meta.total ?? 0}
          pending={deleteAllMutation.isPending}
          onCancel={() => setShowDeleteAll(false)}
          onConfirm={(reason, password) => deleteAllMutation.mutate({ reason, password })}
        />
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-card/40 py-16 text-center">
          <ScrollText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search || action || from || to
              ? "Ningún registro coincide con los filtros."
              : "Aún no hay acciones registradas. A partir de ahora, cada acción administrativa sensible quedará aquí."}
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card divide-y divide-border/60">
          {logs.map((log) => (
            <AuditRow
              key={log.id}
              log={log}
              selected={selected.has(log.id)}
              onToggle={() => toggleOne(log.id)}
            />
          ))}
        </div>
      )}

      {/* Paginación */}
      {data && data.meta.last_page > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="px-3 text-muted-foreground">
            Página {data.meta.current_page} de {data.meta.last_page}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.meta.last_page} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Diálogo del vaciado total: la acción más destructiva. Exige frase escrita
// exacta + motivo (mín. 10) + contraseña (el backend la valida si la cuenta
// tiene una). Es la doble confirmación clara que exige la política.
const CONFIRM_PHRASE = "ELIMINAR AUDITORIA";

function DeleteAllDialog({
  total,
  pending,
  onCancel,
  onConfirm,
}: {
  total: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string, password: string) => void;
}) {
  const [phrase, setPhrase] = useState("");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");

  const phraseOk = phrase.trim().toUpperCase() === CONFIRM_PHRASE;
  const reasonOk = reason.trim().length >= 10;
  const canSubmit = phraseOk && reasonOk && !pending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <Card className="w-full max-w-md border-destructive/40 bg-card p-5">
        <div className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-5 w-5" />
          <h2 className="font-serif text-lg font-bold">Vaciar todo el registro</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Se eliminarán las <b className="tabular-nums">{total}</b> entradas de auditoría.
          Esta acción <b>no se puede deshacer</b>. Considera exportar (CSV/JSON) antes.
          El vaciado quedará registrado con tu motivo.
        </p>

        <label className="mt-4 block text-xs font-medium text-muted-foreground">
          Escribe <span className="font-mono text-destructive">{CONFIRM_PHRASE}</span> para confirmar
        </label>
        <input
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          autoFocus
          className="mt-1 h-9 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus-visible:border-destructive/60"
        />

        <label className="mt-3 block text-xs font-medium text-muted-foreground">Motivo (obligatorio, mín. 10 caracteres)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Ej.: Limpieza trimestral aprobada por dirección"
          className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary/50"
        />

        <label className="mt-3 block text-xs font-medium text-muted-foreground">
          Contraseña actual <span className="text-muted-foreground/60">(si tu cuenta usa contraseña)</span>
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mt-1 h-9 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus-visible:border-primary/50"
        />

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={pending}>Cancelar</Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={!canSubmit}
            onClick={() => onConfirm(reason.trim(), password)}
          >
            {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
            Vaciar definitivamente
          </Button>
        </div>
      </Card>
    </div>
  );
}

const ACTION_COLORS: Record<string, string> = {
  "work.": "bg-primary/15 text-primary",
  "report.": "bg-rose-500/15 text-rose-500",
  "user.": "bg-blue-500/15 text-blue-400",
  "system.": "bg-amber-500/15 text-amber-500",
};

function actionColor(action: string): string {
  for (const [prefix, cls] of Object.entries(ACTION_COLORS)) {
    if (action.startsWith(prefix)) return cls;
  }
  return "bg-muted text-muted-foreground";
}

function AuditRow({
  log,
  selected,
  onToggle,
}: {
  log: AuditLogEntry;
  selected: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasDetails = !!(log.changes || log.reason);

  return (
    <div className={cn("px-4 py-2.5", selected && "bg-destructive/5")}>
      <div className="flex w-full items-center gap-3">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-primary"
        aria-label={`Seleccionar entrada ${log.action}`}
      />
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={cn("flex min-w-0 flex-1 items-center gap-3 text-left", hasDetails && "cursor-pointer")}
        aria-expanded={open}
      >
        {/* Admin */}
        <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-border/50 bg-muted">
          {log.admin?.avatar ? (
            <Image src={log.admin.avatar} alt={log.admin.name} fill sizes="28px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-muted-foreground">
              {log.admin?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-xs font-medium">{log.admin?.name ?? "(cuenta eliminada)"}</span>
            <span className={cn("rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold", actionColor(log.action))}>
              {log.action}
            </span>
            {log.entity_label && (
              <span className="truncate text-xs text-muted-foreground">
                → {log.entity_label}
              </span>
            )}
          </div>
          {log.reason && !open && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80 italic">
              “{log.reason}”
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {new Date(log.created_at).toLocaleString("es", {
              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </p>
          {log.ip && <p className="text-[9px] text-muted-foreground/60 font-mono">{log.ip}</p>}
        </div>

        {hasDetails && (
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform", open && "rotate-180")} />
        )}
      </button>
      </div>

      {open && hasDetails && (
        <div className="ml-10 mt-2 space-y-2 rounded-md border border-border/50 bg-background/60 p-3 text-xs">
          {log.reason && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Motivo</p>
              <p className="mt-0.5 whitespace-pre-line text-foreground/90">{log.reason}</p>
            </div>
          )}
          {log.changes?.before && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Antes</p>
              <pre className="mt-0.5 overflow-x-auto rounded bg-muted/40 p-2 font-mono text-[10px] leading-relaxed">
                {JSON.stringify(log.changes.before, null, 2)}
              </pre>
            </div>
          )}
          {log.changes?.after && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Después</p>
              <pre className="mt-0.5 overflow-x-auto rounded bg-muted/40 p-2 font-mono text-[10px] leading-relaxed">
                {JSON.stringify(log.changes.after, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
