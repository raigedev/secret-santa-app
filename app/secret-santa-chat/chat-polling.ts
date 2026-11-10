export const CHAT_ACTIVE_MESSAGE_POLL_MS = 15_000;
export const CHAT_IDLE_MESSAGE_POLL_MS = 60_000;
export const CHAT_EXCHANGE_POLL_MS = 180_000;
const CHAT_IDLE_GRACE_MS = 60_000;

export function nextChatMessagePollDelay(currentDelay: number, quietForMs: number) {
  return quietForMs < CHAT_IDLE_GRACE_MS
    ? CHAT_ACTIVE_MESSAGE_POLL_MS
    : Math.min(currentDelay * 2, CHAT_IDLE_MESSAGE_POLL_MS);
}
