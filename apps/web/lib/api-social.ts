"use client";

import { apiClient } from "./api-client";
import type {
  Activity,
  ActivityComment,
  Anthology,
  AnthologyCard,
  ApiCollection,
  ApiPaginated,
  ApiResource,
  BookListItem,
  FollowToggleResponse,
  IncomingFollowRequest,
  LikeToggleResponse,
  ProfileUserCard,
  PublicProfile,
  ReadingStatus,
  Review,
  ShareToggleResponse,
} from "./types";

interface ProfileUpdateInput {
  username?: string;
  bio?: string | null;
  is_public_profile?: boolean;
}

interface AnthologyInput {
  title?: string;
  description?: string | null;
  is_public?: boolean;
}

interface ReviewUpsertInput {
  rating: number;
  title?: string | null;
  comment?: string | null;
}

interface FavoriteToggleResponse {
  is_favorited: boolean;
  favorites_count: number;
}

export const socialApi = {
  // ===== Favoritos =====
  favorites: {
    toggle: (slug: string) =>
      apiClient
        .post<FavoriteToggleResponse>(`/books/${slug}/favorite`)
        .then((r) => r.data),

    mine: (page = 1) =>
      apiClient
        .get<ApiPaginated<BookListItem>>("/me/favorites", { params: { page } })
        .then((r) => r.data),
  },

  // ===== Reviews =====
  reviews: {
    list: (slug: string, page = 1) =>
      apiClient
        .get<ApiPaginated<Review>>(`/books/${slug}/reviews`, { params: { page } })
        .then((r) => r.data),

    upsert: (slug: string, input: ReviewUpsertInput) =>
      apiClient
        .post<ApiResource<Review>>(`/books/${slug}/reviews`, input)
        .then((r) => r.data.data),

    deleteMine: (slug: string) =>
      apiClient
        .delete(`/books/${slug}/reviews/me`)
        .then((r) => r.data),

    mine: (page = 1) =>
      apiClient
        .get<ApiCollection<Review>>("/me/reviews", { params: { page } })
        .then((r) => r.data),
  },

  // ===== Perfiles / Atelier =====
  profiles: {
    get: (username: string) =>
      apiClient
        .get<ApiResource<PublicProfile> & { meta: { is_private: boolean } }>(
          `/users/${username}`
        )
        .then((r) => r.data),

    updateMine: (input: ProfileUpdateInput) =>
      apiClient
        .patch<ApiResource<PublicProfile>>("/me/profile", input)
        .then((r) => r.data.data),

    followers: (username: string, page = 1) =>
      apiClient
        .get<ApiPaginated<ProfileUserCard>>(`/users/${username}/followers`, {
          params: { page },
        })
        .then((r) => r.data),

    following: (username: string, page = 1) =>
      apiClient
        .get<ApiPaginated<ProfileUserCard>>(`/users/${username}/following`, {
          params: { page },
        })
        .then((r) => r.data),
  },

  // ===== Seguir lectores =====
  follows: {
    toggle: (username: string) =>
      apiClient
        .post<FollowToggleResponse>(`/users/${username}/follow`)
        .then((r) => r.data),
  },

  // ===== Solicitudes de follow (perfiles privados) =====
  followRequests: {
    incoming: (page = 1) =>
      apiClient
        .get<ApiPaginated<IncomingFollowRequest>>("/me/follow-requests", {
          params: { page },
        })
        .then((r) => r.data),

    count: () =>
      apiClient
        .get<{ count: number }>("/me/follow-requests/count")
        .then((r) => r.data.count),

    accept: (id: number) =>
      apiClient
        .post<{ message: string; request_id: number }>(
          `/me/follow-requests/${id}/accept`
        )
        .then((r) => r.data),

    reject: (id: number) =>
      apiClient
        .post<{ message: string; request_id: number }>(
          `/me/follow-requests/${id}/reject`
        )
        .then((r) => r.data),
  },

  // ===== Estado de lectura (estantes) =====
  readingStatus: {
    set: (slug: string, status: ReadingStatus) =>
      apiClient
        .put<{ status: ReadingStatus }>(`/books/${slug}/status`, { status })
        .then((r) => r.data),

    remove: (slug: string) =>
      apiClient
        .delete<{ status: null }>(`/books/${slug}/status`)
        .then((r) => r.data),

    mine: (status?: ReadingStatus, page = 1) =>
      apiClient
        .get<ApiPaginated<BookListItem>>("/me/shelf", {
          params: { status, page },
        })
        .then((r) => r.data),
  },

  // ===== Feed de actividad =====
  feed: {
    index: (scope: "following" | "discover" = "following", page = 1) =>
      apiClient
        .get<ApiPaginated<Activity>>("/feed", { params: { scope, page } })
        .then((r) => r.data),
  },

  // ===== Reacciones a actividades =====
  activities: {
    like: (id: number) =>
      apiClient
        .post<LikeToggleResponse>(`/activities/${id}/like`)
        .then((r) => r.data),

    share: (id: number) =>
      apiClient
        .post<ShareToggleResponse>(`/activities/${id}/share`)
        .then((r) => r.data),

    comments: (id: number, page = 1) =>
      apiClient
        .get<ApiPaginated<ActivityComment>>(`/activities/${id}/comments`, {
          params: { page },
        })
        .then((r) => r.data),

    comment: (id: number, body: string) =>
      apiClient
        .post<ApiResource<ActivityComment>>(`/activities/${id}/comments`, { body })
        .then((r) => r.data.data),

    deleteComment: (id: number, commentId: number) =>
      apiClient
        .delete(`/activities/${id}/comments/${commentId}`)
        .then((r) => r.data),
  },

  // ===== Búsqueda de lectores =====
  readers: {
    search: (q: string) =>
      apiClient
        .get<ApiCollection<ProfileUserCard>>("/users/search", { params: { q } })
        .then((r) => r.data.data),
  },

  // ===== Antologías =====
  anthologies: {
    mine: () =>
      apiClient
        .get<ApiCollection<AnthologyCard>>("/me/anthologies")
        .then((r) => r.data.data),

    byUser: (username: string) =>
      apiClient
        .get<ApiCollection<AnthologyCard>>(`/users/${username}/anthologies`)
        .then((r) => r.data.data),

    get: (slug: string) =>
      apiClient
        .get<ApiResource<Anthology>>(`/anthologies/${slug}`)
        .then((r) => r.data.data),

    create: (input: AnthologyInput) =>
      apiClient
        .post<ApiResource<Anthology>>("/anthologies", input)
        .then((r) => r.data.data),

    update: (slug: string, input: AnthologyInput) =>
      apiClient
        .patch<ApiResource<Anthology>>(`/anthologies/${slug}`, input)
        .then((r) => r.data.data),

    remove: (slug: string) =>
      apiClient.delete(`/anthologies/${slug}`).then((r) => r.data),

    addBook: (slug: string, bookId: number, note?: string | null) =>
      apiClient
        .post<ApiResource<Anthology>>(`/anthologies/${slug}/books`, {
          book_id: bookId,
          note: note ?? null,
        })
        .then((r) => r.data.data),

    removeBook: (slug: string, bookSlug: string) =>
      apiClient
        .delete<ApiResource<Anthology>>(`/anthologies/${slug}/books/${bookSlug}`)
        .then((r) => r.data.data),
  },
};
