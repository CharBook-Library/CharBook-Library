import { type NextRequest } from "next/server";
import { isAllowedFileTarget } from "@/lib/server/file-proxy-policy";

/**
 * Same-origin byte proxy used by PDF.js. The Laravel API remains responsible
 * for authorization; this handler only accepts its known file endpoints.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u");
  if (!raw) return new Response("Missing url", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("Bad url", { status: 400 });
  }

  if (!isAllowedFileTarget(target, API_URL, process.env.FILE_PROXY_ALLOWED_ORIGINS)) {
    return new Response("Target not allowed", { status: 403 });
  }

  const range = req.headers.get("range");
  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: range ? { Range: range } : {},
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(65_000),
    });
  } catch {
    return new Response("Upstream fetch failed", { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response("Upstream error", { status: upstream.status });
  }

  const headers = new Headers();
  for (const header of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ]) {
    const value = upstream.headers.get(header);
    if (value) headers.set(header, value);
  }

  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");

  return new Response(upstream.body, { status: upstream.status, headers });
}
