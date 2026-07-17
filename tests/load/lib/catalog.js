import { check } from "k6";
import { BASE_URL, getJson } from "./config.js";

export function setupCatalog() {
  const health = getJson("/api/health", "health");
  check(health, {
    "health confirma base disponible": (result) => result.json("db") === "ok",
  });

  const catalog = getJson("/api/books?per_page=12&sort=recent", "catalog_setup");
  const slug = catalog.json("data.0.slug");
  if (!slug) {
    throw new Error(`No hay libros loadtest disponibles en ${BASE_URL}. Ejecuta el seeder primero.`);
  }

  return { slug };
}
