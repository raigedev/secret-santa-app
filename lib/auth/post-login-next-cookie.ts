const POST_LOGIN_NEXT_COOKIE_NAME = "post_login_next";

export function buildPostLoginNextCookie(
  nextPath: string,
  maxAgeSeconds: number,
  isHttps: boolean
): string {
  const secureAttribute = isHttps ? "; Secure" : "";

  return `${POST_LOGIN_NEXT_COOKIE_NAME}=${encodeURIComponent(
    nextPath
  )}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secureAttribute}`;
}
