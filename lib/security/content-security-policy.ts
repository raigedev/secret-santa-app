type ContentSecurityPolicyOptions = {
  isDevelopment?: boolean;
  nonce?: string;
  supabaseUrl?: string;
};

function usesLocalSupabaseUrl(supabaseUrl: string): boolean {
  return (
    supabaseUrl.startsWith("http://127.0.0.1:54321") ||
    supabaseUrl.startsWith("http://localhost:54321")
  );
}

export function createContentSecurityPolicyNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  let binaryNonce = "";
  for (const byte of bytes) {
    binaryNonce += String.fromCharCode(byte);
  }

  return btoa(binaryNonce);
}

export function buildContentSecurityPolicy(options: ContentSecurityPolicyOptions = {}): string {
  const isDevelopment = options.isDevelopment ?? process.env.NODE_ENV === "development";
  const nonce = options.nonce?.trim();
  const supabaseUrl = options.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const scriptSource = [
    "script-src",
    "'self'",
    ...(nonce ? [`'nonce-${nonce}'`, "'strict-dynamic'"] : []),
    ...(isDevelopment && !nonce ? ["'unsafe-inline'"] : []),
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
  ].join(" ");
  const connectSource = [
    "connect-src",
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://fonts.googleapis.com",
    ...(isDevelopment || usesLocalSupabaseUrl(supabaseUrl)
      ? [
          "http://127.0.0.1:54321",
          "http://localhost:54321",
          "ws://127.0.0.1:54321",
          "ws://localhost:54321",
        ]
      : []),
  ].join(" ");

  return [
    "default-src 'self'",
    scriptSource,
    // The current UI still uses React style props and inline style blocks.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    connectSource,
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    "media-src 'self'",
    "worker-src 'self' blob:",
  ].join("; ");
}
