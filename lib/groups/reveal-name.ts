import { sanitizePlainText } from "@/lib/validation/common";

export const REVEAL_NAME_MAX_LENGTH = 80;

export function validateRevealName(value: unknown) {
  const name = sanitizePlainText(value, REVEAL_NAME_MAX_LENGTH).replace(/\s+/g, " ").trim();

  if (!name) return { name: null, error: "Enter your name for the reveal." } as const;
  if (name.includes("@")) return { name: null, error: "Use your name, not an email address." } as const;
  return { name, error: null } as const;
}
