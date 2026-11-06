"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

const VISITOR_KEY = "charbook:visitor-id";
const VIEW_PREFIX = "charbook:viewed-book:";
const SESSION_MS = 30 * 60 * 1000;

function createVisitorId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `cb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function getVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;

    const created = createVisitorId();
    window.localStorage.setItem(VISITOR_KEY, created);
    document.cookie = `charbook_visitor_id=${encodeURIComponent(created)}; path=/; max-age=31536000; samesite=lax`;
    return created;
  } catch {
    return createVisitorId();
  }
}

export function BookViewTracker({ slug }: { slug: string }) {
  const router = useRouter();
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current || !slug) return;
    trackedRef.current = true;

    const storageKey = `${VIEW_PREFIX}${slug}`;
    const now = Date.now();

    try {
      const lastTracked = Number(window.localStorage.getItem(storageKey) ?? 0);
      if (lastTracked > 0 && now - lastTracked < SESSION_MS) return;
    } catch {
      // Si storage falla, el backend todavia deduplica por visitante/IP.
    }

    const visitorKey = getVisitorId();

    apiClient
      .post(`/books/${encodeURIComponent(slug)}/view`, { visitor_key: visitorKey })
      .then((response) => {
        try {
          window.localStorage.setItem(storageKey, String(now));
        } catch {
          // No bloquea la lectura.
        }

        if (response.data?.data?.unique_counted) {
          router.refresh();
        }
      })
      .catch(() => {
        trackedRef.current = false;
      });
  }, [router, slug]);

  return null;
}
