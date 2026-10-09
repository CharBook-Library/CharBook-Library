export function cacheModeForApiRequest(
  explicit: RequestCache | undefined,
  hasAuth: boolean,
): RequestCache | undefined {
  return explicit ?? (hasAuth ? "no-store" : undefined);
}
