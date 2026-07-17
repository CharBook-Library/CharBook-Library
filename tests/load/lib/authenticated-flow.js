import { group, sleep } from "k6";
import { getJson, postJson } from "./config.js";
import { tokenForVu } from "./tokens.js";

export function authenticatedReading(data) {
  const token = tokenForVu();

  group("lectura autenticada", () => {
    getJson("/api/user", "current_user", token);
    getJson("/api/me/favorites", "favorites_authenticated", token);
    getJson("/api/me/shelf", "shelf_authenticated", token);
    getJson("/api/feed?scope=discover", "feed_authenticated", token);
    getJson(`/api/books/${data.slug}/chapters/1`, "chapter_authenticated", token);
    postJson(
      `/api/books/${data.slug}/view`,
      {},
      "view_authenticated",
      token,
    );
  });

  sleep(Number(__ENV.THINK_TIME || 1));
}
