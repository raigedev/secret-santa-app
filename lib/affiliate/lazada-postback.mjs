// @ts-check

const RESERVED_POSTBACK_SECRET_KEYS = new Set(["secret", "token"]);

/**
 * @param {Record<string, string>} payload
 * @returns {Record<string, string>}
 */
export function stripReservedPostbackSecrets(payload) {
  return Object.entries(payload).reduce((sanitizedPayload, [key, value]) => {
    if (RESERVED_POSTBACK_SECRET_KEYS.has(key.toLowerCase())) {
      return sanitizedPayload;
    }

    sanitizedPayload[key] = value;
    return sanitizedPayload;
  }, /** @type {Record<string, string>} */ ({}));
}
