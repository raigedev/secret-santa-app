// @ts-check

export const ELIGIBLE_EMAIL_INVITE_STATUSES = ["pending", "accepted"];

/**
 * @param {unknown} status
 * @returns {status is "pending" | "accepted"}
 */
export function isEligibleEmailInviteStatus(status) {
  return typeof status === "string" && ELIGIBLE_EMAIL_INVITE_STATUSES.includes(status);
}
