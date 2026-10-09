const BOOK_FILE_PATH = /^\/api\/books\/[^/]+\/file-proxy(?:-signed)?$/;
const CHAPTER_FILE_PATH = /^\/api\/chapters\/\d+\/file-proxy$/;

function normalizedOrigin(raw: string): string | null {
  try {
    const url = new URL(raw);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function additionalOrigins(raw: string | undefined): Set<string> {
  const origins = new Set<string>();

  for (const candidate of raw?.split(",") ?? []) {
    const origin = normalizedOrigin(candidate.trim());
    if (origin?.startsWith("https://")) origins.add(origin);
  }

  return origins;
}

/**
 * Restricts the server-side proxy to file endpoints owned by the configured API.
 * Extra origins are exact HTTPS origins, never wildcard host suffixes.
 */
export function isAllowedFileTarget(
  target: URL,
  apiUrl: string,
  configuredAdditionalOrigins?: string,
): boolean {
  if (
    (target.protocol !== "http:" && target.protocol !== "https:") ||
    target.username ||
    target.password ||
    target.hash
  ) {
    return false;
  }

  const apiOrigin = normalizedOrigin(apiUrl);
  if (apiOrigin && target.origin === apiOrigin) {
    return BOOK_FILE_PATH.test(target.pathname) || CHAPTER_FILE_PATH.test(target.pathname);
  }

  return additionalOrigins(configuredAdditionalOrigins).has(target.origin);
}
