"use client";

import { apiClient } from "./api-client";
import type {
  ApiCollection,
  ApiPaginated,
  ApiResource,
  CanApplyResponse,
  AdminUploadedWork,
  AdminWorkAction,
  AdminWorkEditInput,
  Chapter,
  ChapterImport,
  ComicPage,
  CreateWorkInput,
  CreatorApplication,
  CreatorWidget,
  CreatorWidgetType,
  Language,
  MyWork,
  Report,
  ReportReason,
  ReportTargetType,
  WorkSubmissionStatus,
} from "./types";

// ============ Languages (público) ============
export const languagesApi = {
  list: () =>
    apiClient
      .get<ApiCollection<Language>>("/languages")
      .then((r) => r.data.data),
};

// ============ Creator (user-facing) ============
export interface CreatorAppInput {
  display_name: string;
  pen_name?: string | null;
  bio_long: string;
  sample_url: string;
  genres: string[];
  languages: string[];
  why_join: string;
  social_links?: Record<string, string> | null;
  publish_frequency?: "weekly" | "biweekly" | "monthly" | "irregular" | null;
  publish_plan?: string | null;
}

export const creatorApi = {
  canApply: () =>
    apiClient
      .get<CanApplyResponse>("/me/can-apply-creator")
      .then((r) => r.data),

  mine: () =>
    apiClient
      .get<{ data: CreatorApplication | null }>("/me/creator-application")
      .then((r) => r.data.data),

  submit: (input: CreatorAppInput) =>
    apiClient
      .post<ApiResource<CreatorApplication>>("/me/creator-application", input)
      .then((r) => r.data.data),

  update: (input: Partial<CreatorAppInput>) =>
    apiClient
      .patch<ApiResource<CreatorApplication>>("/me/creator-application", input)
      .then((r) => r.data.data),
};

// ============ Creator Widgets (secciones del perfil de creador) ============
export interface CreatorWidgetInput {
  type: CreatorWidgetType;
  title: string;
  body?: string | null;
  url?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  book_id?: number | null;
  category_id?: number | null;
  is_published?: boolean;
  position?: number;
}

export const widgetsApi = {
  mine: () =>
    apiClient
      .get<ApiCollection<CreatorWidget>>("/me/widgets")
      .then((r) => r.data.data),

  create: (input: CreatorWidgetInput) =>
    apiClient
      .post<ApiResource<CreatorWidget>>("/me/widgets", input)
      .then((r) => r.data.data),

  update: (id: number, input: Partial<CreatorWidgetInput>) =>
    apiClient
      .patch<ApiResource<CreatorWidget>>(`/me/widgets/${id}`, input)
      .then((r) => r.data.data),

  remove: (id: number) =>
    apiClient
      .delete(`/me/widgets/${id}`)
      .then((r) => r.data),
};

// ============ Mis Obras (autoservicio del creador) ============
export const worksApi = {
  mine: (status?: "draft" | "review" | "published" | "all", page = 1) =>
    apiClient
      .get<ApiPaginated<MyWork>>("/me/works", {
        params: { status, page },
      })
      .then((r) => r.data),

  get: (id: number) =>
    apiClient
      .get<{ data: MyWork & Record<string, unknown> }>(`/me/works/${id}`)
      .then((r) => r.data.data),

  create: (input: CreateWorkInput) =>
    apiClient
      .post<ApiResource<MyWork>>("/me/works", input)
      .then((r) => r.data.data),

    update: (
      id: number,
      input: Partial<CreateWorkInput> & { submission_status?: WorkSubmissionStatus }
    ) =>
    apiClient
      .patch<ApiResource<MyWork>>(`/me/works/${id}`, input)
      .then((r) => r.data.data),

  remove: (id: number) =>
    apiClient.delete(`/me/works/${id}`).then((r) => r.data),
};

// ============ Archivo principal (libro_completo) ============
export const bookFileApi = {
  upload: (workId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    // Sin Content-Type manual: el navegador añade el boundary del multipart.
    return apiClient
      .post<{ data: Record<string, unknown>; message: string }>(`/me/works/${workId}/file`, fd)
      .then((r) => r.data);
  },
  remove: (workId: number) =>
    apiClient.delete(`/me/works/${workId}/file`).then((r) => r.data),
};

// ============ Capítulos (serie) ============
export const chaptersApi = {
  list: (workId: number) =>
    apiClient
      .get<{ data: Chapter[] }>(`/me/works/${workId}/chapters`)
      .then((r) => r.data.data),

  create: (
    workId: number,
    input: { title: string; body?: string | null; author_note?: string | null }
  ) =>
    apiClient
      .post<{ data: Chapter }>(`/me/works/${workId}/chapters`, input)
      .then((r) => r.data.data),

  update: (
    chapterId: number,
    input: Partial<{
      title: string;
      body: string | null;
      author_note: string | null;
      number: number;
      is_published: boolean;
      schedule_at: string | null;
    }>
  ) =>
    apiClient
      .patch<{ data: Chapter }>(`/me/chapters/${chapterId}`, input)
      .then((r) => r.data.data),

  remove: (chapterId: number) =>
    apiClient.delete(`/me/chapters/${chapterId}`).then((r) => r.data),

  duplicate: (chapterId: number) =>
    apiClient
      .post<{ data: Chapter }>(`/me/chapters/${chapterId}/duplicate`)
      .then((r) => r.data.data),

  reorder: (workId: number, order: number[]) =>
    apiClient
      .post(`/me/works/${workId}/chapters/reorder`, { order })
      .then((r) => r.data),

  uploadFile: (chapterId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    // OJO: sin Content-Type manual — el navegador debe añadir el boundary
    // del multipart; fijarlo a mano hace que Laravel no parsee el archivo.
    return apiClient
      .post<{ data: Chapter }>(`/me/chapters/${chapterId}/file`, fd)
      .then((r) => r.data.data);
  },

  /** Portada/miniatura del episodio (se ve en la tira de episodios del lector). */
  uploadCover: (chapterId: number, file: File) => {
    const fd = new FormData();
    fd.append("cover", file);
    return apiClient
      .post<{ data: Chapter }>(`/me/chapters/${chapterId}/cover`, fd)
      .then((r) => r.data.data);
  },
};

// ============ Importador de libros (EPUB/DOCX/TXT → capítulos) ============
export const importsApi = {
  /** Sube el archivo e inicia el análisis (devuelve la sesión de importación). */
  start: (workId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    // El análisis corre dentro del request (síncrono) — timeout amplio (5 min)
    // para EPUBs grandes, pero NO infinito: si cuelga, el modal muestra error.
    return apiClient
      .post<{ data: ChapterImport }>(`/me/works/${workId}/imports`, fd, { timeout: 300000 })
      .then((r) => r.data.data);
  },

  /** Estado + vista previa (polling). */
  status: (workId: number, importId: number) =>
    apiClient
      .get<{ data: ChapterImport }>(`/me/works/${workId}/imports/${importId}`)
      .then((r) => r.data.data),

  /** Confirma y crea los capítulos (síncrono → timeout amplio). */
  confirm: (importId: number, publish: boolean) =>
    apiClient
      .post<{ data: ChapterImport }>(`/me/imports/${importId}/confirm`, { publish }, { timeout: 300000 })
      .then((r) => r.data.data),

  /** Cancela / elimina la sesión de importación. */
  remove: (importId: number) =>
    apiClient.delete(`/me/imports/${importId}`).then((r) => r.data),
};

// ============ Páginas de cómic ============
export const comicPagesApi = {
  list: (workId: number) =>
    apiClient
      .get<{ data: ComicPage[] }>(`/me/works/${workId}/pages`)
      .then((r) => r.data.data),

  upload: (workId: number, files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files[]", f));
    return apiClient
      .post<{ data: ComicPage[]; message: string }>(
        `/me/works/${workId}/pages`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      .then((r) => r.data);
  },

  /** Importa páginas desde un EPUB de imágenes (extrae las imágenes en orden). */
  importFile: (workId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiClient
      .post<{ data: ComicPage[]; message: string }>(
        `/me/works/${workId}/pages/import`,
        fd,
        { timeout: 300000 },
      )
      .then((r) => r.data);
  },

  remove: (pageId: number) =>
    apiClient.delete(`/me/pages/${pageId}`).then((r) => r.data),

  reorder: (workId: number, order: number[]) =>
    apiClient
      .post(`/me/works/${workId}/pages/reorder`, { order })
      .then((r) => r.data),

  // ----- Páginas por capítulo (serie de cómic / webtoon) -----
  chapterList: (chapterId: number) =>
    apiClient
      .get<{ data: ComicPage[] }>(`/me/chapters/${chapterId}/pages`)
      .then((r) => r.data.data),

  chapterUpload: (chapterId: number, files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files[]", f));
    return apiClient
      .post<{ data: ComicPage[]; message: string }>(
        `/me/chapters/${chapterId}/pages`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      .then((r) => r.data);
  },

  chapterImport: (chapterId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiClient
      .post<{ data: ComicPage[]; message: string }>(
        `/me/chapters/${chapterId}/pages/import`,
        fd,
        { timeout: 300000 },
      )
      .then((r) => r.data);
  },

  chapterReorder: (chapterId: number, order: number[]) =>
    apiClient
      .post(`/me/chapters/${chapterId}/pages/reorder`, { order })
      .then((r) => r.data),

  /** Auto-detecta capítulos desde un ZIP/CBZ (carpeta = capítulo). */
  importComicSeries: (workId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiClient
      .post<{ data: { id: number; title: string; pages: number }[]; message: string }>(
        `/me/works/${workId}/chapters/import-comic`,
        fd,
        { timeout: 600000 },
      )
      .then((r) => r.data);
  },
};

// ============ Reports (user-facing) ============
export const reportsApi = {
  create: (input: {
    target_type: ReportTargetType;
    target_id: number;
    reason: ReportReason;
    details?: string;
  }) =>
    apiClient
      .post<ApiResource<Report>>("/reports", input)
      .then((r) => r.data.data),
};

// ============ Admin / Staff ============
export type AdminAccountStatus = "active" | "suspended" | "banned";

export interface AdminUserListItem {
  id: number;
  name: string;
  username: string | null;
  email: string;
  avatar: string | null;
  created_at: string;
  locale: string;
  trust_score: number;
  creator_status: string;
  creator_tier: string;
  creator_level: string;
  subscription_tier: "free" | "premium" | "premium_plus" | string;
  account_status: AdminAccountStatus;
  account_status_changed_at: string | null;
  account_status_expires_at: string | null;
  roles: string[];
  reviews_count: number;
  favorites_count: number;
}

export const staffApi = {
  creatorApps: {
    list: (params?: { status?: string; search?: string; page?: number }) =>
      apiClient
        .get<ApiPaginated<CreatorApplication>>("/admin/creator-applications", {
          params,
        })
        .then((r) => r.data),

    get: (id: number) =>
      apiClient
        .get<ApiResource<CreatorApplication>>(`/admin/creator-applications/${id}`)
        .then((r) => r.data.data),

    score: (id: number, scores: {
      quality: number;
      commitment: number;
      professionalism: number;
      fit: number;
    }) =>
      apiClient
        .post<{ score_total: number; can_approve: boolean }>(
          `/admin/creator-applications/${id}/score`,
          scores
        )
        .then((r) => r.data),

    approve: (id: number, notes?: string | null) =>
      apiClient
        .post<ApiResource<CreatorApplication>>(
          `/admin/creator-applications/${id}/approve`,
          { notes: notes ?? null }
        )
        .then((r) => r.data.data),

    reject: (id: number, notes: string) =>
      apiClient
        .post<ApiResource<CreatorApplication>>(
          `/admin/creator-applications/${id}/reject`,
          { notes }
        )
        .then((r) => r.data.data),

    requestChanges: (id: number, notes: string) =>
      apiClient
        .post<ApiResource<CreatorApplication>>(
          `/admin/creator-applications/${id}/request-changes`,
          { notes }
        )
        .then((r) => r.data.data),
  },

  users: {
    list: (params?: {
      search?: string;
      role?: string;
      account_status?: AdminAccountStatus | "";
      page?: number;
    }) =>
      apiClient
        .get<{
          data: AdminUserListItem[];
          meta: { current_page: number; last_page: number; total: number };
        }>("/admin/users", { params })
        .then((r) => r.data),

    get: (id: number) =>
      apiClient
        .get<{ data: Record<string, unknown> }>(`/admin/users/${id}`)
        .then((r) => r.data.data),

    updateRoles: (id: number, role: string, action: "assign" | "remove") =>
      apiClient
        .patch<{ roles: string[]; message: string }>(
          `/admin/users/${id}/roles`,
          { role, action }
        )
        .then((r) => r.data),

    setCreatorTier: (id: number, tier: "none" | "featured") =>
      apiClient
        .patch<{ creator_tier: string; creator_status: string; message: string }>(
          `/admin/users/${id}/creator-tier`,
          { tier }
        )
        .then((r) => r.data),

    /** Nivel económico del creador (fuente del reparto). El badge se deriva del nivel. */
    setCreatorLevel: (id: number, level: "none" | "basic" | "verified" | "featured") =>
      apiClient
        .patch<{
          creator_level: string;
          creator_tier: string;
          revenue_share_pct: number;
          message: string;
        }>(`/admin/users/${id}/creator-tier`, { level })
        .then((r) => r.data),

    setMembership: (id: number, tier: "free" | "premium" | "premium_plus") =>
      apiClient
        .patch<{ subscription_tier: string; message: string }>(
          `/admin/users/${id}/membership`,
          { tier }
        )
        .then((r) => r.data),

    setAccountStatus: (
      id: number,
      input: {
        status: AdminAccountStatus;
        reason: string;
        suspended_until?: string | null;
      }
    ) =>
      apiClient
        .patch<{
          account_status: AdminAccountStatus;
          account_status_reason: string | null;
          account_status_changed_at: string | null;
          account_status_expires_at: string | null;
          account_status_changed_by: { id: number; name: string } | null;
          message: string;
        }>(`/admin/users/${id}/account-status`, input)
        .then((r) => r.data),

    grantCoins: (
      id: number,
      input: { currency: "premium"; amount: number; reason?: string }
    ) =>
      apiClient
        .post<{
          transaction_id: number;
          currency: string;
          amount: number;
          balance_after: number;
          message: string;
        }>(`/admin/users/${id}/coins`, input)
        .then((r) => r.data),
  },

  reports: {
    list: (params?: { status?: string; target_type?: string; reason?: string; page?: number }) =>
      apiClient
        .get<ApiPaginated<Report>>("/admin/reports", { params })
        .then((r) => r.data),

    get: (id: number) =>
      apiClient
        .get<{ data: Report; target: unknown }>(`/admin/reports/${id}`)
        .then((r) => r.data),

    resolve: (id: number, action: string, notes?: string) =>
      apiClient
        .patch<{
          data: Report;
          effect?: { executed: boolean; message: string };
        }>(`/admin/reports/${id}/resolve`, {
          resolution_action: action,
          resolution_notes: notes ?? null,
        })
        .then((r) => r.data),

    dismiss: (id: number, notes?: string) =>
      apiClient
        .patch<ApiResource<Report>>(`/admin/reports/${id}/dismiss`, {
          resolution_notes: notes ?? null,
        })
        .then((r) => r.data.data),
  },

  uploadedWorks: {
    list: (params?: {
      status?: string;
      visibility?: string;
      sort?: "oldest" | "newest" | "title" | "views" | "readers";
      search?: string;
      page?: number;
    }) =>
      apiClient
        .get<ApiPaginated<AdminUploadedWork>>("/admin/uploaded-works", { params })
        .then((r) => r.data),

    get: (id: number) =>
      apiClient
        .get<ApiResource<AdminUploadedWork>>(`/admin/uploaded-works/${id}`)
        .then((r) => r.data.data),

    moderate: (id: number, action: AdminWorkAction) =>
      apiClient
        .patch<{ data: AdminUploadedWork; message: string }>(
          `/admin/uploaded-works/${id}/moderation`,
          { action }
        )
        .then((r) => r.data),

    update: (id: number, input: AdminWorkEditInput) =>
      apiClient
        .patch<{ data: AdminUploadedWork; message: string }>(
          `/admin/uploaded-works/${id}`,
          input
        )
        .then((r) => r.data),

    remove: (id: number) =>
      apiClient.delete(`/admin/uploaded-works/${id}`).then((r) => r.data),
  },
};

// ============ Studio del creador: stats / comentarios / seguidores ============

export interface StudioWorkStats {
  id: number;
  title: string;
  slug: string;
  cover: string | null;
  work_format: "serie" | "libro_completo" | "comic" | null;
  submission_status: string;
  chapters_count: number;
  views: number;
  readings: number;
  favorites: number;
  rating_average: number;
  rating_count: number;
  created_at: string | null;
}

export interface StudioStats {
  totals: {
    works: number;
    published: number;
    drafts: number;
    in_review: number;
    views: number;
    readings: number;
    favorites: number;
    comments: number;
    followers: number;
    rating_average: number;
    rating_count: number;
  };
  works: StudioWorkStats[];
}

export interface StudioComment {
  id: number;
  body: string;
  is_spoiler: boolean;
  is_reply: boolean;
  likes_count: number;
  replies_count: number;
  created_at: string | null;
  user: {
    id: number;
    name: string;
    username: string | null;
    avatar: string | null;
    creator_level: string | null;
  } | null;
  target: {
    type: "book" | "chapter";
    book_title: string | null;
    book_slug: string | null;
    chapter_number: number | null;
    chapter_title: string | null;
  } | null;
}

export interface StudioFollower {
  id: number;
  name: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  creator_level: string | null;
  is_following: boolean;
  followed_at: string | null;
}

export const studioApi = {
  stats: () =>
    apiClient
      .get<{ data: StudioStats }>("/me/creator/stats")
      .then((r) => r.data.data),

  comments: (params?: { work_id?: number; sort?: "newest" | "top"; page?: number }) =>
    apiClient
      .get<{
        data: StudioComment[];
        meta: { current_page: number; last_page: number; total: number };
      }>("/me/creator/comments", { params })
      .then((r) => r.data),

  followers: (page = 1, search = "") =>
    apiClient
      .get<{
        data: StudioFollower[];
        meta: { current_page: number; last_page: number; total: number };
      }>("/me/creator/followers", {
        params: { page, search: search || undefined },
      })
      .then((r) => r.data),

  removeFollower: (userId: number) =>
    apiClient
      .post<{ message: string; followers_count: number }>(
        `/me/creator/followers/${userId}/remove`
      )
      .then((r) => r.data),

  blockFollower: (userId: number) =>
    apiClient
      .post<{ message: string }>(`/me/creator/followers/${userId}/block`)
      .then((r) => r.data),

  unblockFollower: (userId: number) =>
    apiClient
      .delete<{ message: string }>(`/me/creator/followers/${userId}/block`)
      .then((r) => r.data),

  blocked: () =>
    apiClient
      .get<{ data: BlockedUser[] }>("/me/creator/blocked")
      .then((r) => r.data.data),
};

export interface BlockedUser {
  id: number;
  name: string;
  username: string | null;
  avatar: string | null;
  blocked_at: string | null;
}

// ============ Comentarios estilo WEBTOON (obra o capítulo) ============
export interface WebtoonComment {
  id: number;
  body: string;
  is_spoiler: boolean;
  likes_count: number;
  replies_count: number;
  liked_by_me: boolean;
  parent_id: number | null;
  created_at: string;
  user?: {
    id: number;
    name: string;
    username: string | null;
    avatar: string | null;
    is_creator: boolean;
    creator_level: string | null;
    is_premium_plus: boolean;
  };
}

export interface CommentsPage {
  data: WebtoonComment[];
  total: number;
  current_page: number;
  last_page: number;
}

type NewComment = { parent_id?: number | null; is_spoiler?: boolean };

export const commentsApi = {
  listForBook: (slug: string, sort: "top" | "newest" = "top") =>
    apiClient.get<CommentsPage>(`/books/${slug}/comments?sort=${sort}`).then((r) => r.data),
  listForChapter: (chapterId: number, sort: "top" | "newest" = "top") =>
    apiClient.get<CommentsPage>(`/chapters/${chapterId}/comments?sort=${sort}`).then((r) => r.data),
  createForBook: (slug: string, body: string, opts: NewComment = {}) =>
    apiClient
      .post<{ data: WebtoonComment }>(`/books/${slug}/comments`, { body, ...opts })
      .then((r) => r.data.data),
  createForChapter: (chapterId: number, body: string, opts: NewComment = {}) =>
    apiClient
      .post<{ data: WebtoonComment }>(`/chapters/${chapterId}/comments`, { body, ...opts })
      .then((r) => r.data.data),
  replies: (commentId: number) =>
    apiClient.get<{ data: WebtoonComment[] }>(`/comments/${commentId}/replies`).then((r) => r.data.data),
  like: (id: number) =>
    apiClient.post<{ liked: boolean; likes_count: number }>(`/comments/${id}/like`).then((r) => r.data),
  unlike: (id: number) =>
    apiClient.delete<{ liked: boolean; likes_count: number }>(`/comments/${id}/like`).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`/comments/${id}`).then((r) => r.data),
};
