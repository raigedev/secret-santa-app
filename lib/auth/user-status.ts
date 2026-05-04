type AuthLikeUser = {
  app_metadata?: {
    provider?: string;
    providers?: string[];
  } | null;
  confirmed_at?: string | null;
  email?: string | null;
  email_confirmed_at?: string | null;
} | null | undefined;

function requiresEmailVerification(user: AuthLikeUser): boolean {
  if (!user?.email) {
    return false;
  }

  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata?.providers
    : [];
  const primaryProvider = user.app_metadata?.provider;

  return primaryProvider === "email" || providers.includes("email");
}

export function isUserEmailVerified(user: AuthLikeUser): boolean {
  if (!user) {
    return false;
  }

  if (!requiresEmailVerification(user)) {
    return true;
  }

  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

export function getEmailVerificationMessage(): string {
  return "Please confirm your email address before opening the app.";
}
