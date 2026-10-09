// ============ Tipos del API CharBook Library ============

export interface Author {
  id: number;
  name: string;
  slug: string;
  biography?: string | null;
  photo_url?: string | null;
  birth_year?: number | null;
  death_year?: number | null;
  nationality?: string | null;
  books_count?: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  parent_id?: number | null;
  books_count?: number;
}

/** Versión ligera (listados, carruseles, grid). */
export interface BookListItem {
  id: number;
  title: string;
  slug: string;
  cover: string | null;
  access_type: "free" | "premium";
  language: string;
  publication_year: number | null;
  rating_average: number;
  rating_count: number;
  is_featured: boolean;
  author?: {
    id: number;
    name: string;
    slug: string;
  };
}

/** Versión completa (detalle del libro). */
export interface BookDetail extends BookListItem {
  subtitle: string | null;
  description: string | null;
  synopsis: string | null;
  file_link: string | null;
  file_type: "pdf" | "epub" | "both";
  file_size: number | null;
  price: string | null;
  isbn_10: string | null;
  isbn_13: string | null;
  publisher: string | null;
  pages: number | null;
  views_count: number;
  unique_readers_count?: number;
  total_readings_count?: number;
  downloads_count: number;
  favorites_count: number;
  is_published: boolean;
  created_at: string;
  author: Author;
  categories: Category[];

  // Estado social del usuario actual (null si no auth)
  is_favorited: boolean;
  my_status: ReadingStatus | null;
  my_review: {
    id: number;
    rating: number;
    title: string | null;
    comment: string | null;
  } | null;
  affiliate_links?: AffiliateLink[];
}

// ============ Affiliate ============

export type AffiliateVendor =
  | "amazon"
  | "kobo"
  | "audible"
  | "apple_books"
  | "google_play"
  | "barnes_noble"
  | "other";

export interface AffiliateLink {
  id: number;
  vendor: AffiliateVendor;
  vendor_label: string;
  url: string;
  label: string | null;
  position: number;
  is_active: boolean;
  click_count: number;
  /** Endpoint backend que loguea click + redirige */
  go_url: string;
}

// ============ v3: Creator Applications + Reports + Languages ============

export type Locale = "es" | "en" | "pt" | "fr" | "de" | "it" | "ja";

export interface Language {
  code: Locale;
  name_native: string;
  name_en: string;
  flag_emoji: string;
  is_active: boolean;
  is_ui_supported: boolean;
  sort_order: number;
}

export type CreatorStatus =
  | "none"
  | "pending"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "suspended";

export type CreatorAppStatus =
  | "pending"
  | "changes_requested"
  | "approved"
  | "rejected";

export interface CanApplyResponse {
  can_apply: boolean;
  checks: Record<
    string,
    { label: string; met: boolean; progress: string }
  >;
  cooldown_days_remaining: number | null;
  has_active_application: boolean;
  creator_status: CreatorStatus;
}

export interface CreatorApplication {
  id: number;
  status: CreatorAppStatus;
  display_name: string;
  pen_name: string | null;
  bio_long: string;
  sample_url: string;
  genres: string[];
  languages: string[];
  why_join: string;
  social_links: Record<string, string> | null;
  publish_frequency: string | null;
  publish_plan: string | null;
  score: {
    quality: number | null;
    commitment: number | null;
    professionalism: number | null;
    fit: number | null;
    total: number | null;
    max: 12;
    min_to_approve: 8;
  };
  reviewer_notes: string | null;
  reviewer?: { id: number; name: string; username: string };
  user?: {
    id: number;
    name: string;
    username: string;
    email: string;
    avatar: string | null;
    created_at: string;
    reviews_count: number;
    anthologies_count: number;
    followers_count: number;
    creator_status?: string;
    creator_tier?: string;
    creator_level?: CreatorLevel;
  };
  submitted_at: string;
  reviewed_at: string | null;
}

export type ReportTargetType =
  | "book" | "review" | "comment" | "user" | "salon_post" | "work" | "chapter";

export type ReportReason =
  | "spam" | "abuse" | "copyright" | "illegal"
  | "inappropriate" | "misleading" | "other";

export type ReportStatus = "open" | "in_review" | "resolved" | "dismissed";

export type ReportAction =
  | "none" | "warn" | "hide" | "delete"
  | "suspend_temp" | "suspend_perm" | "ban";

export interface Report {
  id: number;
  target_type: ReportTargetType;
  target_id: number;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolution_action: ReportAction | null;
  resolution_notes: string | null;
  reporter?: {
    id: number; name: string; username: string; avatar: string | null;
  };
  resolver?: { id: number; name: string } | null;
  created_at: string;
  resolved_at: string | null;
}

// ============ Social ============

export interface Review {
  id: number;
  rating: number;
  title: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
  is_mine: boolean;
  /** Verdadero si el espectador es staff (admin/super_admin/moderator). */
  can_delete_as_staff?: boolean;
  user?: {
    id: number;
    name: string;
    username?: string | null;
    avatar: string | null;
    is_creator?: boolean;
    creator_level?: CreatorLevel;
    is_premium_plus?: boolean;
  };
}

// ============ Perfiles / Atelier ============


/** Tier visual del creador para insignias en UI. */
export type CreatorLevel = "none" | "basic" | "verified" | "featured";

/** Tarjeta ligera de un lector (listas de seguidores/seguidos). */
export interface ProfileUserCard {
  id: number;
  name: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  is_following: boolean;
  is_me: boolean;
  creator_level?: CreatorLevel;
}

/** Reseña recortada para el perfil (con libro embebido). */
export interface ProfileReview {
  id: number;
  rating: number;
  title: string | null;
  comment: string | null;
  created_at: string;
  book: BookListItem | null;
}

/** Estado del botón Follow respecto al perfil que estoy viendo. */
export type FollowState = "self" | "following" | "pending" | "none";

/** Perfil público "Atelier" de un lector / creador. */
export interface PublicProfile {
  id: number;
  name: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  member_since: string | null;
  is_public_profile: boolean;
  is_creator: boolean;
  creator_level?: CreatorLevel;
  creator_badge: { label: string; tier: string } | null;
  /** Insignia Premium Plus (H) + banner del perfil avanzado (F). */
  is_premium_plus?: boolean;
  profile_banner?: string | null;
  stats: {
    followers: number;
    following: number;
    favorites: number;
    reviews: number;
    reading: number;
    read: number;
    books_as_creator: number;
  };
  is_me: boolean;
  is_following: boolean;
  has_pending_request: boolean;
  follow_state: FollowState;
  favorite_books: BookListItem[];
  currently_reading: BookListItem[];
  read_books: BookListItem[];
  recent_reviews: ProfileReview[];
  anthologies: AnthologyCard[];
  /** Obras publicadas por este user cuando is_creator. */
  creator_books: BookListItem[];
  /** Widgets del creador agrupados por tipo. */
  creator_widgets?: CreatorWidgetGroups;
}

export interface FollowToggleResponse {
  state: FollowState;
  is_following: boolean;
  followers_count: number;
}

/** Solicitud de seguimiento entrante (perfil privado). */
export interface IncomingFollowRequest {
  id: number;
  requester: {
    id: number;
    name: string;
    username: string | null;
    avatar: string | null;
    bio: string | null;
  };
  requested_at: string | null;
}

// ============ Antologías (listas curatoriales) ============

/** Tarjeta ligera de antología (perfil, listados). */
export interface AnthologyCard {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  is_public: boolean;
  books_count: number;
  updated_at: string | null;
  is_mine: boolean;
  cover_books?: string[];
  owner?: {
    id: number;
    name: string;
    username: string | null;
    avatar: string | null;
  };
}

/** Un libro dentro de una antología (con nota y posición). */
export interface AnthologyBookEntry {
  book: BookListItem;
  note: string | null;
  position: number;
}

/** Antología completa (detalle). */
export interface Anthology {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  is_public: boolean;
  books_count: number;
  created_at: string | null;
  updated_at: string | null;
  is_mine: boolean;
  owner?: {
    id: number;
    name: string;
    username: string | null;
    avatar: string | null;
  };
  books?: AnthologyBookEntry[];
}

// ============ Comunidad: estado de lectura + feed ============

export type ReadingStatus = "want_to_read" | "reading" | "read";

export type ActivityType =
  | "started_reading"
  | "finished_reading"
  | "want_to_read"
  | "reviewed"
  | "favorited";

export interface ActivityActor {
  id: number;
  name: string;
  username: string | null;
  avatar: string | null;
  is_premium_plus?: boolean;
}

export interface Activity {
  id: number;
  type: ActivityType;
  meta: { rating?: number } | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  liked_by_me: boolean;
  shared_by_me: boolean;
  actor?: ActivityActor;
  book?: BookListItem | null;
}

export interface ActivityComment {
  id: number;
  body: string;
  created_at: string;
  is_mine: boolean;
  user?: ActivityActor;
}

export interface LikeToggleResponse {
  liked_by_me: boolean;
  likes_count: number;
}

export interface ShareToggleResponse {
  shared_by_me: boolean;
  shares_count: number;
}

// ============ Wrappers de respuesta del API ============

export interface ApiResource<T> {
  data: T;
}

export interface ApiCollection<T> {
  data: T[];
}

export interface ApiPaginated<T> {
  data: T[];
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
    path: string;
    links: Array<{ url: string | null; label: string; active: boolean }>;
  };
}

// ============ Params ============

export interface BookListParams {
  search?: string;
  category?: string;
  author?: string;
  access_type?: "free" | "premium";
  language?: string;
  sort?: "recent" | "popular" | "rating" | "title";
  page?: number;
  per_page?: number;
}

// ============ Creator Widgets (secciones del perfil de creador) ============

export type CreatorWidgetType =
  | "announcement"
  | "tip"
  | "event"
  | "link"
  | "new_arrival"
  | "featured_cat";

export interface CreatorWidget {
  id: number;
  type: CreatorWidgetType;
  title: string;
  body: string | null;
  url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  position: number;
  book?: {
    id: number;
    title: string;
    slug: string;
    cover: string | null;
  } | null;
  category?: {
    id: number;
    name: string;
    slug: string;
  } | null;
  is_published?: boolean;
}

/** Widgets agrupados por type, como llegan en PublicProfile. */
export type CreatorWidgetGroups = Partial<Record<CreatorWidgetType, CreatorWidget[]>>;

// ============ Obras de creador (autoservicio) ============

export type ContentType =
  | "novela"
  | "cuento"
  | "ensayo"
  | "poesia"
  | "no_ficcion"
  | "experimental";

export type AgeRating = "all" | "teen" | "mature" | "explicit";

export type WorkSubmissionStatus = "draft" | "review" | "published";

export interface MyWork {
  id: number;
  title: string;
  slug: string;
  cover: string | null;
  description: string;
  content_type: ContentType | null;
  language: string;
  age_rating: AgeRating;
  tags: string[];
  copyright_holder: string | null;
  submission_status: WorkSubmissionStatus;
  is_published: boolean;
  views_count: number;
  unique_readers_count?: number;
  total_readings_count?: number;
  favorites_count: number;
  rating_average: number;
  rating_count: number;
  work_format?: "serie" | "libro_completo" | "comic" | null;
  monetization?: WorkMonetization | null;
  in_unlimited_catalog?: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkMonetization {
  free_chapters?: number;
  packs?: number[];
  pack_discount_pct?: Record<string, number>;
}

export interface CreateWorkInput {
  title: string;
  description: string;
  synopsis?: string | null;
  content_type: ContentType;
  language: string;
  age_rating: AgeRating;
  tags?: string[];
  category_ids?: number[];
  copyright_holder: string;
  is_original: boolean;
  /** Obligatorio en el wizard: si la obra se puede descargar (EPUB) o no. */
  allow_download?: boolean;
  cover_url?: string | null;
  submit_for_review?: boolean;
}


// ============ Directorio de creadores ============

export interface CreatorDirectoryEntry {
  id: number;
  name: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  creator_level: CreatorLevel;
  stats: {
    followers: number;
    books: number;
  };
  is_following: boolean;
  is_me: boolean;
}

export interface CreatorsDirectory {
  featured: CreatorDirectoryEntry[];
  verified: CreatorDirectoryEntry[];
  basic: CreatorDirectoryEntry[];
}

export interface CreatorBookCard {
  id: number;
  title: string;
  slug: string;
  cover: string | null;
  access_type: "free" | "premium";
  language: string;
  rating_average: number;
  rating_count: number;
  favorites_count?: number;
  weekly_views?: number;
  is_featured: boolean;
  creator: {
    id: number;
    name: string;
    username: string | null;
    avatar: string | null;
    creator_level: CreatorLevel;
  } | null;
}


// ============ Admin: Obras subidas (moderación) ============

export type AdminWorkAction =
  | "hide" | "unhide" | "review" | "publish"
  | "sensitive" | "unsensitive"
  | "pin" | "unpin"
  | "recommend" | "unrecommend"
  | "trend" | "untrend";

export interface AdminUploadedWork {
  id: number;
  title: string;
  slug: string;
  cover: string | null;
  content_type: ContentType | null;
  language: string;
  age_rating: AgeRating;
  submission_status: WorkSubmissionStatus;
  is_published: boolean;
  is_hidden: boolean;
  is_sensitive: boolean;
  is_pinned: boolean;
  is_recommended: boolean;
  is_trending: boolean;
  is_featured: boolean;
  views_count: number;
  unique_readers_count?: number;
  total_readings_count?: number;
  favorites_count: number;
  rating_average: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
  creator: {
    id: number;
    name: string;
    username: string | null;
    avatar: string | null;
    creator_level: CreatorLevel;
  } | null;
  // Solo en detalle (show)
  description?: string;
  tags?: string[];
  mod_notes?: string | null;
  copyright_holder?: string | null;
  categories?: { id: number; name: string; slug: string }[];
  hidden_at?: string | null;
}

export interface AdminWorkEditInput {
  title?: string;
  description?: string;
  slug?: string;
  cover_url?: string | null;
  language?: string;
  age_rating?: AgeRating;
  tags?: string[];
  category_ids?: number[];
  mod_notes?: string | null;
}

// ============ Capítulos y páginas de cómic ============

export interface Chapter {
  id: number;
  book_id: number;
  number: number;
  title: string;
  body: string | null;
  author_note: string | null;
  position: number;
  schedule_at: string | null;
  is_published: boolean;
  coin_price: number;
  early_access_until: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  cover_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComicPage {
  id: number;
  book_id: number;
  image_url: string | null;
  position: number;
  size: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

// ============ Importador de libros (EPUB/DOCX/TXT → capítulos) ============

export type ChapterImportStatus =
  | "uploaded" | "parsing" | "preview_ready" | "importing" | "done" | "failed" | "canceled";

/** Metadatos de un capítulo detectado en la vista previa. */
export interface ChapterImportPreview {
  order: number;
  title: string;
  word_count: number;
  char_count: number;
  warning: string | null;
}

export interface ChapterImport {
  id: number;
  book_id: number;
  status: ChapterImportStatus;
  source_name: string | null;
  source_ext: string | null;
  source_size: number | null;
  detected: ChapterImportPreview[] | null;
  total: number;
  progress: number;
  created_count: number;
  warning_count: number;
  error_count: number;
  word_count: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
}

// ============ Lectura pública ============

export interface ChapterSummary {
  id: number;
  number: number;
  title: string;
  has_body: boolean;
  has_file: boolean;
  file_type: string | null;
  cover_url?: string | null;
  position: number;
  published_at: string | null;
}

export interface ChapterFull {
  data: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    author_note: string | null;
    file_url: string | null;
    file_type: string | null;
    file_size: number | null;
    /** Páginas de cómic del capítulo (webtoon). Vacío en capítulos de texto/PDF. */
    pages?: ComicPagePublic[];
    published_at: string | null;
  };
  book: {
    id: number;
    title: string;
    slug: string;
    cover: string | null;
    work_format?: "serie" | "libro_completo" | "comic" | null;
    author_note_start: string | null;
    author_note_end: string | null;
    /** No siempre lo devuelve el API; el lector lo usa de forma opcional. */
    author?: { name: string } | null;
  };
  prev: { number: number; title: string } | null;
  next: { number: number; title: string } | null;
}

export interface ComicPagePublic {
  id: number;
  image_url: string | null;
  position: number;
  width: number | null;
  height: number | null;
}

export interface ComicPagesResponse {
  data: ComicPagePublic[];
  book: {
    id: number;
    title: string;
    slug: string;
    work_format: string | null;
    /** Si el cómic es un PDF, su URL para leerlo como webtoon con pdf.js. */
    file_type?: string | null;
    pdf_url?: string | null;
  };
}

// Ampliar BookDetail con campos del wizard
export interface BookDetailExtended extends BookDetail {
  work_format?: "serie" | "libro_completo" | "comic" | null;
  age_rating?: AgeRating;
  tags?: string[];
  author_note_start?: string | null;
  author_note_end?: string | null;
  chapters_count?: number;
  pages_count?: number;
  creator?: {
    id: number;
    name: string;
    username: string | null;
    avatar: string | null;
    creator_level: CreatorLevel;
  } | null;
}

// ============ Notificaciones ============

export type NotificationCategory =
  | "reading" | "comments" | "followers" | "works" | "system" | "monetization";

export interface AppNotification {
  id: number;
  category: NotificationCategory;
  type: string;
  emoji: string | null;
  title: string;
  body: string | null;
  link: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export interface ActivityGroup {
  category: NotificationCategory;
  count: number;
  preview: Array<{
    id: number;
    emoji: string | null;
    title: string;
    created_at: string;
  }>;
}

// ============ Mensajes (bandeja) ============

export type MessageCategory =
  | "review" | "report" | "achievement" | "event" | "tip" | "platform";

export type MessagePriority = "low" | "normal" | "high" | "urgent";

export interface MessageItem {
  id: number;
  category: MessageCategory;
  priority: MessagePriority;
  subject: string;
  preview: string;
  sender_name: string;
  sender_role: string | null;
  is_read: boolean;
  is_important: boolean;
  is_archived: boolean;
  created_at: string;
}

export interface MessageFull extends MessageItem {
  body: string;
  attachments: Array<{ name: string; url: string; size?: number }>;
  actions: Array<{ label: string; href: string; variant?: "primary" | "outline" | "destructive" }>;
  read_at: string | null;
  important_at: string | null;
  archived_at: string | null;
}

export interface MessageCounts {
  all: number;
  unread: number;
  important: number;
  archived: number;
  by_category: Record<string, number>;
}
