// @ts-check

/**
 * @typedef {{
 *   email?: string | null;
 *   status?: string | null;
 *   user_id?: string | null;
 * }} InviteMembership
 */

/**
 * @param {string | null | undefined} email
 * @returns {string}
 */
function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

/**
 * Returns whether the group already contains a declined invite that can be resent.
 *
 * @param {InviteMembership[] | null | undefined} memberships
 * @param {{ email: string; existingUserId: string | null }} options
 * @returns {boolean}
 */
export function hasDeclinedInviteResendTarget(memberships, options) {
  const normalizedEmail = normalizeEmail(options.email);

  return (memberships || []).some((membership) => {
    if (membership.status !== "declined") {
      return false;
    }

    if (normalizeEmail(membership.email) === normalizedEmail) {
      return true;
    }

    return Boolean(options.existingUserId) && membership.user_id === options.existingUserId;
  });
}
