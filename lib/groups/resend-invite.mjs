// @ts-check

/**
 * @param {string | null | undefined} status
 * @returns {boolean}
 */
export function isInviteStatusEligibleForResend(status) {
  return status === "pending" || status === "declined";
}

/**
 * @param {{
 *   email_confirmed_at?: string | null;
 *   invited_at?: string | null;
 *   last_sign_in_at?: string | null;
 * } | null | undefined} user
 * @returns {boolean}
 */
export function canReceiveResentAuthInvite(user) {
  return Boolean(user?.invited_at && !user.email_confirmed_at && !user.last_sign_in_at);
}
