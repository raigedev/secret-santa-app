// @ts-check

const RESERVED_POSTBACK_SECRET_KEYS = new Set([
  "api_key",
  ["api", "key"].join(""),
  "app_secret",
  "auth",
  "authorization",
  "client_secret",
  "cookie",
  "credential",
  "id_token",
  "password",
  "postback_token",
  "refresh_token",
  "secret",
  "service_role",
  "session",
  "signature",
  "sig",
  "token",
  "x_lazada_postback_secret",
  "x_postback_secret",
]);

const RESERVED_POSTBACK_SECRET_FRAGMENTS = [
  "access_token",
  "api-key",
  "api_key",
  "app-secret",
  "app_secret",
  "auth-token",
  "auth_token",
  "credential",
  "password",
  "postback-secret",
  "postback-token",
  "postback_secret",
  "postback_token",
  "refresh_token",
  "secret",
  "signature",
  "x-lazada-postback-secret",
  "x-postback-secret",
];

const RESERVED_POSTBACK_SECRET_COMPACT_FRAGMENTS = [
  ["access", "token"].join(""),
  ["auth", "token"].join(""),
  ["id", "token"].join(""),
  ["postback", "token"].join(""),
  ["refresh", "token"].join(""),
];

/**
 * @param {string} key
 * @returns {string}
 */
function compactPostbackKey(key) {
  let compactKey = "";

  for (const character of key.trim().toLowerCase()) {
    const codePoint = character.codePointAt(0) ?? 0;
    const isDigit = codePoint >= 48 && codePoint <= 57;
    const isLowerAlpha = codePoint >= 97 && codePoint <= 122;

    if (isDigit || isLowerAlpha) {
      compactKey += character;
    }
  }

  return compactKey;
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function isReservedPostbackSecretKey(key) {
  const normalizedKey = key.trim().toLowerCase();
  const compactKey = compactPostbackKey(key);

  return (
    RESERVED_POSTBACK_SECRET_KEYS.has(normalizedKey) ||
    RESERVED_POSTBACK_SECRET_KEYS.has(compactKey) ||
    RESERVED_POSTBACK_SECRET_FRAGMENTS.some((fragment) => normalizedKey.includes(fragment)) ||
    RESERVED_POSTBACK_SECRET_COMPACT_FRAGMENTS.some((fragment) => compactKey.includes(fragment))
  );
}

/**
 * @param {Record<string, string>} payload
 * @returns {Record<string, string>}
 */
export function stripReservedPostbackSecrets(payload) {
  return Object.entries(payload).reduce((sanitizedPayload, [key, value]) => {
    if (isReservedPostbackSecretKey(key)) {
      return sanitizedPayload;
    }

    sanitizedPayload[key] = value;
    return sanitizedPayload;
  }, /** @type {Record<string, string>} */ ({}));
}
