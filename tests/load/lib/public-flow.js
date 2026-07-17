import { group, sleep } from "k6";
import { getJson, postJson } from "./config.js";

export function publicReading(data) {
  group("lectura pública", () => {
    const page = (__ITER % 10) + 1;
    getJson(`/api/books?per_page=12&page=${page}`, "catalog_public");
    getJson(`/api/books/${data.slug}`, "book_detail_public");
    getJson(`/api/books/${data.slug}/chapters`, "chapters_public");
    getJson(`/api/books/${data.slug}/chapters/1`, "chapter_public");
    getJson(`/api/books/${data.slug}/reviews`, "reviews_public");
    getJson(`/api/books/${data.slug}/comments`, "comments_public");
    postJson(
      `/api/books/${data.slug}/view`,
      { visitor_key: `k6-public-${__VU}` },
      "view_public",
    );
  });

  sleep(Number(__ENV.THINK_TIME || 1));
}
