"use client";

import { useEffect } from "react";
import { apiClient } from "@/lib/api-client";

const PING_INTERVAL_MS = 60_000;
const STORAGE_KEY = "cb_visitor_key";

function getVisitorKey(): string {
  try {
    let key = localStorage.getItem(STORAGE_KEY);
    if (!key) {
      key =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEY, key);
    }
    return key;
  } catch {
    return "anon";
  }
}

/**
 * Heartbeat de presencia: mientras la pestaña está visible manda un ping
 * cada 60 s a /presence/ping. Con sesión → actualiza users.last_seen_at;
 * sin sesión → cuenta como visitante anónimo. Alimenta el contador de
 * "usuarios online" del panel de salud del sistema.
 */
export function PresencePing() {
  useEffect(() => {
    let stopped = false;

    const ping = () => {
      if (stopped || document.visibilityState !== "visible") return;
      apiClient
        .post("/presence/ping", { visitor_key: getVisitorKey() })
        .catch(() => {
          // Best-effort: la presencia nunca debe molestar al usuario.
        });
    };

    ping();
    const interval = setInterval(ping, PING_INTERVAL_MS);

    // Al volver a la pestaña, ping inmediato para reflejar presencia al momento.
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
