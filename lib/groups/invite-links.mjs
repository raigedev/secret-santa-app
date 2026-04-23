// @ts-check

export const GROUP_INVITE_LINK_TTL_DAYS = 7;
export const GROUP_INVITE_LINK_TTL_MS = GROUP_INVITE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * @param {Date} [createdAt]
 * @returns {string}
 */
export function buildInviteLinkExpiresAt(createdAt = new Date()) {
  return new Date(createdAt.getTime() + GROUP_INVITE_LINK_TTL_MS).toISOString();
}
