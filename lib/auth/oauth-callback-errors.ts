const OAUTH_CALLBACK_ERROR_PARAM_NAMES = [
  "error",
  "error_code",
  "error_description",
] as const;

export const OAUTH_CALLBACK_FAILED_ERROR = "oauth_callback_failed";

export function hasOAuthCallbackError(searchParams: URLSearchParams): boolean {
  return (
    searchParams.has("error") &&
    (searchParams.has("error_code") || searchParams.has("error_description"))
  );
}

export function createOAuthCallbackErrorLoginUrl(origin: string | URL): URL {
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", OAUTH_CALLBACK_FAILED_ERROR);
  return loginUrl;
}

export function getOAuthCallbackErrorDetails(searchParams: URLSearchParams): string {
  return OAUTH_CALLBACK_ERROR_PARAM_NAMES.map((name) => {
    const value = searchParams.get(name)?.trim();
    return value ? `${name}=${value}` : null;
  })
    .filter(Boolean)
    .join("; ");
}
