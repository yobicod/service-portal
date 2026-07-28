/**
 * Limits post-authentication navigation to an in-app path.
 * Auth.js/proxies may provide either a path or a same-origin absolute URL.
 * Keeping this pure makes the open-redirect boundary straightforward to test.
 */
export function safeCallbackPath(
  callbackUrl: string | null | undefined,
  origin: string,
): string {
  if (!callbackUrl) return "/";

  try {
    if (callbackUrl.startsWith("//") || callbackUrl.startsWith("/\\")) {
      return "/";
    }
    if (
      !callbackUrl.startsWith("/") &&
      !/^https?:\/\//i.test(callbackUrl)
    ) {
      return "/";
    }
    const destination = new URL(callbackUrl, origin);
    const expectedOrigin = new URL(origin).origin;
    if (!callbackUrl.startsWith("/") && destination.origin !== expectedOrigin) {
      return "/";
    }
    if (destination.origin !== expectedOrigin) return "/";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}
