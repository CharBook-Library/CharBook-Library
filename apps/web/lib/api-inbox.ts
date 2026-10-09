"use client";

import { apiClient } from "./api-client";
import type {
  ActivityGroup,
  AppNotification,
  MessageCounts,
  MessageFull,
  MessageItem,
  NotificationCategory,
} from "./types";

interface Paginated<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    unread_total?: number;
    important_total?: number;
  };
}

export const notificationsApi = {
  list: (params?: { category?: string; unread_only?: boolean; page?: number }) =>
    apiClient
      .get<Paginated<AppNotification>>("/me/notifications", { params })
      .then((r) => r.data),

  unreadCount: () =>
    apiClient.get<{ count: number }>("/me/notifications/unread-count").then((r) => r.data.count),

  activity: () =>
    apiClient
      .get<{ today: ActivityGroup[]; this_week: ActivityGroup[] }>("/me/notifications/activity")
      .then((r) => r.data),

  markRead: (id: number) =>
    apiClient.patch<{ data: AppNotification }>(`/me/notifications/${id}/read`).then((r) => r.data.data),

  readAll: () =>
    apiClient.post<{ message: string }>("/me/notifications/read-all").then((r) => r.data),

  remove: (id: number) =>
    apiClient.delete(`/me/notifications/${id}`).then((r) => r.data),

  /** Borra una selección de notificaciones (ids) del usuario. */
  removeBulk: (ids: number[]) =>
    apiClient
      .delete<{ message: string; deleted: number }>("/me/notifications/bulk", { data: { ids } })
      .then((r) => r.data),

  /** Borra TODAS las notificaciones del usuario. */
  removeAll: () =>
    apiClient
      .delete<{ message: string; deleted: number }>("/me/notifications/bulk", { data: { all: true } })
      .then((r) => r.data),
};

export const messagesApi = {
  list: (params?: { category?: string; view?: string; search?: string; page?: number }) =>
    apiClient.get<Paginated<MessageItem>>("/me/messages", { params }).then((r) => r.data),

  counts: () => apiClient.get<MessageCounts>("/me/messages/counts").then((r) => r.data),

  readAll: () =>
    apiClient.post<{ message: string; updated: number }>("/me/messages/read-all").then((r) => r.data),

  get: (id: number) =>
    apiClient.get<{ data: MessageFull }>(`/me/messages/${id}`).then((r) => r.data.data),

  action: (
    id: number,
    action: "read" | "unread" | "important" | "unimportant" | "archive" | "unarchive"
  ) =>
    apiClient
      .patch<{ data: MessageItem }>(`/me/messages/${id}`, { action })
      .then((r) => r.data.data),

  remove: (id: number) => apiClient.delete(`/me/messages/${id}`).then((r) => r.data),
};

export interface AdminUserHit {
  id: number;
  name: string;
  username?: string | null;
  email?: string | null;
  avatar?: string | null;
}

export const adminBroadcastApi = {
  notification: (input: {
    emoji?: string; title: string; body?: string; link?: string;
    category?: string;
    target?: "all" | "creators" | "verified" | "featured" | "user";
    user_id?: number;
  }) =>
    apiClient
      .post<{ message: string; sent_count: number }>("/admin/broadcast/notification", input)
      .then((r) => r.data),

  message: (input: {
    category: string; priority?: string; subject: string; body: string;
    sender_name?: string;
    target?: "all" | "creators" | "verified" | "featured" | "user";
    user_id?: number;
  }) =>
    apiClient
      .post<{ message: string; sent_count: number }>("/admin/broadcast/message", input)
      .then((r) => r.data),

  searchUsers: (q: string) =>
    apiClient
      .get<{ data: AdminUserHit[] }>("/admin/users/search", { params: { q } })
      .then((r) => r.data.data),
};
