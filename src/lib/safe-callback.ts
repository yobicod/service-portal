/**
 * Limits post-authentication navigation to an in-app absolute path.
 * Keeping this pure makes the open-redirect boundary straightforward to test.
 */
export function safeCallbackPath(
  callbackUrl: string | null | undefined,
  origin: string,
): string {
  if (
    !callbackUrl ||
    !callbackUrl.startsWith("/") ||
    callbackUrl.startsWith("//") ||
    callbackUrl.startsWith("/\\")
  ) {
    return "/";
  }

  try {
    const destination = new URL(callbackUrl, origin);
    if (destination.origin !== origin) return "/";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}
