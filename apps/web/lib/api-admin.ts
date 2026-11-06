"use client";

import { apiClient } from "./api-client";
import type {
  ApiPaginated,
  ApiResource,
  Author,
  BookDetail,
  BookListItem,
  Category,
} from "./types";

/** Metadata devuelta por /api/admin/books/lookup */
export interface BookMetadata {
  title: string | null;
  subtitle: string | null;
  description: string | null;
  authors: string[];
  publisher: string | null;
  publication_year: number | null;
  pages: number | null;
  language: string | null;
  isbn_10: string | null;
  isbn_13: string | null;
  google_books_id: string | null;
  open_library_id: string | null;
  cover_url: string | null;
  author_id?: number;
  author_name?: string;
  author_was_created?: boolean;
}

export interface AdminStats {
  books_total: number;
  books_published: number;
  books_free: number;
  books_premium: number;
  authors_total: number;
  categories_total: number;
  users_total: number;
  total_views: number;
  total_downloads: number;
}

// ===== Centro de alertas administrativas (persistente) =====

export type AlertSeverity = "critical" | "high" | "medium" | "low";
export type AlertStatus = "new" | "acknowledged" | "resolved";

export interface AdminAlert {
  id: number;
  code: string;
  severity: AlertSeverity;
  service: string;
  title: string;
  message: string;
  recommended_action: string | null;
  status: AlertStatus;
  source: "health" | "security" | "manual";
  occurrences: number;
  context: Record<string, unknown> | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  acknowledged_by: { id: number; name: string } | null;
}

export interface AlertSummary {
  open: number;
  new: number;
  critical_open: number;
  high_open: number;
}

// ===== Dashboard ejecutivo (centro de control) =====

export interface DashboardSummary {
  system: {
    status: "ok" | "warning" | "degraded" | "critical" | "unknown";
    components: Record<string, string>;
    active_alerts: number;
    critical_alerts: number;
  };
  users: {
    total: number;
    online_now: number;
    new_today: number;
    new_7d: number;
    new_30d: number;
    suspended: number;
  };
  content: {
    books_total: number;
    books_published: number;
    books_pending_review: number;
    authors_total: number;
    categories_total: number;
  };
  moderation: {
    reports_open: number;
    creator_applications_pending: number;
    works_pending_review: number;
  };
  monetization: {
    active_subscriptions: number;
    past_due_subscriptions: number;
    revenue_today_usd: number;
    revenue_30d_usd: number;
    payouts_pending: number;
    payouts_failed: number;
  };
  engagement: {
    views_total: number;
    downloads_total: number;
    reads_valid_7d: number;
  };
  trends: {
    new_users_by_day: { date: string; count: number }[];
    revenue_by_day: { date: string; amount: number }[];
  };
  recent_admin_actions: {
    action: string;
    entity_type: string | null;
    entity_label: string | null;
    admin_name: string | null;
    created_at: string;
  }[];
  generated_at: string;
}

// ===== Salud del sistema (solo super admin) =====

export type HealthLevel = "ok" | "warning" | "degraded" | "critical";

export interface RequestDayStats {
  total: number;
  errors_4xx: number;
  errors_5xx: number;
  error_rate_pct: number;
  avg_ms: number | null;
  p95_ms: number | null;
  p99_ms: number | null;
}

export interface DayCount {
  date: string;
  count: number;
}

export type FileIssueType =
  | "archivo_faltante"
  | "epub_invalido"
  | "pdf_ilegible"
  | "portada_faltante"
  | "publicado_sin_archivo";

export interface FileIssue {
  id: number;
  title: string;
  slug: string;
  is_creator_work: boolean;
  type: FileIssueType;
  detail: string | null;
}

export interface SystemAlert {
  id: string;
  code: string;
  severity: "critical" | "warning";
  service: string;
  message: string;
  link: string | null;
  first_seen: string | null;
  last_seen: string;
  acked: boolean;
}

export interface QueueHealth {
  driver: string;
  status: HealthLevel;
  status_reason: string | null;
  pending_ready: number | null;
  delayed: number | null;
  processing: number | null;
  failed: number;
  max_attempts_pending: number | null;
  oldest_ready_seconds: number | null;
  worker: {
    active: boolean;
    last_heartbeat: string | null;
    seconds_since_heartbeat: number | null;
  };
  error?: string;
}

export interface QueueJobItem {
  id: number;
  queue: string;
  name: string;
  attempts: number;
  age_seconds: number;
  available_in_seconds: number;
  reserved: boolean;
}

export interface FailedJobItem {
  id: number;
  uuid: string;
  connection: string;
  queue: string;
  exception: string;
  failed_at: string;
}

export interface SystemHealth {
  overall: {
    status: HealthLevel;
    components: Record<string, string>;
    active_alerts: number;
  };
  api: {
    ok: boolean;
    laravel: string;
    php: string;
    environment: string;
    debug: boolean;
    db: {
      ok: boolean;
      driver: string;
      latency_ms: number | null;
      active_connections: number | null;
      checked_at: string;
      error?: string;
    };
    cache: { ok: boolean; driver: string; latency_ms: number | null; error?: string };
    storage: { ok: boolean; disk: string; error?: string };
    disk: {
      status: "ok" | "warning" | "critical";
      free_gb: number | null;
      total_gb: number | null;
      used_pct: number | null;
      path: string;
      warning_pct: number;
      critical_pct: number;
    };
    redis?: {
      required: boolean;
      ok: boolean | null;
      latency_ms: number | null;
      info?: {
        used_memory_mb: number | null;
        max_memory_mb: number | null;
        memory_used_pct: number | null;
        hit_rate_pct: number | null;
        evicted_keys: number;
      } | null;
    };
  };
  postgres:
    | { supported: false; driver?: string; error?: string }
    | {
        supported: true;
        driver: "pgsql";
        status: "ok" | "warning" | "critical";
        connections: {
          used: number | null;
          max: number | null;
          used_pct: number | null;
          status: "ok" | "warning" | "critical";
        };
        size: { bytes: number | null; pretty: string | null };
        cache_hit_ratio: number | null;
        index_hit_ratio: number | null;
        deadlocks: number | null;
        rollback_ratio: number | null;
        slow_active_queries: number | null;
        largest_tables: { name: string; bytes: number; pretty: string }[];
      };
  host: {
    cpu: {
      available: boolean;
      cores: number;
      load_1m: number | null;
      load_per_core_pct: number | null;
      status: "ok" | "warning" | "critical";
    };
    memory: {
      available: boolean;
      scope?: "host" | "process";
      total_mb: number | null;
      available_mb: number | null;
      used_pct: number | null;
      process_usage_mb?: number;
      status: "ok" | "warning" | "critical";
    };
  };
  backups: {
    configured: boolean;
    status: "ok" | "warning" | "critical" | "not_configured";
    last_at: string | null;
    last_result: "ok" | "failed" | null;
    files?: number | null;
    bytes?: number | null;
    age_hours: number | null;
    stale_hours?: number;
  };
  queue: QueueHealth;
  stripe: {
    configured: boolean;
    mode: "live" | "test" | null;
    webhook_configured: boolean;
    ping: { ok: boolean; latency_ms?: number; error?: string } | null;
    checked_at: string;
  };
  meilisearch: {
    configured: boolean;
    ok: boolean;
    latency_ms: number | null;
    documents: number | null;
    indexes: number | null;
    tasks_pending: number | null;
    checked_at: string;
    error?: string;
  } | null;
  services: {
    key: string;
    label: string;
    status: "ok" | "critical" | "configured" | "unknown";
    detail: string | null;
  }[];
  errors: {
    log_exists: boolean;
    size_mb: number;
    recent: { timestamp: string; level: string; message: string }[];
  };
  failed_jobs: { total: number; jobs: FailedJobItem[]; error?: string };
  requests: {
    today: RequestDayStats;
    yesterday: RequestDayStats;
    by_day: { date: string; total: number; errors: number }[];
    last_5xx: { time: string; method: string; path: string; status: number }[];
    slow_requests: { time: string; method: string; path: string; ms: number; status: number }[];
    slow_threshold_ms: number;
  };
  active_users: {
    online_now: number;
    last_24h: number;
    new_this_week: number;
    total: number;
  };
  presence: {
    online_count: number;
    guests_online: number;
    online_users: {
      id: number;
      name: string;
      username: string | null;
      avatar: string | null;
      last_seen_at: string;
    }[];
  };
  files:
    | { scanned: false }
    | {
        scanned: true;
        scanned_at: string;
        duration_ms: number;
        checked_books: number;
        checked_files: number;
        issues: FileIssue[];
        issues_total: number;
        counts_by_type: Record<FileIssueType, number>;
        storage_breakdown: Record<string, number>;
      };
  charts: {
    new_users_by_day: DayCount[];
    reader_activity_by_day: DayCount[];
    errors_by_day: DayCount[];
  };
  alerts: SystemAlert[];
  generated_at: string;
}

export interface QueueDetail {
  status: QueueHealth;
  ready: QueueJobItem[];
  delayed: QueueJobItem[];
  processing: QueueJobItem[];
  failed: { total: number; jobs: FailedJobItem[] };
  generated_at: string;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  entity_label: string | null;
  reason: string | null;
  changes: { before: Record<string, unknown> | null; after: Record<string, unknown> | null } | null;
  ip: string | null;
  created_at: string;
  admin: {
    id: number;
    name: string;
    username: string | null;
    avatar: string | null;
  } | null;
}

export interface AuditFilters {
  action?: string;
  admin_id?: number;
  admin_email?: string;
  entity_type?: string;
  entity_id?: number;
  ip?: string;
  search?: string;
  from?: string;
  to?: string;
  sort?: "asc" | "desc";
}

export const adminApi = {
  stats: () =>
    apiClient.get<AdminStats>("/admin/stats").then((r) => r.data),

  alerts: {
    list: (params?: { status?: string; severity?: string; service?: string; page?: number }) =>
      apiClient
        .get<{ data: AdminAlert[]; meta: { current_page: number; last_page: number; total: number } }>(
          "/admin/alerts",
          { params }
        )
        .then((r) => r.data),

    summary: () =>
      apiClient.get<{ data: AlertSummary }>("/admin/alerts/summary").then((r) => r.data.data),

    acknowledge: (id: number) =>
      apiClient
        .post<{ message: string; data: AdminAlert }>(`/admin/alerts/${id}/acknowledge`)
        .then((r) => r.data),

    resolve: (id: number) =>
      apiClient
        .post<{ message: string; data: AdminAlert }>(`/admin/alerts/${id}/resolve`)
        .then((r) => r.data),
  },

  dashboard: () =>
    apiClient
      .get<{ data: DashboardSummary }>("/admin/dashboard")
      .then((r) => r.data.data),

  system: {
    health: () =>
      apiClient
        .get<{ data: SystemHealth }>("/admin/system/health")
        .then((r) => r.data.data),

    retryJob: (uuid?: string) =>
      apiClient
        .post<{ message: string; output: string }>(
          "/admin/system/failed-jobs/retry",
          uuid ? { uuid } : {}
        )
        .then((r) => r.data),

    forgetJob: (uuid: string) =>
      apiClient
        .delete<{ message: string }>(`/admin/system/failed-jobs/${uuid}`)
        .then((r) => r.data),

    flushJobs: () =>
      apiClient
        .delete<{ message: string }>("/admin/system/failed-jobs")
        .then((r) => r.data),

    clearLogs: () =>
      apiClient
        .post<{ message: string }>("/admin/system/logs/clear")
        .then((r) => r.data),

    clearMetrics: () =>
      apiClient
        .post<{ message: string }>("/admin/system/metrics/clear")
        .then((r) => r.data),

    runFileScan: () =>
      apiClient
        .post<{ data: unknown; message: string }>("/admin/system/file-scan")
        .then((r) => r.data),

    ackAlert: (id: string, acked: boolean) =>
      apiClient
        .post<{ message: string }>("/admin/system/alerts/ack", { id, acked })
        .then((r) => r.data),

    queueDetail: () =>
      apiClient
        .get<{ data: QueueDetail }>("/admin/system/queue")
        .then((r) => r.data.data),

    cancelPendingJob: (id: number) =>
      apiClient
        .delete<{ message: string }>(`/admin/system/queue/pending/${id}`)
        .then((r) => r.data),
  },

  audit: {
    list: (params?: AuditFilters & { page?: number }) =>
      apiClient
        .get<{
          data: AuditLogEntry[];
          meta: { current_page: number; last_page: number; total: number };
        }>("/admin/audit-logs", { params })
        .then((r) => r.data),

    actions: () =>
      apiClient
        .get<{ data: string[] }>("/admin/audit-logs/actions")
        .then((r) => r.data.data),

    /** Descarga el registro FILTRADO como CSV o JSON (respeta los filtros activos). */
    export: async (format: "csv" | "json", filters?: AuditFilters) => {
      const res = await apiClient.get("/admin/audit-logs/export", {
        params: { ...filters, format },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "");
      a.download = `auditoria_${stamp}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },

    deleteSelected: (ids: number[], reason?: string) =>
      apiClient
        .delete<{ message: string; deleted: number }>("/admin/audit-logs", {
          data: { ids, reason },
        })
        .then((r) => r.data),

    purgeOlderThan: (days: number, reason?: string) =>
      apiClient
        .delete<{ message: string; deleted: number }>(
          `/admin/audit-logs/older-than/${days}`,
          { data: { reason } }
        )
        .then((r) => r.data),

    /** Vaciado total: exige motivo y reautenticación (contraseña) en el backend. */
    deleteAll: (reason: string, password: string) =>
      apiClient
        .delete<{ message: string; deleted: number }>("/admin/audit-logs/all", {
          data: { confirm: "ELIMINAR_AUDITORIA", reason, password },
        })
        .then((r) => r.data),
  },

  books: {
    list: (params?: { search?: string; page?: number; per_page?: number }) =>
      apiClient
        .get<ApiPaginated<BookListItem>>("/admin/books", { params })
        .then((r) => r.data),

    create: (data: FormData) =>
      apiClient
        .post<ApiResource<BookDetail>>("/admin/books", data, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data.data),

    update: (slug: string, data: FormData) => {
      // Laravel necesita method spoofing para PUT/PATCH multipart
      data.append("_method", "PUT");
      return apiClient
        .post<ApiResource<BookDetail>>(`/admin/books/${slug}`, data, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data.data);
    },

    delete: (slug: string) =>
      apiClient.delete(`/admin/books/${slug}`).then((r) => r.data),
  },

  /**
   * Lookup de metadata externa (Google Books + Open Library).
   * Auto-crea el autor si no existe. Devuelve metadata lista para llenar el form.
   */
  lookup: (input: { isbn?: string; title?: string; author?: string }) =>
    apiClient
      .post<{ data: BookMetadata }>("/admin/books/lookup", input)
      .then((r) => r.data.data),

  authors: {
    create: (data: Partial<Author>) =>
      apiClient
        .post<ApiResource<Author>>("/admin/authors", data)
        .then((r) => r.data.data),

    update: (slug: string, data: Partial<Author>) =>
      apiClient
        .patch<ApiResource<Author>>(`/admin/authors/${slug}`, data)
        .then((r) => r.data.data),

    delete: (slug: string) =>
      apiClient.delete(`/admin/authors/${slug}`).then((r) => r.data),
  },

  // ===== Affiliate Links =====
  affiliateLinks: {
    list: (bookSlug: string) =>
      apiClient
        .get<{ data: import("./types").AffiliateLink[] }>(
          `/admin/books/${bookSlug}/affiliate-links`
        )
        .then((r) => r.data.data),

    create: (
      bookSlug: string,
      data: {
        vendor: string;
        url: string;
        label?: string | null;
        position?: number;
        is_active?: boolean;
      }
    ) =>
      apiClient
        .post<{ data: import("./types").AffiliateLink }>(
          `/admin/books/${bookSlug}/affiliate-links`,
          data
        )
        .then((r) => r.data.data),

    update: (
      id: number,
      data: Partial<{
        vendor: string;
        url: string;
        label: string | null;
        position: number;
        is_active: boolean;
      }>
    ) =>
      apiClient
        .patch<{ data: import("./types").AffiliateLink }>(
          `/admin/affiliate-links/${id}`,
          data
        )
        .then((r) => r.data.data),

    delete: (id: number) =>
      apiClient.delete(`/admin/affiliate-links/${id}`).then((r) => r.data),
  },

  categories: {
    create: (data: Partial<Category>) =>
      apiClient
        .post<ApiResource<Category>>("/admin/categories", data)
        .then((r) => r.data.data),

    update: (slug: string, data: Partial<Category>) =>
      apiClient
        .patch<ApiResource<Category>>(`/admin/categories/${slug}`, data)
        .then((r) => r.data.data),

    delete: (slug: string) =>
      apiClient.delete(`/admin/categories/${slug}`).then((r) => r.data),
  },
};
